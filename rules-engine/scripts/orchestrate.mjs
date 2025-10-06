#!/usr/bin/env node
// Orchestrate: classify sample products then incremental sync to Algolia
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import logger from '../src/logger.js';
// index.js exports { rulesEngine, generateSampleProducts } plus default main; not default rulesEngine
import { rulesEngine as engine, generateSampleProducts } from '../src/index.js';
import algoliaSync from '../src/algoliaSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(){
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const purge = args.includes('--purge');
  const offline = args.includes('--offline');
  const countArg = args.find(a=>/^--count=/.test(a));
  const count = countArg ? parseInt(countArg.split('=')[1]) : 20;
  const useSamples = args.includes('--samples');
  const manuArg = args.find(a=>/^--manufacturers=/.test(a));
  const manuFilters = manuArg ? manuArg.split('=')[1].split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
  const whereArg = args.find(a=>/^--where=/.test(a));
  const whereCond = whereArg ? whereArg.split('=')[1] : '';
  if (offline) {
    process.env.OFFLINE_MODE = '1';
    process.env.SKIP_DB = '1';
  }
  if (args.includes('--skip-db')) {
    process.env.SKIP_DB = '1';
  }
  const noSync = offline ? true : args.includes('--no-sync');

  logger.banner('Orchestrator: classify -> sync');
  if (offline) {
    logger.warn('Running in OFFLINE mode: will skip DB, skip sync, force AI fallback.');
  }
  let products = [];
  if (useSamples){
    products = generateSampleProducts(count);
  } else {
    // Placeholder: load from JSON file if provided
    const fileArg = args.find(a=>/^--file=/.test(a));
    if (fileArg){
      const fp = fileArg.split('=')[1];
      const raw = fs.readFileSync(fp,'utf8');
      products = JSON.parse(raw);
    } else {
      products = generateSampleProducts(count);
    }
  }
  if (manuFilters.length){
    products = products.filter(p=> manuFilters.includes((p.manufacturer||p.brand||'').toLowerCase()));
  }
  // If --where provided and we are still in sample mode, apply lightweight JS filter heuristically
  if (whereCond){
    // simple patterns manufacturer='X' or price>100
    try {
      const cond = whereCond.toLowerCase();
      if (/manufacturer\s*=\s*'([^']+)'/i.test(whereCond)) {
        const m = whereCond.match(/manufacturer\s*=\s*'([^']+)'/i)[1].toLowerCase();
        products = products.filter(p=> (p.manufacturer||'').toLowerCase() === m);
      }
      if (/price\s*>\s*(\d+)/i.test(whereCond)) {
        const v = parseFloat(whereCond.match(/price\s*>\s*(\d+)/i)[1]);
        products = products.filter(p=> (p.price||0) > v);
      }
      if (/price\s*<\s*(\d+)/i.test(whereCond)) {
        const v2 = parseFloat(whereCond.match(/price\s*<\s*(\d+)/i)[1]);
        products = products.filter(p=> (p.price||0) < v2);
      }
    } catch(e){ logger.warn('Failed to apply where filter heuristically', e.message); }
  }
  logger.info(`Processing ${products.length} products (full=${full}) manuFilters=[${manuFilters.join(',')||'none'}] where='${whereCond||'none'}'`);
  await engine.initialize();
  for (const p of products){
    await engine.processProduct(p);
  }
  await engine.shutdown();
  if (noSync){
    logger.info('Classification phase complete. Skipping Algolia sync (--no-sync)');
  } else {
    logger.info('Classification phase complete. Starting Algolia sync...');
    await algoliaSync.syncProducts({ fullSync: full, purgeMissing: purge });
  }
  logger.success('Done.');
}

main().catch(e=>{ console.error(e); process.exit(1); });
