#!/usr/bin/env node
// Heal-AI enrichment: fill missing QIQ_* fields in SQL using OpenAI
import 'dotenv/config';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

function parseArgs(){
  const args = {};
  for (const a of process.argv.slice(2)){
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    args[k] = rest.join('=') || true;
  }
  return args;
}

async function connectSQL(){
  const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DB,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt:false, trustServerCertificate:true }
  };
  const pool = new sql.ConnectionPool(config);
  return pool.connect();
}

function approxTokens(text){
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

async function callOpenAI(prompt, model){
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  const body = { model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2, messages: [
    { role: 'system', content: 'You generate concise product data in JSON. Respond with a strict JSON object only.' },
    { role: 'user', content: prompt }
  ]};
  const res = await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{ 'authorization': `Bearer ${key}`, 'content-type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok){
    const t = await res.text();
    throw new Error('OpenAI error: ' + t);
  }
  const j = await res.json();
  const content = j?.choices?.[0]?.message?.content || '';
  // Try to parse JSON from content
  let json = null;
  try { json = JSON.parse(content); } catch { json = null; }
  return { json, usage: j?.usage || {} };
}

function buildPrompt(row){
  return [
    `PN: ${row.ManufacturerPartNumber || row.ManufacturerPartNo || ''}`,
    `Name/Description: ${row.Description || ''}`,
    `Brand: ${row.Manufacturer || ''}`,
    `Category: ${row.ItemType || ''}`,
    `Any notes/specs: ${(row.CustomMemo01||'')} ${(row.CustomMemo02||'')} ${(row.CustomMemo03||'')}`,
    '',
    'Return compact JSON with optional keys when missing:',
    '{',
    '  "QIQ_ShortDescription": string,',
    '  "QIQ_FeaturesJSON": array|string,',
    '  "QIQ_SpecsJSON": object|string,',
    '  "QIQ_ValueStatement": string,',
    '  "QIQ_UseCasesJSON": array|string,',
    '  "QIQ_ComplianceTagsJSON": array|string',
    '}',
    'Keep business-safe wording and avoid hallucinations. Use brief, relevant content only.'
  ].join('\n');
}

async function main(){
  const ARGS = parseArgs();
  const BRAND = (ARGS.brand || '').toString().trim();
  const LIMIT = Math.min(parseInt(ARGS.limit || process.env.HEAL_AI_MAX_ROWS || '50',10) || 50, parseInt(process.env.HEAL_AI_MAX_ROWS || '50',10) || 50);
  const COMMIT = String(ARGS.commit || 'false').toLowerCase() === 'true' && String(process.env.HEAL_AI_DRYRUN || 'false').toLowerCase() !== 'true';
  const MAX_TOKENS = parseInt(process.env.HEAL_AI_MAX_TOKENS || '12000',10) || 12000;

  const pool = await connectSQL();
  // Detect QIQ columns
  const qiqTargets = ['QIQ_ShortDescription','QIQ_FeaturesJSON','QIQ_SpecsJSON','QIQ_ValueStatement','QIQ_UseCasesJSON','QIQ_ComplianceTagsJSON'];
  const colsRs = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='DocumentItems'");
  const cols = new Set(colsRs.recordset.map(r=> r.COLUMN_NAME));
  const pnCol = cols.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber' : (cols.has('ManufacturerPartNo') ? 'ManufacturerPartNo' : null);
  if (!pnCol) throw new Error('No PN column');

  // Build WHERE for NULL/empty QIQ_* fields
  const nullPreds = qiqTargets.filter(c=> cols.has(c)).map(c=> `(${c} IS NULL OR ${c} = '')`);
  if (!nullPreds.length){ console.log('No QIQ_* columns found'); await pool.close(); return; }
  const brandWhere = BRAND ? ' AND Manufacturer = @brand' : '';
  const sqlQuery = `SELECT TOP (${LIMIT}) * FROM dbo.DocumentItems WHERE (${nullPreds.join(' OR ')})${brandWhere} ORDER BY ID DESC`;
  const req = pool.request();
  if (BRAND) req.input('brand', sql.NVarChar(255), BRAND);
  const rs = await req.query(sqlQuery);

  let processed = 0; let skipped = 0; let fieldsFilled = 0; let tokensUsed = 0; const events = [];
  for (const row of rs.recordset){
    // Skip fully enriched rows
    const missing = qiqTargets.filter(c=> cols.has(c) && (row[c] == null || String(row[c]).trim()===''));
    if (!missing.length){ skipped++; continue; }
    // Build prompt and check token budget
    const prompt = buildPrompt(row);
    const promptTokens = approxTokens(prompt);
    if (tokensUsed + promptTokens > MAX_TOKENS){ events.push(`Token budget reached before ${row[pnCol]}`); break; }
    let gen = null; let usage = {};
    try{
      const out = await callOpenAI(prompt);
      gen = out.json || {};
      usage = out.usage || {};
    }catch(e){ events.push(`AI error for ${row[pnCol]}: ${String(e.message||e)}`); skipped++; continue; }
    const toUpdate = {};
    for (const c of missing){ if (gen && Object.prototype.hasOwnProperty.call(gen, c)) toUpdate[c] = gen[c]; }
    if (!Object.keys(toUpdate).length){ skipped++; continue; }

    // Apply update if COMMIT
    if (COMMIT){
      const upd = pool.request().input('id', sql.Int, row.ID);
      const sets = [];
      for (const [k,v] of Object.entries(toUpdate)){
        sets.push(`${k}=@${k}`);
        upd.input(k, sql.NVarChar(sql.MAX), typeof v === 'string' ? v : JSON.stringify(v));
      }
      await upd.query(`UPDATE dbo.DocumentItems SET ${sets.join(', ')} WHERE ID=@id`);
    }
    fieldsFilled += Object.keys(toUpdate).length;
    processed++;
    const filledKeys = Object.keys(toUpdate).join(' and ');
    events.push(`Healed ${filledKeys} for ${row[pnCol]}`);
    // Account tokens approximately
    const cIn = usage?.prompt_tokens || promptTokens;
    const cOut = usage?.completion_tokens || approxTokens(JSON.stringify(gen));
    tokensUsed += (cIn + cOut);
  }
  await pool.close();

  // Cost estimate (gpt-4o-mini roughly $0.15 / 1M input, $0.60 / 1M output) ⇒ blended $0.75 / 1M
  const costPerMTok = 0.75; // USD
  const totalCostEstimate = +(tokensUsed/1_000_000 * costPerMTok).toFixed(6);
  const report = { total_processed: processed, fields_filled: fieldsFilled, skipped, tokens_used: tokensUsed, total_cost_estimate: totalCostEstimate, brand: BRAND || null, limit: LIMIT, commit: COMMIT, events };
  const outPath = path.join(process.cwd(), 'heal-ai-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e=>{ console.error('heal-ai-enrich failed', e); process.exit(1); });
