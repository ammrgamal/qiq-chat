#!/usr/bin/env node
// scans repository for potential secret patterns
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const ignoreDirs = new Set(['node_modules', '.git', '.vscode']);
const patterns = [
  { name: 'OpenAI', regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'Resend', regex: /re_[A-Za-z0-9_\-]{15,}/g },
  { name: 'Gemini', regex: /AIza[0-9A-Za-z_\-]{15,}/g },
  { name: 'Algolia32', regex: /\b[0-9a-fA-F]{32}\b/g },
  { name: 'JWT-ish', regex: /eyJ[a-zA-Z0-9_-]{10,}\./g }
];

const findings = [];
const wantJson = process.argv.includes('--json');
function walk(dir){
  for (const entry of fs.readdirSync(dir)){
    const full = path.join(dir, entry);
    const rel = path.relative(root, full);
    if (ignoreDirs.has(entry)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) { walk(full); continue; }
    if (stat.size > 512 * 1024) continue; // skip huge files
    const text = fs.readFileSync(full,'utf8');
    for (const p of patterns){
      const matches = text.match(p.regex);
      if (matches && matches.length){
        // Exempt example template file
        if (rel.includes('local.secrets.example.json')) continue;
        findings.push({ file: rel, type: p.name, count: matches.length });
      }
    }
  }
}
walk(root);

if (!findings.length){
  if (wantJson) {
    console.log(JSON.stringify({ ok:true, findings: [] }, null, 2));
  } else {
    console.log('No potential secrets detected.');
  }
  process.exit(0);
}

if (wantJson) {
  console.log(JSON.stringify({ ok:false, findings }, null, 2));
} else {
  console.log('Potential secret pattern hits:');
  for (const f of findings){
    console.log(`- ${f.file} :: ${f.type} (${f.count})`);
  }
}
process.exit(1);
