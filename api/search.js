// Clean Algolia search endpoint (ESM)
import algoliasearch from 'algoliasearch';
// Dynamic (lazy) modules so that a transient build/ESM resolution issue doesn't crash route load
let arabicNLP = null;
let aiLearningLog = null;
async function ensureDeps(){
  try {
    if (!arabicNLP) {
      arabicNLP = (await import('../rules-engine/src/arabicNLP.js')).default;
    }
  } catch (e) {
    if (process.env.SEARCH_DEBUG==='1') console.warn('[search.deps] arabicNLP load failed', e.message);
  }
  try {
    if (!aiLearningLog) {
      aiLearningLog = (await import('../rules-engine/src/aiLearningLog.js')).default;
    }
  } catch (e) {
    if (process.env.SEARCH_DEBUG==='1') console.warn('[search.deps] aiLearningLog load failed', e.message);
  }
}

export default async function handler(req, res) {
  // Support POST (JSON body) and GET (?q=)
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const started = Date.now();
  const respond = (obj) => {
    const took = Date.now() - started;
    return res.status(200).json({ tookMs: took, ...obj });
  };
  try {
    // Defensive body parsing (in case express.json failed upstream or body empty)
    let body = {};
    if (req.method === 'POST') {
      if (typeof req.body === 'object' && req.body !== null) body = req.body; else body = {};
    } else if (req.method === 'GET') {
      body = {
        query: req.query.q || req.query.query,
        hitsPerPage: req.query.hitsPerPage,
        page: req.query.page,
        facetFilters: req.query.facetFilters ? JSON.parse(req.query.facetFilters) : undefined,
        numericFilters: req.query.numericFilters ? JSON.parse(req.query.numericFilters) : undefined,
        index: req.query.index,
        debug: req.query.debug
      };
    }

    const { query, hitsPerPage, page, facetFilters, numericFilters, index: indexOverride, debug } = body;
    const q = (query ?? '').toString().trim();

  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_API_KEY || process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_SEARCH_KEY; // Try multiple envs
  const defaultIndex = process.env.ALGOLIA_INDEX || process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';
    const indexName = (indexOverride && typeof indexOverride === 'string' && indexOverride.trim()) ? indexOverride.trim() : defaultIndex;

    if (!appId || !apiKey) {
      return respond({ hits: [], facets: {}, nbHits: 0, page: 0, nbPages: 0, warning: 'Algolia credentials not set' });
    }

    if (debug || process.env.SEARCH_DEBUG === '1') {
      console.log('[search.debug] incoming', { q, page, hitsPerPage, facetFilters, numericFilters, indexName, method: req.method });
    }

    // Preprocess Arabic query
    let searchQuery = q;
    let preprocessed = null;
    await ensureDeps();
    if (arabicNLP && arabicNLP.containsArabic && arabicNLP.containsArabic(q)) {
      try {
        preprocessed = await arabicNLP.preprocessQuery(q);
        searchQuery = preprocessed.processed; // Use translated/normalized version
      } catch (prepErr) {
        if (process.env.SEARCH_DEBUG==='1') console.warn('[search.preprocess] failed', prepErr.message);
      }
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

    let result;
    try {
      result = await index.search(searchQuery || '', opts);
    } catch (inner) {
      // If Algolia throws (e.g., index missing), fallback gracefully
      console.warn('Algolia primary search failed, returning empty set:', inner.message);
      if (debug || process.env.SEARCH_DEBUG === '1') {
        console.warn('[search.debug] error stack', inner.stack);
      }
      return respond({
        hits: [],
        facets: {},
        nbHits: 0,
        page: Number(page)||0,
        nbPages: 0,
        error: 'Search backend unavailable',
        detail: debug ? inner.message : undefined
      });
    }
    
    // Log failed Arabic queries for self-learning
    if (preprocessed && (!result?.hits || result.hits.length === 0) && aiLearningLog?.logFailedQuery) {
      try {
        await aiLearningLog.logFailedQuery({
          query: q,
          searchResults: result?.hits || [],
          context: { 
            preprocessed: preprocessed,
            source: 'search_api',
            facetFilters,
            numericFilters
          }
        });
      } catch (logError) {
        if (process.env.SEARCH_DEBUG==='1') console.warn('Failed to log learning data:', logError.message);
      }
    }

    const normalized = (result?.hits || []).map(h => ({
      name: h.name || h.title || h.Description || h.product_name || '',
      price: h.price ?? h.Price ?? h['List Price'] ?? h.list_price ?? '',
      image: h.image || h['Image URL'] || h.thumbnail || (Array.isArray(h.images) ? h.images[0] : ''),
      sku:   h.sku || h.SKU || h.pn || h.mpn || h['Part Number'] || h.product_code || h.objectID || '',
      pn:    h.pn || h.mpn || h['Part Number'] || h.sku || h.SKU || h.product_code || h.objectID || '',
      link:  h.link || h.product_url || h.url || h.permalink || '',
      brand: h.brand || h.manufacturer || h.vendor || h.company || ''
    }));

    const payload = {
      hits: normalized,
      facets: result?.facets || {},
      nbHits: result?.nbHits || 0,
      page: result?.page || 0,
      nbPages: result?.nbPages || 0
    };
    if (debug || process.env.SEARCH_DEBUG === '1') {
      payload.debugInfo = { rawHits: result?.hits?.length, took: result?.processingTimeMS };
    }
    return respond(payload);
  } catch (e) {
    console.error('Algolia search error (outer):', e);
    // Always return 200 with structured empty result to avoid frontend hard failures
    return respond({
      hits: [],
      facets: {},
      nbHits: 0,
      page: 0,
      nbPages: 0,
      error: 'Search failed',
      detail: process.env.SEARCH_DEBUG === '1' ? (e?.stack || e?.message) : undefined
    });
  }
}
