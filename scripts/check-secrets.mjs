#!/usr/bin/env node
// check-secrets.mjs - prints presence (not values) of critical secrets
// Usage: node scripts/check-secrets.mjs
import path from 'path';
import fs from 'fs';

const want = [
  'RESEND_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY', 'GOOGLE_API_KEY',
  'HELLOLEADS_API_KEY', 'HELLOLEADS_LIST_KEY',
  'ALGOLIA_APP_ID', 'ALGOLIA_ADMIN_API_KEY', 'ALGOLIA_SEARCH_KEY', 'ALGOLIA_PUBLIC_API_KEY',
  'ALGOLIA_INDEX',
  'SQL_SERVER','SQL_DATABASE','SQL_USER','SQL_PASSWORD'
];

(async function main(){
  // Attempt dynamic local secrets load (mirrors runtime guarded pattern)
  if (!process.env.DISABLE_LOCAL_SECRETS) {
    try {
      const localPath = path.join(process.cwd(), 'secrets.local.js');
      if (fs.existsSync(localPath)) {
        const mod = await import(pathToFileUrl(localPath).href).catch(()=>null);
        if (mod && typeof mod.loadLocalSecrets === 'function') mod.loadLocalSecrets();
      }
    } catch {}
  }
  const report = want.map(k=>({ key: k, present: Boolean(process.env[k]) }));
  const longest = Math.max(...report.map(r=>r.key.length));
  console.log('\nSecret Presence Summary');
  console.log('-'.repeat(longest + 12));
  for (const r of report){
    console.log(r.key.padEnd(longest+2) + (r.present ? 'OK' : 'MISSING'));
  }
  console.log('\nTip: Add missing ones to local.secrets.json (not committed).');
})();
