import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAdminAuth } from './admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/qiq-storage' : path.join(__dirname, '../../.storage');
const CONFIG_FILE = path.join(STORAGE_DIR, 'admin-config.json');

async function ensureDir(){ try{ await fs.mkdir(STORAGE_DIR, { recursive:true }); }catch{} }

async function readConfig(){
  try{ await ensureDir(); const t = await fs.readFile(CONFIG_FILE,'utf8'); return JSON.parse(t); }catch{ return { instructions:'', bundles:[] }; }
}
async function writeConfig(cfg){ try{ await ensureDir(); await fs.writeFile(CONFIG_FILE, JSON.stringify(cfg,null,2),'utf8'); return true; }catch{ return false; } }

export default async function handler(req, res){
  // simple wrapper to use middleware manually
  return requireAdminAuth(req, res, async ()=>{
    if (req.method === 'GET'){
      const cfg = await readConfig();
      return res.json(cfg);
    }
    if (req.method === 'POST'){
      const { instructions = '', bundles = [] } = req.body || {};
      const cfg = { instructions: String(instructions||''), bundles: Array.isArray(bundles)? bundles : [] };
      const ok = await writeConfig(cfg);
      if (!ok) return res.status(500).json({ error:'Failed to save config' });
      return res.json({ ok:true });
    }
    res.setHeader('Allow','GET,POST');
    return res.status(405).json({ error:'Method not allowed' });
  });
}
