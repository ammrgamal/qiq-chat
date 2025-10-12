#!/usr/bin/env node
// Inspect columns for a given table name (e.g., dbo.Products_12_Products)
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

const cfgPath = path.join(process.cwd(), 'config', 'dbConfig.json');
if (!fs.existsSync(cfgPath)){
  console.error(`Missing DB config at ${cfgPath}`);
  process.exit(2);
}
const config = JSON.parse(fs.readFileSync(cfgPath,'utf8'));
if (process.env.SQL_SERVER) config.server = process.env.SQL_SERVER;
if (process.env.SQL_DB) config.database = process.env.SQL_DB;
if (process.env.SQL_USER) config.user = process.env.SQL_USER;
if (process.env.SQL_PASSWORD) config.password = process.env.SQL_PASSWORD;

const table = process.argv[2] || '';
if (!table){
  console.error('Usage: inspect-table.mjs <schema.tableName>');
  process.exit(2);
}

async function main(){
  const [schema, ...rest] = table.split('.');
  const tbl = rest.join('.') || schema; // allow passing just table name
  const sch = rest.length? schema : 'dbo';
  const pool = await sql.connect(config);
  const rs = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='${sch.replace(/'/g,"''")}'
      AND TABLE_NAME='${tbl.replace(/'/g,"''")}'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(JSON.stringify({ ok:true, schema: sch, table: tbl, columns: rs.recordset }, null, 2));
  await pool.close();
}

main().catch(e=>{ console.error('inspect failed', e); process.exit(1); });
