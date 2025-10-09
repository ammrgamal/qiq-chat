#!/usr/bin/env node
// sync-enriched-sqlite-algolia.mjs - Push enriched items (SQLite) to Algolia using new sections model.
import 'dotenv/config';
import algoliasearch from 'algoliasearch';
import path from 'node:path';
import fs from 'node:fs';
import sqliteService from '../rules-engine/src/sqliteService.js';
import logger from '../rules-engine/src/logger.js';

async function initSQLite(){
  await sqliteService.init();
  if (!sqliteService.enabled) throw new Error('SQLite not enabled; install sqlite3 or set ENRICH_STORAGE_MODE=mssql and implement MSSQL fetch.');
}

function mapRecord(row){
  let enriched;
  try { enriched = JSON.parse(row.enriched_json); } catch { return null; }
  if (!enriched || !enriched.sections) return null;
  const { identity={}, marketing={}, specs={}, compliance={}, embeddings={} } = enriched.sections;
  const synonyms = identity.synonyms || [];
  return {
    objectID: identity.partNumber || row.partNumber || row.id,
    partNumber: identity.partNumber,
    manufacturer: identity.manufacturer,
    name: identity.name,
    rule_tags: identity.rule_tags || [],
    bundle_candidates: identity.bundle_candidates || [],
    value_statement: marketing.value_statement || null,
    short_description: marketing.short_description || null,
    features: specs.features || [],
    specs_table: specs.specs_table || [],
    compliance_tags: compliance.compliance_tags || [],
    risk_score: compliance.risk_score ?? null,
    embedding_ref: embeddings.embedding_ref || null,
    quality_score: enriched.quality_score,
    quality_bucket: enriched.quality_bucket,
    search_synonyms: synonyms,
    enrichment_version: enriched.version,
    hash: enriched.hash,
    updated_at: row.updated_at
  };
}

async function main(){
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
  const indexName = process.env.ALGOLIA_INDEX || process.env.ALGOLIA_INDEX_NAME || 'enriched_products_dev';
  if (!appId || !apiKey){
    console.error('[sync] Missing Algolia credentials');
    process.exit(2);
  }
  await initSQLite();
  const rows = await new Promise((resolve,reject)=>{
    sqliteService.db.all('SELECT id, partNumber, enriched_json, updated_at FROM items LIMIT 100', (e,r)=> e?reject(e):resolve(r));
  });
  const mapped = rows.map(mapRecord).filter(Boolean);
  if (!mapped.length){
    console.warn('[sync] No mapped enriched records');
    process.exit(0);
  }
  console.log(`[sync] Prepared ${mapped.length} records for index '${indexName}'`);
  const client = algoliasearch(appId, apiKey);
  const index = client.initIndex(indexName);
  try {
    const res = await index.saveObjects(mapped, { autoGenerateObjectIDIfNotExist:false });
    console.log('[sync] Uploaded objectIDs count=', res.objectIDs?.length || 0);
  } catch (err){
    const msg = err?.message || '';
    console.error('[sync] upload failed:', msg);
    if (/not enough rights|invalid api key|unauthorized/i.test(msg)){
      console.error('[sync] HINT: Use an Admin API key (ALGOLIA_ADMIN_API_KEY) that has addObject & editSettings rights.');
      console.error('[sync]       Current env key var used:', process.env.ALGOLIA_ADMIN_API_KEY? 'ALGOLIA_ADMIN_API_KEY' : 'ALGOLIA_API_KEY');
    }
    if (/index .* does not exist/i.test(msg)){
      console.error('[sync] HINT: Create the index first or run the settings script (npm run algolia:apply-enriched-settings)');
    }
    if (err?.status === 400 && err?.name === 'ApiError'){
      console.error('[sync] Raw error JSON:', JSON.stringify(err, null, 2));
    }
    process.exit(5);
  }
}

main().catch(e=>{ console.error('[sync] fatal', e); process.exit(1); });
