#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';

// Ensure env is loaded from project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

const { default: algoliaService } = await import('../enrichment-engine/src/algoliaService.js');

if (!algoliaService.isConfigured()){
  console.error('[configure] Algolia not configured. Check ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY in .env');
  process.exit(2);
}

await algoliaService.configureIndex();
console.log('[configure] Applied Algolia index settings.');
