#!/usr/bin/env node
// Run enrichment over a batch of items.
import '../src/logger.js';
import storageAdapter from '../src/storageAdapter.js';
import pipeline from '../src/enrichmentPipeline.js';
import { productHash } from '../src/utils/hash.js';

const BATCH = Number(process.env.ENRICH_BATCH_SIZE||50);
const DRY = /^(1|true|yes)$/i.test(String(process.env.ENRICH_DRY_RUN||''));
const MAX_CONC = Math.max(1, Number(process.env.ENRICH_MAX_CONCURRENCY||3));
const TARGET_STAGE = process.argv.find(a=>a.startsWith('--stage='))?.split('=')[1] || null; // stage1|stage2|stage3|stage4|comma list
const ITEMS_FILTER = process.argv.find(a=>a.startsWith('--items='))?.split('=')[1]?.split(',').map(s=>s.trim()).filter(Boolean) || null;
const HELP = process.argv.includes('--help');
const WEBHOOK = process.env.ENRICH_WEBHOOK_URL || null;

if (HELP){
  console.log(`Usage: node run-enrichment.mjs [--items=PN1,PN2] [--stage=stage2] [--help]\nEnv: ENRICH_BATCH_SIZE, ENRICH_MAX_CONCURRENCY, ENRICH_VERSION, ENRICH_DRY_RUN=1, ENRICH_WEBHOOK_URL`);
  process.exit(0);
}

async function loadSampleItems(){
  // Placeholder: In full system, pull from SQL Server. Here we simulate minimal items.
  return [
    { id:'ITEM-1', partNumber:'SW-24', name:'Managed Switch 24-Port', manufacturer:'NetPro', description:'Layer2/Layer3 managed switch for SMB.' },
    { id:'ITEM-2', partNumber:'SRV-1U', name:'Rack Server 1U', manufacturer:'ComputeCore', description:'1U enterprise server with hot-swap bays.' },
    { id:'ITEM-3', partNumber:'NAS-8B', name:'Storage NAS 8-Bay', manufacturer:'DataBox', description:'8-bay NAS with redundancy.' }
  ];
}

async function main(){
  const startAll = Date.now();
  await storageAdapter.init();
  let items = (await loadSampleItems());
  if (ITEMS_FILTER){ items = items.filter(it=> ITEMS_FILTER.includes(it.partNumber)); }
  items = items.slice(0,BATCH);
  const version = process.env.ENRICH_VERSION || 'v1.0.0';
  let enriched=0, skipped=0, failed=0;
  // Concurrency pool
  const queue = [...items];
  const doing = [];
  const results = [];
  const qualityScore = (res)=>{
    let score = 0;
    if (res.features && res.features.length) score += Math.min(30, res.features.length*5);
    if (res.value_statement) score += Math.min(20, res.value_statement.length/50);
    if (res.risk_score !== undefined) score += 10;
    if (res.compliance_tags && res.compliance_tags.length) score += Math.min(20, res.compliance_tags.length*5);
    if (!res.errors.length) score += 20;
    return Math.round(Math.min(100, score));
  };

  const worker = async () => {
    while (queue.length){
      const it = queue.shift();
      const hash = productHash(it);
      try {
        const existing = await storageAdapter.getByHash(hash);
        let res;
        if (TARGET_STAGE && existing && existing.enriched){
          const stages = TARGET_STAGE.split(',').map(s=>s.trim()).filter(Boolean);
          res = await pipeline.reEnrichPartial(it, existing.enriched || existing.enriched_json || existing, stages);
          res.hash = hash; // hash unchanged
          res.version = version;
        } else if (existing && existing.ai_version === version && !TARGET_STAGE){
          skipped++; console.log(`[enrich-result] item=${it.partNumber} status=skipped hash=${hash}`); continue;
        } else {
          res = await pipeline.enrich(it);
        }
        res.quality_score = qualityScore(res);
        if (res.errors && res.errors.length) failed++; else enriched++;
        console.log(`[enrich-result] item=${it.partNumber} status=${res.errors.length?'failed':'enriched'} hash=${res.hash} ms=${res.durationMs} q=${res.quality_score}`);
        if (!DRY){
          await storageAdapter.saveItem({ id: it.id, partNumber: it.partNumber, manufacturer: it.manufacturer, raw: it, enriched: res, aiVersion: res.version, hash: res.hash });
          await storageAdapter.log({ itemId: it.id, status: res.errors.length?'failed': (res.partial?'partial':'enriched'), aiVersion: res.version, durationMs: res.durationMs||0, error: res.errors && res.errors.length? res.errors.join(';'): null });
        }
        results.push({ partNumber: it.partNumber, status: res.errors.length?'failed':'enriched', hash: res.hash, ms: res.durationMs, q: res.quality_score });
      } catch (e){
        failed++; console.warn(`[enrich-result] item=${it.partNumber} status=failed hash=${hash} error=${e.message}`);
        await storageAdapter.log({ itemId: it.id, status:'failed', aiVersion: version, durationMs:0, error: e.message });
      }
    }
  };

  for (let i=0;i<MAX_CONC;i++) doing.push(worker());
  await Promise.all(doing);

  const totalMs = Date.now()-startAll;
  const summary = { ok:true, total: items.length, enriched, skipped, failed, version, durationMs: totalMs };
  console.log(JSON.stringify(summary, null, 2));
  if (WEBHOOK && !DRY){
    try {
      await fetch(WEBHOOK, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ summary, results }) });
      console.log('[webhook] sent');
    } catch (e){ console.warn('[webhook] failed', e.message); }
  }
}

main().catch(e=>{ console.error('run-enrichment fatal', e); process.exit(1); });
