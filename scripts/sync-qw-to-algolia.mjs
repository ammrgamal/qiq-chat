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
  const base = (s)=> (s||'').replace(/\/$/, '');
  const R2_BASE = process.env.R2_BASE || '';
  const R2I = base(process.env.R2_IMAGES_BASE) || (R2_BASE ? base(R2_BASE) + '/Picture file' : '');
  const R2S = base(process.env.R2_SPECS_BASE) || (R2_BASE ? base(R2_BASE) + '/specs/specs sheet' : '');
  const pn = doc.ManufacturerPartNumber || doc.ManufacturerPartNo || doc.objectID;
  // Prefer PictureFile (per mapping), fallback to PictureFileName
  const imgFile = doc.PictureFile || doc.PictureFileName || null;
  const specFile = doc.SpecSheetFile || doc.CustomText03 || null;
  const imageUrl = (imgFile ? joinUrl(R2I, imgFile) : null) || ext?.ImageURL || null;
  const datasheetUrl = (specFile ? joinUrl(R2S, specFile) : null) || ext?.DatasheetURL || null;

  const record = {
    objectID: pn,
    part_number: pn,
    name: doc.Description || null,
    brand: doc.Manufacturer || null,
    category: doc.ItemType || doc.CustomText01 || null,
    price: (typeof doc.UnitPrice === 'number' ? doc.UnitPrice : undefined),
    currency: doc.BaseCurrency || doc.Currency || undefined,
    // Tags per master mapping: CustomMemo04
    tags: (doc.CustomMemo04 && String(doc.CustomMemo04).split(',').map(s=>s.trim()).filter(Boolean)) || undefined,
    synonyms: (doc.CustomText09 && String(doc.CustomText09).split(',').map(s=>s.trim()).filter(Boolean)) || undefined,
    seo_title: doc.CustomText12 || undefined,
    seo_description: doc.CustomText13 || undefined,
    image: imageUrl || null,
    spec_sheet: datasheetUrl || null,
    media: {
      image: imageUrl || null,
      datasheet: datasheetUrl || null
    },
    short_description: doc.CustomMemo01 || null,
    long_description: doc.CustomMemo02 || null,
    // specs_table prioritizes extension.SpecsTable; fallback to CustomMemo03 if holds JSON
    specs_table: ext?.SpecsTable || undefined,
    datasheet_text: doc.CustomMemo06 || null,
    // Rules Engine per master mapping
    rule_tag: doc.CustomMemo05 || undefined,
    required_questions: doc.CustomText14 || undefined,
    bundle_options: doc.CustomText04 || undefined,
    boq_template_id: doc.CustomText05 || undefined,
    preferred_display: doc.CustomText06 || undefined,
    // AI/Rich content (keep existing extension fields if available)
    ai_description: ext?.AIDescription || undefined,
    ai_marketing: ext?.MarketingDescription || undefined,
    ai_specs_table: ext?.AISpecs || undefined,
    visibility: ext?.Visibility || undefined,
    // Relations
    related_products: doc.CustomText08 || undefined,
    upsell_products: ext?.UpsellProducts || doc.CustomText15 || undefined,
    cross_sell_products: ext?.CrossSellProducts || doc.CustomText16 || undefined,
    options: doc.CustomText17 || undefined,
    service_attachments: doc.CustomText18 || undefined,
    // Business Value
    purchase_pitch: doc.Notes || undefined,
    value_proposition: doc.CustomText19 || undefined,
    benefits: ext?.Benefits || doc.CustomText20 || undefined,
    target_audience: (typeof doc.CustomNumber01 === 'number' ? doc.CustomNumber01 : undefined),
    competitive_advantage: ext?.CompetitiveAdvantage || undefined,
    deployment_scenarios: ext?.DeploymentScenarios || (typeof doc.CustomNumber02 === 'number' ? doc.CustomNumber02 : undefined),
    integration: ext?.Integration || (typeof doc.CustomNumber03 === 'number' ? doc.CustomNumber03 : undefined),
    roi_statement: ext?.ROIStatement || undefined,
    prerequisites: ext?.Prerequisites || undefined,
    // Operational
    lifecycle_status: (typeof doc.CustomNumber05 === 'number' ? doc.CustomNumber05 : undefined),
    compliance: ext?.Compliance || doc.CustomDate01 || undefined,
    warranty: ext?.Warranty || doc.CustomDate02 || undefined,
    lead_time: ext?.LeadTime || doc.CustomText02 || undefined,
    // Diagrams (prefer extension to avoid conflicts with CustomMemo03 used by specs_table)
    ascii_hld: ext?.AsciiHLD || undefined,
    ascii_lld: ext?.AsciiLLD || undefined,
    diagram_params: ext?.DiagramParams || undefined,
    diagram_policy: ext?.DiagramPolicy || undefined,
    // Meta
    source: doc.Vendor || undefined,
    updated_at: doc.OrderDate || undefined,
    revision: doc.SONumber || undefined,
    quality_score: (typeof doc.CloseProbability === 'number' ? doc.CloseProbability : undefined),
    in_stock: typeof ext?.StockStatus === 'number' ? Boolean(ext.StockStatus) : undefined,
    backorders_allowed: typeof ext?.BackorderStatus === 'number' ? Boolean(ext.BackorderStatus) : undefined,
    fx: { usd_to_egp_rate: (typeof ext?.FXRate === 'number' ? ext.FXRate : (doc.CustomNumber04 ?? undefined)) }
  };
  return record;
}

