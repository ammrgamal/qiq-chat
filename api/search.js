// /api/chat.js
export default async function handler(req, res) {
  // CORS (لو هتطلب من دومين خارجي زي موقعك الووردبريس)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.3,
      }),
    });

    // نرجّع النص الخام زي ما هو؛ الواجهة عندك فيها extractAssistantText
    const raw = await resp.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(resp.status).send(raw);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ error: err.message });
  }
}
