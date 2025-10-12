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

function mapRecordToAlgolia(r){
  // Normalize various optional fields
  const tags = r.CustomText03 || '';
  return {
    objectID: r.ManufacturerPartNumber || r.InternalPartNumber || r.PartNumber,
    name: r.Description || '',
    brand: r.Manufacturer || BRAND,
    category: r.CustomText02 || null,
    price: Number(r.Price ?? r.List ?? r.Cost ?? 0) || 0,
    short_description: r.CustomMemo01 || null,
    features: r.CustomMemo02 || null,
    specs: r.CustomMemo03 || null,
    faq: r.CustomMemo04 || null,
    why_buy: r.CustomMemo05 || null,
    prerequisites: r.CustomText07 || null,
    related: r.CustomText08 || null,
    product_rules: r.CustomText09 || null,
    category_rules: r.CustomText10 || null,
    image: r.CustomText05 || r.PictureFileName || r.ItemURL || null,
    datasheet: r.CustomText06 || null,
    scope: r.CustomText13 || null,
    processed_at: r.CustomText12 || null,
    ai_confidence: Number(r.CustomNumber03 ?? 0) || 0,
    tags: tags,
    seo_keywords: r.CustomText04 || null
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
      'CustomMemo01','CustomMemo02','CustomMemo03','CustomMemo04','CustomMemo05',
      'CustomText01','CustomText02','CustomText03','CustomText04','CustomText05',
      'CustomText06','CustomText07','CustomText08','CustomText09','CustomText10',
      'CustomText11','CustomText12','CustomText13','CustomNumber03'
    ].filter(Boolean).filter(c=> cols.has(c));

    const whereBrand = `Manufacturer IS NOT NULL AND Manufacturer LIKE '${BRAND.replace(/'/g, "''")}%'`;
    const whereProcessed = `(CustomText11 = 'TRUE')`;
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
