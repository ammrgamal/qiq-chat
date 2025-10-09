#!/usr/bin/env node
// enrich-sample20.mjs - Generate 20 synthetic products & run enrichment pipeline storing results in SQLite.
import '../rules-engine/src/logger.js';
import storageAdapter from '../rules-engine/src/storageAdapter.js';
import pipeline from '../rules-engine/src/enrichmentPipeline.js';
import { productHash } from '../rules-engine/src/utils/hash.js';

const VERSION = process.env.ENRICH_VERSION || 'v1.0.0';
const DRY = /^(1|true|yes)$/i.test(String(process.env.ENRICH_DRY_RUN||''));

function makeProducts(){
  const base = [
    ['SW-24G','Managed Switch 24-Port Gigabit','NetPro','Enterprise managed Layer2/3 switch with advanced QoS.'],
    ['SW-48G','Managed Switch 48-Port Gigabit','NetPro','High density Layer2/3 switch for aggregation.'],
    ['FW-UTM1','NextGen Firewall UTM Appliance','SecureEdge','Unified threat management firewall with IDS/IPS.'],
    ['FW-POE2','Security Firewall PoE Gateway','SecureEdge','Firewall with integrated PoE for branch deployments.'],
    ['SRV-1U-G1','Rack Server 1U Gen1','ComputeCore','1U enterprise server with hot-swap bays and dual PSU.'],
    ['SRV-2U-G2','Rack Server 2U Gen2','ComputeCore','2U server for virtualization workloads.'],
    ['NAS-8B','Storage NAS 8-Bay','DataBox','8-bay NAS supporting RAID6 and snapshotting.'],
    ['NAS-12B','Storage NAS 12-Bay','DataBox','12-bay NAS for scale-out storage clusters.'],
    ['SEC-AGENT','Endpoint Security License 1Y','Kaspersky','Endpoint protection annual subscription.'],
    ['SEC-AGENT-3Y','Endpoint Security License 3Y','Kaspersky','Three-year endpoint security license pack.'],
    ['WIFI-AP6','WiFi 6 Access Point','AirLink','Indoor WiFi 6 AP with MU-MIMO.'],
    ['WIFI-AP6-OUT','Outdoor WiFi 6 Access Point','AirLink','Rugged outdoor WiFi 6 AP IP67 rated.'],
    ['ROUT-EDGE','Edge Router 10G','RouteMax','10G edge router with BGP/OSPF support.'],
    ['ROUT-CORE','Core Router Modular','RouteMax','Modular chassis core router for large networks.'],
    ['LIC-SW-MGMT','Switch Management License','NetPro','Annual license enabling advanced switch analytics.'],
    ['LIC-FW-ADV','Firewall Advanced Features License','SecureEdge','Adds advanced threat analytics & sandbox.'],
    ['BCK-APPL','Backup Appliance 24TB','SafeStore','Turnkey backup appliance with deduplication.'],
    ['BCK-SW-ENT','Enterprise Backup Software','SafeStore','Enterprise backup software central management.'],
    ['MON-NMS','Network Monitoring Suite','InsightOps','Comprehensive NMS with topology mapping.'],
    ['AIO-SEC-MON','Security Monitoring Platform','InsightOps','Platform correlating firewall, endpoint & network telemetry.']
  ];
  return base.map((row,i)=>({
    id: `GEN-${i+1}`,
    partNumber: row[0],
    name: row[1],
    manufacturer: row[2],
    description: row[3],
    classification: /License|Software/i.test(row[1])? 'Software' : 'Hardware'
  }));
}

async function main(){
  const products = makeProducts();
  console.log(`[enrich-sample20] prepared ${products.length} synthetic products`);
  await storageAdapter.init();
  let enriched=0, failed=0, skipped=0; const results=[]; const startedAll = Date.now();
  for (const p of products){
    const hash = productHash(p);
    try {
      const existing = await storageAdapter.getByHash(hash);
      if (existing && existing.ai_version === VERSION){
        skipped++; console.log(`[enrich-sample20] skip part=${p.partNumber}`); continue;
      }
      const res = await pipeline.enrich(p);
      if (!DRY){
        await storageAdapter.saveItem({ id: p.id, partNumber: p.partNumber, manufacturer: p.manufacturer, raw: p, enriched: res, aiVersion: res.version, hash: res.hash });
        await storageAdapter.log({ itemId: p.id, status: res.errors.length?'failed':'enriched', aiVersion: res.version, durationMs: res.durationMs||0, error: res.errors.length?res.errors.join(';'):null });
      }
      if (res.errors.length) failed++; else enriched++;
      results.push({ partNumber: p.partNumber, status: res.errors.length?'failed':'enriched', q: res.quality_score, bucket: res.quality_bucket });
      console.log(`[enrich-sample20] part=${p.partNumber} status=${res.errors.length?'failed':'enriched'} ms=${res.durationMs}`);
    } catch(e){
      failed++; console.warn(`[enrich-sample20] part=${p.partNumber} error=${e.message}`);
    }
  }
  const summary = { total: products.length, enriched, failed, skipped, durationMs: Date.now()-startedAll };
  console.log(JSON.stringify(summary, null, 2));
  try { await (await import('fs')).promises.writeFile('enrichment-sample20-summary.json', JSON.stringify({ summary, results }, null, 2)); } catch {}
  console.log('[enrich-sample20] wrote enrichment-sample20-summary.json');
}

main().catch(e=>{ console.error('[enrich-sample20] fatal', e); process.exit(1); });