// Email gateway helper supporting Resend (preferred) with SendGrid fallback.
// Defaults are intentionally in-source per user request for quick setup/dev.
// Override via environment variables in production.

// For safety, do NOT ship default provider API keys.
// Emails will be disabled unless RESEND_API_KEY or SENDGRID_API_KEY is set.
const DEFAULT_FROM_EMAIL     = 'no-reply@quickitquote.com';
const DEFAULT_FROM_NAME      = 'QuickITQuote';

function getFromAddress() {
  const email = process.env.EMAIL_FROM
    || process.env.RESEND_FROM
    || process.env.SENDGRID_FROM
    || DEFAULT_FROM_EMAIL;
  const name = process.env.EMAIL_FROM_NAME || process.env.RESEND_FROM_NAME || DEFAULT_FROM_NAME;
  // Prefer formatted From: "Name <email>"
  return /</.test(email) ? email : `${name} <${email}>`;
}

async function sendWithResend({ to, subject, html, from, attachments }){
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok:false, disabled:true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: from || getFromAddress(),
        to,
        subject,
        html,
        // Resend expects attachments as [{ filename, content, path, type }]
        attachments: Array.isArray(attachments) && attachments.length
          ? attachments.map(a => ({ filename: a.filename, content: a.content, path: a.path, type: a.type }))
          : undefined
      })
    });
    if (!res.ok){
      const t = await res.text();
      console.warn('resend error', res.status, t);
      return { ok:false, provider:'resend', status: res.status, error: t };
    }
    const json = await res.json().catch(()=>({}));
    return { ok:true, provider:'resend', id: json?.id };
  } catch (e) {
    console.warn('resend sendEmail failed', e);
    return { ok:false, provider:'resend', error: String(e&&e.message||e) };
  }
}

async function sendWithSendGrid({ to, subject, html, from, attachments }){
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { ok:false, disabled:true };
  try{
    const res = await fetch('https://api.sendgrid.com/v3/mail/send',{
      method:'POST',
      headers:{ 'authorization': `Bearer ${key}`, 'content-type':'application/json' },
      body: JSON.stringify({
        personalizations:[{ to:[{ email: Array.isArray(to) ? to[0] : to }] }],
        from:{ email: from || getFromAddress() },
        subject,
        content:[{ type:'text/html', value: html }],
        attachments: Array.isArray(attachments) && attachments.length
          ? attachments.map(a => ({
              filename: a.filename,
              type: a.type || 'application/octet-stream',
              content: a.content, // base64 string
              disposition: 'attachment'
            }))
          : undefined
      })
    });
    if (!res.ok){
      const t = await res.text();
      console.warn('sendgrid error', res.status, t);
      return { ok:false, provider:'sendgrid', status: res.status, error: t };
    }
    return { ok:true, provider:'sendgrid' };
  }catch(e){
    console.warn('sendgrid sendEmail failed', e);
    return { ok:false, provider:'sendgrid', error: String(e&&e.message||e) };
  }
}

export async function sendEmail({ to, subject, html, from, attachments }){
  // Normalize recipient to a string or first element
  const recipient = Array.isArray(to) ? to[0] : to;
  if (!recipient) return { ok:false, error:'Missing recipient' };

  // Prefer Resend if key present (env or default), else fallback to SendGrid if configured
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  if (hasResend) {
    let r = await sendWithResend({ to: recipient, subject, html, from, attachments });
    if (r.ok) return r;
    // Try Resend onboarding sender as a fallback if domain is not verified
    try{
      if (!String(from||'').includes('onboarding@resend.dev')){
        const ob = await sendWithResend({ to: recipient, subject, html, from: 'onboarding@resend.dev', attachments });
        if (ob.ok) return { ...ob, usedOnboarding: true };
      }
    }catch{}
    // If Resend fails but SendGrid is configured, try fallback silently
    if (process.env.SENDGRID_API_KEY) {
      const s = await sendWithSendGrid({ to: recipient, subject, html, from, attachments });
      return s.ok ? s : { ok:false, primary:r, fallback:s };
    }
    return r;
  }

  if (process.env.SENDGRID_API_KEY) {
    return await sendWithSendGrid({ to: recipient, subject, html, from, attachments });
  }

  console.warn('Email disabled: no provider keys configured.');
  return { ok:false, disabled:true };
}
