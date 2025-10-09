#!/usr/bin/env node
// Inserts a fabricated Arabic-containing product into enrichment storage to demonstrate synonym generation.
import 'dotenv/config';
import storage from '../rules-engine/src/storageAdapter.js';
import pipeline from '../rules-engine/src/enrichmentPipeline.js';
import { productHash } from '../rules-engine/src/utils/hash.js';

async function main(){
  await storage.init();
  const product = {
    partNumber: 'ARABIC-DEMO-001',
    manufacturer: 'Fortinet',
    name: 'جدار حماية فايروال متقدم', // contains Arabic for firewall
    description: 'حل حماية الشبكات - فايروال ذكي لأمان المؤسسات مع دعم PoE.'
  };
  const enriched = await pipeline.enrich(product);
  const hash = productHash(product);
  if (process.env.ENRICH_DRY_RUN === '1'){
    console.log('[arabic-demo] DRY RUN enriched:', JSON.stringify(enriched, null, 2));
    return;
  }
  await storage.saveItem({
    id: product.partNumber,
    partNumber: product.partNumber,
    manufacturer: product.manufacturer,
    raw: product,
    enriched,
    aiVersion: enriched.version || '1',
    hash
  });
  await storage.log({ itemId: product.partNumber, status: 'OK', aiVersion: enriched.version, durationMs: enriched.durationMs||0 });
  console.log('[arabic-demo] Inserted Arabic demo product. Run: npm run print:enriched -- --part=ARABIC-DEMO-001');
}

main().catch(e=>{ console.error('[arabic-demo] failed', e); process.exit(1); });
