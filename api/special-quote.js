// pages/api/special-quote.js  أو  api/special-quote.js
import { sendEmail } from './_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }
  try {
    const body = req.body || {};
    const client = body.client || {};
    const project = body.project || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const number = body.number || '—';
    const date = body.date || new Date().toISOString().slice(0,10);
    const currency = body.currency || 'USD';

    // Build a simple, readable HTML summary
    const rows = items.slice(0, 50).map((it, i)=>`
      <tr>
        <td style="padding:6px;border-bottom:1px solid #eee">${i+1}</td>
        <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(it.description||'-')}</td>
        <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(it.pn||'')}</td>
        <td style="padding:6px;border-bottom:1px solid #eee; text-align:right">${Number(it.qty||1)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee; text-align:right">${Number(it.unit_price||it.unit||0)}</td>
      </tr>
    `).join('');
    const html = `
      <div style="font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial">
        <h2 style="margin:0 0 10px">Quote Request — ${escapeHtml(number)}</h2>
        <div style="margin:0 0 12px; color:#374151">Date: ${escapeHtml(date)} • Currency: ${escapeHtml(currency)}</div>
        <div style="display:flex; gap:16px; margin:0 0 12px">
          <div style="flex:1">
            <div style="font-weight:600; margin:0 0 6px">Client</div>
            <div>${escapeHtml(client.name||'')}</div>
            <div>${escapeHtml(client.contact||'')}</div>
            <div>${escapeHtml(client.email||'')}</div>
            <div>${escapeHtml(client.phone||'')}</div>
          </div>
          <div style="flex:1">
            <div style="font-weight:600; margin:0 0 6px">Project</div>
            <div>${escapeHtml(project.name||'')}</div>
            <div>${escapeHtml(project.site||'')}</div>
            <div>${escapeHtml(project.expected_closing_date||'')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:13px">
          <thead>
            <tr>
              <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px">#</th>
              <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px">Description</th>
              <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px">PN</th>
              <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px">Qty</th>
              <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px">Unit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:10px; color:#6b7280">This is an automated notification from QuickITQuote.</div>
      </div>
    `;

    // Send emails: admin and customer
    const adminTo = process.env.QUOTE_NOTIFY_EMAIL || process.env.EMAIL_TO || '';
    const custTo  = (client.email || '').trim();
    let sent = 0; let details = [];
    try{ if (adminTo) { await sendEmail({ to: adminTo, subject: `QuickITQuote – Quote Request ${number}`, html }); sent++; details.push('admin'); } }catch(e){ details.push('admin-fail'); }
    try{ if (custTo)  { await sendEmail({ to: custTo,  subject: `Your QuickITQuote Request ${number}`, html }); sent++; details.push('client'); } }catch(e){ details.push('client-fail'); }

    return res.status(200).json({ ok: true, sent, details });
  } catch (e) {
    console.error("special-quote error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}

function escapeHtml(s){
  return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]||c));
}
