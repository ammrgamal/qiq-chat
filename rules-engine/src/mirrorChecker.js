// mirrorChecker.js - Compare SQL DB products vs Algolia index and produce a diff report
import algoliasearch from 'algoliasearch';
import dbService from './dbService.js';

// Cache last report to avoid heavy repeated scans
let lastReport = null;
let lastReportTs = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function normalizeKey(v){
  return (v||'').toString().trim().toLowerCase();
}

async function fetchAlgoliaAll(index){
  const hits = [];
  // Using browse objects for completeness (pagination safe)
  await index.browseObjects({ batch: objs => {
    for (const o of objs){ hits.push(o); }
  }});
  return hits;
}

export async function runMirrorCheck(options = {}) {
  const force = options.force || false;
  if (!force && lastReport && (Date.now() - lastReportTs) < CACHE_TTL_MS) {
    return { cached:true, ...lastReport };
  }
  const started = Date.now();
  const warnings = [];
  const env = {
    ALGOLIA_APP_ID: !!process.env.ALGOLIA_APP_ID,
    ALGOLIA_API_KEY: !!(process.env.ALGOLIA_API_KEY || process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_SEARCH_KEY),
    ALGOLIA_INDEX: process.env.ALGOLIA_INDEX || process.env.ALGOLIA_INDEX_NAME
  };
  if (!env.ALGOLIA_APP_ID || !env.ALGOLIA_API_KEY) {
    warnings.push('Algolia credentials missing');
  }
  if (!env.ALGOLIA_INDEX) warnings.push('Algolia index name missing');

  // Step 1: DB fetch (Rules_Item) part number list
  let dbItems = [];
  try {
    const q = await dbService.query(`SELECT RuleID, PartNumber, Manufacturer, ProductName FROM dbo.Rules_Item WHERE PartNumber IS NOT NULL AND LEN(PartNumber) > 0`);
    dbItems = q.recordset || [];
  } catch (e) {
    warnings.push('DB query failed: '+e.message);
  }
  const dbMap = new Map();
  for (const row of dbItems){
    const key = normalizeKey(row.PartNumber);
    if (!key) continue;
    dbMap.set(key, { partNumber: row.PartNumber, name: row.ProductName, manufacturer: row.Manufacturer, ruleId: row.RuleID });
  }

  // Step 2: Algolia fetch
  let algoliaHits = [];
  if (env.ALGOLIA_APP_ID && env.ALGOLIA_API_KEY && env.ALGOLIA_INDEX){
    try {
      const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY || process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_SEARCH_KEY);
      const index = client.initIndex(env.ALGOLIA_INDEX);
      algoliaHits = await fetchAlgoliaAll(index);
    } catch (e) {
      warnings.push('Algolia fetch failed: '+e.message);
    }
  }
  const agMap = new Map();
  for (const h of algoliaHits) {
    const key = normalizeKey(h.pn || h.sku || h.objectID || h.PartNumber);
    if (!key) continue;
    if (!agMap.has(key)) agMap.set(key, h);
  }

  // Step 3: Diff
  const missingInAlgolia = [];
  for (const [k, info] of dbMap.entries()) {
    if (!agMap.has(k)) missingInAlgolia.push(info);
  }
  const orphanInAlgolia = [];
  for (const [k, hit] of agMap.entries()) {
    if (!dbMap.has(k)) {
      orphanInAlgolia.push({ key: k, objectID: hit.objectID, name: hit.name || hit.title || hit.ProductName || hit.ProductName });
    }
  }

  // Step 4: Content diffs (sample) – compare first N overlapping items
  const diffs = [];
  const overlapKeys = [];
  for (const k of dbMap.keys()) if (agMap.has(k)) overlapKeys.push(k);
  const SAMPLE_LIMIT = 50;
  for (let i=0;i<overlapKeys.length && i<SAMPLE_LIMIT;i++){
    const k = overlapKeys[i];
    const dbVal = dbMap.get(k);
    const agVal = agMap.get(k);
    const rowDiff = {};
    // Compare name / manufacturer basic fields
    if (dbVal.name && agVal.name && dbVal.name.trim() !== agVal.name.trim()) rowDiff.name = { db: dbVal.name, algolia: agVal.name };
    if (dbVal.manufacturer && agVal.manufacturer && dbVal.manufacturer.trim() !== agVal.manufacturer.trim()) rowDiff.manufacturer = { db: dbVal.manufacturer, algolia: agVal.manufacturer };
    if (Object.keys(rowDiff).length) {
      diffs.push({ partNumber: dbVal.partNumber, ...rowDiff });
    }
  }

  const report = {
    ok: warnings.length === 0,
    counts: {
      db: dbMap.size,
      algolia: agMap.size,
      overlap: overlapKeys.length,
      missingInAlgolia: missingInAlgolia.length,
      orphanInAlgolia: orphanInAlgolia.length,
      sampledDiffs: diffs.length
    },
    missingInAlgolia: missingInAlgolia.slice(0, 100), // cap output
    orphanInAlgolia: orphanInAlgolia.slice(0, 100),
    diffs,
    warnings,
    generatedAt: new Date().toISOString(),
    tookMs: Date.now() - started
  };
  lastReport = report;
  lastReportTs = Date.now();
  return { cached:false, ...report };
}

export function getLastMirrorReport(){
  if (!lastReport) return null;
  return { ageMs: Date.now() - lastReportTs, ...lastReport };
}
