// POST /api/users/quotation/:id/clone  -> clone existing quotation
import { quotationStorage, activityStorage } from '../storage/quotations.js';

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

export default async function handler(req,res){
  const { id } = req.params || {};
  if (req.method !== 'POST') return res.status(405).json({ error:'METHOD_NOT_ALLOWED' });
  const a = await auth(req);
  if (a.error) return res.status(401).json({ error:'UNAUTHORIZED' });
  const { token, payload } = a;
  try {
    const record = await quotationStorage.getById(id);
    if (!record || record.userToken !== token) return res.status(404).json({ error:'NOT_FOUND' });
    const year = new Date().getFullYear();
    const basePrefix = `QT-${year}`;
    const existing = await quotationStorage.getByUser(token);
    const nums = existing.filter(q => (q.id||'').startsWith(basePrefix))
      .map(q => { const m=(q.id||'').match(/QT-\d{4}-(\d{3,})/); return m?Number(m[1]):0; })
      .filter(n=>!isNaN(n));
    const nextSeq = (nums.length? Math.max(...nums):0) + 1;
    const seqStr = String(nextSeq).padStart(3,'0');
    const newId = `${basePrefix}-${seqStr}`;
    const overrides = req.body || {};
    const cloned = {
      ...record,
      id: newId,
      projectId: newId,
      status: 'مسودة',
      savedAt: undefined,
      lastModified: undefined,
      revision: 1,
      history: [],
      payload: { ...record.payload, ...overrides }
    };
    const saved = await quotationStorage.save(cloned);
    await activityStorage.log({ action:'quotation_clone', quotationId:newId, sourceId: id, userEmail: payload.email, userToken: token });
    return res.json({ ok:true, quotation: saved });
  } catch(e){
    console.warn('clone quotation error', e);
    return res.status(500).json({ error:'CLONE_FAILED' });
  }
}
