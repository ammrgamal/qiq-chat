// public/js/api.js
// SDK صغير لنداءات الشبكة من الواجهة

async function httpJson(url, method = "GET", body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(url, opts);
  let data;
  try { data = await resp.json(); } catch { data = null; }

  if (!resp.ok) {
    const msg = data?.error || resp.statusText || "Request failed";
    const err = new Error(msg);
    err.status = resp.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

/**
 * ابحث منتجات على Algolia (عبر /api/search على السيرفر)
 * @param {string} query  نص البحث
 * @param {number} hitsPerPage  عدد النتائج (افتراضي 5)
 * @returns {Promise<{hits: Array, nbHits: number, query: string}>}
 */
export async function searchProducts(query, hitsPerPage = 5) {
  if (!query || typeof query !== "string") {
    return { hits: [], nbHits: 0, query: "" };
  }
  return await httpJson("/api/search", "POST", { query, hitsPerPage });
}

/* Helpers اختيارية لتوحيد الحقول من الـ hit */
const IMAGE_FIELDS = ["Image URL","image","image_url","image uri","thumbnail","images","img"];
const PRICE_FIELDS = ["List Price","price","Price","list_price","price_usd","priceUSD"];
const PN_FIELDS    = ["Part Number","part_number","pn","PN","sku","SKU","product_code","item","code","رقم","كود","موديل"];
const LINK_FIELDS  = ["link","product_url","url","permalink"];

function first(obj, fields){
  for (const k of fields){
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length){
      const s = String(v[0] ?? "").trim();
      if (s) return s;
    }
  }
  return "";
}

export function normalizeHit(hit) {
  return {
    name:  hit?.name || hit?.title || hit?.Description || "—",
    price: first(hit, PRICE_FIELDS),
    image: first(hit, IMAGE_FIELDS),
    pn:    first(hit, PN_FIELDS) || hit?.sku || hit?.SKU || "",
    sku:  (hit?.sku || hit?.SKU || first(hit, PN_FIELDS) || "").toString().trim(),
    link:  first(hit, LINK_FIELDS),
    raw:   hit
  };
}
