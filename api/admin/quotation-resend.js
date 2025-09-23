import { requireAdminAuth } from './admin.js';
import { quotationStorage, activityStorage } from '../storage/quotations.js';
import { sendEmail } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return requireAdminAuth(req, res, async () => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'Quotation ID required' });
      const q = await quotationStorage.getById(id);
      if (!q) return res.status(404).json({ error: 'Quotation not found' });

      const adminTo = process.env.QUOTE_NOTIFY_EMAIL || process.env.EMAIL_TO || '';
      const userTo  = q.userEmail;
      const items   = Array.isArray(q?.payload?.items) ? q.payload.items : [];
      const lines   = items.slice(0,20).map((it,i)=> `${i+1}. ${it.description||it.name||'-'} ${it.pn?`(${it.pn})`:''} x${it.qty||1} @ ${it.unit||it.price||''}`).join('<br/>');
      const html = `
        <div style="font-family:Segoe UI,Arial">
          <h3 style="margin:0 0 8px">Quotation: ${q.id}</h3>
          <div>Date: ${q.date} • Currency: ${q.currency}</div>
          <div>Client: ${q.clientName || '-'}</div>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:10px 0"/>
          <div>${lines || 'No items provided'}</div>
        </div>`;

      let sent = 0;
      try{ if (adminTo) { await sendEmail({ to: adminTo, subject: `Quotation ${q.id}`, html }); sent++; } }catch{}
      try{ if (userTo)  { await sendEmail({ to: userTo,  subject: `Your quotation ${q.id}`, html }); sent++; } }catch{}

      try{ await activityStorage.log({ userEmail: 'admin', action: 'quotation_resend', details: { id, sent } }); }catch{}
      return res.json({ ok: true, sent });
    } catch (e) {
      console.error('quotation-resend error', e);
      return res.status(500).json({ error: 'Failed to resend email' });
    }
  });
}
