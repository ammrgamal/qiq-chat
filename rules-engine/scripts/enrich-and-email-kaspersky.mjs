#!/usr/bin/env node
// Run enrichment for Kaspersky (lists 1 & 12), generate report, and email samples
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { loadLocalEnvFallback } from './_env-fallback.mjs';

dotenv.config({ path: path.join(process.cwd(), '.env') });
loadLocalEnvFallback();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runNode(script, args=[], opts={}){
  return new Promise((resolve)=>{
    const child = spawn(process.argv[0], [script, ...args], { cwd: opts.cwd||process.cwd(), stdio:['ignore','pipe','pipe'] });
    let out=''; let err='';
    child.stdout.on('data', d=> out += d.toString());
    child.stderr.on('data', d=> err += d.toString());
    child.on('close', code=> resolve({ code, out, err }));
  });
}

function b64(s){ return Buffer.from(s).toString('base64'); }

async function main(){
  const notifyTo = process.env.ENRICH_NOTIFY_TO || process.env.EMAIL_TO || process.env.ADMIN_EMAIL;
  if (!notifyTo){
    console.error('Missing ENRICH_NOTIFY_TO (or EMAIL_TO/ADMIN_EMAIL) env var to send email');
  }

  // 1) Run enrichment for Kaspersky lists 1 and 12
  const enrichScript = path.join(__dirname, 'enrich-products12-kaspersky.mjs');
  const r1 = await runNode(enrichScript);
  if (r1.code !== 0){
    console.error('[enrich] failed', r1.err || r1.out);
  }

  // Expected output JSON file from wrapper
  const enrichJsonPath = path.join(process.cwd(), 'enrichment-products12-kaspersky.json');
  let enrichSummary = null;
  if (fs.existsSync(enrichJsonPath)){
    try { enrichSummary = JSON.parse(fs.readFileSync(enrichJsonPath,'utf8')); } catch {}
  }

  // 2) Generate reports for list 1 and list 12 (only Kaspersky rows marked enriched)
  const reportScript = path.join(__dirname, 'report-enrichment.mjs');
  const rList1 = await runNode(reportScript, ['--brand=Kaspersky','--list=1','--limit=1000']);
  const rList12 = await runNode(reportScript, ['--brand=Kaspersky','--list=12','--limit=1000']);
  const reportJson1 = path.join(process.cwd(),'enrichment-report-kaspersky-list1.json');
  const reportCsv1  = path.join(process.cwd(),'enrichment-report-kaspersky-list1.csv');
  const reportJson12 = path.join(process.cwd(),'enrichment-report-kaspersky-list12.json');
  const reportCsv12  = path.join(process.cwd(),'enrichment-report-kaspersky-list12.csv');

  // 3) Compose email summary
  const htmlParts = [];
  htmlParts.push('<h2>Kaspersky Enrichment Summary</h2>');
  if (enrichSummary?.summary){
    const s = enrichSummary.summary;
    htmlParts.push(`<p>Table: <b>${s.table}</b> | Manufacturer: <b>${s.manufacturer}</b></p>`);
    htmlParts.push(`<p>Total Selected: <b>${s.total}</b> | Enriched: <b style="color:green">${s.enriched}</b> | Failed: <b style="color:red">${s.failed}</b></p>`);
  } else {
    htmlParts.push('<p>No enrichment summary JSON found.</p>');
  }

  // Try parse top few items from report JSONs for visibility
  try {
    if (fs.existsSync(reportJson12)){
      const j12 = JSON.parse(fs.readFileSync(reportJson12,'utf8'));
      const sample = (j12.items||[]).slice(0,5);
      if (sample.length){
        htmlParts.push('<h3>List 12 Samples</h3><ol>' + sample.map(i=>`<li>${i.partNumber} — ${i.name} <small>(${i.enrichedFields})</small></li>`).join('') + '</ol>');
      }
    }
  } catch {}
  try {
    if (fs.existsSync(reportJson1)){
      const j1 = JSON.parse(fs.readFileSync(reportJson1,'utf8'));
      const sample = (j1.items||[]).slice(0,5);
      if (sample.length){
        htmlParts.push('<h3>List 1 Samples</h3><ol>' + sample.map(i=>`<li>${i.partNumber} — ${i.name} <small>(${i.enrichedFields})</small></li>`).join('') + '</ol>');
      }
    }
  } catch {}

  const html = htmlParts.join('\n');

  // 4) Send email with attachments (if email is configured)
  let emailResult = { ok:false, skipped:true };
  if (notifyTo){
    try{
      const { sendEmail } = await import('../../api/_lib/email.js');
      const attachments = [];
      const pushFile = (p, mime) => { if (fs.existsSync(p)) attachments.push({ filename: path.basename(p), path: p, mimeType: mime }); };
      pushFile(enrichJsonPath, 'application/json');
      pushFile(reportCsv1, 'text/csv');
      pushFile(reportCsv12, 'text/csv');
      emailResult = await sendEmail({ to: notifyTo, subject: 'Kaspersky Enrichment Report (lists 1 & 12)', html, attachments });
    } catch (e){
      console.error('email send failed', e);
    }
  }

  const ok = (r1.code === 0) && (rList1.code===0) && (rList12.code===0) && (emailResult.ok || emailResult.skipped);
  console.log(JSON.stringify({ ok, enrichmentExitCode: r1.code, report1ExitCode: rList1.code, report12ExitCode: rList12.code, email: emailResult }, null, 2));
}

main().catch(e=>{ console.error('fatal', e); process.exit(1); });
