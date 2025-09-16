// /api/users/login.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email/password" });
    }

    // TODO: In production, verify against database and check hashed password
    // For now, simulate a successful login for demonstration
    
    // Simple validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
    }

    // Simulate user lookup (replace with real database lookup)
    const userData = {
      id: 12345,
      email: email,
      company: "Demo Company", // This would come from database
      phone: "+20123456789",   // This would come from database
      created: "2024-01-01T00:00:00Z"
    };

    // Generate token (same logic as registration)
    const token = generateSimpleToken(userData);

    console.log("User login:", { email });

    return res.status(200).json({ 
      ok: true, 
      message: "تم تسجيل الدخول بنجاح",
      token, 
      user: userData 
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
}

// Simple token generation (same as in register.js)
function generateSimpleToken(userData) {
  const payload = {
    id: userData.id,
    email: userData.email,
    company: userData.company,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
  return 'qiq_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}
