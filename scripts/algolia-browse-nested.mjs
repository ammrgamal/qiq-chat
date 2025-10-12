#!/usr/bin/env node
import dotenv from 'dotenv';
import algoliasearch from 'algoliasearch';

dotenv.config({ path: '.env' });

const appId = process.env.ALGOLIA_APP_ID;
const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
const indexName = process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';

if (!appId || !apiKey) {
  console.error('[browse] Missing ALGOLIA credentials');
  process.exit(2);
}

const client = algoliasearch(appId, apiKey);
const index = client.initIndex(indexName);

async function main(){
  const filters = process.argv.slice(2).join(' ') || 'brand:Kaspersky AND price.gross > 0';
  const res = await index.search('', { filters, hitsPerPage: 5, attributesToRetrieve: ['objectID','name','brand','price','media','ai'] });
  console.log('[browse] Filters:', filters);
  console.log('[browse] Count:', res.nbHits);
  console.log(JSON.stringify(res.hits, null, 2));
}

main().catch(e=>{ console.error('[browse] Failed', e); process.exit(1); });
