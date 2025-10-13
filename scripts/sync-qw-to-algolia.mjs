#!/usr/bin/env node
// Sync selected QuoteWerks DocumentItems back to Algolia (sample PN mode)
// - Reads from dbo.DocumentItems (+ DocumentItems_Extension if exists)
// - Maps core + rich fields to Algolia schema
// - Builds full URLs for image/spec using R2 base vars

import 'dotenv/config';
import sql from 'mssql';
import algoliasearch from 'algoliasearch';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { loadLocalEnvFallback } from '../rules-engine/scripts/_env-fallback.mjs';

loadLocalEnvFallback();

function parseArgs(){
  const args = {};
  for (const a of process.argv.slice(2)){
    const [k, ...rest] = a.replace(/^--/,'').split('=');
    args[k] = rest.join('=') || true;
  }
  return args;
}

function joinUrl(base, file){
  if (!file) return null;
  const b = (base || '').replace(/\/$/, '');
  const f = String(file).replace(/^\//,'');
  // Avoid double-encoding spaces; assume base already encodes folders
  return `${b}/${encodeURIComponent(f).replace(/%2F/g,'/')}`;
}

async function connectSQL(){
  const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DB,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt:false, trustServerCertificate:true }
  };
  const pool = new sql.ConnectionPool(config);
  return pool.connect();
}

async function connectAlgolia(){
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
  const indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';
  if (!appId || !apiKey) throw new Error('Missing ALGOLIA_APP_ID/API_KEY');
  const client = algoliasearch(appId, apiKey);
  const index = client.initIndex(indexName);
  return { client, index, indexName };
}

async function tableColumns(pool, table){
  const rs = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}'`);
  return new Set(rs.recordset.map(r=> r.COLUMN_NAME));
}

function mapToAlgolia(doc, ext){
  const R2I = process.env.R2_IMAGES_BASE || process.env.R2_BASE || '';
  const R2S = process.env.R2_SPECS_BASE || process.env.R2_BASE || '';
  const pn = doc.ManufacturerPartNumber || doc.ManufacturerPartNo || doc.objectID;
  const imageUrl = ext?.ImageURL || (doc.PictureFileName ? joinUrl(process.env.R2_IMAGES_BASE, doc.PictureFileName) : (doc.PictureFile ? joinUrl(process.env.R2_IMAGES_BASE, doc.PictureFile) : null));
  const datasheetUrl = ext?.DatasheetURL || (doc.SpecSheetFile ? joinUrl(process.env.R2_SPECS_BASE, doc.SpecSheetFile) : (doc.CustomText03 ? joinUrl(process.env.R2_SPECS_BASE, doc.CustomText03) : null));

  const record = {
    objectID: pn,
    part_number: pn,
    name: doc.Description || null,
    brand: doc.Manufacturer || null,
    category: doc.CustomText01 || null,
    tags: (doc.CustomText04 && String(doc.CustomText04).split(',').map(s=>s.trim()).filter(Boolean)) || undefined,
    image: imageUrl || null,
    spec_sheet: datasheetUrl || null,
    media: {
      image: imageUrl || null,
      datasheet: datasheetUrl || null
    },
    short_description: doc.CustomMemo01 || null,
    long_description: doc.CustomMemo02 || null,
    datasheet_text: doc.CustomMemo06 || null,
    ai_description: ext?.AIDescription || doc.CustomMemo03 || null,
    ai_marketing: ext?.MarketingDescription || doc.CustomMemo04 || null,
    ai_specs_table: ext?.AISpecs || doc.CustomMemo05 || null,
    visibility: ext?.Visibility || doc.CustomText08 || null,
    in_stock: typeof ext?.StockStatus === 'number' ? Boolean(ext.StockStatus) : undefined,
    backorders_allowed: typeof ext?.BackorderStatus === 'number' ? Boolean(ext.BackorderStatus) : undefined,
    fx: { usd_to_egp_rate: (typeof ext?.FXRate === 'number' ? ext.FXRate : (doc.CustomNumber04 ?? undefined)) }
  };
  return record;
}

async function main(){
  const ARGS = parseArgs();
  const PN_LIST = (ARGS.pn || '').toString().split(',').map(s=>s.trim()).filter(Boolean);
  if (!PN_LIST.length){
    console.error('Usage: node scripts/sync-qw-to-algolia.mjs --pn=PN1,PN2');
    process.exit(1);
  }

  const pool = await connectSQL();
  const colsDoc = await tableColumns(pool, 'DocumentItems');
  const hasPartNo = colsDoc.has('ManufacturerPartNo');
  const pnCol = colsDoc.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber' : (hasPartNo ? 'ManufacturerPartNo' : null);
  if (!pnCol){ console.error('No PN column in DocumentItems'); process.exit(2); }

  const hasExt = (await tableColumns(pool, 'DocumentItems_Extension')).size > 0;
  const out = [];
  for (const pn of PN_LIST){
    const docRs = await pool.request().input('pn', sql.NVarChar(255), pn).query(`SELECT TOP 1 * FROM dbo.DocumentItems WHERE ${pnCol}=@pn`);
    if (!docRs.recordset.length){
      console.log(chalk.yellow(`${pn} → no DocumentItems row`));
      continue;
    }
    const doc = docRs.recordset[0];
    let ext = null;
    if (hasExt && doc.ID != null){
      const extRs = await pool.request().input('id', sql.Int, doc.ID).query('SELECT TOP 1 * FROM dbo.DocumentItems_Extension WHERE ItemID=@id');
      ext = extRs.recordset[0] || null;
    }
    out.push(mapToAlgolia(doc, ext));
  }
  await pool.close();

  if (!out.length){ console.log('No records to update'); return; }

  const { index, indexName } = await connectAlgolia();
  // Write to Algolia using partial updates to avoid overwriting unrelated fields
  const res = await index.partialUpdateObjects(out.map(o => ({ ...o, objectID: o.objectID })), { createIfNotExists: true });
  console.log(chalk.green(`Pushed ${out.length} records to Algolia index ${indexName}`));

  // Fetch back to verify key fields
  const verify = await index.getObjects(out.map(o=>o.objectID));
  const view = (verify.results||[]).map(r => ({ objectID: r?.objectID, image: r?.image, spec_sheet: r?.spec_sheet, name: r?.name, brand: r?.brand }));
  console.log(JSON.stringify({ ok:true, updated: out.length, verify: view }, null, 2));
}

main().catch(e=>{ console.error('sync-qw-to-algolia failed', e); process.exit(1); });
