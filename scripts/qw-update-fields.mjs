#!/usr/bin/env node
// Update QuoteWerks DocumentItems fields for a PN (image/spec filenames and optional memos)
import 'dotenv/config';
import sql from 'mssql';
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

async function getCols(pool){
  const rs = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='DocumentItems'");
  return new Set(rs.recordset.map(r=> r.COLUMN_NAME));
}

async function main(){
  const ARGS = parseArgs();
  const pn = ARGS.pn;
  if (!pn){ console.error('Usage: node scripts/qw-update-fields.mjs --pn=PN --imageFile=xxx.jpg [--specFile=yyy.pdf] [--short=..] [--long=..]'); process.exit(1); }

  const pool = await connectSQL();
  const cols = await getCols(pool);
  const pnCol = cols.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber' : (cols.has('ManufacturerPartNo') ? 'ManufacturerPartNo' : null);
  if (!pnCol){ console.error('No ManufacturerPartNumber/ManufacturerPartNo column'); process.exit(2); }

  const updates = [];
  const req = pool.request();
  if (ARGS.imageFile){
    if (cols.has('PictureFileName')){ updates.push('PictureFileName=@img'); req.input('img', sql.NVarChar(255), ARGS.imageFile); }
    else if (cols.has('PictureFile')){ updates.push('PictureFile=@img'); req.input('img', sql.NVarChar(255), ARGS.imageFile); }
  }
  if (ARGS.specFile){
    if (cols.has('SpecSheetFile')){ updates.push('SpecSheetFile=@spec'); req.input('spec', sql.NVarChar(255), ARGS.specFile); }
    else if (cols.has('CustomText03')){ updates.push('CustomText03=@spec'); req.input('spec', sql.NVarChar(255), ARGS.specFile); }
  }
  if (ARGS.short && cols.has('CustomMemo01')){ updates.push('CustomMemo01=@s'); req.input('s', sql.NVarChar(sql.MAX), ARGS.short); }
  if (ARGS.long && cols.has('CustomMemo02')){ updates.push('CustomMemo02=@l'); req.input('l', sql.NVarChar(sql.MAX), ARGS.long); }

  if (!updates.length){ console.log('No updatable fields provided'); await pool.close(); return; }

  req.input('pn', sql.NVarChar(255), pn);
  const sqlText = `UPDATE dbo.DocumentItems SET ${updates.join(', ')} WHERE ${pnCol}=@pn`;
  const r = await req.query(sqlText);
  await pool.close();
  console.log(JSON.stringify({ ok:true, pn, rowsAffected: r.rowsAffected?.[0] || 0, set: updates }, null, 2));
}

main().catch(e=>{ console.error(e); process.exit(1); });
