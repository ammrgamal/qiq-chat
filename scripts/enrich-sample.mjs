#!/usr/bin/env node
// enrich-sample.mjs
// Picks 10 CommScope + 10 Kaspersky items from Rules_Item, performs placeholder enrichment,
// and upserts into EnrichedItems + logs into EnrichLogs.

import crypto from 'crypto';
import sql from 'mssql';
import fs from 'fs';

async function getConfig(){
  // Basic inline config using env overrides
  const cfgPath = new URL('../rules-engine/config/dbConfig.json', import.meta.url);
  let base = {};
  try { base = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
  if (process.env.SQL_SERVER) base.server = process.env.SQL_SERVER;
  if (process.env.SQL_DB) base.database = process.env.SQL_DB;
  if (process.env.SQL_USER) base.user = process.env.SQL_USER;
  if (process.env.SQL_PASSWORD) base.password = process.env.SQL_PASSWORD;
  base.options = base.options || { trustServerCertificate: true };
  return base;
}

function hash(obj){
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function buildEnrichment(raw){
  // Placeholder enrichment logic – mimic AI enriched fields
  return {
    summary: `Auto-enriched summary for ${raw.ProductName || raw.PartNumber}`,
    valuePoints: [
      'Improved reliability',
      'Reduced operational cost',
      raw.Manufacturer?.match(/kaspersky/i)?'Security-grade protection':'High quality materials'
    ],
    keywords: (raw.Keywords || '').split(/[,;]+/).map(k=>k.trim()).filter(Boolean),
    aiVersion: 1,
    classification: raw.Classification || 'Standard'
  };
}

async function main(){
  const config = await getConfig();
  console.log('[enrich-sample] connecting to SQL...');
  await sql.connect(config);
  console.log('[enrich-sample] connected');

  const pickQuery = `;WITH base AS (
    SELECT TOP (200) RuleID, PartNumber, Manufacturer, ProductName, Classification, Keywords
    FROM dbo.Rules_Item
    WHERE (Manufacturer LIKE '%commscope%' OR ProductName LIKE '%commscope%'
        OR Manufacturer LIKE '%kaspersky%' OR ProductName LIKE '%kaspersky%')
      AND PartNumber IS NOT NULL AND LEN(PartNumber) > 0
    ORDER BY NEWID()
  )
  SELECT * FROM (
    SELECT TOP (10) * FROM base WHERE Manufacturer LIKE '%commscope%' OR ProductName LIKE '%commscope%' ORDER BY NEWID()
  ) a
  UNION ALL
  SELECT * FROM (
    SELECT TOP (10) * FROM base WHERE Manufacturer LIKE '%kaspersky%' OR ProductName LIKE '%kaspersky%' ORDER BY NEWID()
  ) b;`;

  const res = await sql.query(pickQuery);
  const rows = res.recordset || [];
  if (!rows.length){
    console.error('[enrich-sample] no sample rows found');
    process.exit(2);
  }
  console.log(`[enrich-sample] picked ${rows.length} rows`);

  const summary = { inserted:0, updated:0, errors:0, items:[] };
  for (const r of rows){
    const raw = { ...r };
    const enriched = buildEnrichment(raw);
    const h = hash({ part: raw.PartNumber, manu: raw.Manufacturer, enriched });
    // Upsert
    try {
      const existing = await sql.query`SELECT ItemID, EnrichHash FROM dbo.EnrichedItems WHERE ItemID=${r.RuleID}`;
      if (existing.recordset.length){
        await sql.query`UPDATE dbo.EnrichedItems SET PartNumber=${r.PartNumber}, Manufacturer=${r.Manufacturer}, RawJson=${JSON.stringify(raw)}, EnrichedJson=${JSON.stringify(enriched)}, AIVersion='1', EnrichHash=${h}, UpdatedAt=SYSUTCDATETIME() WHERE ItemID=${r.RuleID}`;
        summary.updated++;
      } else {
        await sql.query`INSERT INTO dbo.EnrichedItems (ItemID, PartNumber, Manufacturer, RawJson, EnrichedJson, AIVersion, EnrichHash, UpdatedAt) VALUES (${r.RuleID}, ${r.PartNumber}, ${r.Manufacturer}, ${JSON.stringify(raw)}, ${JSON.stringify(enriched)}, '1', ${h}, SYSUTCDATETIME())`;
        summary.inserted++;
      }
      await sql.query`INSERT INTO dbo.EnrichLogs (ItemID, Status, AIVersion, DurationMs, CreatedAt, Error) VALUES (${r.RuleID}, 'OK', '1', 0, SYSUTCDATETIME(), NULL)`;
      summary.items.push({ ruleId:r.RuleID, partNumber:r.PartNumber, manufacturer:r.Manufacturer });
    } catch (e){
      console.error('[enrich-sample] upsert failed', r.RuleID, e.message);
      summary.errors++;
      await sql.query`INSERT INTO dbo.EnrichLogs (ItemID, Status, AIVersion, DurationMs, CreatedAt, Error) VALUES (${r.RuleID}, 'ERR', '1', 0, SYSUTCDATETIME(), ${e.message.substring(0,3800)})`;
    }
  }

  summary.total = rows.length;
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.errors?1:0);
}

main().catch(e=>{ console.error('[enrich-sample] fatal', e); process.exit(1); });
