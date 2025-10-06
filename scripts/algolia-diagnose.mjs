#!/usr/bin/env node
// algolia-diagnose.mjs - Quick diagnostic script to list indices, record counts, and sample objects
// Usage: node scripts/algolia-diagnose.mjs [--index name] [--sample 3]
// Requires: ALGOLIA_APP_ID + (ALGOLIA_ADMIN_API_KEY or ALGOLIA_API_KEY) environment variables.

import algoliasearch from 'algoliasearch';
import dotenv from 'dotenv';

try { dotenv.config(); } catch {}

const appId = process.env.ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY; // fallback
const idxEnvA = process.env.ALGOLIA_INDEX?.trim();
const idxEnvB = process.env.ALGOLIA_INDEX_NAME?.trim();
const defaultIndex = idxEnvA || idxEnvB || 'woocommerce_products';

if (!appId || !adminKey){
  console.error('❌ Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY (or ALGOLIA_API_KEY)');
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (flag, def=null) => {
  const i = args.indexOf(flag); if (i !== -1 && args[i+1]) return args[i+1]; return def;
};
const targetIndex = getArg('--index', defaultIndex);
const sampleSize = Number(getArg('--sample', '3')) || 3;

(async () => {
  const client = algoliasearch(appId, adminKey);
  console.log(`🔍 Algolia Diagnose for index '${targetIndex}' (env default: ${defaultIndex})`);
  if (idxEnvA && idxEnvB && idxEnvA !== idxEnvB){
    console.warn(`⚠️ Environment mismatch: ALGOLIA_INDEX='${idxEnvA}' vs ALGOLIA_INDEX_NAME='${idxEnvB}'`);
  }

  try {
    const indices = await client.listIndices();
    const hit = indices.items.find(i => i.name === targetIndex);
    if (!hit){
      console.warn(`⚠️ Index '${targetIndex}' not found. Available indices:`);
      indices.items.slice(0,20).forEach(i => console.log(` - ${i.name} (entries=${i.entries})`));
      process.exit(2);
    }
    console.log(`✅ Found index '${hit.name}' entries=${hit.entries} lastBuild=${hit.dataUpdatedAt}`);
  } catch (e){
    console.error('Failed to list indices:', e.message);
  }

  // Fetch 1 empty search to get stats & then browse sample objects
  const index = client.initIndex(targetIndex);
  try {
    const res = await index.search('', { hitsPerPage: sampleSize });
    console.log(`ℹ️ Search Stats: nbHits=${res.nbHits} processingTimeMS=${res.processingTimeMS}`);
    res.hits.forEach((h, i) => {
      console.log(`--- Hit ${i+1} objectID=${h.objectID}`);
      const shallow = { ...h };
      // Limit printing of large arrays
      ['features','specs','faq','use_cases','search_synonyms'].forEach(k=>{
        if (Array.isArray(shallow[k])) shallow[k] = shallow[k].slice(0,5);
      });
      console.dir(shallow, { depth: 2, maxArrayLength: 10 });
    });
  } catch (e){
    console.error('Search failed:', e.message);
  }
})();
