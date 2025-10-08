#!/usr/bin/env node
/**
 * Print one (or more) enriched items from storage (SQLite or MSSQL via storageAdapter) by part number hash or part number.
 * Usage:
 *   node scripts/print-enriched.mjs --part=CSC-OPT-1001
 *   node scripts/print-enriched.mjs --parts=CSC-OPT-1001,KAS-SFT-2005
 *   node scripts/print-enriched.mjs --limit=1            (first available)
 *
 * Output: Pretty-printed JSON including sections + selected root meta.
 */
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function loadHelpers() {
  const storage = (await import('../rules-engine/src/storageAdapter.js').catch(() => ({}))).default;
  const sqlite = (await import('../rules-engine/src/sqliteService.js').catch(() => ({}))).default;
  if (storage && storage.init) await storage.init();
  return { storage, sqlite };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const [k, v = ''] = a.replace(/^--/, '').split('=');
    out[k] = v;
  }
  return out;
}

async function main() {
  const { part, parts, limit = '1', pretty = '2' } = parseArgs();
  let targets = [];
  if (part) targets = [part];
  if (parts) targets = parts.split(',').map(s => s.trim()).filter(Boolean);

  const { storage, sqlite } = await loadHelpers();
  let results = [];
  // Direct SQLite read of items table
  if (sqlite && sqlite.db) {
    const all = await new Promise((resolve,reject)=>{
      sqlite.db.all('SELECT partNumber, enriched_json FROM items ORDER BY updated_at DESC LIMIT ?', [parseInt(limit,10)], (e,rows)=> e?reject(e):resolve(rows));
    }).catch(()=>[]);
    for (const row of all) {
      if (targets.length && !targets.includes(row.partNumber)) continue;
      if (!row.enriched_json) continue;
      results.push({ partNumber: row.partNumber, enriched: JSON.parse(row.enriched_json) });
    }
    // If targets specified but not found, results might be empty.
  }
  // MSSQL fallback: query by hash not implemented; skip unless we add getRecent.

  if (!results.length) {
    console.error('No enriched items found. Have you run the enrichment script?');
    process.exit(1);
  }

  const space = parseInt(pretty, 10) || 0;
  for (const r of results) {
    console.log('\n=== Part:', r.partNumber, '===');
    const minimal = {
      partNumber: r.partNumber,
      version: r.enriched.version,
      hash: r.enriched.hash,
      sections: r.enriched.sections,
      quality_score: r.enriched.quality_score,
      warnings: r.enriched.warnings,
      errors: r.enriched.errors
    };
    console.log(JSON.stringify(minimal, null, space));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
