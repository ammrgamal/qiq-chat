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

function isFilenameOnly(v){
  if (!v) return false;
  const s = String(v).trim();
  return !/^https?:\/\//i.test(s) && !s.includes('://');
}

function kaspImageFromDescription(desc){
  const d = (desc||'').toLowerCase();
  if (d.includes('optimum')) return 'KasperskyNextEDROptimum.jpg';
  if (d.includes('foundations')) return 'KasperskyNextEDRFoundations.jpg';
  if (d.includes('expert')) return 'KasperskyNextEDRExpert.jpg';
  if (d.includes('core')) return 'KasperskyNextEDRCore.jpg';
  if (d.includes('edr')) return 'KasperskyNextEDROptimum.jpg';
  return 'KasperskyNextEDRFoundations.jpg';
}

function kaspSpecFromDescription(desc){
  const d = (desc||'').toLowerCase();
  if (d.includes('next edr')) return 'kaspersky-next-datasheet-0224-en.pdf';
  if (d.includes('endpoint security')) return 'kaspersky-endpoint-security-for-business-datasheet.pdf';
  return 'kaspersky-next EDR-datasheet.pdf';
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

function mapToAlgolia(doc, ext, ctx){
  const base = (s)=> (s||'').replace(/\/$/, '');
  // Support both legacy and new var names
  const R2_PUBLIC_BASE = base(process.env.R2_PUBLIC_BASE || process.env.R2_IMAGES_BASE || process.env.R2_BASE || '');
  const R2_SPECS_BASE  = base(process.env.R2_SPECS_BASE  || (process.env.R2_BASE ? base(process.env.R2_BASE) + '/Specs/SpecSheetFile' : ''));
  const pn = doc.ManufacturerPartNumber || doc.ManufacturerPartNo || doc.objectID;
  // Clone + apply Kaspersky corrections (export payload only)
  const isKaspersky = String(doc.Manufacturer||'').toLowerCase() === 'kaspersky';
  const corrected = { ...doc };
  if (isKaspersky){
    const desc = corrected.Description || '';
    // PictureFile correction: if empty or contains URL → set heuristic filename
    const pf = corrected.PictureFile || corrected.PictureFileName || '';
    if (!pf || !isFilenameOnly(pf)){
      corrected.PictureFile = kaspImageFromDescription(desc);
      if (ctx) ctx.autoFixedImages++;
      if (ctx) ctx.events.push(`Auto-corrected Kaspersky PictureFile to ${corrected.PictureFile} for ${pn}`);
    }
    // SpecSheetFile correction: if empty → set heuristic filename
    const sf = corrected.SpecSheetFile || corrected.CustomText03 || '';
    if (!sf || !isFilenameOnly(sf)){
      corrected.SpecSheetFile = kaspSpecFromDescription(desc);
      if (ctx) ctx.autoFixedSpecs++;
      if (ctx) ctx.events.push(`Auto-corrected Kaspersky SpecSheetFile to ${corrected.SpecSheetFile} for ${pn}`);
    }
  }

  // Prefer PictureFile (per mapping), fallback to PictureFileName
  const imgFile = corrected.PictureFile || corrected.PictureFileName || null;
  const specFile = corrected.SpecSheetFile || corrected.CustomText03 || null;
  const imageUrl = (imgFile ? joinUrl(R2_PUBLIC_BASE, imgFile) : null) || ext?.ImageURL || null;
  const datasheetUrl = (specFile ? joinUrl(R2_SPECS_BASE, specFile) : null) || ext?.DatasheetURL || null;

  const record = {
    objectID: pn,
    part_number: pn,
    name: doc.Description || null,
    brand: doc.Manufacturer || null,
  category: corrected.ItemType || corrected.CustomText01 || null,
  price: (typeof corrected.UnitPrice === 'number' ? corrected.UnitPrice : undefined),
  currency: corrected.BaseCurrency || corrected.Currency || undefined,
    // Tags per master mapping: CustomMemo04
  tags: (corrected.CustomMemo04 && String(corrected.CustomMemo04).split(',').map(s=>s.trim()).filter(Boolean)) || undefined,
  synonyms: (corrected.CustomText09 && String(corrected.CustomText09).split(',').map(s=>s.trim()).filter(Boolean)) || undefined,
  seo_title: corrected.CustomText12 || undefined,
  seo_description: corrected.CustomText13 || undefined,
    image: imageUrl || null,
    spec_sheet: datasheetUrl || null,
    media: {
      image: imageUrl || null,
      datasheet: datasheetUrl || null
    },
  short_description: corrected.CustomMemo01 || null,
  long_description: corrected.CustomMemo02 || null,
    // specs_table prioritizes extension.SpecsTable; fallback to CustomMemo03 if holds JSON
    specs_table: ext?.SpecsTable || undefined,
  datasheet_text: corrected.CustomMemo06 || null,
    // Rules Engine per master mapping
  rule_tag: corrected.CustomMemo05 || undefined,
  required_questions: corrected.CustomText14 || undefined,
  bundle_options: corrected.CustomText04 || undefined,
  boq_template_id: corrected.CustomText05 || undefined,
  preferred_display: corrected.CustomText06 || undefined,
    // AI/Rich content (keep existing extension fields if available)
    ai_description: ext?.AIDescription || undefined,
    ai_marketing: ext?.MarketingDescription || undefined,
    ai_specs_table: ext?.AISpecs || undefined,
    visibility: ext?.Visibility || undefined,
    // Relations
  related_products: corrected.CustomText08 || undefined,
  upsell_products: ext?.UpsellProducts || corrected.CustomText15 || undefined,
  cross_sell_products: ext?.CrossSellProducts || corrected.CustomText16 || undefined,
  options: corrected.CustomText17 || undefined,
  service_attachments: corrected.CustomText18 || undefined,
    // Business Value
  purchase_pitch: corrected.Notes || undefined,
  value_proposition: corrected.CustomText19 || undefined,
  benefits: ext?.Benefits || corrected.CustomText20 || undefined,
  target_audience: (typeof corrected.CustomNumber01 === 'number' ? corrected.CustomNumber01 : undefined),
    competitive_advantage: ext?.CompetitiveAdvantage || undefined,
  deployment_scenarios: ext?.DeploymentScenarios || (typeof corrected.CustomNumber02 === 'number' ? corrected.CustomNumber02 : undefined),
  integration: ext?.Integration || (typeof corrected.CustomNumber3 === 'number' ? corrected.CustomNumber3 : (typeof corrected.CustomNumber03 === 'number' ? corrected.CustomNumber03 : undefined)),
    roi_statement: ext?.ROIStatement || undefined,
    prerequisites: ext?.Prerequisites || undefined,
    // Operational
  lifecycle_status: (typeof corrected.CustomNumber05 === 'number' ? corrected.CustomNumber05 : undefined),
  compliance: ext?.Compliance || corrected.CustomDate01 || undefined,
  warranty: ext?.Warranty || corrected.CustomDate02 || undefined,
  lead_time: ext?.LeadTime || corrected.CustomText02 || undefined,
    // Diagrams (prefer extension to avoid conflicts with CustomMemo03 used by specs_table)
    ascii_hld: ext?.AsciiHLD || undefined,
    ascii_lld: ext?.AsciiLLD || undefined,
    diagram_params: ext?.DiagramParams || undefined,
    diagram_policy: ext?.DiagramPolicy || undefined,
    // Meta
    source: corrected.Vendor || undefined,
    updated_at: corrected.OrderDate || undefined,
    revision: corrected.SONumber || undefined,
    quality_score: (typeof corrected.CloseProbability === 'number' ? corrected.CloseProbability : undefined),
    in_stock: typeof ext?.StockStatus === 'number' ? Boolean(ext.StockStatus) : undefined,
    backorders_allowed: typeof ext?.BackorderStatus === 'number' ? Boolean(ext.BackorderStatus) : undefined,
    fx: { usd_to_egp_rate: (typeof ext?.FXRate === 'number' ? ext.FXRate : (corrected.CustomNumber04 ?? undefined)) }
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
  const ctx = { autoFixedImages: 0, autoFixedSpecs: 0, missing: [], events: [] };
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
  const autoFixed = ctx.autoFixedImages + ctx.autoFixedSpecs;
  let pending = missingCount; // We didn't call external AI here, so pending equals missing
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
  console.log(`Total Products Checked: ${out.length}`);
  console.log(`NULL Enrichment Fields: ${missingCount}`);
  console.log(`Auto-Fixed Kaspersky Images/Specs: ${autoFixed}`);
  console.log(`Pending Manual Review: ${pending}`);
  if (hints.length){
    for (const h of hints) console.log(h);
  }

  // Persist report for email
  try {
    const outPath = path.join(process.cwd(), 'algolia-sync-report.json');
    const payload = { index: indexName, updated: out.length, verify: view, missing: ctx.missing, autoFixed: autoFixed, hints };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Report written: ${outPath}`);
  } catch {}
}

main().catch(e=>{ console.error('sync-qw-to-algolia failed', e); process.exit(1); });
