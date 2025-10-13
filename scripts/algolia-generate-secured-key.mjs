#!/usr/bin/env node
// Generate a secured Algolia API key limited to brand:Kaspersky for quick testing
import 'dotenv/config';
import algoliasearch from 'algoliasearch';

const appId = process.env.ALGOLIA_APP_ID;
const searchKey = process.env.ALGOLIA_API_KEY; // search-only key is fine
const indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';

if (!appId || !searchKey){
  console.error('Missing ALGOLIA_APP_ID or ALGOLIA_API_KEY');
  process.exit(2);
}

const now = Math.floor(Date.now()/1000);
const validUntil = now + 6*60*60; // 6 hours

const securedApiKey = algoliasearch.generateSecuredApiKey(searchKey, {
  filters: 'brand:Kaspersky',
  restrictIndices: indexName,
  validUntil
});

const sampleCurl = [
  'curl -X POST \\\',
  `  https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query \\\\`,
  `  -H "X-Algolia-Application-Id: ${appId}" \\\\`,
  `  -H "X-Algolia-API-Key: ${securedApiKey}" \\\\`,
  '  -H "Content-Type: application/json" \\\\',
  '  --data "{\"query\":\"\",\"hitsPerPage\":10}"'
].join('\n');

console.log(JSON.stringify({ ok:true, appId, indexName, validUntil, securedApiKey, sampleCurl }, null, 2));
