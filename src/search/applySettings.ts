import algoliasearch from 'algoliasearch';
import { ALGOLIA_SETTINGS, applyIndexSettings } from './algoliaSettings';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const INDEX_NAME = 'woocommerce_products';

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
  console.error('Algolia credentials missing in environment variables.');
  process.exit(1);
}

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
const index = client.initIndex(INDEX_NAME);

applyIndexSettings(index)
  .then(() => {
    console.log('Algolia index settings applied successfully.');
  })
  .catch((err) => {
    console.error('Failed to apply Algolia settings:', err);
    process.exit(1);
  });
