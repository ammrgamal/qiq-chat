#!/usr/bin/env node
// Insert a minimal DocumentItems row for a given PN using Algolia data
// - Detects PN column (ManufacturerPartNumber/ManufacturerPartNo)
// - Fills Description and Manufacturer when possible
// - Handles NOT NULL columns by providing type-safe defaults

import 'dotenv/config';
import sql from 'mssql';
import algoliasearch from 'algoliasearch';
import fs from 'fs';
import path from 'path';
import { loadLocalEnvFallback } from '../rules-engine/scripts/_env-fallback.mjs';

loadLocalEnvFallback();

function parseArgs(){
  const args = {};
  for (const a of process.argv.slice(2)){
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    args[k] = rest.join('=') || true;
  }
  return args;
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
  return client.initIndex(indexName);
}

async function getColumns(pool){
  const rs = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='DocumentItems'");
  const cols = new Map();
  for (const r of rs.recordset){ cols.set(r.COLUMN_NAME, { type:r.DATA_TYPE, nullable:r.IS_NULLABLE==='YES' }); }
  return cols;
}

async function isIdentity(pool, column){
  const rs = await pool.request().query(`SELECT COLUMNPROPERTY(OBJECT_ID('dbo.DocumentItems'), '${column}', 'IsIdentity') AS IsIdentity`);
  return rs.recordset[0]?.IsIdentity === 1;
}

function defaultForType(type){
  switch((type||'').toLowerCase()){
    case 'int': case 'bigint': case 'smallint': case 'tinyint': return 0;
    case 'decimal': case 'numeric': case 'float': case 'real': return 0;
    case 'bit': return 0;
    case 'datetime': case 'smalldatetime': case 'date': return '2000-01-01';
    default: return '';
  }
}

function get(obj, pathStr){ return pathStr.split('.').reduce((v,k)=> (v && v[k]!==undefined) ? v[k] : undefined, obj); }

async function main(){
  const { pn } = parseArgs();
  if (!pn){ console.error('Usage: node scripts/qw-upsert-item.mjs --pn=<value>'); process.exit(1); }

  const pool = await connectSQL();
  const columns = await getColumns(pool);
  const pnCol = columns.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber'
               : columns.has('ManufacturerPartNo') ? 'ManufacturerPartNo' : null;
  if (!pnCol){ console.error('No ManufacturerPartNumber/ManufacturerPartNo column found'); process.exit(2); }

  // If row exists, exit early
  const existRs = await pool.request().input('pn', sql.NVarChar(255), pn).query(`SELECT TOP 1 ID FROM dbo.DocumentItems WHERE ${pnCol}=@pn`);
  if (existRs.recordset.length){
    console.log(JSON.stringify({ inserted:false, reason:'exists', id: existRs.recordset[0].ID }, null, 2));
    await pool.close(); return;
  }

  // Fetch Algolia record for basic fields
  let name = pn, brand = null;
  try {
    const index = await connectAlgolia();
    const res = await index.getObjects([pn]);
    const hit = (res.results||[])[0];
    if (hit){ name = hit.name || name; brand = hit.brand || brand; }
  } catch {}

  // Build insert column/value sets
  const insertCols = [];
  const params = [];
  const req = pool.request();

  // Avoid setting identity ID
  const skipId = columns.has('ID') && await isIdentity(pool, 'ID');
  if (!skipId && columns.has('ID')){
    // Don't set ID unless necessary; assume identity
  }

  // Required base fields
  insertCols.push(pnCol); req.input('p_pn', sql.NVarChar(255), pn); params.push('@p_pn');
  if (columns.has('Description')){ insertCols.push('Description'); req.input('p_desc', sql.NVarChar(sql.MAX), name || pn); params.push('@p_desc'); }
  if (columns.has('Manufacturer') && brand){ insertCols.push('Manufacturer'); req.input('p_manu', sql.NVarChar(255), brand); params.push('@p_manu'); }

  // Ensure all NOT NULL columns have a value supplied
  for (const [col, meta] of columns.entries()){
    if (insertCols.includes(col)) continue;
    if (col === 'ID') continue; // identity
    if (!meta.nullable){
      const defVal = defaultForType(meta.type);
      insertCols.push(col);
      const p = `p_${col}`;
      // Choose parameter type
      if (typeof defVal === 'number') req.input(p, sql.Decimal(18,4), defVal);
      else req.input(p, sql.NVarChar(sql.MAX), String(defVal));
      params.push(`@${p}`);
    }
  }

  const q = `INSERT INTO dbo.DocumentItems (${insertCols.join(', ')}) VALUES (${params.join(', ')})`;
  try{
    const r = await req.query(q);
    // Get new ID
    const idRs = await pool.request().input('pn', sql.NVarChar(255), pn).query(`SELECT TOP 1 ID FROM dbo.DocumentItems WHERE ${pnCol}=@pn`);
    console.log(JSON.stringify({ inserted:true, id: idRs.recordset[0]?.ID || null, columns: insertCols.length }, null, 2));
  }catch(e){
    console.error('insert failed', e.message);
    process.exit(3);
  } finally {
    await pool.close();
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
