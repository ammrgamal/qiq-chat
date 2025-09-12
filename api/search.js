import algoliasearch from "algoliasearch";

export default async function handler(req, res) {
  try {
    const client = algoliasearch(
      process.env.ALGOLIA_APP_ID,
      process.env.ALGOLIA_API_KEY
    );
    const index = client.initIndex(process.env.ALGOLIA_INDEX);

    const { q } = req.query;
    const results = await index.search(q || "", { hitsPerPage: 5 });

    res.status(200).json({ hits: results.hits });
  } catch (err) {
    console.error("Algolia Search Error:", err);
    res.status(500).json({ error: err.message });
  }
}
