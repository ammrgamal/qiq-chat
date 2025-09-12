// /api/search.js
export default async function handler(req, res) {
  // CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, hitsPerPage = 5 } =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const appId  = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_API_KEY; // Search-Only أو Admin (Search-Only كفاية)
    const index  = process.env.ALGOLIA_INDEX;

    const idxUrl = `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(index)}/query`;
    const r = await fetch(idxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-API-Key": apiKey,
        "X-Algolia-Application-Id": appId,
      },
      body: JSON.stringify({ query, hitsPerPage }),
    });

    const json = await r.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(r.status).json(json);

  } catch (e) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ error: e.message });
  }
}
