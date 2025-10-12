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

async function tableExists(pool, schema, table){
  const q = await pool.request()
    .query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='${schema.replace(/'/g,"''")}' AND TABLE_NAME='${table.replace(/'/g,"''")}'`);
  return q.recordset.length>0;
}

async function updateProductInTable(pool, table, partNumber, enrichedData, columns){
  const esc = (v) => String(v ?? '').replace(/'/g, "''");
  const updates = [];
  const has = (name) => columns.has(name);
  if (enrichedData.shortDescription && has('CustomMemo01')){ updates.push(`CustomMemo01=N'${esc(enrichedData.shortDescription)}'`); }
  if (enrichedData.features && has('CustomMemo02')){ updates.push(`CustomMemo02=N'${esc(enrichedData.features)}'`); }
  if (enrichedData.specs && has('CustomMemo03')){ updates.push(`CustomMemo03=N'${esc(enrichedData.specs)}'`); }
  if (enrichedData.faq && has('CustomMemo04')){ updates.push(`CustomMemo04=N'${esc(enrichedData.faq)}'`); }
  if (enrichedData.whyBuy && has('CustomMemo05')){ updates.push(`CustomMemo05=N'${esc(enrichedData.whyBuy)}'`); }
  // Map remaining textual aids into CustomText fields if present
  if (enrichedData.prerequisites && has('CustomText07')){ updates.push(`CustomText07=N'${esc(enrichedData.prerequisites)}'`); }
  if (enrichedData.related && has('CustomText08')){ updates.push(`CustomText08=N'${esc(enrichedData.related)}'`); }
  if (enrichedData.productRule && has('CustomText09')){ updates.push(`CustomText09=N'${esc(enrichedData.productRule)}'`); }
  if (enrichedData.categoryRule && has('CustomText10')){ updates.push(`CustomText10=N'${esc(enrichedData.categoryRule)}'`); }
  if (enrichedData.manufacturer && has('CustomText01')){ updates.push(`CustomText01=N'${esc(enrichedData.manufacturer)}'`); }
  if (enrichedData.category && has('CustomText02')){ updates.push(`CustomText02=N'${esc(enrichedData.category)}'`); }
  if (enrichedData.tags && has('CustomText03')){ updates.push(`CustomText03=N'${esc(enrichedData.tags)}'`); }
  if (enrichedData.seoKeywords && has('CustomText04')){ updates.push(`CustomText04=N'${esc(enrichedData.seoKeywords)}'`); }
  if (enrichedData.imageUrl && has('CustomText05')){ updates.push(`CustomText05=N'${esc(enrichedData.imageUrl)}'`); }
  if (enrichedData.datasheetUrl && has('CustomText06')){ updates.push(`CustomText06=N'${esc(enrichedData.datasheetUrl)}'`); }
  // scopeOfWork: avoid duplicating CustomText09 if already used by productRule; use next available
  if (enrichedData.scopeOfWork){
    if (has('CustomText13') && !updates.some(u=> u.startsWith('CustomText13='))){
      updates.push(`CustomText13=N'${esc(enrichedData.scopeOfWork)}'`);
    } else if (has('CustomText09') && !updates.some(u=> u.startsWith('CustomText09='))){
      updates.push(`CustomText09=N'${esc(enrichedData.scopeOfWork)}'`);
    }
  }
  // processed flags
  if (has('CustomText11')){ updates.push(`CustomText11='TRUE'`); }
  if (has('CustomText12')){ updates.push(`CustomText12='${esc(new Date().toISOString())}'`); }
  // skip numeric confidence update to avoid decimal type binding issues for now
  if (!updates.length) return { updated:0 };
  const sqlText = `UPDATE ${table} SET ${updates.join(', ')} WHERE ManufacturerPartNumber=N'${esc(partNumber)}'`;
  await pool.request().query(sqlText);
  return { updated: updates.length };
}

async function main(){
  const started = Date.now();
  // Connect DB via enrichment-engine service (it expects config/dbConfig.json at CWD)
  // We already have it in place; enrichmentEngine uses its own dbService which reads that path.
  await dbSvc.connect();

  const pool = dbSvc.pool;
  const listsInt = LISTS.map(n=>parseInt(n,10)).filter(n=>!isNaN(n));
  const products = [];
  // helper: fetch column names for a table
  async function getTableColumns(pool, schema, tbl){
    const rs = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema.replace(/'/g,"''")}' AND TABLE_NAME='${tbl.replace(/'/g,"''")}'`);
    return new Set(rs.recordset.map(r=> r.COLUMN_NAME));
  }

  for (const lid of listsInt){
    const tableName = `dbo.Products_${lid}_Products`;
    const exists = await tableExists(pool, 'dbo', `Products_${lid}_Products`);
    if (!exists){ console.warn(`[warn] table not found: ${tableName}`); continue; }
    const columns = await getTableColumns(pool, 'dbo', `Products_${lid}_Products`);
    const req = pool.request();
    // Build select list based on available columns
    const selectCols = [
      'Description',
      columns.has('ManufacturerPartNumber')? 'ManufacturerPartNumber' : 'InternalPartNumber',
      'Manufacturer',
      columns.has('Price')? 'Price' : (columns.has('List')? 'List' : 'Cost'),
      columns.has('PictureFileName')? 'PictureFileName' : 'ItemURL',
      'CustomMemo01','CustomMemo02','CustomMemo03','CustomMemo04','CustomMemo05',
      'CustomText01','CustomText02','CustomText03','CustomText04','CustomText05',
      'CustomText06','CustomText07','CustomText08','CustomText09','CustomText10',
      'CustomText11','CustomText12'
    ].filter(c=> columns.has(c));
    const pnCol = columns.has('ManufacturerPartNumber')? 'ManufacturerPartNumber' : 'InternalPartNumber';
    const priceCol = columns.has('Price')? 'Price' : (columns.has('List')? 'List' : 'Cost');
    const imgCol = columns.has('PictureFileName')? 'PictureFileName' : (columns.has('ItemURL')? 'ItemURL' : null);
    const q = `SELECT TOP (${LIMIT}) ${selectCols.join(', ')}
    FROM ${tableName}
    WHERE Manufacturer IS NOT NULL AND Manufacturer LIKE '${BRAND.replace(/'/g, "''")}%'
      AND (CustomText11 IS NULL OR CustomText11 != 'TRUE')
    ORDER BY NEWID()`;
    const rs = await req.query(q);
    products.push(...rs.recordset.map(r=> ({ ...r, __table: tableName, __pnCol: pnCol, __priceCol: priceCol, __imgCol: imgCol })));
  }
  console.log(`[select] brand=${BRAND} lists=${LISTS.join(',')} totalSelected=${products.length}`);

  // Initialize enrichment engine
  await enrichEngine.initialize();

  let enriched = 0, skipped=0, failed=0; const results=[];
  for (const p of products){
    try {
      const mod = await import('../../enrichment-engine/src/enrichmentService.js');
      const svc = mod.default;
      const enrichedData = await svc.enrichProduct({
        Description: p.Description,
        ManufacturerPartNo: p[p.__pnCol],
        Manufacturer: p.Manufacturer,
        UnitPrice: p[p.__priceCol],
        ImageFile: p[p.__imgCol]
      });
      const fieldsUpdated = Object.keys(enrichedData||{}).filter(k=> enrichedData[k] && !['provider','processingTime','tokensUsed','model','error'].includes(k));
      if (!DRY){
        // fetch columns once more for this table to guard updates
        const colSet = new Set(Object.keys(p).filter(k=> !k.startsWith('__')));
        await updateProductInTable(pool, p.__table, p[p.__pnCol], enrichedData, colSet);
        await dbSvc.logEnrichment({
          productId: p[p.__pnCol],
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
      results.push({ id: p[p.__pnCol], pn: p[p.__pnCol], status: enrichedData.error? 'failed':'enriched', q: enrichedData.confidence||0 });
    } catch(e){
      failed++; results.push({ id: p[p.__pnCol], pn: p[p.__pnCol], status:'failed', error: e.message });
    }
  }

  await enrichEngine.shutdown();
  await dbSvc.disconnect();

  const summary = { ok:true, brand: BRAND, lists: LISTS, total: products.length, enriched, failed, skipped, durationMs: Date.now()-started };
  console.log(JSON.stringify({ ...summary, results }, null, 2));
}

main().catch(err=>{ console.error('run-enrichment-db fatal', err); process.exit(1); });
