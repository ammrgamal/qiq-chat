#!/usr/bin/env node
// Sync enriched products from dbo.Products_<list>_Products to Algolia
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env from project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

// CLI args parsing
const ARGS = Object.fromEntries(process.argv.slice(2).map(a=>{
  const [k,...rest] = a.replace(/^--/,'').split('=');
  return [k, rest.join('=') || true];
}));

const BRAND = (ARGS.brand || 'Kaspersky').toString();
const LIST = (ARGS.list || '12').toString();
const LIMIT = ARGS.limit ? parseInt(ARGS.limit,10) : null; // optional cap

// Ensure Algolia env alias compatibility for enrichment-engine service
if (!process.env.ALGOLIA_INDEX_NAME && process.env.ALGOLIA_INDEX){
  process.env.ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX;
}

// Import Algolia service after env prepared
const { default: algoliaService } = await import('../../enrichment-engine/src/algoliaService.js');

// Load DB config
const dbConfigPath = path.join(process.cwd(), 'config', 'dbConfig.json');
if (!fs.existsSync(dbConfigPath)){
  console.error(`[algolia-sync] Missing DB config at ${dbConfigPath}`);
  process.exit(2);
}
const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath,'utf8'));
// Optional overrides from env
if (process.env.SQL_SERVER) dbConfig.server = process.env.SQL_SERVER;
if (process.env.SQL_DB) dbConfig.database = process.env.SQL_DB;
if (process.env.SQL_USER) dbConfig.user = process.env.SQL_USER;
if (process.env.SQL_PASSWORD) dbConfig.password = process.env.SQL_PASSWORD;

