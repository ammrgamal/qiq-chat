#!/usr/bin/env node
// Test /api/hello-leads locally without PowerShell quoting issues
// Usage: node scripts/test-hello-leads.mjs [port]
const port = process.argv[2] || process.env.PORT || '3045';
const url = `http://localhost:${port}/api/hello-leads`;

async function main(){
  const body = {
    number: 'Q-TEST-001',
    date: new Date().toISOString().slice(0,10),
    client: { name: 'ACME Ltd', contact: 'John Doe', email: 'john@acme.com', phone: '+123456' },
    project: { name: 'Demo', requester_role: 'Engineer', expected_closing_date: '2025-10-01' },
    items: [ { description: 'Switch 24p', pn: 'SW-24', qty: 2 } ]
  };
  try{
    const r = await fetch(url, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(body) });
    const text = await r.text();
    let json; try{ json = JSON.parse(text); }catch{ json = { raw: text } }
    console.log('[hello-leads status]', r.status);
    console.log(JSON.stringify(json, null, 2));
    process.exit(0);
  }catch(e){
    console.error('[hello-leads error]', e?.message || e);
    process.exit(2);
  }
}

main();
