#!/usr/bin/env node
// run-enrichment-db.mjs - Pull 20 items (10 CommScope, 10 Kaspersky) from MSSQL Rules_Item and run real enrichment pipeline.
import '../src/logger.js';
// Lazy load heavy modules after stable DB connection
let storageAdapter; // assigned dynamically
let pipeline;       // assigned dynamically
import { productHash } from '../src/utils/hash.js';
import sql from 'mssql';
import 'dotenv/config';

const PER_BRAND = parseInt(process.env.ENRICH_PER_BRAND || '10', 10);
const VERSION = process.env.ENRICH_VERSION || 'v1.0.0';
const DRY = /^(1|true|yes)$/i.test(String(process.env.ENRICH_DRY_RUN||''));

import fs from 'fs';
function buildConfig(){
  const cfgPath = new URL('../../config/dbConfig.json', import.meta.url);
  let base = {};
  try { if (fs.existsSync(cfgPath)) base = JSON.parse(fs.readFileSync(cfgPath,'utf8')); } catch {}
  const rawServer = process.env.SQL_SERVER || base.server;
  let server = rawServer;
  let instanceName;
  if (rawServer && rawServer.includes('\\')){
    const parts = rawServer.split('\\');
    server = parts[0];
    instanceName = parts[1];
  }
  const database = process.env.SQL_DB || base.database;
  const user = process.env.SQL_USER || base.user;
  const password = process.env.SQL_PASSWORD || base.password;
  return {
    rawServer,
    config: {
      server,
      database,
      user,
      password,
      options: { trustServerCertificate: true, instanceName },
      pool: { max:5, min:0, idleTimeoutMillis:30000 }
    }
  };
}

async function connectMSSQL(){
  const { rawServer, config } = buildConfig();
  if (!config.server || !config.database){
    console.error('[enrich-db] Missing SQL_SERVER or SQL_DB env vars');
    process.exit(10);
  }
  if (!config.user || !config.password){
    console.warn('[enrich-db] Warning: Missing SQL_USER/SQL_PASSWORD (Windows auth not implemented here).');
  }
  const safe = { ...config, password: config.password? '***' : undefined };
  // Ensure any previous pool is closed (defensive)
  try { await sql.close(); } catch {}
  console.log('[enrich-db] Connecting with config (attempt 1):', safe);
  try {
    await sql.connect(config);
    return;
  } catch (e){
    console.warn('[enrich-db] First connection attempt failed:', e.message);
    if (e.originalError) console.warn('[enrich-db] originalError:', e.originalError.message);
    // Retry once after short delay if ELOGIN
    if (String(e.message).toLowerCase().includes('login failed')){
      await new Promise(r=>setTimeout(r,600));
      try { await sql.close(); } catch {}
      console.log('[enrich-db] Retrying connection (attempt 2)...');
      try {
        await sql.connect(config);
        console.log('[enrich-db] Connected on retry.');
        return;
      } catch (e2){
        console.error('[enrich-db] Retry connection failed:', e2.message);
        if (e2.originalError) console.error('[enrich-db] originalError:', e2.originalError.message);
        process.exit(11);
      }
    } else {
      console.error('[enrich-db] Connection failed (non-login error):', e.message);
      process.exit(11);
    }
  }
}

const PICK_QUERY = (per)=>`;
WITH base AS (
  SELECT TOP (400) RuleID, PartNumber, Manufacturer, ProductName, Classification, Keywords
  FROM dbo.Rules_Item
  WHERE (Manufacturer LIKE '%commscope%' OR ProductName LIKE '%commscope%' OR Manufacturer LIKE '%kaspersky%' OR ProductName LIKE '%kaspersky%')
    AND PartNumber IS NOT NULL AND LEN(PartNumber) > 0
  ORDER BY NEWID()
)
SELECT * FROM (
  SELECT TOP (${per}) * FROM base WHERE Manufacturer LIKE '%commscope%' OR ProductName LIKE '%commscope%' ORDER BY NEWID()
) a
UNION ALL
SELECT * FROM (
  SELECT TOP (${per}) * FROM base WHERE Manufacturer LIKE '%kaspersky%' OR ProductName LIKE '%kaspersky%' ORDER BY NEWID()
) b`;

