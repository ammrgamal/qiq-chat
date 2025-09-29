#!/usr/bin/env node
/** Quick test for /api/v0/ui */
import http from 'node:http';

const port = process.argv[2] || process.env.PORT || '3037';

const payload = JSON.stringify({
  prompt: 'Render a minimal HTML div with the text "Hello from V0" and an id="helloV0".',
  context: { now: new Date().toISOString() }
});

const opts = {
  hostname: 'localhost',
  port,
  path: '/api/v0/ui',
  method: 'POST',
  headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
};

const req = http.request(opts, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      console.log('status', res.statusCode, 'provider', j.provider, 'ok', j.ok);
      if (!j.ok && j.error) {
        console.log('error:', (typeof j.error === 'string' ? j.error : JSON.stringify(j.error)).slice(0,200));
      }
      const html = (j.html || '').toString();
      console.log('html snippet:', html.slice(0, 160).replace(/\n/g,' '));
    } catch (e) {
      console.error('Bad JSON:', data.slice(0,200));
    }
  });
});
req.on('error', (e) => console.error('request error', e.message));
req.write(payload);
req.end();
