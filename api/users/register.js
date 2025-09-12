// /api/users/register.js
import { signJWT } from "../_lib/jwt";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }

  const { name, email, password } = body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });

  const APP_ID  = process.env.ALGOLIA_APP_ID;
  const API_KEY = process.env.ALGOLIA_API_KEY;
  const USERS   = process.env.ALGOLIA_USERS_INDEX || "qiq_users";
  const JWT_SECRET = process.env.JWT_SECRET || "change-me";

  const base = `https://${APP_ID}.algolia.net/1/indexes/${encodeURIComponent(USERS)}`;
  try {
    // هل الإيميل موجود؟
    const searchUrl = `${base}/query`;
    const s = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "content-type":"application/json",
        "x-algolia-application-id": APP_ID,
        "x-algolia-api-key": API_KEY,
      },
      body: JSON.stringify({ query: email, hitsPerPage: 1 })
    });
    const sj = await s.json();
    const exists = (sj?.hits || []).find(h => (h.email || "").toLowerCase() === email.toLowerCase());
    if (exists) return res.status(409).json({ error: "Email already registered" });

    // hash
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = Buffer.from(salt).toString("base64");
    const enc = new TextEncoder();
    const pwBytes = enc.encode(password + ":" + saltB64);
    const hashBuf = await crypto.subtle.digest("SHA-256", pwBytes);
    const hashB64 = Buffer.from(hashBuf).toString("base64");

    const now = new Date().toISOString();
    const createResp = await fetch(base, {
      method: "POST",
      headers: {
        "content-type":"application/json",
        "x-algolia-application-id": APP_ID,
        "x-algolia-api-key": API_KEY,
      },
      body: JSON.stringify({ name, email, salt: saltB64, hash: hashB64, createdAt: now })
    });
    const cj = await createResp.json();
    if (!createResp.ok) return res.status(createResp.status).json({ error: cj?.message || "Algolia error", raw: cj });

    const token = await signJWT({ sub: email, name }, JWT_SECRET);
    res.setHeader("Set-Cookie", `qid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24*7}`);
    return res.status(200).json({ ok: true, email, name });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
