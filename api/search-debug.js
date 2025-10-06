// /api/search/debug - lightweight diagnostics for search backend (ESM)
// NEVER returns secret keys; only shows presence flags and derived runtime info.
export default async function handler(req, res){
  if (req.method !== 'GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({ ok:false, error:'Method not allowed' });
  }
  try {
    const appId = !!process.env.ALGOLIA_APP_ID;
    const hasAnyKey = !!(process.env.ALGOLIA_API_KEY || process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_SEARCH_KEY || process.env.ALGOLIA_PUBLIC_API_KEY);
    const indexName = process.env.ALGOLIA_INDEX || process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';
    const debugMode = process.env.SEARCH_DEBUG === '1';
    const lastErr = global.__LAST_SEARCH_ERROR ? {
      ageMs: Date.now() - global.__LAST_SEARCH_ERROR.ts,
      message: global.__LAST_SEARCH_ERROR.message,
      stack: debugMode ? global.__LAST_SEARCH_ERROR.stack : undefined
    } : null;
    return res.status(200).json({
      ok: true,
      algolia: {
        appId,
        hasKey: hasAnyKey,
        indexName
      },
      env: {
        debugMode
      },
      lastError: lastErr,
      note: 'No secret values are exposed. Set SEARCH_DEBUG=1 for verbose server logging.'
    });
  } catch (e){
    return res.status(500).json({ ok:false, error:'debug_failure', detail: e?.message });
  }
}
