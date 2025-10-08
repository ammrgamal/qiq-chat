#!/usr/bin/env node
// discover-product-tables.mjs - list candidate tables containing product-like columns
import 'dotenv/config';
import sql from 'mssql';

function buildCfg(){
  const rawServer = process.env.SQL_SERVER; const database = process.env.SQL_DB; const user = process.env.SQL_USER; const password = process.env.SQL_PASSWORD;
  let server = rawServer; let instanceName; if (rawServer && rawServer.includes('\\')) { const p = rawServer.split('\\'); server = p[0]; instanceName = p[1]; }
  return { server, database, user, password, options:{ trustServerCertificate:true, instanceName }, pool:{ max:3,min:0,idleTimeoutMillis:30000 } };
}

async function main(){
  const cfg = buildCfg();
  await sql.connect(cfg);
  console.log('[discover] Connected');
  const patternQuery = `SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME IN ('PartNumber','Manufacturer','ProductName','Description','SKU','ItemNumber')
    GROUP BY TABLE_SCHEMA,TABLE_NAME
    ORDER BY TABLE_SCHEMA, TABLE_NAME`;
  const tables = await sql.query(patternQuery);
  if (!tables.recordset.length){
    console.log('[discover] No tables with target columns found. Listing any tables containing "Part" substring.');
    const alt = await sql.query("SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Part%' ORDER BY TABLE_NAME");
    console.table(alt.recordset);
    process.exit(0);
  }
  console.table(tables.recordset);
  // For each candidate, pull up to 3 sample rows with those columns
  for (const row of tables.recordset){
    const full = `[${row.TABLE_SCHEMA}].[${row.TABLE_NAME}]`;
    console.log(`\n[discover] Sampling ${full}`);
    try {
      const sample = await sql.query(`SELECT TOP 3 * FROM ${full}`);
      if (!sample.recordset.length){ console.log('  (no rows)'); continue; }
      // Print subset of fields of interest if present
      const mapped = sample.recordset.map(r=>({
        PartNumber: r.PartNumber || r.SKU || r.ItemNumber || null,
        Manufacturer: r.Manufacturer || r.Vendor || null,
        ProductName: r.ProductName || r.Name || r.Title || null,
        Description: r.Description?.slice(0,60) || null
      }));
      console.table(mapped);
    } catch (e){
      console.log('  (error reading table)', e.message);
    }
  }
  process.exit(0);
}

main().catch(e=>{ console.error('[discover] fatal', e); process.exit(1); });
