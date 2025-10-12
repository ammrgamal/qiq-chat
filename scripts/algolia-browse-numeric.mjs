#!/usr/bin/env node
import dotenv from 'dotenv';
import algoliasearch from 'algoliasearch';

dotenv.config({ path: '.env' });

const appId = process.env.ALGOLIA_APP_ID;
const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
const indexName = process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';

if (!appId || !apiKey) {
  console.error('[numeric-browse] Missing ALGOLIA credentials');
  process.exit(2);
}

const client = algoliasearch(appId, apiKey);
const index = client.initIndex(indexName);

async function main(){
  const expr = process.argv[2] || 'prices.gross>0';
  const brand = process.argv[3] || 'Kaspersky';
  const res = await index.search('', {
    numericFilters: [expr],
    facetFilters: [[`brand:${brand}`]],
    hitsPerPage: 5,
    attributesToRetrieve: ['objectID','name','brand','price','prices']
  });
  console.log('[numeric-browse] numericFilters:', expr, 'brand:', brand);
  console.log('[numeric-browse] Count:', res.nbHits);
  console.log(JSON.stringify(res.hits, null, 2));
}

main().catch(e=>{ console.error('[numeric-browse] Failed', e); process.exit(1); });
