// api/search.js
const algoliasearch = require("algoliasearch");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, hitsPerPage } = req.body || {};
    const q = (query || "").toString().trim();
    if (!q) return res.status(400).json({ error: "Missing query" });

    const appId   = process.env.ALGOLIA_APP_ID;
    const apiKey  = process.env.ALGOLIA_API_KEY; // استخدم Search API Key
    const indexNm = process.env.ALGOLIA_INDEX || "woocommerce_products";

    if (!appId || !apiKey) {
      return res.status(500).json({ error: "Algolia credentials not set" });
    }

    const client = algoliasearch(appId, apiKey);
    const index  = client.initIndex(indexNm);

    const result = await index.search(q, {
      hitsPerPage: Math.min(50, Number(hitsPerPage) || 10),
    });

    const normalized = (result?.hits || []).map(h => ({
      name: h.name || h.title || h.Description || h.product_name || "",
      price: h.price ?? h.Price ?? h["List Price"] ?? h.list_price ?? "",
      image: h.image || h["Image URL"] || h.thumbnail || (Array.isArray(h.images) ? h.images[0] : ""),
      sku:   h.sku || h.SKU || h.pn || h["Part Number"] || h.product_code || h.objectID || "",
      pn:    h.pn || h["Part Number"] || h.sku || h.SKU || h.product_code || h.objectID || "",
      link:  h.link || h.product_url || h.url || h.permalink || "",
      brand: h.brand || h.manufacturer || h.vendor || h.company || ""
    }));

    return res.status(200).json({ hits: normalized });
  } catch (e) {
    console.error("Algolia search error:", e);
    return res.status(500).json({ error: e?.message || "Search failed" });
  }
};
