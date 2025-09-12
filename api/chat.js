// /api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    // عادي جدًا تشوف الرسالة دي لو فتحت /api/chat من المتصفح (GET)
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // تأكيد قراءة البودي كـ JSON
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    // حماية بسيطة
    if (messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // نداء OpenAI (تأكد إن اسم المتغير في Vercel هو OPENAI_API_KEY)
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.3,
      }),
    });

    // لو OpenAI رجع خطأ، نرجعه زي ما هو للنصّ الأمامي
    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: errText });
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (error) {
    // أي خطأ غير متوقّع
    return res.status(500).json({ error: error.message || "Server error" });
  }
}
