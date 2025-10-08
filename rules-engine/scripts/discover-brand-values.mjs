#!/usr/bin/env node
// discover-brand-values.mjs - search for target brand strings across candidate tables
import 'dotenv/config';
import sql from 'mssql';

const TARGETS = (process.env.ENRICH_BRANDS || 'commscope,kaspersky').split(',').map(s=>s.trim()).filter(Boolean);

function buildCfg(){
  const rawServer = process.env.SQL_SERVER; const database = process.env.SQL_DB; const user = process.env.SQL_USER; const password = process.env.SQL_PASSWORD;
  let server = rawServer; let instanceName; if (rawServer && rawServer.includes('\\')) { const p = rawServer.split('\\'); server = p[0]; instanceName = p[1]; }
  return { server, database, user, password, options:{ trustServerCertificate:true, instanceName }, pool:{ max:3,min:0,idleTimeoutMillis:30000 } };
}

async function main(){
  const cfg = buildCfg();
  await sql.connect(cfg);
  console.log('[brand-scan] Connected. Targets:', TARGETS);
  // Find tables that have a Manufacturer or ProductName or Description column
  const meta = await sql.query(`SELECT TABLE_SCHEMA, TABLE_NAME, STRING_AGG(COLUMN_NAME, ',') cols
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME IN ('Manufacturer','ProductName','Description','Vendor','Name','Title')
    GROUP BY TABLE_SCHEMA, TABLE_NAME`);
  const candidates = meta.recordset;
  const hits = [];
  for (const t of candidates){
    const full = `[${t.TABLE_SCHEMA}].[${t.TABLE_NAME}]`;
    for (const brand of TARGETS){
      const q = `SELECT TOP 1 '${brand}' AS brand, '${full}' AS tableName FROM ${full} WITH (NOLOCK)
        WHERE (Manufacturer LIKE @b OR ProductName LIKE @b OR Description LIKE @b OR Vendor LIKE @b OR Name LIKE @b OR Title LIKE @b)`;
      try {
        const req = new sql.Request();
        req.input('b', sql.NVarChar, '%' + brand + '%');
        const r = await req.query(q);
        if (r.recordset.length){
          hits.push({ table: full, brand });
          console.log(`[brand-scan] Hit brand='${brand}' table=${full}`);
        }
      } catch {}
    }
  }
  if (!hits.length){
    console.log('[brand-scan] No matches found for brands in scanned tables');
  } else {
    console.table(hits);
  }
  process.exit(0);
}

main().catch(e=>{ console.error('[brand-scan] fatal', e); process.exit(1); });
