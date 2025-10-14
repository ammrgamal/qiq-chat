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

function mapToAlgolia(doc, ext, ctx){
  const base = (s)=> (s||'').replace(/\/$/, '');
  // Explicit bases per instructions
  const R2_IMAGES_BASE = base(process.env.R2_IMAGES_BASE || process.env.R2_PUBLIC_BASE || process.env.R2_BASE || '');
  const R2_SPECS_BASE  = base(process.env.R2_SPECS_BASE  || (process.env.R2_PUBLIC_BASE ? base(process.env.R2_PUBLIC_BASE) + '/Specs' : (process.env.R2_BASE ? base(process.env.R2_BASE) + '/Specs' : '')));
  const pn = doc.ManufacturerPartNumber || doc.ManufacturerPartNo || doc.objectID;

  // Build media URLs strictly from SQL filenames; do not alter filenames during sync
  const imgFile = doc.PictureFile ?? doc.PictureFileName ?? null;
  const specFile = doc.SpecSheetFile ?? doc.CustomText03 ?? null;
  let imageUrl = imgFile ? joinUrl(R2_IMAGES_BASE, imgFile) : null;
  let datasheetUrl = specFile ? joinUrl(R2_SPECS_BASE, specFile) : null;

  // Validation (a): remove placeholder folders if present
  const beforeImage = imageUrl;
  const beforeSpec = datasheetUrl;
  imageUrl = sanitizeMediaUrl(imageUrl);
  datasheetUrl = sanitizeMediaUrl(datasheetUrl);
  if (beforeImage && beforeImage !== imageUrl){
    ctx.correctedPaths++;
    ctx.events.push(`Auto-corrected image URL path for ${pn}`);
  }
  if (beforeSpec && beforeSpec !== datasheetUrl){
    ctx.correctedPaths++;
    ctx.events.push(`Auto-corrected spec_sheet URL path for ${pn}`);
  }

  // Build prices per instructions
  const priceVal = doc.Price;
  const costVal = (typeof doc.Cost === 'number') ? doc.Cost : 0;
  const listVal = (typeof doc.UnitPrice === 'number') ? doc.UnitPrice : ((typeof doc.List === 'number') ? doc.List : 0);
  const marginVal = (typeof doc.Margin === 'number') ? doc.Margin : 0;
  const prices = {};
  let fixedPrice = false;
  if (typeof priceVal === 'number'){
    prices.net = priceVal;
    prices.gross = priceVal;
  } else {
    fixedPrice = true; // missing price → consider as fixed per rule set
  }
  prices.cost = costVal;
  prices.list = listVal;
  prices.margin = marginVal;
  if (fixedPrice){
    ctx.fixedPriceObjects++;
    ctx.events.push(`Rebuilt malformed price object for ${pn}`);
  }

  const record = {
    objectID: pn,
    part_number: pn,
    name: doc.Description ?? null,
    brand: doc.Manufacturer ?? null,
    category: doc.ItemType ?? doc.CustomText01 ?? null,
    prices,
    currency: doc.BaseCurrency ?? doc.Currency ?? null,
    // Tagging/text fields: preserve NULLs
    tags: doc.CustomMemo04 ? String(doc.CustomMemo04).split(',').map(s=>s.trim()).filter(Boolean) : null,
    synonyms: doc.CustomText09 ? String(doc.CustomText09).split(',').map(s=>s.trim()).filter(Boolean) : null,
    seo_title: doc.CustomText12 ?? null,
    seo_description: doc.CustomText13 ?? null,
    image: imageUrl,
    spec_sheet: datasheetUrl,
    short_description: doc.CustomMemo01 ?? null,
    long_description: doc.CustomMemo02 ?? null,
    // specs_table prioritizes extension.SpecsTable (if present); keep NULL else
    specs_table: (ext && 'SpecsTable' in ext) ? (ext.SpecsTable ?? null) : null,
    datasheet_text: doc.CustomMemo06 ?? null,
    // Rules Engine / metadata
    rule_tag: doc.CustomMemo05 ?? null,
    required_questions: doc.CustomText14 ?? null,
    bundle_options: doc.CustomText04 ?? null,
    boq_template_id: doc.CustomText05 ?? null,
    preferred_display: doc.CustomText06 ?? null,
    // AI/Rich content (keep extension values if present, else NULL)
    ai_description: (ext && 'AIDescription' in ext) ? (ext.AIDescription ?? null) : null,
    ai_marketing: (ext && 'MarketingDescription' in ext) ? (ext.MarketingDescription ?? null) : null,
    ai_specs_table: (ext && 'AISpecs' in ext) ? (ext.AISpecs ?? null) : null,
    visibility: (ext && 'Visibility' in ext) ? (ext.Visibility ?? null) : null,
    // Relations
    related_products: doc.CustomText08 ?? null,
    upsell_products: (ext && 'UpsellProducts' in ext) ? (ext.UpsellProducts ?? null) : (doc.CustomText15 ?? null),
    cross_sell_products: (ext && 'CrossSellProducts' in ext) ? (ext.CrossSellProducts ?? null) : (doc.CustomText16 ?? null),
    options: doc.CustomText17 ?? null,
    service_attachments: doc.CustomText18 ?? null,
    // Business Value
    purchase_pitch: doc.Notes ?? null,
    value_proposition: doc.CustomText19 ?? null,
    benefits: (ext && 'Benefits' in ext) ? (ext.Benefits ?? null) : (doc.CustomText20 ?? null),
    target_audience: (typeof doc.CustomNumber01 === 'number') ? doc.CustomNumber01 : null,
    competitive_advantage: (ext && 'CompetitiveAdvantage' in ext) ? (ext.CompetitiveAdvantage ?? null) : null,
    deployment_scenarios: (ext && 'DeploymentScenarios' in ext) ? (ext.DeploymentScenarios ?? null) : ((typeof doc.CustomNumber02 === 'number') ? doc.CustomNumber02 : null),
    integration: (ext && 'Integration' in ext) ? (ext.Integration ?? null) : ((typeof doc.CustomNumber3 === 'number') ? doc.CustomNumber3 : ((typeof doc.CustomNumber03 === 'number') ? doc.CustomNumber03 : null)),
    roi_statement: (ext && 'ROIStatement' in ext) ? (ext.ROIStatement ?? null) : null,
    prerequisites: (ext && 'Prerequisites' in ext) ? (ext.Prerequisites ?? null) : null,
    // Operational
    lifecycle_status: (typeof doc.CustomNumber05 === 'number') ? doc.CustomNumber05 : null,
    compliance: (ext && 'Compliance' in ext) ? (ext.Compliance ?? null) : (doc.CustomDate01 ?? null),
    warranty: (ext && 'Warranty' in ext) ? (ext.Warranty ?? null) : (doc.CustomDate02 ?? null),
    lead_time: doc.CustomText02 ?? null,
    // Diagrams
    ascii_hld: (ext && 'AsciiHLD' in ext) ? (ext.AsciiHLD ?? null) : null,
    ascii_lld: (ext && 'AsciiLLD' in ext) ? (ext.AsciiLLD ?? null) : null,
    diagram_params: (ext && 'DiagramParams' in ext) ? (ext.DiagramParams ?? null) : null,
    diagram_policy: (ext && 'DiagramPolicy' in ext) ? (ext.DiagramPolicy ?? null) : null,
    // Meta
    source: doc.Vendor ?? null,
    updated_at: doc.OrderDate ?? null,
    revision: doc.SONumber ?? null,
    quality_score: (typeof doc.CloseProbability === 'number') ? doc.CloseProbability : null,
    in_stock: (typeof ext?.StockStatus === 'number') ? Boolean(ext.StockStatus) : null,
    backorders_allowed: (typeof ext?.BackorderStatus === 'number') ? Boolean(ext.BackorderStatus) : null,
    fx: { usd_to_egp_rate: (typeof ext?.FXRate === 'number') ? ext.FXRate : (doc.CustomNumber04 ?? null) }
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
  // Detect enrichment (QIQ_*) columns dynamically
  const allDocCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='DocumentItems'");
  const QIQ_COLS = allDocCols.recordset.map(r=>r.COLUMN_NAME).filter(n=> /^QIQ_/i.test(n));
  const ctx = { correctedPaths: 0, fixedPriceObjects: 0, missing: [], events: [] };
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
  const fixedPrice = ctx.fixedPriceObjects;
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
  console.log(`Fixed Price Objects: ${fixedPrice}`);
  console.log(`Missing Fields: ${missingCount}`);
  console.log(`Total Items Pushed: ${out.length}`);
  if (hints.length){
    for (const h of hints) console.log(h);
  }

  // Persist report for email
  try {
    const outPath = path.join(process.cwd(), 'algolia-sync-report.json');
    const payload = { index: indexName, updated: out.length, verify: view, missing: ctx.missing, correctedPaths, fixedPrice, hints };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Report written: ${outPath}`);
  } catch {}
}

main().catch(e=>{ console.error('sync-qw-to-algolia failed', e); process.exit(1); });
