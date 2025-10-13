#!/usr/bin/env node
// Apply Algolia index settings to ensure rich attributes are retrievable/visible
import 'dotenv/config';
import algoliasearch from 'algoliasearch';

const appId = process.env.ALGOLIA_APP_ID;
const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
const indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';

if (!appId || !apiKey) {
  console.error('Missing ALGOLIA_APP_ID or API key');
  process.exit(2);
}

const client = algoliasearch(appId, apiKey);
const index = client.initIndex(indexName);

const attributesToRetrieve = [
  'objectID','name','brand','category','short_description','long_description','features','specs_table','faq','value_proposition','prerequisites','related','image','spec_sheet','scope_of_work','ai_processed_at','tags','media.image','media.datasheet'
];

const searchableAttributes = [
  'name','brand','category','short_description','long_description','features','tags'
];

const attributesForFaceting = [
  'brand','category','tags'
];

const settings = {
  attributesToRetrieve,
  searchableAttributes,
  attributesForFaceting,
};

await index.setSettings(settings);
console.log('Applied rich settings to index', indexName);
