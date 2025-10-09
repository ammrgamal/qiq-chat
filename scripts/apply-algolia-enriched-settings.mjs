#!/usr/bin/env node
// apply-algolia-enriched-settings.mjs
// Applies enriched index settings (including synonyms/quality fields) to Algolia.
import 'dotenv/config';
import algoliasearch from 'algoliasearch';

function warn(msg){ console.warn('[algolia-settings]', msg); }

async function main(){
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
  const indexName = process.env.ALGOLIA_INDEX || process.env.ALGOLIA_INDEX_NAME || 'enriched_products_dev';
  if (!appId || !apiKey){
    console.error('[algolia-settings] Missing ALGOLIA_APP_ID or admin key');
    process.exit(2);
  }
  const client = algoliasearch(appId, apiKey);
  const index = client.initIndex(indexName);
  const settings = {
    searchableAttributes: [
      'sku','mpn','name','brand','category',
      'custom_memo','custom_text','tags',
      'search_synonyms','sections.identity.synonyms'
    ],
    attributesForFaceting: ['brand','category','availability','quality_bucket'],
    customRanking: ['desc(availability_weight)','desc(quality_score)','asc(price)'],
    attributesToRetrieve: [
      'objectID','name','brand','category','price','availability','availability_weight',
      'quality_score','quality_bucket','search_synonyms','features','value_statement','short_description'
    ],
    removeWordsIfNoResults: 'allOptional',
    ignorePlurals: true,
    typoTolerance: 'min',
    decompoundQuery: true
  };
  try {
    console.log('[algolia-settings] Applying settings to', indexName);
    await index.setSettings(settings);
    console.log('[algolia-settings] Done. You can now sync enriched records.');
  } catch (e){
    console.error('[algolia-settings] Failed:', e.message);
    if (/not enough rights|invalid api key/i.test(e.message)){
      warn('Use an Admin API key with editSettings right.');
    }
    process.exit(3);
  }
}

main().catch(e=>{ console.error('[algolia-settings] fatal', e); process.exit(1); });
