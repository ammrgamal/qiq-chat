// api/chat.js — clean ESM with FAST_MODE fallback
import algoliasearch from "algoliasearch";

async function searchAlgolia({ query, hitsPerPage = 5 }) {
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_API_KEY; // Search API Key (public/search)
  const index = process.env.ALGOLIA_INDEX || "woocommerce_products";
  if (!appId || !apiKey) return [];
  const client = algoliasearch(appId, apiKey);
  const idx = client.initIndex(index);
  const res = await idx.search(query, { hitsPerPage: Math.min(50, hitsPerPage) });
  return (res?.hits || []).map((h) => ({
    name: h.name || h.title || h.Description || "",
    price: h.price ?? h.Price ?? h["List Price"] ?? "",
    image: h.image || h["Image URL"] || h.thumbnail || "",
    sku: h.sku || h.SKU || h.pn || h["Part Number"] || h.product_code || "",
    link: h.link || h.product_url || h.url || h.permalink || "",
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "messages required" });
    }

    const FAST_MODE = /^(1|true|yes)$/i.test(String(process.env.FAST_MODE || process.env.AUTO_APPROVE || ""));
    const openaiKey = process.env.OPENAI_API_KEY;

    // Fast path: drive a conversational intake (no auto-search unless user explicitly asks)
    if (FAST_MODE || !openaiKey) {
      const last = (messages[messages.length - 1]?.content || '').toLowerCase();
      let reply = 'تمام، خلّيني أفهم احتياجك خطوة بخطوة:\n1) نوع الحل المطلوب؟ (مثال: EDR, Firewall, Wi‑Fi, O365)\n2) العدد/السعة؟\n3) الميزانية التقريبية؟\n4) هل تحب عرض بدائل اقتصادية وممتازة؟';
      // Nudge with domain-specific follow-ups
      if (/(kaspersky|edr|endpoint)/i.test(last)) reply = 'لـ Kaspersky: عدد الأجهزة؟ مدة الترخيص؟ وهل في سيرفرات تحتاج حماية؟';
      if (/(office|microsoft|o365|m365)/i.test(last)) reply = 'Microsoft 365: كم مستخدم؟ هل تحتاج Business Standard ولا E3/E5؟ مساحة التخزين والبريد مهمة؟';
      if (/(vmware|vsphere)/i.test(last)) reply = 'VMware: كم سيرفر؟ عدد المعالجات/الأنوية؟ تحتاج vCenter؟ مستوى الترخيص (Standard/Enterprise)؟';
      // Do not search by default; wait for clearer specs or the word "ابحث"/"search"
      let hits = [];
      if (/(ابحث|search|هات منتجات|products)/i.test(last)) {
        try { hits = await searchAlgolia({ query: last.replace(/(ابحث|search)/ig, '').trim() || 'kaspersky', hitsPerPage: 6 }); } catch {}
      }
      return res.status(200).json({ reply, hits });
    }

    const systemPrompt = [
      "أنت مساعد QuickITQuote.",
      "- تحدث بالعربية أولاً ثم الإنجليزية باختصار.",
      "- إن كان سؤال المستخدم عن منتج/موديل/سعر/بدائل، استدعِ أداة البحث (searchProducts) بكلمة بحث مناسبة.",
      "- إن لم يكن طلبًا عن منتجات، اكمل محادثة جمع البيانات (اسم الشركة، الصناعة، عدد المستخدمين، الأولوية، الميزانية، الإيميل، الهاتف) خطوة بخطوة، ثم لخّص واطلب تأكيد الإرسال.",
      "- عند إرجاع نتائج، اذكر 3 إلى 5 عناصر فقط وروابطها إن توفرت، ثم اقترح إضافة العناصر للعرض (quotation).",
    ].join("\n");

    const openaiURL = "https://api.openai.com/v1/chat/completions";
    const enableGpt5 = String(process.env.ENABLE_GPT5_ALL || "").toLowerCase() === "true";
    const chatModel = enableGpt5 ? (process.env.OPENAI_GPT5_MODEL || "gpt-5") : (process.env.OPENAI_MODEL || "gpt-4o-mini");

    const tools = [
      {
        type: "function",
        function: {
          name: "searchProducts",
          description: "Searches the product catalog for items relevant to the query.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "User intent keyword(s) or model/part number" },
              hitsPerPage: { type: "integer", minimum: 1, maximum: 50 },
            },
            required: ["query"],
          },
        },
      },
    ];

    const call = await fetch(openaiURL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${openaiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: chatModel,
        temperature: 0.4,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
      }),
    });

    const first = await call.json();
    const choice = first?.choices?.[0];
    const toolCalls = choice?.message?.tool_calls || [];
    let assistantMsg = choice?.message?.content || "";
    let hits = [];

    if (Array.isArray(toolCalls) && toolCalls[0]?.function?.name === "searchProducts") {
      const argsText = toolCalls[0].function.arguments || "{}";
      let args = {};
      try { args = JSON.parse(argsText); } catch {}
      const found = await searchAlgolia({ query: args.query || "", hitsPerPage: args.hitsPerPage || 5 });

      const call2 = await fetch(openaiURL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${openaiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: chatModel,
          temperature: 0.4,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            {
              role: "tool",
              tool_call_id: toolCalls[0].id,
              name: "searchProducts",
              content: JSON.stringify({ hits: found }),
            },
          ],
        }),
      });

      const second = await call2.json();
      assistantMsg = second?.choices?.[0]?.message?.content || assistantMsg;
      hits = found || [];
    }

    return res.status(200).json({ reply: assistantMsg || "تم.", hits });
  } catch (e) {
    console.error("chat error:", e);
    return res.status(500).json({ error: e?.message || "chat failed" });
  }
}
