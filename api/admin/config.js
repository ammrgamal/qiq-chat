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
  try{
    await ensureDir();
    const t = await fs.readFile(CONFIG_FILE,'utf8');
    const j = JSON.parse(t);
    // Back-compat shape
    return Object.assign({ instructions:'', bundles:[], ai:{ autoApproveOverride:false, allowedDomains:[], preferGammaCards: false }, pdf:{ includeItemImages: process.env.NODE_ENV==='production', includePartnerLogos: process.env.NODE_ENV==='production', includeProServices: true } }, j, {
      ai: Object.assign({ autoApproveOverride:false, allowedDomains:[], preferGammaCards: false }, j.ai||{}),
      pdf: Object.assign({ includeItemImages: process.env.NODE_ENV==='production', includePartnerLogos: process.env.NODE_ENV==='production', includeProServices: true }, j.pdf||{})
    });
  }catch{
    return { instructions:'', bundles:[], ai:{ autoApproveOverride:false, allowedDomains:[], preferGammaCards: false }, pdf:{ includeItemImages: process.env.NODE_ENV==='production', includePartnerLogos: process.env.NODE_ENV==='production', includeProServices: true } };
  }
}
async function writeConfig(cfg){
  try{
    await ensureDir();
    // Persist minimal validated shape
    const out = {
      instructions: String(cfg.instructions||''),
      bundles: Array.isArray(cfg.bundles) ? cfg.bundles : [],
      ai: {
        autoApproveOverride: !!(cfg.ai && cfg.ai.autoApproveOverride),
        allowedDomains: Array.isArray(cfg.ai?.allowedDomains) ? cfg.ai.allowedDomains.map(String) : [],
        preferGammaCards: !!(cfg.ai && cfg.ai.preferGammaCards)
      },
      pdf: {
        includeItemImages: !!(cfg.pdf && cfg.pdf.includeItemImages),
        includePartnerLogos: !!(cfg.pdf && cfg.pdf.includePartnerLogos),
        includeProServices: !!(cfg.pdf && cfg.pdf.includeProServices)
      }
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(out,null,2),'utf8');
    return true;
  }catch{ return false; }
}

export default async function handler(req, res){
  // simple wrapper to use middleware manually
  return requireAdminAuth(req, res, async ()=>{
    if (req.method === 'GET'){
      const cfg = await readConfig();
      const autoApproveEnv = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasGemini = !!(process.env.Gemini_API || process.env.GEMINI_API || process.env.GOOGLE_API_KEY);
      const effectiveAutoApprove = !!(autoApproveEnv || cfg.ai?.autoApproveOverride);
      const info = {
        autoApprove: effectiveAutoApprove,
        aiProviders: { openai: hasOpenAI, gemini: hasGemini },
        notes: effectiveAutoApprove ? undefined : 'AUTO_APPROVE is off and no admin override: server will not fetch remote media for AI.',
        details: { envAutoApprove: autoApproveEnv, adminOverride: !!cfg.ai?.autoApproveOverride, allowedDomains: cfg.ai?.allowedDomains||[] }
      };
      return res.json({ ...cfg, _env: info });
    }
    if (req.method === 'POST'){
      const { instructions = '', bundles = [], ai = {}, pdf = {} } = req.body || {};
      const cfg = { instructions: String(instructions||''), bundles: Array.isArray(bundles)? bundles : [], ai, pdf };
      const ok = await writeConfig(cfg);
      if (!ok) return res.status(500).json({ error:'Failed to save config' });
      return res.json({ ok:true });
    }
    res.setHeader('Allow','GET,POST');
    return res.status(405).json({ error:'Method not allowed' });
  });
}
