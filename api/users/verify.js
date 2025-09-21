import { verifyJWT } from '../_lib/jwt.js';

export default async function handler(req, res){
  try{
    const token = req.query?.token || req.body?.token;
    if (!token) return res.status(400).send('Missing token');
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = await verifyJWT(token, secret);
    if (!payload) return res.status(400).send('Invalid or expired token');
    // For demo: mark verified in browser storage and redirect to account page
    const target = '/account.html?verified=1';
    const html = `<!doctype html><meta charset="utf-8"><title>Verified</title>
      <div style="font-family:system-ui;padding:20px;max-width:640px;margin:auto">
        <h1 style="margin:0 0 8px">✅ Email verified</h1>
        <p style="margin:0 0 16px">Your email <strong>${payload.email}</strong> has been verified successfully.</p>
        <p><a href="${target}" style="background:#2563eb;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none">Go to my account</a></p>
        <p style="color:#6b7280">You can close this tab; you'll be redirected shortly.</p>
      </div>
      <script>
        try{
          localStorage.setItem('qiq_email_verified','1');
          localStorage.setItem('qiq_verified_email', ${JSON.stringify(payload.email)});
        }catch(e){}
        setTimeout(function(){ location.replace(${JSON.stringify(target)}); }, 1200);
      </script>`;
    res.setHeader('content-type','text/html; charset=utf-8');
    return res.status(200).send(html);
  }catch(e){ console.warn('verify error', e); return res.status(500).send('Server error'); }
}
