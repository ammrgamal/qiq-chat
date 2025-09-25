#!/usr/bin/env node
// Test /api/quote-email end-to-end: builds PDF/CSV and attempts email
// Usage: node scripts/test-quote-email.mjs [port]
const port = process.argv[2] || process.env.PORT || '3039';
const url = `http://localhost:${port}/api/quote-email`;

async function main(){
  const payload = {
    action: 'send',
    number: 'QT-LOCAL-TEST-001',
    date: new Date().toISOString().slice(0,10),
    currency: 'USD',
    client: { name: 'ACME Test Co', email: 'client@example.com' },
    project: { name: 'Local Test Project', site: 'HQ' },
    items: [
      { name: 'Firewall Appliance', pn: 'FW-100', qty: 1, unit_price: 499.99, image: 'https://via.placeholder.com/80' },
      { description: 'Managed Switch 24-Port', pn: 'SW-24', qty: 2, unit: 129.5, image: 'https://via.placeholder.com/64' },
      { name: 'Endpoint Security License', qty: 50, unit_price: 3.25 }
    ]
  };
  try{
    const res = await fetch(url, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(payload) });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text } }
    console.log('[quote-email status]', res.status);
    // Show summary without dumping base64 blobs
    if (json && json.ok){
      const emailAdmin = json.email?.admin || {};
      const emailClient = json.email?.client || {};
      console.log('[pdf length]', (json.pdfBase64||'').length);
      console.log('[csv length]', (json.csvBase64||'').length);
      console.log('[email admin]', emailAdmin);
      console.log('[email client]', emailClient);
    } else {
      console.log(JSON.stringify(json, null, 2));
    }
    process.exit(res.ok ? 0 : 1);
  }catch(err){
    console.error('[quote-email error]', err?.message || err);
    process.exit(2);
  }
}

main();
