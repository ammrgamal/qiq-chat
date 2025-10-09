#!/usr/bin/env node
// backup-db.mjs - Simple SQL Server backup utility using env vars
// Required ENV:
//  SQL_SERVER, SQL_DB, SQL_USER, SQL_PASSWORD (if using SQL auth) OR Integrated Security via trusted connection not handled here.
// Optional: BACKUP_DIR (default ./backups)
// Usage: npm run backup  (will create folder and .bak with timestamp)

import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import zlib from 'zlib';
import https from 'https';
import 'dotenv/config';

async function main() {
  const server = process.env.SQL_SERVER;
  const database = process.env.SQL_DB;
  if (!server || !database) {
    console.error('[backup] Missing SQL_SERVER or SQL_DB env vars');
    process.exit(2);
  }
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  const retainDays = parseInt(process.env.BACKUP_RETENTION_DAYS || process.env.BACKUP_RETAIN_DAYS || '0', 10); // legacy + new name
  const keepCount = parseInt(process.env.BACKUP_KEEP_COUNT || '0', 10);   // preferred: keep last N backups
  const logFile = process.env.BACKUP_LOG_FILE;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  // Format: DB_yyyyMMdd_HHmmss.bak
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const fileName = `${database}_${stamp}.bak`;
  const fullPath = path.join(backupDir, fileName);
  const compress = /^(1|true|yes)$/i.test(process.env.BACKUP_COMPRESS||'');
  const dryRun = /^(1|true|yes)$/i.test(process.env.BACKUP_DRY_RUN||'');

  // Support instance name via SERVER\INSTANCE
  let host = server; let instanceName;
  if (server.includes('\\')){ const parts = server.split('\\'); host = parts[0]; instanceName = parts[1]; }
  const config = {
    server: host,
    database,
    user,
    password,
    options: { trustServerCertificate: true, instanceName },
    pool: { max: 3, min: 0, idleTimeoutMillis: 30000 }
  };

  console.log(`[backup] Connecting to ${server}/${database}`);
  try {
    await sql.connect(config);
  } catch (e) {
    console.error('[backup] Connection failed:', e.message);
    process.exit(3);
  }

  console.log('[backup] Running BACKUP DATABASE to', fullPath, compress?'(will compress)':'');
  try {
    // Sanitize database identifier (very small surface: allow closing bracket escaping)
    const dbQuoted = '[' + database.replace(/]/g, ']]') + ']';
    const parts = [];
    // COPY_ONLY requested by config (always on per requirements)
    parts.push('COPY_ONLY');
    // CHECKSUM for integrity if supported
    parts.push('CHECKSUM');
    // COMPRESSION optional (Express often ignores / not supported) can disable via env BACKUP_DISABLE_COMPRESSION=1
    if (!/^(1|true|yes)$/i.test(process.env.BACKUP_DISABLE_COMPRESSION||'')){
      parts.push('COMPRESSION');
    }
    const withClause = 'WITH INIT, ' + parts.join(', ');
    if (!dryRun){
      const sqlText = `BACKUP DATABASE ${dbQuoted} TO DISK = @path ${withClause}`;
      const request = new sql.Request();
      request.input('path', sql.NVarChar, fullPath);
      await request.query(sqlText);
    } else {
      console.log('[backup] DRY RUN - skipping actual BACKUP DATABASE execution');
    }
  } catch (e) {
    console.error('[backup] Backup failed:', e.message);
    if (e.originalError) console.error('[backup] originalError:', e.originalError.message);
    console.error('[backup] HINT: The path is resolved on the SQL Server machine. Ensure the SQL Server service account has write permission to', fullPath);
    process.exit(4);
  }
  if (!dryRun){
    console.log('[backup] Done ->', fullPath);
    appendLog(logFile, `[OK] ${new Date().toISOString()} ${fileName}`);
  }

  // Optional compression (.gz) AFTER successful backup
  let finalPath = fullPath;
  if (compress && !dryRun){
    try {
      const gzPath = fullPath + '.gz';
      await new Promise((resolve, reject)=>{
        const inp = fs.createReadStream(fullPath);
        const out = fs.createWriteStream(gzPath);
        const gz = zlib.createGzip({ level: 6 });
        inp.on('error', reject); out.on('error', reject); out.on('finish', resolve);
        inp.pipe(gz).pipe(out);
      });
      const origSize = fs.statSync(fullPath).size;
      const gzSize = fs.statSync(gzPath).size;
      fs.unlinkSync(fullPath); // remove original
      finalPath = gzPath;
      console.log(`[backup] Compressed -> ${gzPath} (${Math.round(gzSize/origSize*100)}% of original)`);
      appendLog(logFile, `[COMPRESS] ${new Date().toISOString()} ${path.basename(gzPath)} ${gzSize}`);
    } catch (e){ console.warn('[backup] compression failed', e.message); }
  }

  // Rotation by count (preferred)
  if (keepCount > 0){
    try {
      const files = fs.readdirSync(backupDir)
        .filter(f=>f.startsWith(database + '_') && f.toLowerCase().endsWith('.bak'))
        .map(f=>({ f, m: fs.statSync(path.join(backupDir,f)).mtimeMs }))
        .sort((a,b)=> b.m - a.m); // newest first
      if (files.length > keepCount){
        const toRemove = files.slice(keepCount);
        for (const r of toRemove){
          fs.unlinkSync(path.join(backupDir, r.f));
        }
        console.log(`[backup] keepCount=${keepCount} removed ${toRemove.length} old file(s)`);
        appendLog(logFile, `[ROTATE] ${new Date().toISOString()} removed ${toRemove.length} file(s)`);
      }
    } catch (e){ console.warn('[backup] count rotation failed', e.message); }
  } else if (retainDays > 0) {
    // Legacy days-based retention
    try {
      const files = fs.readdirSync(backupDir).filter(f=>f.toLowerCase().endsWith('.bak'));
      const nowMs = Date.now();
      let removed = 0;
      for (const f of files){
        const fp = path.join(backupDir, f);
        const stat = fs.statSync(fp);
        const ageDays = (nowMs - stat.mtimeMs) / 86400000;
        if (ageDays > retainDays){
          fs.unlinkSync(fp); removed++;
        }
      }
      if (removed) console.log(`[backup] rotation removed ${removed} old file(s)`);
    } catch (e){ console.warn('[backup] days rotation failed', e.message); }
  }
  // Webhook notification (non-blocking)
  if (process.env.BACKUP_WEBHOOK_URL && !dryRun){
    try { sendWebhook(process.env.BACKUP_WEBHOOK_URL, { database, file: path.basename(finalPath), size: fs.statSync(finalPath).size, compressed: compress, keepCount, retainDays, at: new Date().toISOString() }); }
    catch(e){ console.warn('[backup] webhook failed', e.message); }
  }
  process.exit(0);
}

main().catch(e => { console.error('[backup] Fatal', e); process.exit(1); });

function appendLog(logFile, line){
  if (!logFile) return;
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
}

function sendWebhook(urlStr, payload){
  try {
    const u = new URL(urlStr);
    const body = JSON.stringify(payload);
    const opts = { method:'POST', hostname:u.hostname, port:u.port||443, path:u.pathname + (u.search||''), headers: { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, res=>{ res.on('data', ()=>{}); });
    req.on('error', e=> console.warn('[backup] webhook error', e.message));
    req.write(body); req.end();
  } catch (e){ console.warn('[backup] invalid webhook url', e.message); }
}
