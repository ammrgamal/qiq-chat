#!/usr/bin/env node
// Run enrichment for products filtered by brand and list IDs against SQL Server
import sql from 'mssql';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

// CLI args
const ARGS = Object.fromEntries(process.argv.slice(2).map(a=>{
  const [k,...rest] = a.replace(/^--/,'').split('=');
  return [k, rest.join('=') || true];
}));

const BRAND = (ARGS.brand || process.env.ENRICH_BRAND || '').toString();
const LISTS = (ARGS.lists || process.env.ENRICH_LISTS || '').toString().split(',').map(s=>s.trim()).filter(Boolean);
const LIMIT = Math.max(1, Number(ARGS.limit || process.env.ENRICH_LIMIT || 100));
const DRY = /^(1|true|yes)$/i.test(String(process.env.ENRICH_DRY_RUN||''));

if (!BRAND || LISTS.length===0){
  console.error('Usage: run-enrichment-db.mjs --brand=Kaspersky --lists=1,12 [--limit=100]');
  process.exit(2);
}

// Load DB config
const dbConfigPath = join(process.cwd(), 'config', 'dbConfig.json');
if (!fs.existsSync(dbConfigPath)){
  console.error(`Missing DB config at ${dbConfigPath}. Create it from config/dbConfig.example.json`);
  process.exit(2);
}
const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));

// Optional env overrides
if (process.env.SQL_SERVER) dbConfig.server = process.env.SQL_SERVER;
if (process.env.SQL_DB) dbConfig.database = process.env.SQL_DB;
if (process.env.SQL_USER) dbConfig.user = process.env.SQL_USER;
if (process.env.SQL_PASSWORD) dbConfig.password = process.env.SQL_PASSWORD;

// Minimal enrichment using enrichment-engine
import enrichEngine from '../../enrichment-engine/src/enrichmentEngine.js';
import dbSvc from '../../enrichment-engine/src/dbService.js';

async function main(){
  const started = Date.now();
  // Connect DB via enrichment-engine service (it expects config/dbConfig.json at CWD)
  // We already have it in place; enrichmentEngine uses its own dbService which reads that path.
  await dbSvc.connect();

  // Query products by brand and list ids: assume table Products with ListID or SourceListID field
  // Try common field names: ListID, PriceListID, List, SourceListID
  const pool = dbSvc.pool;
  const listsInt = LISTS.map(n=>parseInt(n,10)).filter(n=>!isNaN(n));
  const placeholders = listsInt.map((_,i)=>`@list${i}`).join(',');
  const request = pool.request();
  listsInt.forEach((v,i)=> request.input(`list${i}`, sql.Int, v));
  request.input('brand', sql.NVarChar(100), BRAND);
  request.input('limit', sql.Int, LIMIT);

  // Try to locate a list column dynamically
  const listColumns = ['ListID','PriceListID','List','SourceListID','CustomNumber01'];
  let listColumn = null;
  for (const col of listColumns){
    try {
      const test = await pool.request().query(`SELECT TOP (1) 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Products' AND COLUMN_NAME='${col}'`);
      if (test.recordset.length){ listColumn = col; break; }
    } catch {}
  }
  if (!listColumn){
    console.warn('Could not detect list column automatically, defaulting to ListID');
    listColumn = 'ListID';
  }

  const q = `SELECT TOP (@limit)
    Description, ManufacturerPartNo, Manufacturer, UnitPrice,
    ImageFile,
    CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
    CustomMemo06, CustomMemo07, CustomMemo08, CustomMemo09, CustomMemo10,
    CustomText01, CustomText02, CustomText03, CustomText04, CustomText05,
    CustomText06, CustomText07, CustomText08, CustomText09, CustomText10,
    CustomText11, CustomText12,
    ${listColumn} as ListID
  FROM Products
  WHERE Manufacturer IS NOT NULL AND Manufacturer LIKE @brand + '%'
    AND ${listColumn} IN (${placeholders})
    AND (CustomText11 IS NULL OR CustomText11 != 'TRUE')
  ORDER BY NEWID()`;

  const products = (await request.query(q)).recordset;
  console.log(`[select] brand=${BRAND} lists=${LISTS.join(',')} count=${products.length}`);

  // Initialize enrichment engine
  await enrichEngine.initialize();

  let enriched = 0, skipped=0, failed=0; const results=[];
  for (const p of products){
    try {
      const enrichedData = await (await import('../../enrichment-engine/src/enrichmentService.js')).then(m=>m.default).then(svc=> svc.enrichProduct(p));
      const fieldsUpdated = Object.keys(enrichedData||{}).filter(k=> enrichedData[k] && !['provider','processingTime','tokensUsed','model','error'].includes(k));
      if (!DRY){
        await dbSvc.updateProduct(p.ManufacturerPartNo, enrichedData);
        await dbSvc.logEnrichment({
          productId: p.ManufacturerPartNo,
          productName: p.Description,
          operationType: 'Enrichment',
          aiProvider: enrichedData.provider,
          aiConfidence: enrichedData.confidence,
          timeTaken: enrichedData.processingTime,
          status: (enrichedData.error? 'Fallback' : 'Success'),
          fieldsUpdated: fieldsUpdated.join(','),
          metadata: JSON.stringify({ lists: LISTS, brand: BRAND, model: enrichedData.model || null, tokensUsed: enrichedData.tokensUsed || 0 })
        });
      }
      enriched += enrichedData.error? 0 : 1;
      if (enrichedData.error) failed++; 
      results.push({ id: p.ManufacturerPartNo, pn: p.ManufacturerPartNo, status: enrichedData.error? 'failed':'enriched', q: enrichedData.confidence||0 });
    } catch(e){
      failed++; results.push({ id: p.ManufacturerPartNo, pn: p.ManufacturerPartNo, status:'failed', error: e.message });
    }
  }

  await enrichEngine.shutdown();
  await dbSvc.disconnect();

  const summary = { ok:true, brand: BRAND, lists: LISTS, total: products.length, enriched, failed, skipped, durationMs: Date.now()-started };
  console.log(JSON.stringify({ ...summary, results }, null, 2));
}

main().catch(err=>{ console.error('run-enrichment-db fatal', err); process.exit(1); });
