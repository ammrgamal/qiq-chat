// GET /api/users/quotation/:id  -> fetch single quotation with history (if owned)
// PATCH /api/users/quotation/:id -> update draft quotation (limited fields)
// POST /api/users/quotation/:id/clone -> clone quotation

import { quotationStorage, activityStorage } from '../storage/quotations.js';
import { validateBusinessEmail } from '../../_lib/email-validation.js';

async function auth(req){
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { error:'NO_AUTH' };
  const token = authHeader.substring(7);
  if (!token.startsWith('qiq_')) return { error:'BAD_TOKEN' };
  try {
    const payload = JSON.parse(Buffer.from(token.substring(4), 'base64').toString());
    if (payload.exp && payload.exp < Date.now()) return { error:'EXPIRED' };
    return { token, payload };
  } catch {
    return { error:'BAD_PAYLOAD' };
  }
}

export async function handler(req,res){
  const { id } = req.params || {};
  const a = await auth(req);
  if (a.error) return res.status(401).json({ error:'UNAUTHORIZED' });
  const { token, payload } = a;
  const method = req.method;

  if (method === 'GET'){
    const record = await quotationStorage.getById(id);
    if (!record || record.userToken !== token) return res.status(404).json({ error:'NOT_FOUND' });
    return res.json({ ok:true, quotation: record });
  }

  if (method === 'PATCH') {
    try {
      const record = await quotationStorage.getById(id);
      if (!record || record.userToken !== token) return res.status(404).json({ error:'NOT_FOUND' });
      if (!['مسودة','draft','قيد المراجعة'].includes(record.status)){
        return res.status(400).json({ error:'NOT_EDITABLE' });
      }
      const body = req.body || {};
      // Optional business email validation if client email changed
      if (body?.client?.email) {
        const AUTO_APPROVE = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));
        if (!AUTO_APPROVE){
          const v = validateBusinessEmail(body.client.email);
          if (!v.valid) return res.status(400).json({ error:v.message });
        }
      }
      const updated = { ...record, payload: { ...record.payload, ...body }, lastModified: new Date().toISOString() };
      const saved = await quotationStorage.save(updated); // save() handles history + revision
      await activityStorage.log({ action:'quotation_update', quotationId:id, userEmail: payload.email, userToken: token });
      return res.json({ ok:true, quotation: saved });
    } catch (e){
      console.warn('update quotation error', e);
      return res.status(500).json({ error:'UPDATE_FAILED' });
    }
  }

  // Clone route handled in separate module (quotation-clone.js)
  return res.status(405).json({ error:'METHOD_NOT_ALLOWED' });
}

export default handler;
