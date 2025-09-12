// /api/search.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { q, sessionId } = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    if (!q || !q.trim()) {
      return res.status(400).json({ error: "Missing q" });
    }

    // نستخدم URL الكامل لو موجود (مريح وثابت)، أو نركّب من APP_ID + AGENT_ID
    const base =
      process.env.ALGOLIA_AGENT_API_URL &&
      process.env.ALGOLIA_AGENT_API_URL.trim()
        ? process.env.ALGOLIA_AGENT_API_URL.trim()
        : `https://${process.env.ALGOLIA_APP_ID}.algolia.net/agent-studio/1/agents/${process.env.ALGOLIA_AGENT_ID}`;

    const url = `${base.replace(/\/+$/, "")}/interact`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-algolia-application-id": process.env.ALGOLIA_APP_ID,
        "x-algolia-api-key": process.env.ALGOLIA_API_KEY, // مفاتيح Algolia (Admin أو Search key المسموح لها تستدعي الـ Agent)
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: q }],
        // تمرير sessionId اختياري
        userId: sessionId || undefined,
      }),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: raw || "Agent API error" });
    }

    // نحاول نفهم الرد:
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }

    // 1) لو فيه toolResults وفيها hits
    let hits = [];
    try {
      const tools = data?.toolResults || data?.body?.toolResults || [];
      for (const t of tools) {
        const hs = t?.result?.hits || t?.hits || [];
        if (Array.isArray(hs) && hs.length) { hits = hs; break; }
      }
    } catch {}

    // 2) fallback: نحاول نقتبس روابط من message النصّي (للإظهار المؤقت)
    let text =
      data?.answer?.text ||
      data?.body?.answer?.text ||
      data?.messages?.[0]?.content ||
      data?.content ||
      "";

    // تطبيع hits (اسم/سعر/صورة/لينك) ليوافق بقية الكود
    const norm = (h) => ({
      objectID: h.objectID || h.id || h.sku || h.SKU || h.pn,
      name: h.name || h.title || h.Description || "",
      price: h.price || h.price_usd || h.list_price || "",
      image: h.image || h.image_url || h.thumbnail || "",
      sku: h.sku || h.SKU || h.pn || "",
      link: h.link || h.product_url || h.url || h.permalink || "",
      Availability: h.Availability || h.status || "",
    });

    // لو ملقيناش hits، رجّع النص بس (الكلاينت يقدر يعرِضه في الفقاعة)
    if (!hits.length) {
      return res.status(200).json({
        ok: true,
        hits: [],
        text: typeof text === "string" ? text : "",
      });
    }

    return res.status(200).json({
      ok: true,
      hits: hits.map(norm),
      text: typeof text === "string" ? text : "",
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
