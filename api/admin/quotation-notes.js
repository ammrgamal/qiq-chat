import { requireAdminAuth } from './admin.js';
import { quotationStorage, activityStorage } from '../storage/quotations.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return requireAdminAuth(req, res, async () => {
    try {
      const { id } = req.params;
      const { note } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Quotation ID required' });
      if (!note || typeof note !== 'string') return res.status(400).json({ error: 'Note is required' });

      const q = await quotationStorage.getById(id);
      if (!q) return res.status(404).json({ error: 'Quotation not found' });
      const notes = Array.isArray(q.internalNotes) ? q.internalNotes : [];
      const entry = { note, at: new Date().toISOString() };
      q.internalNotes = [entry, ...notes].slice(0, 100);
      await quotationStorage.save(q);

      try{ await activityStorage.log({ userEmail: 'admin', action: 'quotation_note', details: { id } }); }catch{}
      return res.json({ ok: true, notes: q.internalNotes });
    } catch (e) {
      console.error('quotation-notes error', e);
      return res.status(500).json({ error: 'Failed to save note' });
    }
  });
}
