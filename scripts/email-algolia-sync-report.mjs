#!/usr/bin/env node
// Email the latest Algolia sync report (algolia-sync-report.json)
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Optional env fallback loader if present
async function tryLoadEnvFallback(){
  try {
    const mod = await import('../rules-engine/scripts/_env-fallback.mjs');
    if (mod && typeof mod.loadLocalEnvFallback === 'function') mod.loadLocalEnvFallback();
  } catch {}
}

function parseArgs(){
  const args = {};
  for (const a of process.argv.slice(2)){
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    args[k] = rest.join('=') || true;
  }
  return args;
}

function summarize(report){
  const { index, updated, missing = [], autoFixed = 0, verify = [] } = report || {};
  const okCount = Array.isArray(verify) ? verify.length : 0;
  const sample = (Array.isArray(verify) ? verify.slice(0, 10) : []).map(v => ({
    objectID: v.objectID,
    brand: v.brand,
    hasImage: !!v.image,
    hasSpec: !!v.spec_sheet
  }));
  return { index, updated, okCount, missingCount: missing.length, autoFixed, sample };
}

async function main(){
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  await tryLoadEnvFallback();
  const ARGS = parseArgs();

  const fp = path.join(process.cwd(), 'algolia-sync-report.json');
  if (!fs.existsSync(fp)){
    console.error('algolia-sync-report.json not found');
    process.exit(2);
  }
  const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const sum = summarize(json);

  const title = `Algolia Sync Report — ${sum.index || ''}`.trim();
  const to = ARGS.to
    || process.env.ENRICH_NOTIFY_TO
    || process.env.EMAIL_TO
    || process.env.ADMIN_EMAIL
    || process.env.QUOTE_NOTIFY_EMAIL
    || process.env.EMAIL_FROM;

  const itemsList = (sum.sample || []).map(s => {
    const flags = [s.hasImage ? 'img' : 'no-img', s.hasSpec ? 'spec' : 'no-spec'].join(', ');
    return `<li><code>${s.objectID}</code> — ${s.brand || ''} <small>(${flags})</small></li>`;
  }).join('');

  const html = [
    `<h2>${title}</h2>`,
    `<p><b>Updated:</b> ${sum.updated ?? sum.okCount} | <b>Auto-Fixed:</b> ${sum.autoFixed} | <b>Missing Count:</b> ${sum.missingCount}</p>`,
    itemsList ? '<h3>Sample</h3>' + `<ul>${itemsList}</ul>` : '',
    '<p>Full details attached as JSON.</p>'
  ].join('\n');

  let result = { ok:false, reason:'No recipient' };
  try{
    const { sendEmail } = await import('../api/_lib/email.js');
    if (to){
      result = await sendEmail({
        to,
        subject: `${title} — ${sum.updated ?? sum.okCount} updated` ,
        html,
        attachments: [{ filename: 'algolia-sync-report.json', path: fp, mimeType: 'application/json' }]
      });
    }
  }catch(e){
    console.error('email send failed', e);
    result = { ok:false, error: String(e && e.message || e) };
  }

  console.log(JSON.stringify({ ok: !!result.ok, email: result, to, title }, null, 2));
}

main().catch(e=>{ console.error('fatal', e); process.exit(1); });