function toProduct(row){
  return {
    id: String(row.RuleID),
    partNumber: row.PartNumber,
    name: row.ProductName || row.PartNumber,
    manufacturer: row.Manufacturer || '',
    classification: row.Classification || 'Standard',
    keywords: row.Keywords || '',
    description: row.ProductName || ''
  };
}

async function main(){
  const startedAll = Date.now();
  await connectMSSQL();
  // Dynamic imports AFTER successful DB connection to avoid earlier pool interference
  if (!storageAdapter){
    const modSA = await import('../src/storageAdapter.js');
    storageAdapter = modSA.default;
  }
  if (!pipeline){
    const modPipe = await import('../src/enrichmentPipeline.js');
    pipeline = modPipe.default;
  }
  await storageAdapter.init();
  let rows = [];
  try {
    const res = await sql.query(PICK_QUERY(PER_BRAND));
    rows = res.recordset || [];
  } catch (e){
    console.warn('[enrich-db] query failed, will attempt seed fallback:', e.message);
  }
  let usingSeed = false;
  if (!rows.length){
    // Seed fallback
    const seedPath = new URL('../../seed/enrich-brands.json', import.meta.url);
    try {
      const fs = await import('fs');
      const txt = fs.readFileSync(seedPath, 'utf8');
      const seed = JSON.parse(txt);
      rows = seed.map((s,i)=>({
        RuleID: s.id || s.partNumber || `seed-${i+1}`,
        PartNumber: s.partNumber,
        Manufacturer: s.manufacturer,
        ProductName: s.name,
        Classification: s.classification || 'Standard',
        Keywords: (s.keywords||[]).join(',')
      }));
      usingSeed = true;
      console.log(`[enrich-db] using seed fallback items count=${rows.length}`);
    } catch (se){
      console.error('[enrich-db] no candidate rows and seed load failed', se.message);
      process.exit(2);
    }
  }
  console.log(`[enrich-db] selected ${rows.length} rows${usingSeed?' (seed)':''}`);
  const products = rows.map(toProduct);
  console.table(products.map(p=>({ id:p.id, part:p.partNumber, manu:p.manufacturer, name:p.name.slice(0,40) })));

  let enriched=0, skipped=0, failed=0; const results=[];
  for (const p of products){
    const hash = productHash(p);
    try {
      const existing = await storageAdapter.getByHash(hash);
      if (existing && existing.ai_version === VERSION){
        skipped++; console.log(`[enrich-db] skip part=${p.partNumber} hash=${hash}`); continue;
      }
      const res = await pipeline.enrich(p);
      if (!DRY){
        await storageAdapter.saveItem({ id: p.id, partNumber: p.partNumber, manufacturer: p.manufacturer, raw: p, enriched: res, aiVersion: res.version, hash: res.hash });
        await storageAdapter.log({ itemId: p.id, status: res.errors.length?'failed':'enriched', aiVersion: res.version, durationMs: res.durationMs||0, error: res.errors.length?res.errors.join(';'):null });
      }
      if (res.errors.length) failed++; else enriched++;
      results.push({ partNumber: p.partNumber, manufacturer: p.manufacturer, status: res.errors.length?'failed':'enriched', hash: res.hash });
      console.log(`[enrich-db] part=${p.partNumber} status=${res.errors.length?'failed':'enriched'} ms=${res.durationMs}`);
    } catch (e){
      failed++; console.warn(`[enrich-db] part=${p.partNumber} error=${e.message}`);
      if (!DRY) await storageAdapter.log({ itemId: p.id, status:'failed', aiVersion: VERSION, durationMs:0, error: e.message });
    }
  }
  const summary = { total: products.length, enriched, skipped, failed, version: VERSION, durationMs: Date.now()-startedAll, selected: products.map(p=>p.partNumber) };
  console.log(JSON.stringify(summary, null, 2));
  console.log('[enrich-db] field sample (first 3 enriched items if any):');
  try {
    let count=0;
    for (const r of results){
      if (r.status==='enriched' && count<3){
        // fetch from storage if sqlite (quick) else skip heavy fetch
        console.log('  ->', r.partNumber, r.manufacturer, 'hash='+r.hash);
        count++;
      }
    }
  } catch {}
  // Write selected list for auditing
  try { await (await import('fs')).promises.writeFile('enrichment-selected.json', JSON.stringify(summary, null, 2)); } catch {}
}

main().catch(e=>{ console.error('[enrich-db] fatal', e); process.exit(1); });
