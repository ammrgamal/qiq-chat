// Enrich product media/spec via Gemini (Google) when missing
// POST /api/media/enrich { items: [{ name, pn, brand, link, image, spec_sheet }] }
// Returns { items: [{ image?, spec_sheet? }] } — only fills missing fields

export async function enrichItems(itemsInput) {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API || process.env.Gemini_API || process.env.GEMINI_API_KEY || process.env.GOOGLE_IMAGE_SPECS_API || process.env.Google_Image_Specs_API;
  if (!key) {
    return { items: [], provider: 'none', note: 'Gemini key not configured' };
  }
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  if (!items.length) return { items: [], provider: 'gemini' };

  // Lightweight in-memory cache (per-process). TTL defaults to 7 days unless overridden.
  const ttlMs = Math.max(1, Number(process.env.MEDIA_ENRICH_TTL_HOURS || 24 * 7)) * 3600_000;
  const now = Date.now();
  globalThis.__qiqEnrichCache = globalThis.__qiqEnrichCache || new Map();
  const cache = globalThis.__qiqEnrichCache;

  const out = [];
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  for (const it of items) {
    const needsImage = !it.image;
    const needsSpec = !it.spec_sheet;
    if (!needsImage && !needsSpec) { out.push({}); continue; }
    const cacheKey = makeKey(it);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      // Only supply missing pieces from cache
      out.push({
        image: needsImage ? (cached.image || undefined) : undefined,
        spec_sheet: needsSpec ? (cached.spec_sheet || undefined) : undefined
      });
      continue;
    }
    const prompt = [
      'Given the following product info, return a JSON with direct imageUrl and specPdfUrl if confidently found. If unsure, return empty strings.\n',
      `Name: ${it.name || ''}\n`,
      `PN: ${it.pn || it.sku || ''}\n`,
      `Brand: ${it.brand || ''}\n`,
      `Link: ${it.link || ''}\n`,
      'Only respond with a JSON object of the form {"imageUrl":"","specPdfUrl":""}. Prefer official vendor resources.\n',
      'Do not invent. If unavailable, leave empty.'
    ].join('');
    try {
      const ctrl = new AbortController();
      const to = setTimeout(()=> ctrl.abort(), 8500);
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 200 }
        }),
        signal: ctrl.signal
      });
      clearTimeout(to);
      let imageUrl = '', specPdfUrl = '';
      if (r.ok) {
        const j = await r.json().catch(()=>null);
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try { const parsed = JSON.parse(text); imageUrl = String(parsed?.imageUrl || ''); specPdfUrl = String(parsed?.specPdfUrl || ''); } catch {}
      }
      const record = { image: imageUrl || undefined, spec_sheet: specPdfUrl || undefined };
      // Save to cache if something was found
      if (record.image || record.spec_sheet) {
        cache.set(cacheKey, { ...record, expiresAt: now + ttlMs });
      }
      out.push(record);
    } catch (e) {
      out.push({});
    }
  }
  return { items: out, provider: 'gemini' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const result = await enrichItems(items);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'enrich failed' });
  }
}

function makeKey(p = {}){
  const brand = (p.brand || '').toString().trim().toLowerCase();
  const pn = (p.pn || p.sku || '').toString().trim().toLowerCase();
  const name = (p.name || '').toString().trim().toLowerCase();
  return [brand, pn, name].filter(Boolean).join('|') || name || pn || brand;
}