function isUrl(v){ return typeof v === 'string' && /^https?:\/\//i.test(v); }
function encodePathSegment(seg){
  // Encode segment safely; preserve basic filename dots
  try { return encodeURIComponent(String(seg)).replace(/%2F/g,'/'); } catch { return String(seg); }
}
function safeBase(base){ return String(base).replace(/\s/g, '%20').replace(/\/+$/,''); }
function joinUrl(base, part){
  if (!base || !part) return null;
  const b = safeBase(base);
  const p = encodePathSegment(String(part).replace(/^\/+/, ''));
  return `${b}/${p}`;
}

function asString(v){ return v == null ? null : String(v); }
function parseMaybeJSON(v){
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

function mapRecordToAlgolia(r){
  // Normalize various optional fields
  const tags = (r.QIQ_Tags || r.CustomText03 || '').toString();
  const imgBase = process.env.R2_IMAGES_BASE || process.env.R2_BASE || null;
  const specsBase = process.env.R2_SPECS_BASE || null;

  // Image resolution priority:
  // 1) R2_BASE + PictureFileName (if both present)
  // 2) CustomText05 if it is a full URL (legacy)
  // 3) PictureFileName as-is if it is already a URL
  // 4) ItemURL as fallback
  let imageUrl = null;
  if (imgBase && r.PictureFileName) imageUrl = joinUrl(imgBase, r.PictureFileName);
  if (!imageUrl && isUrl(r.QIQ_ImagePath || r.CustomText05)) imageUrl = r.QIQ_ImagePath || r.CustomText05;
  if (!imageUrl && isUrl(r.PictureFileName)) imageUrl = r.PictureFileName;
  if (!imageUrl && r.ItemURL) imageUrl = r.ItemURL;

  // Datasheet/specs resolution priority:
  // 1) R2_SPECS_BASE + CustomText06 when CustomText06 looks like a file path (no http)
  // 2) CustomText06 if it is a full URL
  let datasheetUrl = null;
  const rawSpecPath = r.QIQ_SpecSheetPath || r.CustomText06;
  if (specsBase && rawSpecPath && !isUrl(rawSpecPath)) datasheetUrl = joinUrl(specsBase, rawSpecPath);
  if (!datasheetUrl && isUrl(rawSpecPath)) datasheetUrl = rawSpecPath;

  // Price shapes (nested + legacy)
  const sell = Number(r.Price ?? r.List ?? r.Cost ?? 0) || 0;
  const list = r.List != null ? Number(r.List) : null;
  const cost = r.Cost != null ? Number(r.Cost) : null;
  const gross = list ?? sell;
  const net = sell; // interpret 'net' as sell price
  const marginPct = (net && cost != null) ? Math.round(((net - cost) / net) * 10000) / 100 : null;

  return {
    objectID: r.ManufacturerPartNumber || r.InternalPartNumber || r.PartNumber,
    name: r.Description || '',
    brand: r.Manufacturer || BRAND,
    category: r.CustomText02 || null,
    // legacy top-level price (kept numeric for compatibility)
    price: sell,
    // nested prices for numeric filtering: prices.net, prices.gross, prices.cost, prices.list, prices.margin
    prices: {
      net,
      gross,
      cost,
      list,
      margin: marginPct
    },
    short_description: asString(r.QIQ_ShortDescription || r.CustomMemo01),
    features: parseMaybeJSON(r.QIQ_FeaturesJSON || r.CustomMemo02),
    specs: parseMaybeJSON(r.QIQ_SpecsJSON || r.CustomMemo03),
    faq: parseMaybeJSON(r.QIQ_FAQJSON || r.CustomMemo04),
    why_buy: asString(r.QIQ_ValueStatement || r.CustomMemo05),
    // nested content
    content: {
      short_description: asString(r.QIQ_ShortDescription || r.CustomMemo01),
      features: parseMaybeJSON(r.QIQ_FeaturesJSON || r.CustomMemo02),
      specs: parseMaybeJSON(r.QIQ_SpecsJSON || r.CustomMemo03),
      faq: parseMaybeJSON(r.QIQ_FAQJSON || r.CustomMemo04),
      why_buy: asString(r.QIQ_ValueStatement || r.CustomMemo05)
    },
    prerequisites: r.CustomText07 || null,
    related: r.CustomText08 || null,
    product_rules: asString(r.QIQ_ProductRules || r.CustomText09),
    category_rules: asString(r.QIQ_CategoryRules || r.CustomText10),
    // nested rules
    rules: {
      product: asString(r.QIQ_ProductRules || r.CustomText09),
      category: asString(r.QIQ_CategoryRules || r.CustomText10),
      scope: asString(r.QIQ_ScopeOfWork || r.CustomText13)
    },
    image: imageUrl,
    datasheet: datasheetUrl,
    // nested media
    media: {
      image: imageUrl,
      datasheet: datasheetUrl
    },
    scope: asString(r.QIQ_ScopeOfWork || r.CustomText13),
    processed_at: asString(r.QIQ_ProcessedAt || r.CustomText12),
    ai_confidence: Number(r.QIQ_AIConfidence ?? r.CustomNumber03 ?? 0) || 0,
    // nested ai
    ai: {
      confidence: Number(r.QIQ_AIConfidence ?? r.CustomNumber03 ?? 0) || 0,
      processed_at: asString(r.QIQ_ProcessedAt || r.CustomText12)
    },
    tags: tags,
    seo_keywords: asString(r.QIQ_SEOKeywords || r.CustomText04)
  };
}

async function main(){
  const table = `dbo.Products_${LIST}_Products`;
  console.log(`[algolia-sync] Starting sync for brand='${BRAND}', table=${table}`);

  // Initialize Algolia
  if (!algoliaService.isConfigured()){
    console.error('[algolia-sync] Algolia not configured. Please set ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY/ALGOLIA_API_KEY');
    process.exit(2);
  }

  // Connect to SQL
  let pool;
  try{
    pool = await sql.connect(dbConfig);
  }catch(e){
    console.error('[algolia-sync] Failed to connect to SQL Server:', e.message);
    process.exit(1);
  }

  try{
    // Verify table exists
    const check = await pool.request().query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Products_${LIST}_Products'`);
    if (!check.recordset.length){
      console.error(`[algolia-sync] Table not found: ${table}`);
      process.exit(2);
    }

    // Determine available columns
    const colsRs = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Products_${LIST}_Products'`);
    const cols = new Set(colsRs.recordset.map(r=>r.COLUMN_NAME));
    const pick = (c)=> cols.has(c);

    const selectCols = [
      'Description',
      pick('ManufacturerPartNumber')? 'ManufacturerPartNumber':'InternalPartNumber',
      'Manufacturer',
      pick('Price')? 'Price' : (pick('List')? 'List' : 'Cost'),
      pick('PictureFileName')? 'PictureFileName' : (pick('ItemURL')? 'ItemURL' : null),
      // Enrichment fields
      // Prefer QIQ_* columns when present, else fallback to legacy Custom*
      pick('QIQ_ShortDescription') ? 'QIQ_ShortDescription' : (pick('CustomMemo01') ? 'CustomMemo01' : null),
      pick('QIQ_FeaturesJSON') ? 'QIQ_FeaturesJSON' : (pick('CustomMemo02') ? 'CustomMemo02' : null),
      pick('QIQ_SpecsJSON') ? 'QIQ_SpecsJSON' : (pick('CustomMemo03') ? 'CustomMemo03' : null),
      pick('QIQ_FAQJSON') ? 'QIQ_FAQJSON' : (pick('CustomMemo04') ? 'CustomMemo04' : null),
      pick('QIQ_ValueStatement') ? 'QIQ_ValueStatement' : (pick('CustomMemo05') ? 'CustomMemo05' : null),
      pick('QIQ_Tags') ? 'QIQ_Tags' : (pick('CustomText03') ? 'CustomText03' : null),
      pick('QIQ_SEOKeywords') ? 'QIQ_SEOKeywords' : (pick('CustomText04') ? 'CustomText04' : null),
      pick('QIQ_ImagePath') ? 'QIQ_ImagePath' : (pick('CustomText05') ? 'CustomText05' : null),
      pick('QIQ_SpecSheetPath') ? 'QIQ_SpecSheetPath' : (pick('CustomText06') ? 'CustomText06' : null),
      pick('QIQ_ProductRules') ? 'QIQ_ProductRules' : (pick('CustomText09') ? 'CustomText09' : null),
      pick('QIQ_CategoryRules') ? 'QIQ_CategoryRules' : (pick('CustomText10') ? 'CustomText10' : null),
      pick('QIQ_ScopeOfWork') ? 'QIQ_ScopeOfWork' : (pick('CustomText13') ? 'CustomText13' : null),
      pick('QIQ_Processed') ? 'QIQ_Processed' : (pick('CustomText11') ? 'CustomText11' : null),
      pick('QIQ_ProcessedAt') ? 'QIQ_ProcessedAt' : (pick('CustomText12') ? 'CustomText12' : null),
      pick('QIQ_AIConfidence') ? 'QIQ_AIConfidence' : (pick('CustomNumber03') ? 'CustomNumber03' : null)
    ].filter(Boolean).filter(c=> cols.has(c));

    const whereBrand = `Manufacturer IS NOT NULL AND Manufacturer LIKE '${BRAND.replace(/'/g, "''")}%'`;
  const whereProcessed = pick('QIQ_Processed') ? `(QIQ_Processed = 1 OR CustomText11 = 'TRUE')` : `(CustomText11 = 'TRUE')`;
    const limitClause = LIMIT ? `TOP (${LIMIT})` : '';
    const q = `SELECT ${limitClause} ${selectCols.join(', ')} FROM ${table} WHERE ${whereBrand} AND ${whereProcessed}`;
    const rs = await pool.request().query(q);
    const rows = rs.recordset;
    if (!rows.length){
      console.log('[algolia-sync] No enriched rows found to sync. Nothing to do.');
      return;
    }

  const objects = rows.map(mapRecordToAlgolia);
    console.log(`[algolia-sync] Pushing ${objects.length} objects to Algolia index '${algoliaService.index?.indexName || 'unknown'}'...`);
    const result = await algoliaService.syncProducts(objects);
    if (result?.success){
      console.log(`[algolia-sync] Done. Synced ${result.synced} objects.`);
    } else {
      console.error('[algolia-sync] Sync did not succeed:', result?.reason || 'unknown error');
      process.exit(1);
    }
  } catch(e){
    console.error('[algolia-sync] Fatal error:', e);
    process.exit(1);
  } finally {
    try{ await pool?.close(); }catch{}
  }
}

main().catch(e=>{ console.error('[algolia-sync] Unhandled error', e); process.exit(1); });
