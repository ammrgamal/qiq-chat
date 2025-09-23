#!/usr/bin/env node
// Simple PDF-AI endpoint test without PowerShell quoting issues
// Usage: node scripts/test-pdf-ai.mjs [port]
const port = process.argv[2] || process.env.PORT || '3037';
const url = `http://localhost:${port}/api/pdf-ai`;

async function main(){
  const body = {
    client: { name: 'ACME' },
    project: { name: 'Demo' },
    currency: 'USD',
    items: [
      { description: 'Switch 24p', qty: 2, unit: 100, image: 'https://via.placeholder.com/64', link: 'https://example.com/switch.pdf' }
    ],
    imageUrls: ['https://via.placeholder.com/64'],
    webUrls: ['https://example.com/switch.pdf'],
    pdfUrls: ['https://example.com/switch.pdf']
  };
  try{
    const res = await fetch(url, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(body) });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text } }
    console.log('[pdf-ai status]', res.status);
    console.log(JSON.stringify(json, null, 2));
    process.exit(res.ok ? 0 : 1);
  }catch(err){
    console.error('[pdf-ai error]', err?.message || err);
    process.exit(2);
  }
}

main();
