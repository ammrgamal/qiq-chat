import { requireAdminAuth } from './admin.js';
import { quotationStorage } from '../storage/quotations.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return requireAdminAuth(req, res, async () => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'Quotation ID required' });
      const quotation = await quotationStorage.getById(id);
      if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
      return res.json(quotation);
    } catch (e) {
      console.error('quotation-details error', e);
      return res.status(500).json({ error: 'Failed to fetch quotation' });
    }
  });
}
