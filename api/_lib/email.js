// Email gateway helper supporting Resend (preferred) with SendGrid fallback.
// Defaults are intentionally in-source per user request for quick setup/dev.
// Override via environment variables in production.

// For safety, do NOT ship default provider API keys.
// Emails will be disabled unless RESEND_API_KEY or SENDGRID_API_KEY is set.
const DEFAULT_FROM_EMAIL     = 'no-reply@quickitquote.com';

function getFromAddress() {
  return process.env.EMAIL_FROM
    || process.env.RESEND_FROM
    || process.env.SENDGRID_FROM
    || DEFAULT_FROM_EMAIL;
}

async function sendWithResend({ to, subject, html, from, attachments }){
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok:false, disabled:true };
  try {
    // Resend attachments API expects: [{ filename, content, path, type }]
    let resendAttachments = undefined;
    if (attachments && Array.isArray(attachments) && attachments.length){
      resendAttachments = attachments.map(a=>{
        let content = a.contentBase64;
        if (!content && a.path && fs.existsSync(a.path)){
          try { content = fs.readFileSync(a.path).toString('base64'); } catch {}
        }
        return {
          filename: a.filename,
          content,
          type: a.mimeType || 'application/octet-stream'
        };
      }).filter(att=> !!att.content);
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ from: from || getFromAddress(), to, subject, html, attachments: resendAttachments })
    });
    if (!res.ok){
      const t = await res.text();
      console.warn('resend error', res.status, t);
      return { ok:false, provider:'resend', status: res.status, body: t };
    }
    return { ok:true, provider:'resend' };
  } catch (e) {
    console.warn('resend sendEmail failed', e);
    return { ok:false, provider:'resend', error: String(e && e.message || e) };
  }
}

import fs from 'fs';

async function sendWithSendGrid({ to, subject, html, from, attachments }){
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { ok:false, disabled:true };
  try{
    let sgAttachments = undefined;
    if (attachments && Array.isArray(attachments) && attachments.length){
      sgAttachments = attachments.map(a=>{
        let content = a.contentBase64;
        if (!content && a.path && fs.existsSync(a.path)){
          try { content = fs.readFileSync(a.path).toString('base64'); } catch {}
        }
        return {
          content,
          filename: a.filename,
          type: a.mimeType || 'application/octet-stream',
          disposition: 'attachment'
        };
      }).filter(att=> !!att.content);
    }
    const res = await fetch('https://api.sendgrid.com/v3/mail/send',{
      method:'POST',
      headers:{ 'authorization': `Bearer ${key}`, 'content-type':'application/json' },
      body: JSON.stringify({
        personalizations:[{ to:[{ email: Array.isArray(to) ? to[0] : to }] }],
        from:{ email: from || getFromAddress() },
        subject,
        content:[{ type:'text/html', value: html }],
        attachments: sgAttachments
      })
    });
    if (!res.ok){
      const t = await res.text();
      console.warn('sendgrid error', res.status, t);
      return { ok:false, provider:'sendgrid', status: res.status, body: t };
    }
    return { ok:true, provider:'sendgrid' };
  }catch(e){
    console.warn('sendgrid sendEmail failed', e);
    return { ok:false, provider:'sendgrid', error: String(e && e.message || e) };
  }
}

export async function sendEmail({ to, subject, html, from, attachments }){
  // Normalize recipient to a string or first element
  const recipient = Array.isArray(to) ? to[0] : to;
  if (!recipient) return { ok:false, error:'Missing recipient' };

  // Prefer Resend if key present (env or default), else fallback to SendGrid if configured
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  if (hasResend) {
    const r = await sendWithResend({ to: recipient, subject, html, from, attachments });
    if (r.ok) return r;
    // If Resend fails but SendGrid is configured, try fallback silently
    if (process.env.SENDGRID_API_KEY) {
      return await sendWithSendGrid({ to: recipient, subject, html, from, attachments });
    }
    return r;
  }

  if (process.env.SENDGRID_API_KEY) {
    return await sendWithSendGrid({ to: recipient, subject, html, from, attachments });
  }

  console.warn('Email disabled: no provider keys configured.');
  return { ok:false, disabled:true };
}
