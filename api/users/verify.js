import { verifyJWT } from '../_lib/jwt.js';

export default async function handler(req, res){
  try{
    const token = req.query?.token || req.body?.token;
    if (!token) return res.status(400).send('Missing token');
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = await verifyJWT(token, secret);
    if (!payload) return res.status(400).send('Invalid or expired token');
    // For demo: just acknowledge. In production, mark user as verified in DB.
    const html = `<!doctype html><meta charset="utf-8"><title>Verified</title><div style="font-family:system-ui;padding:20px">✅ Email verified for ${payload.email}. You can close this tab.</div>`;
    res.setHeader('content-type','text/html; charset=utf-8');
    return res.status(200).send(html);
  }catch(e){ console.warn('verify error', e); return res.status(500).send('Server error'); }
}
