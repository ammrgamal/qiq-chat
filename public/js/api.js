// public/js/api.js

/**
 * استدعاء البحث من الباك إند (/api/search) وإرجاع hits جاهزة.
 * @param {string} query - نص البحث
 * @param {number} hits - عدد النتائج المطلوبة (اختياري)
 * @returns {Promise<Array>} مصفوفة النتائج أو []
 */
async function aSearch(query, hits = 10) {
  const endpoint = "/api/search";

  // تنظيف الكويري سريعًا
  const q = (query || "").toString().trim();
  if (!q) return [];

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({ query: q, hitsPerPage: hits }),
      cache: "no-store",
    });

    // لو رجع 4xx/5xx نطبع الرسالة ونرجّع []
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error) msg += ` - ${errJson.error}`;
      } catch {}
      console.warn("Algolia /api/search error:", msg);
      return [];
    }

    const json = await res.json();
    // شكل استجابة Algolia: { hits: [...], ... }
    const out = Array.isArray(json?.hits) ? json.hits : [];
    return out;
  } catch (e) {
    console.warn("Algolia fetch failed:", e?.message || e);
    return [];
  }
}

/**
 * مثال بسيط لو عايز دالة مريحة بترجع أول نتيجة فقط.
 * @param {string} query
 * @returns {Promise<Object|null>}
 */
async function aSearchFirst(query) {
  const hits = await aSearch(query, 1);
  return hits[0] || null;
}

// Make functions globally available
window.aSearch = aSearch;
window.aSearchFirst = aSearchFirst;
