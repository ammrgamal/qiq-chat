// /api/chat.js
export default async function handler(req, res) {
  // CORS (لو هتطلب من دومين خارجي زي WordPress)
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

const bubble = addMsg("bot","…"); sendBtn.disabled = true;

try {
  const r = await fetch(`/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const raw = await r.text();
  const reply = extractAssistantText(raw) || raw;
  bubble.innerHTML = mdToHtml(reply) || esc(reply);
} catch (err) {
  bubble.textContent = `حصل خطأ أثناء الاتصال بالخادم: ${err.message}`;
} finally {
  sendBtn.disabled = false;
  win.scrollTop = win.scrollHeight;
}
