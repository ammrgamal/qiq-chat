// api/search.js
const algoliasearch = require("algoliasearch");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
  const { query, hitsPerPage, page, facets, filters } = req.body || {};
  const q = (query ?? "").toString(); // allow empty query for default listing

    const appId   = process.env.ALGOLIA_APP_ID;
    const apiKey  = process.env.ALGOLIA_API_KEY; // استخدم Search API Key
    const indexNm = process.env.ALGOLIA_INDEX || "woocommerce_products";

    if (!appId || !apiKey) {
      return res.status(500).json({ error: "Algolia credentials not set" });
    }

    const client = algoliasearch(appId, apiKey);
    const index  = client.initIndex(indexNm);

    // Compose Algolia search options with facets and filters
    const facetList = Array.isArray(facets) && facets.length
      ? facets
      : ["brand", "manufacturer", "categories", "category"];

    const opts = {
      hitsPerPage: Math.min(50, Number(hitsPerPage) || 20),
      page: Number(page) || 0,
      facets: facetList,
    };

    // facetFilters: array of OR groups => [["brand:Apple","brand:Dell"],["categories:Laptops"]]
    const facetFilters = [];
    if (filters && Array.isArray(filters.brands) && filters.brands.length) {
      facetFilters.push(filters.brands.map((b) => `brand:${b}`));
    }
    if (filters && Array.isArray(filters.categories) && filters.categories.length) {
      facetFilters.push(filters.categories.map((c) => `categories:${c}`));
    }
    if (facetFilters.length) opts.facetFilters = facetFilters;

    // numericFilters for price range if the index has numeric 'price'
    const numericFilters = [];
    if (filters && filters.priceMin != null && filters.priceMin !== "") {
      numericFilters.push(`price>=${Number(filters.priceMin)}`);
    }
    if (filters && filters.priceMax != null && filters.priceMax !== "") {
      numericFilters.push(`price<=${Number(filters.priceMax)}`);
    }
    if (numericFilters.length) opts.numericFilters = numericFilters;

    const result = await index.search(q, opts);

    const normalized = (result?.hits || []).map(h => ({
      name: h.name || h.title || h.Description || h.product_name || "",
      price: h.price ?? h.Price ?? h["List Price"] ?? h.list_price ?? "",
      image: h.image || h["Image URL"] || h.thumbnail || (Array.isArray(h.images) ? h.images[0] : ""),
      sku:   h.sku || h.SKU || h.pn || h["Part Number"] || h.product_code || h.objectID || "",
      pn:    h.pn || h["Part Number"] || h.sku || h.SKU || h.product_code || h.objectID || "",
      link:  h.link || h.product_url || h.url || h.permalink || "",
      brand: h.brand || h.manufacturer || h.vendor || h.company || ""
    }));

    return res.status(200).json({
      hits: normalized,
      facets: result?.facets || {},
      nbHits: result?.nbHits || 0,
      page: result?.page || 0,
      nbPages: result?.nbPages || 0,
    });
  } catch (e) {
    console.error("Algolia search error:", e);
    return res.status(500).json({ error: e?.message || "Search failed" });
  }
};
