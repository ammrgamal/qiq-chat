// rulesEngine.js - Lightweight rules evaluation (clean)
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

function loadJsonSafe(p){
  try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return []; }
}

class RulesEngine {
  constructor(){
    const cfgDir = path.join(process.cwd(), 'rules-engine', 'config');
    this.categoryRules = loadJsonSafe(path.join(cfgDir, 'rules.category.json'));
    this.productRules  = loadJsonSafe(path.join(cfgDir, 'rules.product.json'));
    this._compile();
  }
  _compile(){
    const prep = (r)=>{
      const m = r.match || {};
      return {
        ...r,
        _includes: Array.isArray(m.includes)? m.includes.map(s=>s.toLowerCase()):[],
        _regex: Array.isArray(m.regex)? m.regex.map(src=>{ try { return new RegExp(src,'i'); } catch { return null; } }).filter(Boolean):[],
        _manufacturer: Array.isArray(m.manufacturer)? m.manufacturer.map(s=>s.toLowerCase()):[]
      };
    };
    this.categoryRules = this.categoryRules.map(prep).sort((a,b)=>(a.priority||0)-(b.priority||0));
    this.productRules  = this.productRules.map(prep).sort((a,b)=>(a.priority||0)-(b.priority||0));
  }
  matchRule(r, ctx){
    const name = ctx.name;
    if (r._includes.length && !r._includes.some(inc=> name.includes(inc))) return false;
    if (r._regex.length && !r._regex.some(rx=> rx.test(name))) return false;
    if (r._manufacturer.length && !r._manufacturer.includes(ctx.manufacturer)) return false;
    return true;
  }
  resolve(product){
    const ctx = { name: (product.name||product.ProductName||'').toLowerCase(), manufacturer: (product.manufacturer||product.Manufacturer||'').toLowerCase() };
    const tags = new Set(); const bundles = new Set(); const applied = []; let qualityBonus = 0;
    for (const r of this.categoryRules){ try { if (this.matchRule(r, ctx)){ (r.tagsAdd||[]).forEach(t=>tags.add(t)); (r.bundlesAdd||[]).forEach(b=>bundles.add(b)); if (r.qualityScoreBonus) qualityBonus += r.qualityScoreBonus; applied.push(r.id); } } catch(e){ logger.warn('[rulesEngine] category rule failed', r.id, e.message); } }
    for (const r of this.productRules){ try { if (this.matchRule(r, ctx)){ (r.tagsAdd||[]).forEach(t=>tags.add(t)); (r.bundlesAdd||[]).forEach(b=>bundles.add(b)); if (r.qualityScoreBonus) qualityBonus += r.qualityScoreBonus; applied.push(r.id); if (r.stop) break; } } catch(e){ logger.warn('[rulesEngine] product rule failed', r.id, e.message); } }
    return { tags:[...tags], bundles:[...bundles], appliedRules: applied, qualityBonus };
  }
}

const rulesEngine = new RulesEngine();
export default rulesEngine;