async function main(){
  const ARGS = parseArgs();
  const PN_LIST = (ARGS.pn || '').toString().split(',').map(s=>s.trim()).filter(Boolean);
  const BRAND = (ARGS.brand || '').toString().trim();
  const LIMIT = Math.max(1, parseInt(ARGS.limit || '20', 10) || 20);
  const WITH_MEDIA_ONLY = String(ARGS.withMediaOnly || 'false').toLowerCase() === 'true';
  if (!PN_LIST.length){
    if (!BRAND){
      console.error('Usage: node scripts/sync-qw-to-algolia.mjs --pn=PN1,PN2 | --brand=Kaspersky [--limit=20] [--withMediaOnly=true]');
      process.exit(1);
    }
  }

  const pool = await connectSQL();
  const colsDoc = await tableColumns(pool, 'DocumentItems');
  const hasPartNo = colsDoc.has('ManufacturerPartNo');
  const pnCol = colsDoc.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber' : (hasPartNo ? 'ManufacturerPartNo' : null);
  if (!pnCol){ console.error('No PN column in DocumentItems'); process.exit(2); }

  const hasExt = (await tableColumns(pool, 'DocumentItems_Extension')).size > 0;
  const out = [];
  if (PN_LIST.length){
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
  } else if (BRAND) {
    // Brand-scoped selection
    const req = pool.request().input('brand', sql.NVarChar(255), BRAND);
    let mediaFilter = '';
    if (WITH_MEDIA_ONLY){
      const parts = [];
      if (colsDoc.has('PictureFile')) parts.push('PictureFile IS NOT NULL');
      if (colsDoc.has('PictureFileName')) parts.push('PictureFileName IS NOT NULL');
      if (colsDoc.has('SpecSheetFile')) parts.push('SpecSheetFile IS NOT NULL');
      if (colsDoc.has('CustomText03')) parts.push('CustomText03 IS NOT NULL');
      if (parts.length){ mediaFilter = ' AND (' + parts.join(' OR ') + ')'; }
    }
    const q = `SELECT TOP (${LIMIT}) * FROM dbo.DocumentItems WHERE Manufacturer=@brand${mediaFilter} ORDER BY ID DESC`;
    const rs = await req.query(q);
    for (const doc of rs.recordset){
      let ext = null;
      if (hasExt && doc.ID != null){
        const extRs = await pool.request().input('id', sql.Int, doc.ID).query('SELECT TOP 1 * FROM dbo.DocumentItems_Extension WHERE ItemID=@id');
        ext = extRs.recordset[0] || null;
      }
      out.push(mapToAlgolia(doc, ext));
    }
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
