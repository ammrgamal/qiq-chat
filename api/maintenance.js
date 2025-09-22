import dotenv from 'dotenv';
try { dotenv.config(); } catch {}

import { sendEmail } from './_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  try {
    const body = req.body || {};
    const to = process.env.MAINTENANCE_EMAIL_TO || 'ammr.gamal@gmail.com';

    // Build a simple, readable HTML email
    const client = body.client || {};
    const project = body.project || {};
    const meta = body.meta || {};
    const items = Array.isArray(body.items) ? body.items : [];

    const title = `Maintenance Request — ${project.name || 'Untitled Project'}`;
    const rows = items.slice(0, 50).map((it, i) => `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:6px 8px">${i+1}</td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px">${escapeHtml(it.description || it.desc || '')}</td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px">${escapeHtml(it.pn || '')}</td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;text-align:right">${Number(it.qty || 1)}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Inter,system-ui,Segoe UI,Arial;color:#111">
        <h2 style="margin:0 0 10px">Maintenance Contract Request</h2>
        <p style="margin:0 0 8px">A customer requested a maintenance contract via QuickITQuote.</p>
        <h3 style="margin:16px 0 6px">Client</h3>
        <div style="font-size:14px;line-height:1.6">
          <div><strong>Name:</strong> ${escapeHtml(client.name || '')}</div>
          <div><strong>Contact:</strong> ${escapeHtml(client.contact || '')}</div>
          <div><strong>Email:</strong> ${escapeHtml(client.email || '')}</div>
          <div><strong>Phone:</strong> ${escapeHtml(client.phone || '')}</div>
        </div>

        <h3 style="margin:16px 0 6px">Project</h3>
        <div style="font-size:14px;line-height:1.6">
          <div><strong>Name:</strong> ${escapeHtml(project.name || '')}</div>
          <div><strong>Site:</strong> ${escapeHtml(project.site || '')}</div>
          <div><strong>Execution date:</strong> ${escapeHtml(project.execution_date || '')}</div>
        </div>

        ${items.length ? `
        <h3 style="margin:16px 0 6px">Items (for context)</h3>
        <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;width:100%">
          <thead>
            <tr>
              <th style="text-align:left;border:1px solid #e5e7eb;padding:6px 8px">#</th>
              <th style="text-align:left;border:1px solid #e5e7eb;padding:6px 8px">Description</th>
              <th style="text-align:left;border:1px solid #e5e7eb;padding:6px 8px">PN</th>
              <th style="text-align:right;border:1px solid #e5e7eb;padding:6px 8px">Qty</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>` : ''}

        <h3 style="margin:16px 0 6px">Meta</h3>
        <div style="font-size:14px;line-height:1.6">
          <div><strong>Quote Number:</strong> ${escapeHtml(meta.number || '')}</div>
          <div><strong>Date:</strong> ${escapeHtml(meta.date || '')}</div>
          <div><strong>Currency:</strong> ${escapeHtml(meta.currency || '')}</div>
        </div>
      </div>`;

    const r = await sendEmail({ to, subject: title, html });
    if (!r.ok) {
      return res.status(500).json({ ok: false, error: 'Email failed', provider: r.provider, disabled: r.disabled });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('maintenance error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}
