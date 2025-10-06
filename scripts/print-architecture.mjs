#!/usr/bin/env node
// prints a concise ASCII architecture snapshot
import fs from 'fs';
import path from 'path';

function section(title){
  console.log('\n' + title); console.log('-'.repeat(title.length));
}
section('QIQ Architecture Snapshot');
console.log('Version: dynamic');

section('Core Components');
console.log(`server.js        -> Express entry / dynamic API loader`);
console.log(`rules-engine/    -> Classification + enrichment + sync`);
console.log(`api/             -> Feature + domain endpoints`);
console.log(`public/          -> Static UI & search facets`);

section('Enrichment Stages');
console.log('1 extract  2 marketing  3 compliance  4 embeddings (future)');

section('Flags (orchestrate.mjs)');
console.log('--samples --count=N --full --purge --manufacturers= --where=' );
console.log('--skip-db --no-sync --offline');

section('Facets (Algolia)');
console.log('ai_version | enrichment_version | data_quality_bucket | risk_bucket | lifecycle_stage');

section('Secrets (runtime only)');
console.log('Dynamic local.secrets.json loader (DISABLE_LOCAL_SECRETS=1 to skip)');

section('Pricing Tiers (config/pricing-tiers.json)');
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(),'config','pricing-tiers.json'),'utf8'));
  cfg.tiers.forEach(t=> console.log(`${t.name.padEnd(11)} EGP ${t.monthly}/mo :: ${t.features.slice(0,2).join(', ')}...`));
} catch { console.log('No pricing config found.'); }

section('Circuit Breaker');
console.log('AI providers: threshold=3 auth failures -> 5m cooldown');

section('Offline Mode');
console.log('--offline => OFFLINE_MODE + SKIP_DB + no-sync + fallback classification');

section('Next Potential Enhancements');
console.log('- Embeddings integration\n- Arabic marketing stage\n- Quality scoring bucketization');
