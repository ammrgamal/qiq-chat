import algoliasearch from "algoliasearch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = algoliasearch(
      process.env.ALGOLIA_APP_ID,   // App ID من Algolia
      process.env.ALGOLIA_API_KEY  // Search API Key
    );

    const index = client.initIndex(process.env.ALGOLIA_INDEX); // اسم الـ Index من Vercel env
    const { query } = req.body;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Query is required" });
    }

    const results = await index.search(query, {
      hitsPerPage: 10,  // عدد النتائج
    });

    return res.status(200).json(results);
  } catch (error) {
    console.error("Algolia search error:", error);
    return res.status(500).json({ error: error.message });
  }
}
