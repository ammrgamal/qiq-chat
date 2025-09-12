// /api/users/me.js
import { verifyJWT } from "../_lib/jwt";

export default async function handler(req, res) {
  const JWT_SECRET = process.env.JWT_SECRET || "change-me";
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)qid=([^;]+)/);
  if (!m) return res.status(200).json({ ok: false });

  const token = decodeURIComponent(m[1]);
  const payload = await verifyJWT(token, JWT_SECRET);
  if (!payload) return res.status(200).json({ ok: false });

  return res.status(200).json({ ok: true, user: { email: payload.sub, name: payload.name } });
}
