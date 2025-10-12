#!/usr/bin/env node
// Synchronize enriched product data from SQL Server (QuoteWerks) to Algolia (woocommerce_products)
// - Creates a local JSON backup before any changes
// - Enriches up to 20 sample items across multiple manufacturers
// - Updates SQL first, then mirrors to Algolia
// - Retries Algolia pushes, shows progress, logs to file, and emails a summary with backup attached

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import sql from 'mssql';
import algoliasearch from 'algoliasearch';
import cliProgress from 'cli-progress';

import { sendEmail } from '../api/_lib/email.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// CLI args (optional overrides)
const ARGS = Object.fromEntries(process.argv.slice(2).map(a=>{
  const [k,...rest] = a.replace(/^--/,'').split('=');
  return [k, rest.join('=') || true];
}));
const PN = ARGS.pn ? String(ARGS.pn) : null;

// Directories
const backupsDir = path.join(process.cwd(), 'local_backups', 'algolia_sync');
const logsDir = path.join(process.cwd(), 'logs');
fs.mkdirSync(backupsDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

// Log file
const dateStr = new Date().toISOString().slice(0,10);
const logFile = path.join(logsDir, `algolia_sync_${dateStr}.log`);
function logLine(msg){
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

// Load DB config
const dbCfgPath = path.join(process.cwd(), 'config', 'dbConfig.json');
if (!fs.existsSync(dbCfgPath)){
  console.error(`[algolia-sync-rich] Missing DB config at ${dbCfgPath}`);
  process.exit(2);
}
const dbConfig = JSON.parse(fs.readFileSync(dbCfgPath, 'utf8'));
if (process.env.SQL_SERVER) dbConfig.server = process.env.SQL_SERVER;
if (process.env.SQL_DB) dbConfig.database = process.env.SQL_DB;
if (process.env.SQL_USER) dbConfig.user = process.env.SQL_USER;
if (process.env.SQL_PASSWORD) dbConfig.password = process.env.SQL_PASSWORD;
// Bump timeouts to avoid ETIMEOUT on large catalogs
dbConfig.connectionTimeout = parseInt(process.env.SQL_CONNECTION_TIMEOUT || '60000', 10);
dbConfig.requestTimeout = parseInt(process.env.SQL_REQUEST_TIMEOUT || '60000', 10);

// Algolia env
const ALG_APP = process.env.ALGOLIA_APP_ID;
const ALG_KEY = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
const ALG_INDEX = process.env.ALGOLIA_INDEX || process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';
if (!ALG_APP || !ALG_KEY){
  logLine('[algolia-sync-rich] Algolia not configured (ALGOLIA_APP_ID and ALGOLIA_API_KEY required).');
}

// Google CSE for image search (optional)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.Gemini_API;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || process.env.GOOGLE_CX;

function isUrl(v){ return typeof v === 'string' && /^https?:\/\//i.test(v); }
function appendRaw(u){ if (!u) return u; return u.includes('?') ? `${u}&raw=1` : `${u}?raw=1`; }
function filenameOnly(p){
  const s = String(p||'');
  const norm = s.replace(/\\/g,'/');
  const parts = norm.split('/');
  return parts[parts.length-1] || s;
}
function removeSpacesKeepExt(name){
  const m = String(name).match(/^(.*?)(\.[^.]+)?$/);
  const base = (m?.[1]||'').replace(/\s+/g,'');
  const ext = m?.[2] || '';
  return base + ext;
}
function fallbackImage(manufacturer){
  const m = encodeURIComponent(String(manufacturer||'product'));
  return appendRaw(`https://pub-02eff5b467804c8ebe56285681eba9a0.r2.dev/${m}.jpg`);
}

async function findImageUrl(rec){
  // 1) Prefer existing link in SQL
  const likely = [rec.CustomText05, rec.PictureFileName, rec.ItemURL].find(isUrl);
  if (likely) return appendRaw(likely);
  // 2) Try Google Custom Search (if configured)
  if (GOOGLE_API_KEY && GOOGLE_CSE_ID){
    try{
      const q = encodeURIComponent(`${rec.Manufacturer || ''} ${rec.Description || rec.Name || ''}`.trim());
      const url = `https://www.googleapis.com/customsearch/v1?q=${q}&searchType=image&num=1&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}`;
      const resp = await fetch(url);
      if (resp.ok){
        const data = await resp.json();
        const link = data.items?.[0]?.link;
        if (isUrl(link)) return appendRaw(link);
      }
    }catch(e){ logLine(`[image] CSE failed: ${e.message}`); }
  }
  // 3) Fallback CDN by manufacturer
  return fallbackImage(rec.Manufacturer || 'product');
}

function toHtmlList(features){
  if (!features) return '';
  let items = [];
  if (Array.isArray(features)) items = features;
  else if (typeof features === 'string') items = features.split(/\n|,|•/).map(s=>s.trim()).filter(Boolean);
  const lis = items.map(s=> `<li>${s}</li>`).join('');
  return `<div><strong>Key Features</strong><ul>${lis}</ul></div>`;
}

function toHtmlTable(specs){
  if (!specs) return '';
  // Accept markdown tables or key:value lines
  if (typeof specs === 'string' && specs.includes('|')){
    // naive markdown table to HTML
    const rows = specs.split(/\n+/).filter(l=>!/^\s*-+\s*\|/.test(l));
    const tr = rows.map(r=> r.split('|').map(c=>c.trim())).filter(c=>c.length>=2);
    const body = tr.map(c=> `<tr><td><strong>${c[0]}</strong></td><td>${c[1]}</td></tr>`).join('');
    return `<div><strong>Specifications</strong><table>${body}</table></div>`;
  }
  if (Array.isArray(specs)){
    const body = specs.map(obj=>{
      if (typeof obj==='object' && obj){
        const [[k,v]] = Object.entries(obj);
        return `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`;
      }
      return '';
    }).join('');
    return `<div><strong>Specifications</strong><table>${body}</table></div>`;
  }
  // key:value lines
  const lines = String(specs).split(/\n|,/).map(s=>s.trim()).filter(Boolean);
  const body = lines.map(line=>{
    const [k,...rest] = line.split(/:|=|\|/);
    return `<tr><td><strong>${(k||'Spec')}</strong></td><td>${rest.join(':').trim()}</td></tr>`;
  }).join('');
  return `<div><strong>Specifications</strong><table>${body}</table></div>`;
}

function makeSynonymsEn(arBase){
  // Minimal heuristic; could be extended with OpenAI for better results
  const en = Array.from(new Set(String(arBase||'').toLowerCase().split(/\s|,|\//).filter(t=>t.length>2)));
  const ar = en.map(t=> t); // placeholder; real Arabic synonyms can be fetched via AI later
  return Array.from(new Set([...en, ...ar])).slice(0, 20).join(',');
}

async function ensureColumns(pool, table, columns){
  // create columns if missing (subset we need)
  const rs = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table.replace(/'/g,"''")}'`);
  const have = new Set(rs.recordset.map(r=> r.COLUMN_NAME));
  const adds = [];
  function add(name, type){ if (!have.has(name)) adds.push(`ALTER TABLE dbo.${table} ADD [${name}] ${type} NULL`); }
  // Ensure key QIQ columns
  add('QIQ_Processed','BIT');
  add('QIQ_ProcessedAt','DATETIME2');
  add('QIQ_ProductRules','NVARCHAR(MAX)');
  add('QIQ_CategoryRules','NVARCHAR(MAX)');
  add('QIQ_ScopeOfWork','NVARCHAR(MAX)');
  add('QIQ_Tags','NVARCHAR(500)');
  add('QIQ_SEOKeywords','NVARCHAR(500)');
  add('QIQ_ImagePath','NVARCHAR(500)');
  if (adds.length){
    for (const stmt of adds){ await pool.request().query(stmt); }
    logLine(`[sql] Added ${adds.length} columns to ${table}`);
  }
}

async function listProductTables(pool){
  const rs = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME LIKE 'Products[_]_%[_]Products'`);
  return rs.recordset.map(r=> r.TABLE_NAME);
}

async function selectSampleProducts(pool, limit=20){
  const tables = await listProductTables(pool);
  let candidates = [];
  for (const t of tables){
    const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${t}'`);
    const has = (c)=> cols.recordset.some(r=> r.COLUMN_NAME===c);
    const priceCol = has('Price')? 'Price' : (has('List')? 'List' : 'Cost');
    const pnCol = has('ManufacturerPartNumber')? 'ManufacturerPartNumber' : (has('InternalPartNumber')? 'InternalPartNumber' : null);
    const imgCol = has('CustomText05')? 'CustomText05' : (has('PictureFileName')? 'PictureFileName' : (has('ItemURL')? 'ItemURL': null));
    // Prefer unprocessed rows when available
    const whereProcessed = has('QIQ_Processed')
      ? `(QIQ_Processed IS NULL OR QIQ_Processed = 0)`
      : (has('CustomText11') ? `(CustomText11 IS NULL OR CustomText11 <> 'TRUE')` : '1=1');
    const pnFilter = PN && pnCol ? ` AND ${pnCol}=N'${PN.replace(/'/g,"''")}'` : '';
    const q = `SELECT TOP (100) '${t}' AS __table, ${pnCol || 'NULL'} AS __pn,
      Description, Manufacturer, ${priceCol} AS UnitPrice,
      ${imgCol || 'NULL'} AS ImageField,
      CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
      CustomText01, CustomText02, CustomText03, CustomText04, CustomText05,
      CustomText06, CustomText07, CustomText08, CustomText09, CustomText10,
      QIQ_Processed, QIQ_ProcessedAt
    FROM dbo.${t}
    WHERE Manufacturer IS NOT NULL
      AND ${priceCol} > 0
      AND Description NOT LIKE '%Localization%'
      AND Description NOT LIKE '%N/A%'
      ${pnFilter}
      AND ${whereProcessed}
    ORDER BY NEWID()`;
    const rs = await pool.request().query(q);
    candidates.push(...rs.recordset.map(r=> ({ ...r, __pnCol: pnCol, __priceCol: priceCol, __imgCol: imgCol })));
  }
  // Pick diverse manufacturers
  const byMfr = new Map();
  for (const r of candidates){
    const m = (r.Manufacturer||'').trim();
    if (!byMfr.has(m)) byMfr.set(m, []);
    byMfr.get(m).push(r);
  }
  const picked = [];
  for (const [m, arr] of byMfr){
    if (picked.length >= limit) break;
    picked.push(arr[0]);
  }
  return picked.slice(0, limit);
}

async function enrichBatchOpenAI(items){
  // Combine up to 10 items per request; return a map by part number
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const prompt = `You are an expert IT content generator. For each product, return a JSON object keyed by partNumber with the following fields per item: shortDescription, features (array), specs (markdown table or array of {key:value}), faq (array of {q,a}), whyBuy, prerequisites, related, category, tags (comma-separated), seoKeywords (comma-separated), productRule, categoryRule, scopeOfWork.
Input JSON array:\n${JSON.stringify(items.map(i=>({ partNumber:i.__pn, name:i.Description, manufacturer:i.Manufacturer })))}`;
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role:'system', content: 'Always respond with valid JSON only.' },
      { role:'user', content: prompt }
    ],
    temperature: 0.5,
    max_tokens: 5000,
    response_format: { type:'json_object' }
  });
  const text = completion.choices?.[0]?.message?.content || '{}';
  try{ return JSON.parse(text); }catch{ return null; }
}

async function enrichItems(items){
  // Try batched OpenAI enrichment first; fallback to per-item rules via enrichmentService
  let enrichedMap = null;
  try{
    const chunks = [];
    for (let i=0;i<items.length;i+=10) chunks.push(items.slice(i,i+10));
    enrichedMap = {};
    for (const ch of chunks){
      const r = await enrichBatchOpenAI(ch);
      if (r) Object.assign(enrichedMap, r);
    }
  }catch(e){ logLine(`[enrich] OpenAI batch failed: ${e.message}`); }
  if (!enrichedMap){
    const mod = await import('../enrichment-engine/src/enrichmentService.js');
    const svc = mod.default;
    const results = await svc.batchEnrich(items.map(i=>({ Description:i.Description, ManufacturerPartNo:i.__pn, Manufacturer:i.Manufacturer, UnitPrice:i.UnitPrice })), null);
    enrichedMap = {};
    for (let idx=0; idx<items.length; idx++){
      const pn = items[idx].__pn;
      const r = results[idx]?.enriched || {};
      enrichedMap[pn] = r;
    }
  }
  return enrichedMap;
}

function buildAlgoliaObject(row, enriched, imageUrl){
  const price = Number(row.UnitPrice||0)||0;
  const featuresHtml = toHtmlList(enriched.features);
  const specsHtml = toHtmlTable(enriched.specs);
  const tags = enriched.tags || makeSynonymsEn(`${row.Manufacturer||''} ${row.Description||''}`);
  const seo = enriched.seoKeywords || tags;
  const nowIso = new Date().toISOString();
  return {
    objectID: row.__pn,
    name: row.Description || '',
    brand: row.Manufacturer || '',
    category: enriched.category || row.CustomText02 || null,
    price,
    prices: { net: price, gross: price },
    short_description: enriched.shortDescription || `${row.Manufacturer||''} ${row.Description||''}`.trim(),
    features: featuresHtml,
    specs: specsHtml,
    faq: Array.isArray(enriched.faq)? enriched.faq.map(q=>`Q: ${q.q}\nA: ${q.a}`).join('\n\n') : (enriched.faq || null),
    why_buy: enriched.whyBuy || null,
    prerequisites: enriched.prerequisites || null,
    related: enriched.related || null,
    product_rules: enriched.productRule || null,
    category_rules: enriched.categoryRule || null,
    scope: enriched.scopeOfWork || null,
    image: imageUrl,
    _ai_processed_at: nowIso,
    tags,
    seo_keywords: seo
  };
}

async function updateSqlWithEnrichment(pool, row, enriched, imageUrl){
  // Write enriched HTML into legacy CustomMemo for compatibility, and QIQ_* flags
  const esc = (v)=> String(v??'').replace(/'/g, "''");
  const t = row.__table;
  const sets = [];
  if (enriched.shortDescription) sets.push(`CustomMemo01=N'${esc(enriched.shortDescription)}'`);
  if (enriched.features) sets.push(`CustomMemo02=N'${esc(toHtmlList(enriched.features))}'`);
  if (enriched.specs) sets.push(`CustomMemo03=N'${esc(toHtmlTable(enriched.specs))}'`);
  if (enriched.faq) sets.push(`CustomMemo04=N'${esc(Array.isArray(enriched.faq)? enriched.faq.map(q=>`Q: ${q.q}\\nA: ${q.a}`).join('\\n\\n'): enriched.faq)}'`);
  if (enriched.whyBuy) sets.push(`CustomMemo05=N'${esc(enriched.whyBuy)}'`);
  if (enriched.category) sets.push(`CustomText02=N'${esc(enriched.category)}'`);
  const tags = enriched.tags || makeSynonymsEn(`${row.Manufacturer||''} ${row.Description||''}`);
  sets.push(`QIQ_Tags=N'${esc(tags)}'`);
  const seo = enriched.seoKeywords || tags;
  sets.push(`QIQ_SEOKeywords=N'${esc(seo)}'`);
  if (enriched.prerequisites) sets.push(`CustomText07=N'${esc(enriched.prerequisites)}'`);
  if (enriched.related) sets.push(`CustomText08=N'${esc(enriched.related)}'`);
  if (enriched.productRule) sets.push(`QIQ_ProductRules=N'${esc(enriched.productRule)}'`);
  if (enriched.categoryRule) sets.push(`QIQ_CategoryRules=N'${esc(enriched.categoryRule)}'`);
  if (enriched.scopeOfWork) sets.push(`QIQ_ScopeOfWork=N'${esc(enriched.scopeOfWork)}'`);
  if (imageUrl) sets.push(`QIQ_ImagePath=N'${esc(imageUrl)}'`);
  sets.push(`QIQ_Processed=1`);
  sets.push(`QIQ_ProcessedAt='${esc(new Date().toISOString())}'`);
  const sqlText = `UPDATE dbo.${t} SET ${sets.join(', ')} WHERE ${row.__pnCol}=N'${esc(row.__pn)}'`;
  await pool.request().query(sqlText);
}

async function pushAlgolia(objects){
  if (!ALG_APP || !ALG_KEY){ return { ok:false, reason:'Algolia not configured' }; }
  const client = algoliasearch(ALG_APP, ALG_KEY);
  const index = client.initIndex(ALG_INDEX);
  const maxAttempts = 3;
  let attempt = 0;
  let lastErr = null;
  while (attempt < maxAttempts){
    try{
      await index.saveObjects(objects);
      return { ok:true, count: objects.length };
    }catch(e){
      lastErr = e; attempt++; logLine(`[algolia] saveObjects attempt ${attempt} failed: ${e.message}`);
      await new Promise(r=> setTimeout(r, 1000*attempt));
    }
  }
  return { ok:false, error: lastErr?.message };
}

async function main(){
  logLine('Starting Algolia rich sync...');
  const started = Date.now();
  let processed=0, skipped=0, errors=0;

  // Connect SQL
  const pool = await sql.connect(dbConfig);

  // Select sample items
  const items = await selectSampleProducts(pool, 20);
  logLine(`[select] Picked ${items.length} items across manufacturers`);

  // Backup policy: once per day; keep only last two backups
  const dayKey = new Date().toISOString().slice(0,10);
  const dailyName = `backup_${dayKey}.json`;
  const backupFile = path.join(backupsDir, dailyName);
  if (!fs.existsSync(backupFile)){
    fs.writeFileSync(backupFile, JSON.stringify(items, null, 2));
    logLine(`[backup] Wrote ${backupFile}`);
  } else {
    logLine(`[backup] Skipped (exists for today): ${backupFile}`);
  }
  // Prune older backups, keep last 2
  try{
    const files = fs.readdirSync(backupsDir)
      .filter(f=> /^backup_.*\.json$/i.test(f))
      .map(f=> ({ f, time: fs.statSync(path.join(backupsDir,f)).mtimeMs }))
      .sort((a,b)=> b.time - a.time);
    if (files.length > 2){
      const toDelete = files.slice(2);
      for (const d of toDelete){
        fs.unlinkSync(path.join(backupsDir, d.f));
      }
      logLine(`[backup] Pruned ${toDelete.length} old backup(s), kept latest 2.`);
    }
  }catch(e){ logLine(`[backup] prune failed: ${e.message}`); }

  // Ensure columns on each table
  const tables = Array.from(new Set(items.map(i=> i.__table)));
  for (const t of tables){ await ensureColumns(pool, t, []); }

  // Enrich (using batch when possible)
  const enrichedMap = await enrichItems(items);

  const progress = new cliProgress.SingleBar({ format: 'Progress {bar} {value}/{total}' }, cliProgress.Presets.shades_classic);
  progress.start(items.length, 0);

  const algoliaObjects = [];
  for (const row of items){
    try{
      const pn = row.__pn;
      const enriched = enrichedMap[pn] || {};
      // Required fallbacks
      enriched.shortDescription = enriched.shortDescription || `${row.Manufacturer||''} ${row.Description||''}`.trim();
      enriched.category = enriched.category || row.CustomText02 || 'Software';
      enriched.tags = enriched.tags || makeSynonymsEn(`${row.Manufacturer||''} ${row.Description||''}`);
      enriched.seoKeywords = enriched.seoKeywords || enriched.tags;

      // Image resolution
      const imageUrl = await findImageUrl({
        CustomText05: row.CustomText05,
        PictureFileName: row.PictureFileName,
        ItemURL: row.ItemURL,
        Manufacturer: row.Manufacturer,
        Description: row.Description
      });

      // Update SQL first (mirror principle)
      await updateSqlWithEnrichment(pool, row, enriched, imageUrl);

      // Build Algolia object
      const obj = buildAlgoliaObject(row, enriched, imageUrl);
      algoliaObjects.push(obj);
      processed++;
    }catch(e){
      errors++; logLine(`[error] ${row.__pn} ${e.message}`);
    }finally{
      progress.increment();
    }
  }
  progress.stop();

  // Push to Algolia in one batch with retries
  const pushRes = await pushAlgolia(algoliaObjects);
  if (!pushRes.ok){ errors++; logLine(`[algolia] push failed: ${pushRes.error||pushRes.reason}`); }
  else { logLine(`[algolia] synced ${pushRes.count} objects to ${ALG_INDEX}`); }

  await pool.close();

  const duration = Math.round((Date.now()-started)/1000);
  const summary = `Summary: processed=${processed} skipped=${skipped} errors=${errors} duration=${duration}s`;
  logLine(summary);

  // Email notification with backup attachment
  try{
    const backupB64 = fs.readFileSync(backupFile).toString('base64');
    const html = `<p>Algolia Sync Completed.</p><p>${summary}</p><p>Index: ${ALG_INDEX}</p>`;
    const emailRes = await sendEmail({
      to: 'ammr.gamal@gmail.com',
      subject: 'Algolia Sync Completed',
      html,
      attachments: [{ filename: path.basename(backupFile), contentBase64: backupB64, mimeType: 'application/json' }]
    });
    if (!emailRes.ok){ logLine('[email] Failed or disabled.'); }
    else { logLine(`[email] Sent via ${emailRes.provider}`); }
  }catch(e){ logLine(`[email] Exception: ${e.message}`); }

  console.log(summary);
}

main().catch(e=>{ console.error('[algolia-sync-rich] fatal', e); process.exit(1); });
