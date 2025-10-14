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
  return `${b}/${encodeURIComponent(f).replace(/%2F/g,'/')}`;
}

function sanitizeMediaUrl(url){
  if (!url) return url;
  // Remove placeholder segments like /PictureFile/ or /SpecSheetFile/
  let u = url.replace(/\/PictureFile\//gi, '/').replace(/\/SpecSheetFile\//gi, '/');
  // Collapse accidental multiple slashes (but keep protocol)
  u = u.replace(/([^:])\/+\//g, '$1/');
  return u;
}

function isFilenameOnly(v){
  if (!v) return false;
  const s = String(v).trim();
  return !/^https?:\/\//i.test(s) && !s.includes('://');
}

// removed brand-specific auto-corrections; SQL is source of truth during sync

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

// Load mapping once
let FIELD_MAPPING = null;
function loadMapping(){
  if (!FIELD_MAPPING){
    const fp = path.join(process.cwd(), 'docs', 'qw_sql_algolia_mapping.json');
    FIELD_MAPPING = JSON.parse(fs.readFileSync(fp, 'utf8'));
  }
  return FIELD_MAPPING;
}

function mapToAlgolia(doc, ext, ctx){
  const base = (s)=> (s||'').replace(/\/$/, '');
  // Explicit bases per instructions
  const R2_IMAGES_BASE = base(process.env.R2_IMAGES_BASE || process.env.R2_PUBLIC_BASE || process.env.R2_BASE || '');
  const R2_SPECS_BASE  = base(process.env.R2_SPECS_BASE  || (process.env.R2_PUBLIC_BASE ? base(process.env.R2_PUBLIC_BASE) + '/Specs' : (process.env.R2_BASE ? base(process.env.R2_BASE) + '/Specs' : '')));
  const pn = doc.ManufacturerPartNumber || doc.ManufacturerPartNo || doc.objectID;

  // Build media URLs strictly from SQL filenames
  const imgFile = doc.PictureFile ?? doc.PictureFileName ?? null;
  const specFile = doc.SpecSheetFile ?? doc.CustomText03 ?? null;
  let imageUrl = imgFile ? joinUrl(R2_IMAGES_BASE, imgFile) : null;
  let datasheetUrl = specFile ? joinUrl(R2_SPECS_BASE, specFile) : null;
  const beforeImage = imageUrl;
  const beforeSpec = datasheetUrl;
  imageUrl = sanitizeMediaUrl(imageUrl);
  datasheetUrl = sanitizeMediaUrl(datasheetUrl);
  if (beforeImage && beforeImage !== imageUrl){ ctx.correctedPaths++; ctx.events.push(`Auto-corrected image URL path for ${pn}`); }
  if (beforeSpec && beforeSpec !== datasheetUrl){ ctx.correctedPaths++; ctx.events.push(`Auto-corrected spec_sheet URL path for ${pn}`); }

  // Mapping-based payload build
  const mapping = loadMapping();
  const payload = {};
  for (const m of mapping){
    const key = m.algolia;
    if (!key) continue;
    let val = null;
    if (m.extField){
      // If ext has the field, prefer it; else fall back to QW field when appropriate per reference
      if (ext && Object.prototype.hasOwnProperty.call(ext, m.extField)){
        val = ext[m.extField];
      } else if (m.qwField && Object.prototype.hasOwnProperty.call(doc, m.qwField)){
        val = doc[m.qwField];
      }
    } else if (m.qwField && Object.prototype.hasOwnProperty.call(doc, m.qwField)){
      val = doc[m.qwField];
    }
    // Normalize empty to null
    if (val === undefined) val = null;
    if (typeof val === 'string' && val.trim() === '') val = null;
    // Special cases: tags and synonyms are CSV strings in QW fields
    if (key === 'tags' && typeof val === 'string') val = val.split(',').map(s=>s.trim()).filter(Boolean);
    if (key === 'synonyms' && typeof val === 'string') val = val.split(',').map(s=>s.trim()).filter(Boolean);
    payload[key] = val;
  }

  // Force pricing simplification per instructions
  const unitPrice = (typeof doc.UnitPrice === 'number') ? doc.UnitPrice : null;
  const unitList = (typeof doc.UnitList === 'number') ? doc.UnitList : ((typeof doc.List === 'number') ? doc.List : null);
  payload.price = unitPrice;
  payload.list_price = unitList;
  payload.currency = 'USD';
  // Track simplification
  ctx.simplifiedPrice++;
  ctx.events.push(`Simplified pricing structure for ${pn} (UnitPrice / UnitList only)`);

  // Mandatory identity fields
  payload.objectID = pn;
  payload.part_number = pn;
  // Media fields
  payload.image = imageUrl;
  payload.spec_sheet = datasheetUrl;

  // Leave NULLs as null (not strings). This payload is now fully mapping-driven plus pricing/media rules.
  ctx.mappingApplied++;
  ctx.events.push(`Mapped SQL→Algolia fields from reference for ${pn}`);
  return payload;
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
  // Detect enrichment (QIQ_*) columns dynamically
  const allDocCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='DocumentItems'");
  const QIQ_COLS = allDocCols.recordset.map(r=>r.COLUMN_NAME).filter(n=> /^QIQ_/i.test(n));
  const ctx = { correctedPaths: 0, simplifiedPrice: 0, mappingApplied: 0, missing: [], events: [] };
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
      // Check enrichment NULL fields (QIQ_*)
      for (const qcol of QIQ_COLS){
        const val = doc[qcol];
        if (val === null || val === undefined || String(val).trim() === ''){
          ctx.missing.push({ pn: doc[pnCol], field: qcol, cause: 'AI enrichment not completed' });
        }
      }
  // Media presence
      if (!doc.PictureFile && !doc.PictureFileName){ ctx.missing.push({ pn: doc[pnCol], field: 'PictureFile', cause: 'Missing media filename' }); }
      if (!doc.SpecSheetFile && !doc.CustomText03){ ctx.missing.push({ pn: doc[pnCol], field: 'SpecSheetFile', cause: 'Missing media filename' }); }
      out.push(mapToAlgolia(doc, ext, ctx));
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
      for (const qcol of QIQ_COLS){
        const val = doc[qcol];
        if (val === null || val === undefined || String(val).trim() === ''){
          ctx.missing.push({ pn: doc[pnCol], field: qcol, cause: 'AI enrichment not completed' });
        }
      }
      if (!doc.PictureFile && !doc.PictureFileName){ ctx.missing.push({ pn: doc[pnCol], field: 'PictureFile', cause: 'Missing media filename' }); }
      if (!doc.SpecSheetFile && !doc.CustomText03){ ctx.missing.push({ pn: doc[pnCol], field: 'SpecSheetFile', cause: 'Missing media filename' }); }
      out.push(mapToAlgolia(doc, ext, ctx));
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
  const report = { ok:true, updated: out.length, verify: view };
  console.log(JSON.stringify(report, null, 2));

  // Self-healing diagnostics
  const keys = { openai: !!process.env.OPENAI_API_KEY, gemini: !!(process.env.Gemini_API || process.env.GOOGLE_API_KEY) };
  const missingCount = ctx.missing.length;
  const correctedPaths = ctx.correctedPaths;
  const simplifiedPrice = ctx.simplifiedPrice;
  let pending = missingCount;
  const hints = [];
  if (!keys.openai && !keys.gemini){ hints.push('Missing OpenAI/Gemini API key — please provide in .env'); }

  // Print detailed missing section
  if (missingCount){
    console.log('\n⚠️ Missing or Incomplete Enrichment Fields');
    for (const m of ctx.missing){
      console.log(`- ${m.pn} | ${m.field} | ${m.cause}`);
    }
  }

  // Final summary
  console.log('\n✅ Algolia Sync Completed');
  console.log(`Corrected Image/Spec Paths: ${correctedPaths}`);
  console.log(`Simplified Price Fields Applied: ${simplifiedPrice}`);
  console.log(`Mapping Reference Applied Count: ${ctx.mappingApplied}`);
  console.log(`Missing Fields: ${missingCount}`);
  console.log(`Total Items Pushed: ${out.length}`);
  if (hints.length){
    for (const h of hints) console.log(h);
  }

  // Persist report for email
  try {
    const outPath = path.join(process.cwd(), 'algolia-sync-report.json');
    const payload = { index: indexName, updated: out.length, verify: view, missing: ctx.missing, correctedPaths, simplifiedPrice, mappingApplied: ctx.mappingApplied, hints };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Report written: ${outPath}`);
  } catch {}
}

main().catch(e=>{ console.error('sync-qw-to-algolia failed', e); process.exit(1); });
