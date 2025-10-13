#!/usr/bin/env node
// Quick diagnostic: find a PN across common DocumentItems columns
import 'dotenv/config';
import sql from 'mssql';
import path from 'path';
import fs from 'fs';

function loadLocalEnvFallback(){
  const candidates = [
    'C://GitHub//API.txt',
    'C://GitHub//local use API.txt',
    'C://GitHub//local_use_API.txt'
  ];
  for (const p of candidates){
    try {
      if (!fs.existsSync(p)) continue;
      const lines = fs.readFileSync(p,'utf8').split(/\r?\n/);
      for (let i=0;i<lines.length;i++){
        const line = lines[i].trim();
        if (!line) continue;
        const eq = line.indexOf('=');
        if (eq>0){ const k=line.slice(0,eq).trim(); const v=line.slice(eq+1).trim(); if (!process.env[k]) process.env[k]=v; continue; }
      }
      break;
    } catch {}
  }
}
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

async function main(){
  const { pn } = parseArgs();
  if (!pn){ console.error('Usage: node scripts/qw-find-pn.mjs --pn=<value>'); process.exit(1); }
  const pool = await connectSQL();
  const candidates = [
    'ManufacturerPartNumber','ManufacturerPartNo','Description',
    'CustomText01','CustomText02','CustomText03','CustomText04','CustomText05','CustomText06','CustomText07','CustomText08',
    'PictureFileName','PictureFile','SpecSheetFile'
  ];
  const results = [];
  for (const col of candidates){
    try{
      const q = `SELECT TOP 5 ID, Description, ${col} AS MatchValue FROM dbo.DocumentItems WHERE ${col} = @pn`;
      const rs = await pool.request().input('pn', sql.NVarChar(255), pn).query(q);
      for (const r of rs.recordset){
        results.push({ column: col, id: r.ID, description: r.Description, value: r.MatchValue });
      }
    } catch {}
  }
  await pool.close();
  console.log(JSON.stringify({ pn, matches: results }, null, 2));
}

main().catch(e=>{ console.error(e); process.exit(1); });
