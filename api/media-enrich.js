// api/media-enrich.js — Enrich missing product image/specs using Gemini (Google_Image_Specs_API)
import dotenv from 'dotenv';
try { dotenv.config(); } catch {}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const product = body.product || body;
    const ttlHours = Number(body.ttlHours ?? 24 * 7); // 7 days default

    const key = process.env.Google_Image_Specs_API || process.env.GEMINI_API || process.env.Gemini_API || process.env.GOOGLE_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    // Basic caching on disk
    let cacheObj = {};
    let cachePath = null;
    try {
      const fs = (await import('fs/promises')).default;
      const path = (await import('path')).default;
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/qiq-storage' : path.join(__dirname, '../.storage');
      cachePath = path.join(STORAGE_DIR, 'enrich-cache.json');
      try { await fs.mkdir(STORAGE_DIR, { recursive: true }); } catch {}
      try {
        const txt = await fs.readFile(cachePath, 'utf8');
        cacheObj = JSON.parse(txt || '{}');
      } catch {}

      const cacheKey = makeKey(product);
      const cached = cacheObj[cacheKey];
      const now = Date.now();
      if (cached && cached.expiresAt && cached.expiresAt > now) {
        return res.status(200).json({ ok: true, cached: true, provider: cached.provider, data: cached.data });
      }

      // If no Gemini key, return empty (let frontend fallbacks work)
      if (!key) {
        return res.status(200).json({ ok: true, provider: 'none', data: { image: '', specs: {}, sources: [] }, note: 'Google_Image_Specs_API not set' });
      }

      const query = buildQuery(product);
      const system = [
        'You are an enterprise product catalog assistant.',
        'Given a product identity (brand, PN, name), return official product image URL (prefer manufacturer domain) and a concise specs object.',
        'Keep fields simple: model, brand, category, key features, dimensions, weight, ports, speed, power, warranty, etc. Use at most 15 fields.',
        'Also include a list of 1-5 likely source URLs (prefer vendor datasheet or product page).',
        'Return strictly valid JSON with keys: image (string), specs (object), sources (array of strings).'
      ].join('\n');

      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}` , {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [ { role: 'user', parts: [ { text: system }, { text: 'Product:' }, { text: JSON.stringify(query) } ] } ],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        })
      });

      if (!r.ok) {
        const msg = await safeText(r);
        return res.status(200).json({ ok: true, provider: 'gemini-fail', data: { image: '', specs: {}, sources: [] }, note: msg || 'Gemini request failed' });
      }

      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      let data = null; try { data = JSON.parse(text); } catch {}
      if (!data || typeof data !== 'object') data = { image: '', specs: {}, sources: [] };

      // Normalize fields
      const norm = {
        image: String(data.image || ''),
        specs: (data.specs && typeof data.specs === 'object') ? data.specs : {},
        sources: Array.isArray(data.sources) ? data.sources.filter(s => typeof s === 'string') : []
      };

      // Write to cache
      try {
        cacheObj[cacheKey] = { data: norm, provider: 'gemini', ts: Date.now(), expiresAt: Date.now() + ttlHours * 3600_000 };
        await fs.writeFile(cachePath, JSON.stringify(cacheObj, null, 2), 'utf8');
      } catch {}

      return res.status(200).json({ ok: true, provider: 'gemini', data: norm });
    } catch (e) {
      // Fallback without disk cache available
      if (!key) return res.status(200).json({ ok: true, provider: 'none', data: { image: '', specs: {}, sources: [] }, note: 'no key' });
      try {
        const query = buildQuery(product);
        const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [ { role: 'user', parts: [ { text: 'Return JSON with keys: image, specs, sources' }, { text: JSON.stringify(query) } ] } ],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
          })
        });
        const j = await r.json();
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        let data = null; try { data = JSON.parse(text); } catch {}
        if (!data || typeof data !== 'object') data = { image: '', specs: {}, sources: [] };
        return res.status(200).json({ ok: true, provider: 'gemini', data });
      } catch (err) {
        return res.status(200).json({ ok: true, provider: 'exception-fallback', data: { image: '', specs: {}, sources: [] } });
      }
    }
  } catch (e) {
    return res.status(200).json({ ok: true, provider: 'exception', data: { image: '', specs: {}, sources: [] } });
  }
}

function buildQuery(p = {}) {
  const q = {
    name: String(p.name || ''),
    pn: String(p.pn || p.sku || p.mpn || ''),
    brand: String(p.brand || p.manufacturer || ''),
    description: String(p.description || ''),
    link: String(p.link || '')
  };
  return q;
}

function makeKey(p = {}) {
  const base = [p.brand || p.manufacturer || '', p.pn || p.sku || '', p.name || ''].join('|').toLowerCase();
  const clean = base.replace(/\s+/g, ' ').trim();
  let hash = 0; for (let i = 0; i < clean.length; i++) { hash = (hash * 31 + clean.charCodeAt(i)) >>> 0; }
  return 'k' + hash.toString(16);
}

async function safeText(r) {
  try { return await r.text(); } catch { return ''; }
}
