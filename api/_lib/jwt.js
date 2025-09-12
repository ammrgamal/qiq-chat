// /api/_lib/jwt.js
const enc = new TextEncoder();

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function b64urlStr(s) { return b64url(Buffer.from(s)); }

export async function signJWT(payload, secret, expiresInSec = 60*60*24*7) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now()/1000);
  const data = { ...payload, iat: now, exp: now + expiresInSec };

  const p1 = b64urlStr(JSON.stringify(header));
  const p2 = b64urlStr(JSON.stringify(data));
  const unsigned = `${p1}.${p2}`;

  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(unsigned));
  const p3 = b64url(sig);

  return `${unsigned}.${p3}`;
}

export async function verifyJWT(token, secret) {
  try {
    const [p1,p2,p3] = token.split(".");
    const unsigned = `${p1}.${p2}`;
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, Buffer.from(p3.replace(/-/g,"+").replace(/_/g,"/"),"base64"), new TextEncoder().encode(unsigned));
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(p2, "base64").toString("utf8"));
    if (payload?.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch { return null; }
}
