// api/bundles-align.js — Align requested bundle items to Algolia catalog (ESM)
import algoliasearch from 'algoliasearch';

function norm(s){
  return String(s||'').trim();
}

function simplify(s){
  return norm(s).toLowerCase().replace(/[^a-z0-9]+/g,'');
}

function scoreHit({ query, brand }, hit){
  // Lightweight scoring: prefer exact PN matches, then brand, then token overlap in name
  const q = norm(query);
  const qSimple = simplify(q);
  const name = norm(hit.name||'');
  const pn   = norm(hit.pn||hit.sku||'');
  const brandHit = norm(hit.brand||'');

  let score = 0;
  if (pn && (simplify(pn) === qSimple)) score += 10; // strong exact pn
  if (pn && qSimple && simplify(pn).includes(qSimple)) score += 6; // pn contains query
  if (brand && brandHit && brand.toLowerCase() === brandHit.toLowerCase()) score += 2;
  if (name) {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    for (const t of tokens) if (t && name.toLowerCase().includes(t)) score += 1;
  }
  return score;
}

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ error:'Method not allowed' });
  }
  try{
    const { requested, hitsPerItem } = req.body || {};
    if (!Array.isArray(requested) || requested.length === 0){
      return res.status(400).json({ error: 'requested array required' });
    }

    const appId = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_API_KEY; // search key ok
    const defaultIndex = process.env.ALGOLIA_INDEX || 'woocommerce_products';
    if (!appId || !apiKey){
      return res.status(200).json({
        ok: true,
        warning: 'Algolia credentials not set',
        results: requested.map((r,i)=>({ i, requested: r, status: 'unverified', match: null, alternatives: [] })),
        messageAr: 'لا يمكننا التحقق من التوفر الآن. سنقترح عناصر عند تفعيل التكامل مع الكاتالوج.',
        messageEn: 'Catalog integration is not configured; cannot validate availability right now.'
      });
    }

    const client = algoliasearch(appId, apiKey);
    const index = client.initIndex(defaultIndex);

    const results = [];
    for (let i=0;i<requested.length;i++){
      const r = requested[i];
      const obj = (r && typeof r === 'object') ? r : { name: String(r||'') };
      const brand = norm(obj.brand||obj.manufacturer||'');
      const query = norm(obj.pn || obj.sku || obj.name || obj.title || '');
      if (!query){
        results.push({ i, requested: r, status:'not-found', match:null, alternatives:[] });
        continue;
      }

      const opts = { hitsPerPage: Math.min(12, Number(hitsPerItem)||8) };
      if (brand) opts.facetFilters = [[`brand:${brand}`, `manufacturer:${brand}`]];

      let searchRes;
      try {
        searchRes = await index.search(query, opts);
      } catch (e) {
        // Fallback: try without filters
        try { searchRes = await index.search(query, { hitsPerPage: Math.min(12, Number(hitsPerItem)||8) }); } catch {
          searchRes = { hits: [] };
        }
      }
      const hits = (searchRes?.hits||[]).map(h => ({
        name: h.name || h.title || h.Description || h.product_name || '',
        price: h.price ?? h.Price ?? h['List Price'] ?? h.list_price ?? '',
        image: h.image || h['Image URL'] || h.thumbnail || (Array.isArray(h.images) ? h.images[0] : ''),
        sku:   h.sku || h.SKU || h.pn || h.mpn || h['Part Number'] || h.product_code || h.objectID || '',
        pn:    h.pn || h.mpn || h['Part Number'] || h.sku || h.SKU || h.product_code || h.objectID || '',
        link:  h.link || h.product_url || h.url || h.permalink || '',
        brand: h.brand || h.manufacturer || h.vendor || h.company || ''
      }));

      // Score and select best match
      let best = null; let bestScore = -1;
      for (const h of hits){
        const s = scoreHit({ query, brand }, h);
        if (s > bestScore){ best = h; bestScore = s; }
      }

      // Determine status
      let status = 'not-found';
      if (best){
        const qSimple = simplify(query);
        const bestPn = simplify(best.pn||best.sku||'');
        if (bestPn && (bestPn === qSimple || bestPn.includes(qSimple))) status = 'exact';
        else status = 'alternative';
      }

      results.push({ i, requested: obj, status, match: best || null, alternatives: hits.slice(0, Math.min(5, hits.length)) });
    }

    const anyMissing = results.some(r => r.status === 'not-found');
    const anyAlt = results.some(r => r.status === 'alternative');
    const messageAr = anyMissing || anyAlt
      ? 'بعض المنتجات المطلوبة غير متوفرة لدينا حاليًا في الكاتالوج. قمنا باقتراح بدائل مناسبة. نحن نضيف منتجات وماركات جديدة باستمرار.'
      : 'تمت مطابقة جميع العناصر مع المنتجات المتوفرة لدينا.';
    const messageEn = anyMissing || anyAlt
      ? 'Some requested products are not currently in our catalog. We suggested suitable alternatives. We continuously expand with new products and brands.'
      : 'All requested items were matched to available products.';

    return res.status(200).json({ ok:true, results, messageAr, messageEn });
  }catch(e){
    console.error('bundles-align error:', e);
    return res.status(500).json({ error: e?.message || 'bundles align failed' });
  }
}
