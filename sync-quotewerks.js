#!/usr/bin/env node
// Sync Algolia enriched product data back to QuoteWerks (DocumentItems focus) with safe mappings
// - Reads env from .env and C:\GitHub\API.txt fallback
// - Connects to Algolia index (ALGOLIA_APP_ID, ALGOLIA_API_KEY, ALGOLIA_INDEX)
// - Connects to SQL Server (SQL_SERVER, SQL_DB, SQL_USER, SQL_PASSWORD)
// - Ensures extension table DocumentItems_Extension exists
// - Updates only whitelisted DocumentItems fields if they exist
// - Logs all actions to sync-log.txt

import 'dotenv/config';
import algoliasearch from 'algoliasearch';
import sql from 'mssql';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

// Load fallback env from C:\GitHub\API.txt if variables missing
function loadLocalEnvFallback() {
  const candidates = [
    'C://GitHub//API.txt',
    'C://GitHub//local use API.txt',
    'C://GitHub//local_use_API.txt'
  ];
  const normalize = (label) => label.trim().replace(/[^A-Za-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const lines = fs.readFileSync(p,'utf8').split(/\r?\n/);
      for (let i=0;i<lines.length;i++){
        const line = lines[i].trim();
        if (!line) continue;
        const eq = line.indexOf('=');
        if (eq>0){ const k=line.slice(0,eq).trim(); const v=line.slice(eq+1).trim(); if (!process.env[k]) process.env[k]=v; continue; }
        const key = normalize(line);
        let val=''; let j=i+1; while(j<lines.length && !val){ const t=lines[j].trim(); if (t) val=t; j++; }
        if (val){
          const map = { 'ALGOLIA_SEARCH_API_KEY':'ALGOLIA_API_KEY' };
          const envKey = map[key] || key;
          if (!process.env[envKey]) process.env[envKey] = val;
        }
      }
      console.log(chalk.gray(`[env] loaded fallback from ${p}`));
      break;
    } catch {}
  }
}
loadLocalEnvFallback();

const LOG_PATH = path.join(process.cwd(), 'sync-log.txt');
function logLine(msg){ const line = `[${new Date().toISOString()}] ${msg}\n`; fs.appendFileSync(LOG_PATH, line); console.log(line.trim()); }

