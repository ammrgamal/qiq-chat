// /api/search.js

import algoliasearch from "algoliasearch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, hitsPerPage = 5 } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Invalid or missing query" });
    }

    // تأكد إن الـ Env Variables موجودة
    const appId = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_API_KEY;
    const indexName = process.env.ALGOLIA_INDEX;

    if (!appId || !apiKey || !indexName) {
      return res.status(500).json({ error: "Algolia environment variables missing" });
    }

    // Connect to Algolia
    const client = algoliasearch(appId, apiKey);
    const index = client.initIndex(indexName);

    // Search
    const result = await index.search(query, { hitsPerPage });

    return res.status(200).json({
      hits: result.hits || [],
      nbHits: result.nbHits,
      query: result.query
    });
  } catch (error) {
    console.error("Algolia search error:", error);
    return res.status(500).json({ error: "Search failed", details: error.message });
  }
}
