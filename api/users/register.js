// /api/quote.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    // Basic validation
    const required = ["company", "users", "email", "phone"];
    for (const f of required) if (!body[f]) return res.status(400).json({ error: `Missing field: ${f}` });

    console.log("New custom quote request:", body); // <-- وصلها بإيميل/CRM لاحقاً

    // مثال رد
    return res.status(200).json({ ok: true, message: "Quote request received" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Failed to submit quote" });
  }
}
