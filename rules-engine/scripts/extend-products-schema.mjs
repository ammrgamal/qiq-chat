#!/usr/bin/env node
// Extend SQL schema for dbo.Products_%_Products with QIQ_* enrichment/search columns (idempotent)
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

const cfgPath = path.join(process.cwd(), 'config', 'dbConfig.json');
if (!fs.existsSync(cfgPath)){
  console.error(`[schema] Missing DB config at ${cfgPath}`);
  process.exit(2);
}
const config = JSON.parse(fs.readFileSync(cfgPath,'utf8'));
if (process.env.SQL_SERVER) config.server = process.env.SQL_SERVER;
if (process.env.SQL_DB) config.database = process.env.SQL_DB;
if (process.env.SQL_USER) config.user = process.env.SQL_USER;
if (process.env.SQL_PASSWORD) config.password = process.env.SQL_PASSWORD;

// Column definitions (QIQ_*). Keep names <= 128 chars. NVARCHAR(MAX) for JSON/text blobs; NVARCHAR(500) for URLs/short lists.
const columns = [
  { name:'QIQ_ShortDescription', type:'NVARCHAR(MAX)' },
  { name:'QIQ_FeaturesJSON', type:'NVARCHAR(MAX)' },
  { name:'QIQ_SpecsJSON', type:'NVARCHAR(MAX)' },
  { name:'QIQ_FAQJSON', type:'NVARCHAR(MAX)' },
  { name:'QIQ_SearchSynonymsJSON', type:'NVARCHAR(MAX)' },
  { name:'QIQ_ValueStatement', type:'NVARCHAR(MAX)' },
  { name:'QIQ_UseCasesJSON', type:'NVARCHAR(MAX)' },
  { name:'QIQ_ComplianceTagsJSON', type:'NVARCHAR(MAX)' },
  { name:'QIQ_ProductRules', type:'NVARCHAR(MAX)' },
  { name:'QIQ_CategoryRules', type:'NVARCHAR(MAX)' },
  { name:'QIQ_ScopeOfWork', type:'NVARCHAR(MAX)' },
  { name:'QIQ_Tags', type:'NVARCHAR(500)' },
  { name:'QIQ_SEOKeywords', type:'NVARCHAR(500)' },
  { name:'QIQ_ImagePath', type:'NVARCHAR(500)' },
  { name:'QIQ_SpecSheetPath', type:'NVARCHAR(500)' },
  { name:'QIQ_Processed', type:'BIT', default:'0' },
  { name:'QIQ_ProcessedAt', type:'DATETIME2', nullable:true },
  { name:'QIQ_AIConfidence', type:'DECIMAL(5,2)', default:'0' },
  { name:'QIQ_AIVersion', type:'NVARCHAR(50)' },
  { name:'QIQ_DataQualityScore', type:'INT', default:'0' },
  { name:'QIQ_RiskScore', type:'INT', default:'0' }
];

async function listProductTables(pool){
  const rs = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA='dbo' AND TABLE_NAME LIKE 'Products[_]_%[_]Products'`);
  return rs.recordset.map(r=> `[${r.TABLE_SCHEMA}].[${r.TABLE_NAME}]`);
}

async function columnExists(pool, schema, table, col){
  const rs = await pool.request().query(`
    SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA='${schema.replace(/'/g,"''")}' AND TABLE_NAME='${table.replace(/'/g,"''")}' AND COLUMN_NAME='${col.replace(/'/g,"''")}'`);
  return rs.recordset.length>0;
}

async function addColumn(pool, fullName, col){
  const [schema, table] = fullName.replace(/\[|\]/g,'').split('.');
  const exists = await columnExists(pool, schema, table, col.name);
  if (exists) return { added:false };
  const nullable = col.nullable === true ? ' NULL' : ' NULL';
  const defaultConstraint = col.default !== undefined ? ` CONSTRAINT DF_${table}_${col.name} DEFAULT ${col.default}` : '';
  const sqlText = `ALTER TABLE ${fullName} ADD [${col.name}] ${col.type}${defaultConstraint}${nullable}`;
  await pool.request().query(sqlText);
  return { added:true };
}

async function main(){
  const pool = await sql.connect(config);
  const tables = await listProductTables(pool);
  if (!tables.length){
    console.warn('[schema] No product tables matched pattern dbo.Products_*_Products');
  }
  let totalAdded = 0;
  for (const t of tables){
    let addedForTable = 0;
    for (const col of columns){
      const r = await addColumn(pool, t, col).catch(e=>{ console.error(`[schema] Failed adding ${col.name} to ${t}:`, e.message); return {added:false};});
      if (r.added) { totalAdded++; addedForTable++; }
    }
    console.log(`[schema] ${t}: +${addedForTable} columns (idempotent)`);
  }
  await pool.close();
  console.log(`[schema] Done. Total columns added: ${totalAdded}`);
}

main().catch(e=>{ console.error('[schema] Fatal', e); process.exit(1); });
