import { signJWT } from '../_lib/jwt.js';
import { sendEmail } from '../_lib/email.js';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  try{
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error:'Missing email' });
    const AUTO_APPROVE = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));
    if (AUTO_APPROVE) {
      return res.status(200).json({ ok:true, sent:false, skipped:true });
    }
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = await signJWT({ email }, secret, 60*60*24); // 24h
    const base = process.env.PUBLIC_BASE_URL || (req.headers.origin || `http://${req.headers.host}`);
    const link = `${base}/api/users/verify?token=${encodeURIComponent(token)}`;
    const html = `<p>Verify your email for QuickITQuote</p><p><a href="${link}">Click here to verify</a></p>`;
    const r = await sendEmail({ to: email, subject:'Verify your email', html });
    return res.status(200).json({ ok:true, sent: !!r.ok });
  }catch(e){ console.warn('send-verification error', e); return res.status(500).json({ error:'Server error' }); }
}
