// /api/users/logout.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Set-Cookie", `qid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  return res.status(200).json({ ok: true });
}
