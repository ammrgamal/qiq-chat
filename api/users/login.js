// /api/users/login.js
import { signJWT } from "../_lib/jwt";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }

  const { email, password } = body || {};
  if (!email || !password) return res.status(400).json({ error: "email, password required" });

  const APP_ID  = process.env.ALGOLIA_APP_ID;
  const API_KEY = process.env.ALGOLIA_API_KEY;
  const USERS   = process.env.ALGOLIA_USERS_INDEX || "qiq_users";
  const JWT_SECRET = process.env.JWT_SECRET || "change-me";

  const base = `https://${APP_ID}-dsn.algolia.net/1/indexes/${encodeURIComponent(USERS)}`;
  try {
    const resp = await fetch(`${base}/query`, {
      method: "POST",
      headers: {
        "content-type":"application/json",
        "x-algolia-application-id": APP_ID,
        "x-algolia-api-key": API_KEY,
      },
      body: JSON.stringify({ query: email, hitsPerPage: 2 })
    });
    const data = await resp.json();
    const hit = (data?.hits || []).find(h => (h.email || "").toLowerCase() === email.toLowerCase());
    if (!hit) return res.status(401).json({ error: "Invalid credentials" });

    const enc = new TextEncoder();
    const pwBytes = enc.encode(password + ":" + hit.salt);
    const hashBuf = await crypto.subtle.digest("SHA-256", pwBytes);
    const hashB64 = Buffer.from(hashBuf).toString("base64");
    if (hashB64 !== hit.hash) return res.status(401).json({ error: "Invalid credentials" });

    const token = await signJWT({ sub: email, name: hit.name || "" }, JWT_SECRET);
    res.setHeader("Set-Cookie", `qid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24*7}`);
    return res.status(200).json({ ok: true, email, name: hit.name || "" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
