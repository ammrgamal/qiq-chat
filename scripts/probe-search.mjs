// Quick probe for /api/search endpoint
// Usage: node scripts/probe-search.mjs [query] [baseUrl]
// Default query: test, default baseUrl: http://localhost:3001

const q = process.argv[2] || 'test';
const base = process.argv[3] || process.env.BASE_URL || 'http://localhost:3001';

async function main(){
  const url = `${base}/api/search?q=${encodeURIComponent(q)}`;
  const started = Date.now();
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    console.error('[probe] network failure', e.message);
    process.exit(2);
  }
  const text = await res.text();
  const took = Date.now() - started;
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  console.log(JSON.stringify({
    ok: res.ok,
    status: res.status,
    tookMs: took,
    hasHitsField: parsed && Object.prototype.hasOwnProperty.call(parsed,'hits'),
    error: parsed && parsed.error,
    warning: parsed && parsed.warning,
    raw: !parsed ? text.slice(0,200) : undefined
  }, null, 2));
  if (res.status >= 500) process.exit(1);
}
main();
