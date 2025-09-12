// /api/search.js
import algoliasearch from "algoliasearch";

export default async function handler(req, res) {
  try {
    const appId = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_API_KEY;
    const indexName = process.env.ALGOLIA_INDEX;

    if (!appId || !apiKey || !indexName) {
      return res.status(500).json({
        error: "Missing Algolia env vars (ALGOLIA_APP_ID / ALGOLIA_API_KEY / ALGOLIA_INDEX)",
      });
    }

    const client = algoliasearch(appId, apiKey);
    const index = client.initIndex(indexName);

    // يدعم GET ?q= و POST { q, hitsPerPage }
    let q = "";
    let hitsPerPage = 5;

    if (req.method === "GET") {
      q = (req.query.q || "").toString();
      if (req.query.hitsPerPage) hitsPerPage = parseInt(req.query.hitsPerPage, 10) || 5;
    } else if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      q = (body.q || body.query || "").toString();
      if (body.hitsPerPage) hitsPerPage = parseInt(body.hitsPerPage, 10) || 5;
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const results = await index.search(q, { hitsPerPage });
    return res.status(200).json({ hits: results.hits });
  } catch (err) {
    console.error("Algolia Search Error:", err);
    return res.status(500).json({ error: err?.message || "Algolia search failed" });
  }
}
