#!/usr/bin/env node
// Compose and send an email with a short summary of the latest QuoteWerks sync sample run
// - Reads from sync-log.txt
// - Accepts --pns=comma,separated,list to highlight specific PNs
// - Uses existing email helper with Resend/SendGrid

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Prefer the same env fallback used by enrichment/email scripts if available
import { loadLocalEnvFallback } from '../rules-engine/scripts/_env-fallback.mjs';

dotenv.config({ path: path.join(process.cwd(), '.env') });
loadLocalEnvFallback();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(){
  const args = {};
  for (const a of process.argv.slice(2)){
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    args[k] = rest.join('=') || true;
  }
  return args;
}

function readSyncBlocks(logText){
  // Identify blocks from "Sync start" to the next "Sync Complete"
  const lines = logText.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines){
    if (!line.trim()) continue;
    if (line.includes('Sync start for index')){
      if (current) blocks.push(current);
      current = { lines: [line] };
    } else if (current){
      current.lines.push(line);
      if (line.includes('Sync Complete')){
        blocks.push(current);
        current = null;
      }
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function extractSummary(block){
  // Return stats and any PN result lines
  const txt = block.lines.join('\n');
  const summaryMatch = txt.match(/(\d+) items processed.*?(\d+) updated,\s*(\d+) inserted,\s*(\d+) skipped,\s*(\d+) errors/);
  const stats = summaryMatch ? {
    processed: Number(summaryMatch[1]),
    updated: Number(summaryMatch[2]),
    inserted: Number(summaryMatch[3]),
    skipped: Number(summaryMatch[4]),
    errors: Number(summaryMatch[5])
  } : null;
  const pnLines = txt.split('\n').filter(l => /→ (updated|skipped|error)/.test(l));
  return { stats, pnLines };
}

function filterPnLines(pnLines, pns){
  if (!pns || !pns.length) return pnLines;
  const lowerSet = new Set(pns.map(p => p.toLowerCase()));
  return pnLines.filter(l => {
    const id = l.replace(/^.*?\]\s*/, '') // strip timestamp prefix if present
                 .split('→')[0]
                 .trim();
    return lowerSet.has(id.toLowerCase());
  });
}

async function main(){
  const ARGS = parseArgs();
  const pns = (ARGS.pns || '').toString().split(',').map(s=>s.trim()).filter(Boolean);

  const logPath = path.join(process.cwd(), 'sync-log.txt');
  if (!fs.existsSync(logPath)){
    console.error('sync-log.txt not found');
    process.exit(1);
  }
  const logText = fs.readFileSync(logPath, 'utf8');
  const blocks = readSyncBlocks(logText);
  if (!blocks.length){
    console.error('No sync blocks found in sync-log.txt');
    process.exit(1);
  }
  const last = blocks[blocks.length-1];
  const { stats, pnLines } = extractSummary(last);
  const highlighted = filterPnLines(pnLines, pns);

  const title = 'QuoteWerks Sync Sample Report';
  const whenLine = (last.lines[0] || '').replace(/^\[|\].*$/g,'');
  const htmlParts = [];
  htmlParts.push(`<h2>${title}</h2>`);
  htmlParts.push(`<p><b>Run:</b> ${whenLine || 'Latest run'} | <b>Index:</b> woocommerce_products</p>`);
  if (stats){
    htmlParts.push(`<p><b>Processed:</b> ${stats.processed} | <b>Updated:</b> ${stats.updated} | <b>Inserted:</b> ${stats.inserted} | <b>Skipped:</b> ${stats.skipped} | <b>Errors:</b> ${stats.errors}</p>`);
  }
  if (highlighted.length){
    htmlParts.push('<h3>Highlighted PNs</h3>');
    htmlParts.push('<ul>' + highlighted.map(l=>`<li><code>${l.replace(/^.*?\]\s*/, '')}</code></li>`).join('') + '</ul>');
  } else if (pnLines.length){
    // Fallback: show last few PN lines if nothing matched
    const lastFew = pnLines.slice(-5);
    htmlParts.push('<h3>Recent Changes</h3>');
    htmlParts.push('<ul>' + lastFew.map(l=>`<li><code>${l.replace(/^.*?\]\s*/, '')}</code></li>`).join('') + '</ul>');
  }

  // Build a small text attachment with the same content
  const attachmentText = [
    `${title}`,
    `Run: ${whenLine || 'Latest run'}`,
    stats ? `Processed: ${stats.processed}, Updated: ${stats.updated}, Inserted: ${stats.inserted}, Skipped: ${stats.skipped}, Errors: ${stats.errors}` : '',
    '',
    'Details:',
    ...(highlighted.length ? highlighted : pnLines.slice(-10))
  ].filter(Boolean).join('\n');
  const outName = `sync-sample-${Date.now()}.txt`;
  const outPath = path.join(process.cwd(), outName);
  fs.writeFileSync(outPath, attachmentText, 'utf8');

  // Recipient fallback (extended) — includes QUOTE_NOTIFY_EMAIL
  const to = process.env.ENRICH_NOTIFY_TO
    || process.env.EMAIL_TO
    || process.env.ADMIN_EMAIL
    || process.env.QUOTE_NOTIFY_EMAIL
    || process.env.EMAIL_FROM;
  let result = { ok:false, skipped:true, reason:'Missing recipient' };
  try {
    const { sendEmail } = await import('../api/_lib/email.js');
    if (to){
      result = await sendEmail({
        to,
        subject: `${title}${pns.length ? ' — ' + pns.join(', ') : ''}`,
        html: htmlParts.join('\n'),
        attachments: [{ filename: outName, path: outPath, mimeType: 'text/plain' }]
      });
    }
  } catch (e){
    console.error('send email failed', e);
    result = { ok:false, error: String(e && e.message || e) };
  }

  console.log(JSON.stringify({ ok: !!result.ok, email: result, attachment: outPath }, null, 2));
}

main().catch(e=>{ console.error('fatal', e); process.exit(1); });
