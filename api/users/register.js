// /api/users/register.js
import { userStorage } from '../storage/quotations.js';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    
    // Basic validation
    const required = ["company", "email", "password"];
    for (const field of required) {
      if (!body[field]) {
        return res.status(400).json({ error: `Missing field: ${field}` });
      }
    }

  const { company, email, phone, password } = body;
  const AUTO_APPROVE = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));

    // Enhanced email validation - business emails only
    if (!AUTO_APPROVE) {
      const emailValidation = validateBusinessEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.message });
      }
    }

    // Simple password validation
    if (password.length < 6) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 6 أحرف" });
    }

    // TODO: Here you would normally:
    // 1. Hash the password
    // 2. Save to database
    // 3. Generate JWT token
    // For now, we'll just simulate success

    const adminList = (process.env.AUTO_ADMIN_EMAILS || '')
      .split(/[,;\s]+/)
      .map(e=>e.trim().toLowerCase())
      .filter(Boolean);

    let existing = await userStorage.getByEmail(email);
    if (!existing){
      existing = {
        id: Date.now(),
        email,
        company,
        phone: phone || '',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
    } else {
      existing.company = company;
      existing.phone = phone || '';
    }
    if (adminList.includes(email.toLowerCase())){
      existing.role = 'admin';
      existing.verified = true;
      existing.systemSeeded = existing.systemSeeded || false;
    } else {
      existing.role = existing.role || 'user';
    }
    await userStorage.save(existing);
    const userData = existing;
    const token = generateSimpleToken(userData);

    // Fire-and-forget: send verification email if SENDGRID configured
    if (!AUTO_APPROVE) {
      try {
        const base = req.headers.origin || `http://${req.headers.host}`;
        // Call our own endpoint
        await fetch(base + '/api/users/send-verification', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email }) });
      } catch {}
    }

    return res.status(201).json({ 
      ok: true, 
      message: "تم إنشاء الحساب بنجاح",
      user: userData,
      token
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Failed to create account" });
  }
}

// Email validation function
function validateBusinessEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, message: "صيغة البريد الإلكتروني غير صحيحة" };
  }

  // List of blocked personal email domains
  const blockedDomains = [
    'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 
    'yahoo.co.uk', 'yahoo.co.jp', 'yahoo.de', 'yahoo.fr',
    'aol.com', 'mail.com', 'ymail.com', 'googlemail.com',
    'live.com', 'msn.com', 'icloud.com', 'me.com',
    'protonmail.com', 'tutanota.com'
  ];

  const domain = email.toLowerCase().split('@')[1];
  
  if (blockedDomains.includes(domain)) {
    return { 
      valid: false, 
      message: "يرجى استخدام بريد إلكتروني للعمل/الشركة وليس بريد شخصي مثل Gmail أو Hotmail" 
    };
  }

  return { valid: true };
}

// Simple token generation (replace with proper JWT in production)
function generateSimpleToken(userData) {
  // This is a very basic token - use proper JWT library in production
  const payload = {
    id: userData.id,
    email: userData.email,
    company: userData.company,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
  return 'qiq_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}
