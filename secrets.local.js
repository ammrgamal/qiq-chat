// secrets.local.js - load local development secrets from local.secrets.json if present
// This file is safe to commit; it only reads a gitignored JSON file and populates process.env
// Precedence: existing process.env values WIN over file values (do not overwrite)
import fs from 'fs';
import path from 'path';

export function loadLocalSecrets() {
  try {
    const root = process.cwd();
    const filePath = path.join(root, 'local.secrets.json');
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    let applied = 0;
    for (const [k,v] of Object.entries(data)){
      if (typeof process.env[k] === 'undefined' || process.env[k] === ''){
        process.env[k] = v;
        applied++;
      }
    }
    return applied;
  } catch (e) {
    console.warn('Failed to load local.secrets.json', e.message);
    return false;
  }
}

// Auto-execute when imported directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const applied = loadLocalSecrets();
  console.log(`Local secrets applied: ${applied || 0}`);
}
