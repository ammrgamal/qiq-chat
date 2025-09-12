// /api/users/login.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing email/password" });

    // TODO: تحقّق من DB
    const fakeToken = `demo.${Buffer.from(email).toString("base64")}.token`;
    return res.status(200).json({ ok: true, token: fakeToken, user: { email } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
}
