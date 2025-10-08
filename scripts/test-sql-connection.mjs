#!/usr/bin/env node
// test-sql-connection.mjs - quick connectivity + basic query test
import 'dotenv/config';
import sql from 'mssql';

(async () => {
  const rawServer = process.env.SQL_SERVER;
  const database = process.env.SQL_DB;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  if (!rawServer || !database){
    console.error('[test-sql] Missing SQL_SERVER or SQL_DB');
    process.exit(2);
  }
  let server = rawServer; let instanceName;
  if (rawServer.includes('\\')){ const parts = rawServer.split('\\'); server = parts[0]; instanceName = parts[1]; }
  const cfg = { server, database, user, password, options:{ trustServerCertificate:true, instanceName }, pool:{ max:3, min:0, idleTimeoutMillis:30000 } };
  console.log('[test-sql] Connecting to', JSON.stringify({ server: rawServer, database, user, instance: instanceName }));
  try {
    await sql.connect(cfg);
  } catch (e){
    console.error('[test-sql] Connection failed:', e.message);
    if (e.originalError) console.error('[test-sql] originalError:', e.originalError.message);
    process.exit(3);
  }
  try {
    const r = await sql.query`SELECT TOP 1 name FROM sys.tables`;
    console.log('[test-sql] Success. Sample table name:', r.recordset[0]?.name || '(none)');
  } catch (e){
    console.error('[test-sql] Post-connect query failed:', e.message);
  }
  process.exit(0);
})();
