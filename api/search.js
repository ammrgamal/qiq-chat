// Clean Algolia search endpoint (ESM)
import algoliasearch from 'algoliasearch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { query, hitsPerPage, page, facetFilters, numericFilters, index: indexOverride } = req.body || {};
    const q = (query ?? '').toString();

    const appId = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_API_KEY; // Search or Admin key both OK for querying
    const defaultIndex = process.env.ALGOLIA_INDEX || 'woocommerce_products';
    const indexName = (indexOverride && typeof indexOverride === 'string' && indexOverride.trim()) ? indexOverride.trim() : defaultIndex;

    if (!appId || !apiKey) {
      return res.status(200).json({ hits: [], facets: {}, nbHits: 0, page: 0, nbPages: 0, warning: 'Algolia credentials not set' });
    }

    const client = algoliasearch(appId, apiKey);
    const index = client.initIndex(indexName);

    // Keep options minimal and rely on index settings. This prevents accidental 0 results due to mismatched attributes.
    const opts = {
      hitsPerPage: Math.min(50, Number(hitsPerPage) || 20),
      page: Number(page) || 0,
      facets: ['brand', 'manufacturer', 'categories', 'category']
    };
    if (Array.isArray(facetFilters) && facetFilters.length) opts.facetFilters = facetFilters;
    if (Array.isArray(numericFilters) && numericFilters.length) opts.numericFilters = numericFilters;

    const result = await index.search(q, opts);

    const normalized = (result?.hits || []).map(h => ({
      name: h.name || h.title || h.Description || h.product_name || '',
      price: h.price ?? h.Price ?? h['List Price'] ?? h.list_price ?? '',
      image: h.image || h['Image URL'] || h.thumbnail || (Array.isArray(h.images) ? h.images[0] : ''),
      sku:   h.sku || h.SKU || h.pn || h.mpn || h['Part Number'] || h.product_code || h.objectID || '',
      pn:    h.pn || h.mpn || h['Part Number'] || h.sku || h.SKU || h.product_code || h.objectID || '',
      link:  h.link || h.product_url || h.url || h.permalink || '',
      brand: h.brand || h.manufacturer || h.vendor || h.company || '',
      availability: h.availability ?? h.stock_status ?? h.in_stock ?? '',
      spec_sheet: h.spec_sheet || h.specsheet || h.datasheet || h['Spec URL'] || h['Datasheet'] || ''
    }));

    return res.status(200).json({
      hits: normalized,
      facets: result?.facets || {},
      nbHits: result?.nbHits || 0,
      page: result?.page || 0,
      nbPages: result?.nbPages || 0
    });
  } catch (e) {
    console.error('Algolia search error:', e);
    const status = Number(e?.status) || 500;
    return res.status(status).json({ error: e?.message || 'Search failed' });
  }
}
