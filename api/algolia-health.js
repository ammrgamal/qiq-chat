// Lightweight Algolia health / diagnostic endpoint
// Returns: configured index name(s), mismatch warning, basic stats (nbHits) using search-only key if available.
// Does NOT expose admin key.
import algoliasearch from 'algoliasearch';
import dotenv from 'dotenv';
try { dotenv.config(); } catch {}

export default async function handler(req, res){
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }
  const t0 = Date.now();
  const appId = process.env.ALGOLIA_APP_ID;
  const rawSearchKey = process.env.ALGOLIA_SEARCH_KEY || process.env.ALGOLIA_PUBLIC_API_KEY;
  const adminKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
  const allowEmergency = /^(1|true|yes)$/i.test(String(process.env.ALLOW_ADMIN_KEY_AS_SEARCH || ''));
  const searchKey = rawSearchKey || (allowEmergency ? adminKey : null);
  const idxA = process.env.ALGOLIA_INDEX?.trim();
  const idxB = process.env.ALGOLIA_INDEX_NAME?.trim();
  const resolved = idxA || idxB || 'woocommerce_products';
  const mismatch = Boolean(idxA && idxB && idxA !== idxB);

  if (!appId || !searchKey){
    return res.status(200).json({
      ok: false,
      configured: false,
      reason: !appId ? 'Missing ALGOLIA_APP_ID' : 'Missing search key (ALGOLIA_SEARCH_KEY / ALGOLIA_PUBLIC_API_KEY)',
      index: resolved,
      mismatch,
      hasAdminKey: Boolean(adminKey),
      emergencyAllowed: allowEmergency,
      tookMs: Date.now()-t0
    });
  }

  try {
    const client = algoliasearch(appId, searchKey);
    const index = client.initIndex(resolved);
    // Use empty query for fast stats (attributesToRetrieve none)
    const searchRes = await index.search('', { hitsPerPage: 0 });
    return res.status(200).json({
      ok: true,
      configured: true,
      index: resolved,
      envIndex: idxA || null,
      envIndexName: idxB || null,
      mismatch,
      nbHits: searchRes.nbHits || 0,
      processingTimeMS: searchRes.processingTimeMS || null,
      hasAdminKey: Boolean(adminKey),
      usedEmergencyFallback: Boolean(!rawSearchKey && allowEmergency && adminKey),
      tookMs: Date.now()-t0
    });
  } catch (e){
    return res.status(500).json({
      ok: false,
      configured: true,
      index: resolved,
      mismatch,
      error: e.message,
      hasAdminKey: Boolean(adminKey),
      tookMs: Date.now()-t0
    });
  }
}
