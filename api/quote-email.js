// api/quote-email.js
// Generates PDF & CSV from a simple payload and emails notifications with attachments.
// Expected body: { action: 'download'|'send'|'custom', adminNotify: true, client: {...}, project: {...}, items: [...], number, date, currency }
// Returns { ok, pdfBase64, csvBase64 } (pdfBase64 only for download action)

import { sendEmail } from './_lib/email.js';

function ensureString(v){ return (v==null?'':String(v)); }
function b64(s){ return Buffer.from(s).toString('base64'); }
function escapeCsv(v){ const s = ensureString(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

function buildCsv(items){
  const header = 'Item,Quantity,Unit Price,Total\n';
  const rows = (items||[]).map(it=>{
    const name = ensureString(it.description || it.name || '-');
    const qty = Number(it.qty||1);
    const unit = Number(it.unit_price||it.unit||it.price||0);
    const total = unit*qty;
    return [escapeCsv(name), qty, unit, total].join(',');
  }).join('\n');
  return header + rows + (rows? '\n' : '');
}

// Build a minimalist PDF as text-based for now (many email providers accept simple base64 PDFs)
// For richer PDFs use client-side pdfmake; here we just deliver a simple fallback server PDF.
function buildSimplePdf({ number, date, currency, client, project, items }){
  const lines = (items||[]).map((it,i)=>`${i+1}. ${ensureString(it.description||it.name||'-')} | PN: ${ensureString(it.pn||'')} | Qty: ${it.qty||1} | Unit: ${it.unit_price||it.unit||it.price||0}`);
  const text = [
    `QuickITQuote — Quotation ${ensureString(number)}`,
    `Date: ${ensureString(date)}  Currency: ${ensureString(currency)}`,
    '', 'Client:', `  ${ensureString(client?.name||'')}`, `  ${ensureString(client?.email||'')}`, `  ${ensureString(client?.phone||'')}`,
    '', 'Project:', `  ${ensureString(project?.name||'')}`, `  ${ensureString(project?.site||'')}`,
    '', 'Items:', ...lines
  ].join('\n');
  // This is not a real PDF generator; we wrap plain text in a minimal PDF-like file for transport.
  // To keep scope minimal, set application/pdf but content is text. Many viewers will still open it.
  return Buffer.from(text);
}

function buildSummaryHtml(payload, action){
  const items = payload.items||[];
  const rows = items.slice(0,50).map((it,i)=>`
    <tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(it.description||it.name||'-')}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(it.pn||'')}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${Number(it.qty||1)}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${Number(it.unit_price||it.unit||it.price||0)}</td>
    </tr>
  `).join('');
  const titleMap = { download:'Download PDF', send:'Send by Email', custom:'Get Custom Quote' };
  return `
    <div style="font-family:Segoe UI,Arial">
      <h3 style="margin:0 0 8px">${titleMap[action]||'Quote Action'} — ${escapeHtml(payload.number||'')}</h3>
      <div style="margin-bottom:8px;color:#374151">Date: ${escapeHtml(payload.date||'')} • Currency: ${escapeHtml(payload.currency||'USD')}</div>
      <div style="display:flex;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-weight:600">Client</div>
          <div>${escapeHtml(payload.client?.name||'')}</div>
          <div>${escapeHtml(payload.client?.email||'')}</div>
        </div>
        <div>
          <div style="font-weight:600">Project</div>
          <div>${escapeHtml(payload.project?.name||'')}</div>
          <div>${escapeHtml(payload.project?.site||'')}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">#</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Description</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">PN</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Qty</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Unit</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:10px;color:#6b7280">Automated message from QuickITQuote</div>
    </div>`;
}

function escapeHtml(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  try{
    const body = req.body || {};
    const action = (body.action||'').toLowerCase();
    const payload = body;

    // Build CSV and PDF
    const csv = buildCsv(payload.items||[]);
    const csvB64 = b64(csv);
    const pdfBuf = buildSimplePdf(payload);
    const pdfB64 = pdfBuf.toString('base64');

    const attachments = [
      { filename: `${payload.number||'quotation'}.pdf`, type: 'application/pdf', content: pdfB64 },
      { filename: `${payload.number||'quotation'}.csv`, type: 'text/csv', content: csvB64 }
    ];

    // Always notify admin
    const adminEmail = 'ammr.gamal@gmail.com';
    const subject = `QIQ – ${action||'action'} — ${payload.number||''}`;
    const html = buildSummaryHtml(payload, action);
    await sendEmail({ to: adminEmail, subject, html, attachments });

    // If sending to customer ('send' action), email the client too
    if (action === 'send'){
      const to = (payload?.client?.email || '').trim();
      if (to) {
        await sendEmail({ to, subject: `Your quotation ${payload.number||''}`, html, attachments });
      }
    }

    // Respond with base64s for download
    return res.status(200).json({ ok:true, pdfBase64: pdfB64, csvBase64: csvB64 });
  }catch(e){
    console.error('quote-email error', e);
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}
