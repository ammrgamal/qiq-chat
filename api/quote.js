// /api/quote.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }

  const {
    name, email, phone, company,
    requirements, // نص حر
    items = [],   // [{sku,name,qty,price},...]
  } = body || {};

  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  const APP_ID  = process.env.ALGOLIA_APP_ID;
  const API_KEY = process.env.ALGOLIA_API_KEY; // Admin/Search (يفضل Admin للحفظ)
  const QUOTES  = process.env.ALGOLIA_QUOTES_INDEX || "qiq_quotes";

  if (!APP_ID || !API_KEY) {
    return res.status(500).json({ error: "Missing env ALGOLIA_APP_ID / ALGOLIA_API_KEY" });
  }

  const url = `https://${APP_ID}.algolia.net/1/indexes/${encodeURIComponent(QUOTES)}`;
  const now = new Date().toISOString();

  const obj = {
    name, email, phone, company,
    requirements: (requirements || "").toString(),
    items: Array.isArray(items) ? items : [],
    status: "new",
    createdAt: now,
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-algolia-application-id": APP_ID,
        "x-algolia-api-key": API_KEY,
      },
      body: JSON.stringify(obj),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data?.message || "Algolia error", raw: data });

    return res.status(200).json({ ok: true, id: data?.objectID, createdAt: now });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
