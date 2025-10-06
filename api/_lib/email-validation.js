// Shared business email validation utility
// Returns { valid:boolean, message?:string }
// AUTO_APPROVE mode bypasses this (handled by callers)

const blockedDomains = new Set([
  'gmail.com','hotmail.com','yahoo.com','outlook.com','googlemail.com','live.com','msn.com','icloud.com','me.com',
  'aol.com','mail.com','ymail.com','protonmail.com','tutanota.com','gmx.com','zoho.com'
]);

export function validateBusinessEmail(email){
  if (!email || typeof email !== 'string') return { valid:false, message:'البريد الإلكتروني مطلوب'};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { valid:false, message:'صيغة البريد الإلكتروني غير صحيحة'};
  const domain = email.toLowerCase().split('@')[1];
  // Allow explicit allow list override
  const allowList = (process.env.ALLOW_EMAIL_DOMAINS||'')
    .split(/[,;\s]+/).map(d=>d.trim().toLowerCase()).filter(Boolean);
  if (allowList.includes(domain)) return { valid:true };
  if (blockedDomains.has(domain)) return { valid:false, message:'يرجى استخدام بريد الشركة وليس بريد شخصي'};
  // Optional custom deny list
  const denyList = (process.env.BLOCK_EMAIL_DOMAINS||'')
    .split(/[,;\s]+/).map(d=>d.trim().toLowerCase()).filter(Boolean);
  if (denyList.includes(domain)) return { valid:false, message:'النطاق محظور، استخدم بريد عمل آخر'};
  return { valid:true };
}

export function isBlockedPersonalDomain(email){
// Provide CommonJS interop when executed under Jest (which transpiles TS but not pure ESM JS here)
// eslint-disable-next-line
if (typeof module !== 'undefined') {
  // @ts-ignore
  module.exports = { validateBusinessEmail, isBlockedPersonalDomain };
}
  if (!email) return false;
  const domain = email.toLowerCase().split('@')[1];
  return blockedDomains.has(domain);
}
