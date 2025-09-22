// api/search-health.js (ESM)
import algoliasearch from 'algoliasearch';

export default async function handler(req, res) {
  try {
    const appId = process.env.ALGOLIA_APP_ID || '';
    const apiKey = process.env.ALGOLIA_API_KEY || '';
    const indexNm = process.env.ALGOLIA_INDEX || 'woocommerce_products';

    const hasKeys = Boolean(appId && apiKey);
    let canConnect = false;
    let nbHits = null;
    let message = null;

    if (!hasKeys) {
      return res.status(200).json({ ok: true, hasKeys, canConnect, index: indexNm, nbHits: 0, message: 'Missing ALGOLIA_APP_ID or ALGOLIA_API_KEY' });
    }

    try {
      const client = algoliasearch(appId, apiKey);
      const index = client.initIndex(indexNm);
      const result = await index.search('', { hitsPerPage: 0 });
      canConnect = true;
      nbHits = result?.nbHits ?? 0;
    } catch (e) {
      message = e?.message || 'Failed to query Algolia';
    }

    const appMasked = appId ? `${appId.slice(0, 2)}***${appId.slice(-2)}` : null;
    return res.status(200).json({ ok: true, hasKeys, canConnect, appId: appMasked, index: indexNm, nbHits, message });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'health error' });
  }
}
