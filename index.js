/* ====== البحث عبر Agent Studio ====== */
async function aSearch(query, hits = (typeof CHAT_HITS_PER_SEARCH !== "undefined" ? CHAT_HITS_PER_SEARCH : 5)) {
  try {
    const r = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, hitsPerPage: hits })
    });

    if (!r.ok) {
      console.warn("agent search http error:", r.status, await r.text().catch(() => ""));
      return [];
    }

    const json = await r.json().catch(() => ({}));

    // الحالات اللي ممكن يرد بيها السيرفر
    // { hits: [...] } أو { results: [...] } أو Array مباشرة
    let hitsArr = Array.isArray(json) ? json : (json.hits || json.results || []);

    if (!Array.isArray(hitsArr)) hitsArr = [];

    return hitsArr;
  } catch (e) {
    console.warn("agent search error:", e?.message || e);
    return [];
  }
}
