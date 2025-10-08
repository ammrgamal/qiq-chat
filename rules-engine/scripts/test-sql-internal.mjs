#!/usr/bin/env node
// test-sql-internal.mjs - mimic run-enrichment-db context to isolate login issue
import 'dotenv/config';
import sql from 'mssql';
import fs from 'fs';

function buildConfig(){
  const rawServer = process.env.SQL_SERVER;
  const database = process.env.SQL_DB;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  let server = rawServer; let instanceName;
  if (rawServer && rawServer.includes('\\')){ const parts = rawServer.split('\\'); server = parts[0]; instanceName = parts[1]; }
  return { server, database, user, password, options:{ trustServerCertificate:true, instanceName }, pool:{ max:3,min:0,idleTimeoutMillis:30000 } };
}

(async () => {
  const cfg = buildConfig();
  console.log('[test-sql-internal] Config (masked):', { ...cfg, password: cfg.password? '***' : undefined });
  try {
    await sql.connect(cfg);
    console.log('[test-sql-internal] Connected OK');
  } catch (e){
    console.error('[test-sql-internal] Connect failed:', e.message);
    if (e.originalError) console.error('[test-sql-internal] originalError:', e.originalError.message);
    process.exit(3);
  }
  try {
    const r = await sql.query`SELECT TOP 3 name FROM sys.tables ORDER BY name`;
    console.log('[test-sql-internal] Tables:', r.recordset.map(x=>x.name));
  } catch (e){
    console.error('[test-sql-internal] Query failed:', e.message);
  }
  process.exit(0);
})();
