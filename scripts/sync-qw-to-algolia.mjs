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

function toBooleanArg(val, defaultValue){
  if (val === undefined) return !!defaultValue;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['1','true','yes','on','y','t'].includes(s)) return true;
  if (['0','false','no','off','n','f','fales','fale','fal'].includes(s)) return false; // tolerate common typos
  return !!defaultValue;
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
  if (ctx.heal) {
    imageUrl = sanitizeMediaUrl(imageUrl);
    datasheetUrl = sanitizeMediaUrl(datasheetUrl);
  }
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
  const FULL = toBooleanArg(ARGS.full, false);
  const BATCH_SIZE = Math.max(1, parseInt(ARGS.batchSize || '500', 10) || 500);
  const HEAL = toBooleanArg(ARGS.heal, true);
  const AUTO_EMAIL = toBooleanArg(ARGS.email, FULL);
  const SOURCE = ((ARGS.source || 'products') + '').toLowerCase(); // products | documentitems
  if (!PN_LIST.length){
    if (!BRAND && !FULL){
      console.error('Usage: node scripts/sync-qw-to-algolia.mjs --pn=PN1,PN2 | --brand=Kaspersky [--limit=20] [--withMediaOnly=true] | --full [--batchSize=1000] [--heal=true] [--source=products|documentitems]');
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
  const ctx = { correctedPaths: 0, simplifiedPrice: 0, mappingApplied: 0, missing: [], events: [], heal: HEAL };
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
  } else if (FULL) {
    // Full sync for selected source table
    let totalPushed = 0;
    const { index, indexName } = await connectAlgolia();
    const verifyView = [];

    if (SOURCE === 'products'){
      // Discover columns and PN for Products_12_Products
      const prodCols = await tableColumns(pool, 'Products_12_Products');
      const pnColSrc = prodCols.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber' : (prodCols.has('ManufacturerPartNo') ? 'ManufacturerPartNo' : null);
      const hasID = prodCols.has('ID');
      if (!pnColSrc && !hasID){ console.error('Products_12_Products missing ID and PN columns'); process.exit(2); }
      let lastKey = hasID ? 0 : '';
      while (true){
        const req = pool.request();
        let q;
        if (hasID){
          q = `SELECT TOP (${BATCH_SIZE}) * FROM dbo.Products_12_Products WHERE ID > @key ORDER BY ID ASC`;
          req.input('key', sql.Int, lastKey);
        } else {
          q = `SELECT TOP (${BATCH_SIZE}) * FROM dbo.Products_12_Products WHERE ${pnColSrc} > @key ORDER BY ${pnColSrc} ASC`;
          req.input('key', sql.NVarChar(255), lastKey);
        }
        const rs = await req.query(q);
        if (!rs.recordset.length) break;
        const batch = [];
        for (const doc of rs.recordset){
          // QIQ missing scan if present
          for (const qcol of ['QIQ_ShortDescription','QIQ_FeaturesJSON','QIQ_SpecsJSON','QIQ_ValueStatement','QIQ_UseCasesJSON','QIQ_ComplianceTagsJSON']){
            if (doc.hasOwnProperty(qcol)){
              const val = doc[qcol];
              if (val == null || String(val).trim() === '') ctx.missing.push({ pn: (pnColSrc ? doc[pnColSrc] : doc.ID), field: qcol, cause: 'AI enrichment not completed' });
            }
          }
          batch.push(mapToAlgolia(doc, null, ctx));
        }
        await index.partialUpdateObjects(batch.map(o => ({ ...o, objectID: o.objectID })), { createIfNotExists: true });
        totalPushed += batch.length;
        const ids = batch.slice(0, 5).map(o=>o.objectID);
        if (ids.length){
          const v = await index.getObjects(ids);
          const view = (v.results||[]).map(r => ({ objectID: r?.objectID, image: r?.image, spec_sheet: r?.spec_sheet, name: r?.name, brand: r?.brand }));
          verifyView.push(...view);
        }
        if (hasID){ lastKey = rs.recordset[rs.recordset.length-1].ID; }
        else { lastKey = rs.recordset[rs.recordset.length-1][pnColSrc]; }
        console.log(chalk.gray(`Synced products batch up to ${hasID ? 'ID' : pnColSrc} ${lastKey} — total pushed: ${totalPushed}`));
      }
    } else {
      // DocumentItems (legacy)
      let lastID = 0;
      while (true){
        const q = `SELECT TOP (${BATCH_SIZE}) * FROM dbo.DocumentItems WHERE ID > @lastID ORDER BY ID ASC`;
        const rs = await pool.request().input('lastID', sql.Int, lastID).query(q);
        if (!rs.recordset.length) break;
        const batch = [];
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
          batch.push(mapToAlgolia(doc, ext, ctx));
        }
        await index.partialUpdateObjects(batch.map(o => ({ ...o, objectID: o.objectID })), { createIfNotExists: true });
        const ids = batch.slice(0, 5).map(o=>o.objectID);
        if (ids.length){
          const v = await index.getObjects(ids);
          const view = (v.results||[]).map(r => ({ objectID: r?.objectID, image: r?.image, spec_sheet: r?.spec_sheet, name: r?.name, brand: r?.brand }));
          verifyView.push(...view);
        }
        lastID = rs.recordset[rs.recordset.length-1].ID;
        console.log(chalk.gray(`Synced documentitems batch up to ID ${lastID}`));
      }
    }

    await pool.close();
    const missingCount = ctx.missing.length;
    const report = {
      ok: true,
      mode: 'full',
      source: SOURCE,
      verify: verifyView,
      missing: ctx.missing,
      correctedPaths: ctx.correctedPaths,
      simplifiedPrice: ctx.simplifiedPrice,
      mappingApplied: ctx.mappingApplied
    };
    const outPath = path.join(process.cwd(), 'algolia-sync-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('\n✅ Algolia Sync Completed (Full)');
    console.log(`Source: ${SOURCE}`);
    console.log(`Corrected Image/Spec Paths: ${ctx.correctedPaths}`);
    console.log(`Simplified Price Fields Applied: ${ctx.simplifiedPrice}`);
    console.log(`Mapping Reference Applied Count: ${ctx.mappingApplied}`);
    console.log(`Missing Fields: ${missingCount}`);
    if (AUTO_EMAIL){
      try{ 
        const { sendEmail } = await import('../api/_lib/email.js');
        const to = process.env.ENRICH_NOTIFY_TO || process.env.EMAIL_TO || process.env.ADMIN_EMAIL || process.env.QUOTE_NOTIFY_EMAIL || process.env.EMAIL_FROM;
        const subject = `Algolia Sync Report — Full (${SOURCE})`;
        const html = [
          `<h2>${subject}</h2>`,
          `<p><b>Corrected Paths:</b> ${ctx.correctedPaths} | <b>Simplified Price:</b> ${ctx.simplifiedPrice} | <b>Mapping Applied:</b> ${ctx.mappingApplied} | <b>Missing:</b> ${missingCount}</p>`,
          `<p>Report attached.</p>`
        ].join('\n');
        if (to){ await sendEmail({ to, subject, html, attachments: [{ filename: 'algolia-sync-report.json', path: outPath, mimeType: 'application/json' }] }); }
      }catch(e){ console.error('Auto-email failed', e?.message||e); }
    }
    return; // end FULL
  }
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
    if (AUTO_EMAIL){
      try{ 
        const { sendEmail } = await import('../api/_lib/email.js');
        const to = process.env.ENRICH_NOTIFY_TO || process.env.EMAIL_TO || process.env.ADMIN_EMAIL || process.env.QUOTE_NOTIFY_EMAIL || process.env.EMAIL_FROM;
        const subject = `Algolia Sync Report — ${indexName}`;
        const html = [
          `<h2>${subject}</h2>`,
          `<p><b>Updated:</b> ${out.length} | <b>Corrected Paths:</b> ${correctedPaths} | <b>Simplified Price:</b> ${simplifiedPrice} | <b>Mapping Applied:</b> ${ctx.mappingApplied}</p>`,
          `<p>Report attached.</p>`
        ].join('\n');
        if (to){ await sendEmail({ to, subject, html, attachments: [{ filename: 'algolia-sync-report.json', path: outPath, mimeType: 'application/json' }] }); }
      }catch(e){ console.error('Auto-email failed', e?.message||e); }
    }
  } catch {}
}

main().catch(e=>{ console.error('sync-qw-to-algolia failed', e); process.exit(1); });
