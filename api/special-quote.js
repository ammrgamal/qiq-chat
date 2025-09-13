// pages/api/special-quote.js  أو  api/special-quote.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }
  try {
    const body = req.body || {};
    // TODO: هنا تقدر تضيف تحقق أقوى (email required, at least 1 item, ...)

    // مثال: لو حابب تبعت بريد عبر Resend أو SendGrid أو تحفظ في Notion
    // await sendEmail(body) / await saveToSheet(body) / await saveToDB(body)

    return res.status(200).json({ ok: true, received: body });
  } catch (e) {
    console.error("special-quote error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
