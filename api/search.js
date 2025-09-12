// /api/search.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }

  const query = (body?.query ?? body?.q ?? "").toString().trim();
  const hitsPerPage = Number(body?.hitsPerPage ?? 8) || 8;

  if (!query) return res.status(400).json({ error: "Missing 'query' in body" });

  const APP_ID  = process.env.ALGOLIA_APP_ID;
  const API_KEY = process.env.ALGOLIA_API_KEY;
  const INDEX   = process.env.ALGOLIA_INDEX;

  if (!APP_ID || !API_KEY || !INDEX) {
    return res.status(500).json({ error: "Missing env: ALGOLIA_APP_ID / ALGOLIA_API_KEY / ALGOLIA_INDEX" });
  }

  const url = `https://${APP_ID}-dsn.algolia.net/1/indexes/${encodeURIComponent(INDEX)}/query`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-algolia-application-id": APP_ID,
        "x-algolia-api-key": API_KEY,
      },
      body: JSON.stringify({ query, hitsPerPage }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data?.message || "Algolia error", raw: data });

    return res.status(200).json({
      ok: true,
      query,
      hits: Array.isArray(data?.hits) ? data.hits : [],
      nbHits: data?.nbHits ?? 0,
      page: data?.page ?? 0,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
