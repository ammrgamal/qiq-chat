// Load environment variables from well-known local files if not already set
// Targets Windows path C:\GitHub\API.txt or C:\GitHub\local use API.txt
import fs from 'fs';
import path from 'path';

function normalizeLabelToEnv(label){
  return label.trim().replace(/[^A-Za-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();
}

function applyKv(k, v){
  if (!k || v == null) return;
  if (!process.env[k]) process.env[k] = String(v).trim();
}

function parseAndApply(content){
  const lines = content.split(/\r?\n/);
  let i=0;
  while (i < lines.length){
    let line = lines[i].trim();
    i++;
    if (!line) continue;
    // KEY=VALUE direct
    const eq = line.indexOf('=');
    if (eq > 0){
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq+1).trim();
      applyKv(key, val);
      continue;
    }
    // Label on one line, value on next line
    const envKey = normalizeLabelToEnv(line);
    // Peek next non-empty line
    let val='';
    while (i < lines.length && !val){
      const nxt = lines[i].trim();
      if (nxt) val = nxt; else i++;
    }
    if (val){
      // Special-case some known labels mapping
      const map = {
        'ALGOLIA_SEARCH_API_KEY': 'ALGOLIA_API_KEY',
        'ALGOLIA_WRITE_API_KEY': 'ALGOLIA_WRITE_API_KEY',
        'ALGOLIA_ADMIN_API_KEY': 'ALGOLIA_ADMIN_API_KEY',
        'ALGOLIA_USAGE_API_KEY': 'ALGOLIA_USAGE_API_KEY',
        'ALGOLIA_MONITORING_API_KEY': 'ALGOLIA_MONITORING_API_KEY',
        'GEMINI_API': 'GEMINI_API'
      };
      const key = map[envKey] || envKey;
      applyKv(key, val);
      i++; // consumed value line
    }
  }
}

export function loadLocalEnvFallback(){
  const candidates = [
    'C://GitHub//API.txt',
    'C://GitHub//local use API.txt',
    'C://GitHub//local_use_API.txt'
  ];
  for (const p of candidates){
    try {
      if (fs.existsSync(p)){
        const txt = fs.readFileSync(p,'utf8');
        parseAndApply(txt);
        return { ok:true, source:p };
      }
    } catch {}
  }
  return { ok:false };
}
