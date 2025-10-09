#!/usr/bin/env node
// enrichment-report.mjs - Summarize enriched items from SQLite.
import '../rules-engine/src/logger.js';
import storageAdapter from '../rules-engine/src/storageAdapter.js';
import sqliteService from '../rules-engine/src/sqliteService.js';
import fs from 'fs';

const LIMIT = parseInt(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1] || process.env.REPORT_LIMIT || '50', 10);
const PART_FILTER = process.argv.find(a=>a.startsWith('--part='))?.split('=')[1] || null;
const JSON_OUT = process.argv.includes('--json');
const SUMMARY_ONLY = process.argv.includes('--summary');

function parseEnriched(row){
  try {
    if (row.enriched_json) return JSON.parse(row.enriched_json);
    if (row.enriched) return row.enriched; // legacy
  } catch {}
  return null;
}

async function main(){
  await storageAdapter.init();
  if (!storageAdapter.isSQLite()){
    console.error('[enrichment-report] Currently only SQLite mode supported');
    process.exit(2);
  }
  await sqliteService.init();
  const rows = await new Promise((resolve,reject)=>{
    sqliteService.db.all('SELECT partNumber, manufacturer, enriched_json FROM items ORDER BY rowid DESC LIMIT ?', [LIMIT], (e,r)=> e?reject(e):resolve(r));
  });
  const parsed = [];
  for (const r of rows){
    if (PART_FILTER && r.partNumber !== PART_FILTER) continue;
    const enriched = parseEnriched(r);
    if (!enriched) continue;
    const sec = enriched.sections||{};
    const identity = sec.identity||{};
    const marketing = sec.marketing||{};
    const specs = sec.specs||{};
    parsed.push({
      part: identity.partNumber || r.partNumber,
      name: (identity.name||'').slice(0,40),
      manu: (identity.manufacturer||r.manufacturer||'').slice(0,18),
      q: enriched.quality_score,
      bucket: enriched.quality_bucket,
      feats: (specs.features||[]).length,
      syns: (identity.synonyms||[]).length,
      tags: (identity.rule_tags||[]).length,
      bundles: (identity.bundle_candidates||[]).length,
      bullets: (marketing.short_benefit_bullets||[]).length
    });
  }
  if (JSON_OUT){
    console.log(JSON.stringify({ count: parsed.length, items: parsed }, null, 2));
    return;
  }
  if (!SUMMARY_ONLY){
    const header = ['PART','Q','BKT','FEAT','SYNS','TAGS','BUND','BUL','MANUFACTURER','NAME'];
    console.log(header.join('\t'));
    for (const p of parsed){
      console.log([
        p.part,
        p.q,
        p.bucket,
        p.feats,
        p.syns,
        p.tags,
        p.bundles,
        p.bullets,
        p.manu,
        p.name
      ].join('\t'));
    }
  }
  const summary = {
    total_listed: parsed.length,
    avg_quality: parsed.length? Math.round(parsed.reduce((a,b)=>a+(b.q||0),0)/parsed.length) : 0,
    high: parsed.filter(p=>p.bucket==='high').length,
    medium: parsed.filter(p=>p.bucket==='medium').length,
    low: parsed.filter(p=>p.bucket==='low').length,
    avg_features: parsed.length? (parsed.reduce((a,b)=>a+b.feats,0)/parsed.length).toFixed(2): '0'
  };
  console.log('\nSummary:', summary);
  try { fs.writeFileSync('enrichment-report-latest.json', JSON.stringify({ generatedAt: new Date().toISOString(), summary, sample: parsed.slice(0,10) }, null, 2)); } catch {}
}

main().catch(e=>{ console.error('[enrichment-report] fatal', e); process.exit(1); });