function canonicalizeImage(url){
  if (!url) return null;
  let u = String(url).trim();
  // Remove spaces folder like 'Picture%20file/' if present and decode %20
  u = u.replace(/\bPicture%20?file\//i,'');
  u = u.replace(/%20/g,'');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
  return u;
}

function canonicalizeDatasheet(input){
  if (!input) return null;
  let u = String(input).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

const REQUIRED_FIELDS = {
  // Algolia → DocumentItems
  name: 'Description',
  brand: 'Manufacturer',
  part_number: 'ManufacturerPartNumber',
  category: 'CustomText01',
  image: 'PictureFileName', // Many QW setups store image path here; will skip if missing
  spec_sheet: 'CustomText03',
  short_description: 'CustomMemo01',
  long_description: 'Notes',
  tags: 'CustomText04',
  'attributes.Manufacturer': 'CustomText05',
  'attributes.Type': 'CustomText06',
  availability: 'CustomText07',
  in_stock: 'CustomNumber01',
  backorders_allowed: 'CustomNumber02',
  published: 'CustomNumber03',
  visibility: 'CustomText08',
  'fx.usd_to_egp_rate': 'CustomNumber04',
  datasheet_text: 'CustomMemo02',
  ai_description: 'CustomMemo03',
  ai_marketing: 'CustomMemo04',
  ai_specs_table: 'CustomMemo05'
};

function parseArgs(){
  const args = Object.fromEntries(process.argv.slice(2).map(a=>{
    const [k,...rest] = a.replace(/^--/,'').split('=');
    return [k, rest.join('=') || true];
  }));
  return args;
}

const ARGS = parseArgs();
const BRAND_FILTER = (ARGS.brand || process.env.SYNC_BRAND || '').toString();
const PN_LIST = (ARGS.pn || '').toString().split(',').map(s=>s.trim()).filter(Boolean);
const PN_CSV = (ARGS.pnCsv || '').toString();

async function connectAlgolia(){
  const appId = process.env.ALGOLIA_APP_ID;
  // Prefer Admin key to allow browse/iterate; fallback to generic API key
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
  const indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';
  if (!appId || !apiKey) throw new Error('Missing ALGOLIA_APP_ID or ALGOLIA_API_KEY');
  const client = algoliasearch(appId, apiKey);
  const index = client.initIndex(indexName);
  return { client, index, indexName };
}

async function connectSQL(){
  // Prefer root config/dbConfig.json if present, else compose from env
  let config = null;
  const cfgPath = path.join(process.cwd(), 'config', 'dbConfig.json');
  if (fs.existsSync(cfgPath)){
    config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } else {
    config = {};
  }
  if (process.env.SQL_SERVER) config.server = process.env.SQL_SERVER;
  if (process.env.SQL_DB) config.database = process.env.SQL_DB;
  if (process.env.SQL_USER) config.user = process.env.SQL_USER;
  if (process.env.SQL_PASSWORD) config.password = process.env.SQL_PASSWORD;
  config.options = config.options || { encrypt:false, trustServerCertificate:true };
  let lastErr;
  for (let attempt=1; attempt<=3; attempt++){
    try{
      const pool = new sql.ConnectionPool(config);
      const connected = await pool.connect();
      return connected;
    } catch (e){
      lastErr = e; await new Promise(r=> setTimeout(r, attempt*300));
    }
  }
  throw lastErr || new Error('SQL connect failed');
}

async function tableColumns(pool, schema, table){
  const rs = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema}' AND TABLE_NAME='${table}'`);
  return new Set(rs.recordset.map(r=> r.COLUMN_NAME));
}

async function ensureExtensionTable(pool){
  const exists = await pool.request().query("SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='DocumentItems_Extension'");
  if (!exists.recordset.length){
    await pool.request().query(`
      CREATE TABLE DocumentItems_Extension (
        ItemID INT PRIMARY KEY,
        ImageURL NVARCHAR(500),
        DatasheetURL NVARCHAR(500),
        MarketingDescription NVARCHAR(MAX),
        AIDescription NVARCHAR(MAX),
        AISpecs NVARCHAR(MAX),
        FXRate DECIMAL(10,4),
        StockStatus BIT,
        BackorderStatus BIT,
        Visibility NVARCHAR(50),
        LastUpdated DATETIME DEFAULT GETDATE()
      )
    `);
    logLine('created table DocumentItems_Extension');
  }
}

function get(o, pathStr){
  return pathStr.split('.').reduce((v,k)=> (v && v[k]!==undefined) ? v[k] : undefined, o);
}

function mapAlgoliaToDocItems(record){
  // Canonicalize image and datasheet
  const algImage = record.image || get(record,'media.image');
  const image = canonicalizeImage(algImage);
  const spec = canonicalizeDatasheet(record.spec_sheet || get(record,'media.datasheet'));
  const mapped = {
    Description: record.name,
    Manufacturer: record.brand,
    ManufacturerPartNumber: record.part_number || record.objectID,
    CustomText01: record.category || get(record, 'category') || null,
    PictureFileName: image || null,
    CustomText03: spec || null,
    CustomMemo01: record.short_description || get(record,'content.short_description') || null,
    Notes: record.long_description || null,
    CustomText04: Array.isArray(record.tags) ? record.tags.join(',') : (record.tags || null),
    CustomText05: get(record,'attributes.Manufacturer') || null,
    CustomText06: get(record,'attributes.Type') || null,
    CustomText07: record.availability || null,
    CustomNumber01: typeof record.in_stock === 'boolean' ? (record.in_stock?1:0) : null,
    CustomNumber02: typeof record.backorders_allowed === 'boolean' ? (record.backorders_allowed?1:0) : null,
    CustomNumber03: typeof record.published === 'boolean' ? (record.published?1:0) : null,
    CustomText08: record.visibility || null,
    CustomNumber04: get(record,'fx.usd_to_egp_rate') ?? null,
    CustomMemo02: record.datasheet_text || null,
    CustomMemo03: record.ai_description || null,
    CustomMemo04: record.ai_marketing || null,
    CustomMemo05: record.ai_specs_table || null
  };
  // Guarantee short_description not empty if name exists
  if (!mapped.CustomMemo01 && record.name) mapped.CustomMemo01 = record.name;
  return mapped;
}

function buildExtensionValues(record, mapped){
  const image = mapped.PictureFileName || null;
  const datasheet = mapped.CustomText03 || null;
  const fx = get(record,'fx.usd_to_egp_rate');
  return {
    ImageURL: image,
    DatasheetURL: datasheet,
    MarketingDescription: record.ai_marketing || null,
    AIDescription: record.ai_description || null,
    AISpecs: typeof record.ai_specs_table === 'object' ? JSON.stringify(record.ai_specs_table) : (record.ai_specs_table || null),
    FXRate: typeof fx === 'number' ? fx : null,
    StockStatus: typeof record.in_stock === 'boolean' ? (record.in_stock?1:0) : null,
    BackorderStatus: typeof record.backorders_allowed === 'boolean' ? (record.backorders_allowed?1:0) : null,
    Visibility: record.visibility || null
  };
}

async function getDocumentItemId(pool, pn, cols){
  const pnCol = cols.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber' : (cols.has('ManufacturerPartNo') ? 'ManufacturerPartNo' : null);
  const idCol = cols.has('ID') ? 'ID' : null;
  if (!pnCol || !idCol) return null;
  const rs = await pool.request().input('pn', sql.NVarChar(255), pn).query(`SELECT TOP 1 ${idCol} AS ID FROM dbo.DocumentItems WHERE ${pnCol}=@pn`);
  return rs.recordset[0]?.ID ?? null;
}

async function upsertExtension(pool, itemId, values){
  if (!itemId) return { upserted: 0 };
  const req = pool.request();
  req.input('ItemID', sql.Int, itemId);
  const cols = [];
  const sets = [];
  const vals = [];
  let idx=0;
  for (const [k,v] of Object.entries(values)){
    if (v === undefined || v === null) continue;
    const p = `e${idx++}`;
    cols.push(k);
    sets.push(`${k}=@${p}`);
    vals.push(`@${p}`);
    if (typeof v === 'number') req.input(p, sql.Decimal(18,4), v);
    else if (typeof v === 'boolean') req.input(p, sql.Bit, v?1:0);
    else req.input(p, sql.NVarChar(sql.MAX), String(v));
  }
  // Always touch LastUpdated on update
  const merge = `
    MERGE dbo.DocumentItems_Extension AS tgt
    USING (SELECT @ItemID AS ItemID) AS src
      ON (tgt.ItemID = src.ItemID)
    WHEN MATCHED THEN UPDATE SET ${sets.length? sets.join(', ') + ', ': ''} LastUpdated = GETDATE()
    WHEN NOT MATCHED THEN INSERT (ItemID${cols.length? ','+cols.join(','):''}) VALUES (@ItemID${vals.length? ','+vals.join(','):''});
  `;
  await req.query(merge);
  return { upserted: 1 };
}

async function updateDocumentItemsByPart(pool, pn, values, cols){
  // Columns set provided upfront
  // Figure out proper PN column and image column variations
  const pnCol = cols.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber'
              : cols.has('ManufacturerPartNo') ? 'ManufacturerPartNo'
              : 'ManufacturerPartNumber';
  const imgCol = cols.has('PictureFileName') ? 'PictureFileName'
               : cols.has('PictureFile') ? 'PictureFile'
               : null;
  if (imgCol && values.PictureFileName && imgCol !== 'PictureFileName'){
    values[imgCol] = values.PictureFileName; delete values.PictureFileName;
  }
  const sets = [];
  const req = pool.request();
  let idx=0;
  for (const [k,v] of Object.entries(values)){
    if (v===undefined || v===null) continue;
    if (!cols.has(k)) continue; // don't attempt to update non-existent columns
    const param = `p${idx++}`;
    sets.push(`${k} = @${param}`);
    // Choose NVARCHAR(MAX) for memo-like fields, NVARCHAR(255) for text, else numeric/bool inference
    if (typeof v === 'number') req.input(param, sql.Decimal(18,4), v);
    else req.input(param, sql.NVarChar(sql.MAX), String(v));
  }
  if (!sets.length) return { updated: 0 };
  req.input('pn', sql.NVarChar(255), pn);
  const q = `UPDATE dbo.DocumentItems SET ${sets.join(', ')} WHERE ${pnCol} = @pn`;
  const result = await req.query(q);
  return { updated: result.rowsAffected?.[0] || 0 };
}

async function syncRecords(){
  const { index, indexName } = await connectAlgolia();
  const pool = await connectSQL();
  await ensureExtensionTable(pool);
  const docItemCols = await tableColumns(pool, 'dbo', 'DocumentItems');

  let processed=0, updated=0, inserted=0, skipped=0, errors=0;

  logLine(`Sync start for index ${indexName}`);
  async function processHits(hits){
    for (const hit of hits){
      try{
        const pn = hit.objectID;
        if (!pn){ skipped++; continue; }
        if (BRAND_FILTER && (hit.brand||'').toLowerCase() !== BRAND_FILTER.toLowerCase()) { skipped++; continue; }
        const mapped = mapAlgoliaToDocItems(hit);
        const res = await updateDocumentItemsByPart(pool, pn, mapped, docItemCols);
        // Upsert extension for richer content
        const itemId = await getDocumentItemId(pool, pn, docItemCols);
        if (itemId){
          const extVals = buildExtensionValues(hit, mapped);
          await upsertExtension(pool, itemId, extVals);
        }
        if (res.updated>0){ updated++; logLine(`${pn} → updated (${res.updated} rows)`); }
        else { skipped++; logLine(`${pn} → skipped (no updatable columns or no matching rows)`); }
        processed++;
      }catch(e){ errors++; logLine(`${hit.objectID||'?'} → error ${e.message}`); }
    }
  }

  // If PN list provided, fetch targeted objects; else use paginated search with optional brand filter
  if (PN_LIST.length || PN_CSV){
    let pns = PN_LIST.slice();
    if (PN_CSV && fs.existsSync(PN_CSV)){
      const csv = fs.readFileSync(PN_CSV,'utf8');
      const lines = csv.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      // Basic: take first column per line
      for (const line of lines){
        const pn = line.split(/,|\t|;\s*/)[0].trim();
        if (pn && !pns.includes(pn)) pns.push(pn);
      }
    }
    // Chunk getObjects calls (max ~1000)
    for (let i=0; i<pns.length; i+=1000){
      const chunk = pns.slice(i, i+1000);
      const res = await index.getObjects(chunk);
      const hits = (res.results || []).filter(Boolean);
      await processHits(hits);
    }
  } else {
    const filters = BRAND_FILTER ? `brand:${BRAND_FILTER}` : undefined;
    let page = 0;
    while (true){
      const res = await index.search('', { page, hitsPerPage: 500, filters });
      if (!res.hits || !res.hits.length) break;
      await processHits(res.hits);
      if (page >= (res.nbPages - 1)) break;
      page++;
    }
  }
  await pool.close();
  const summary = `✅ Sync Complete\n${processed} items processed\n${updated} updated, ${inserted} inserted, ${skipped} skipped, ${errors} errors`;
  logLine(summary.replace(/\n/g,' | '));
  console.log(chalk.green(summary));
}

// Run
syncRecords().catch(err=>{
  console.error(chalk.red('Sync failed'), err);
  logLine(`Sync failed: ${err.message}`);
  process.exit(1);
});
