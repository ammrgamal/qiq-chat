// /api/search.js  — proxy لـ Algolia Agent Studio

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { q, sessionId } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!q || !q.trim()) {
      return res.status(400).json({ ok: false, error: "Missing 'q' (query) in body" });
    }

    const APP_ID   = process.env.ALGOLIA_APP_ID;
    const API_KEY  = process.env.ALGOLIA_API_KEY;   // Search/Write key with Agent access
    const AGENT_ID = process.env.ALGOLIA_AGENT_ID;
    // لو عندك URL جاهز من شاشة الـ Agent حطّه كمتغير بيئة ALGOLIA_AGENT_URL
    // وإلا هنركّبه من الـ APP_ID و الـ AGENT_ID:
    const AGENT_URL =
      process.env.ALGOLIA_AGENT_URL ||
      `https://${APP_ID}.algolia.net/agent-studio/1/agents/${AGENT_ID}/invoke`;

    // نبعت للـ Agent
    const body = {
      query: q,
      session: { id: sessionId || `web-${Date.now()}` },
      stream: false,
    };

    const resp = await fetch(AGENT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-algolia-application-id": APP_ID,
        "x-algolia-api-key": API_KEY,
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, error: text || resp.statusText });
    }

    // محاولة تفكيك الرد علشان نطلّع نص البوت + أي Products لو متاحة
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // نحاول نلقط النص (الأسامي بتختلف من إصدار لإصدار)
    const replyText =
      data?.answer ||
      data?.reply ||
      data?.content ||
      data?.message ||
      data?.text ||
      data?.output ||
      "";

    // نحاول نلقط النتائج (كروت المنتجات) إن كانت راجعة من الـ tool
    // بندوّر على arrays من شِكل hits/products/results داخل أي tool_calls.
    let products = [];
    const toolCalls = data?.tool_calls || data?.tools || data?.calls || [];
    const pick = (arr) => Array.isArray(arr) ? arr : [];
    for (const t of pick(toolCalls)) {
      const maybe =
        t?.results || t?.hits || t?.products || t?.items || t?.payload || [];
      products = products.concat(pick(maybe));
    }
    // fallback: في بعض الإصدارات بترجع بشكل مباشر
    if (!products.length) {
      products = pick(data?.results || data?.hits || data?.products);
    }

    return res.status(200).json({
      ok: true,
      text: replyText,
      products,
      raw: data, // لو محتاجه للديبج — ممكن تشيله بعد ما تتأكد
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
