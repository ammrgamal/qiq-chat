// enrichmentPipeline.js - staged enrichment for product data
import fs from 'fs';
import path from 'path';
import aiService from './aiService.js';
import logger from './logger.js'; // remains same path; underlying implementation now in TS
import { productHash } from './utils/hash.js';
import { generateArabicSynonyms } from './utils/arabicSynonyms.js';
import rulesEngine from './rulesEngine.js';

const CONFIG_PATH = path.join(process.cwd(), 'rules-engine', 'config', 'enrichment.json');
function loadConfig(){
  try {
    const raw = fs.readFileSync(CONFIG_PATH,'utf8');
    return JSON.parse(raw);
  } catch { return { enabled:true, stages:{stage1_extract:true, stage2_marketing:true, stage3_compliance:true, stage4_embeddings:false}, limits:{ maxExtendedDescription:1500, maxFeatures:10, maxFaq:4 } }; }
}

export class EnrichmentPipeline {
  constructor(){
    this.config = loadConfig();
    this.version = this.config.version || 1;
    this._marketingCache = new Map(); // simple in-memory cache keyed by (hash:stage2)
  }

  async enrich(product){
    const started = Date.now();
    if (!this.config.enabled) return { enriched:false, disabled:true };
  const accum = { input: product, stages: {}, sections:{}, meta: {}, warnings: [], errors: [] };
    const stageTimings = {};
    const runStage = async (name, fn, ...args) => {
      const t0 = Date.now();
      try { accum.stages[name] = await fn.apply(this, args); }
      catch(e){ accum.errors.push(`${name}:${e.message}`); logger.warn(`[enrich] stage ${name} failed`, e); }
      stageTimings[name] = Date.now()-t0;
    };

    if (this.config.stages.stage1_extract){ await runStage('stage1', this.stage1_extract, product); }
    if (this.config.stages.stage2_marketing){ await runStage('stage2', this.stage2_marketing, product, accum.stages.stage1); }
    if (this.config.stages.stage3_compliance){ await runStage('stage3', this.stage3_compliance, product, accum.stages.stage1); }
    if (this.config.stages.stage4_embeddings){ await runStage('stage4', this.stage4_embeddings, product, accum.stages.stage2); }

    const assembled = this.assemble(accum, product);
    // Apply rules engine (override placeholders)
    try {
      const ruleRes = rulesEngine.resolve(product);
      if (ruleRes.tags.length) assembled.identity.rule_tags = ruleRes.tags;
      if (ruleRes.bundles.length) assembled.identity.bundle_candidates = ruleRes.bundles;
      if (ruleRes.qualityBonus) accum.meta.rules_quality_bonus = ruleRes.qualityBonus;
    } catch (e){ logger.warn('[enrich] rulesEngine resolve failed', e.message); }
    // Arabic / bilingual synonyms (optional)
    try {
      const synRes = await generateArabicSynonyms({
        name: product.name || product.ProductName,
        description: product.description || product.ExtendedDescription || '',
        manufacturer: product.manufacturer || product.Manufacturer || '',
        category: product.classification || product.Category || ''
      });
      if (synRes.synonyms?.length){
        const uniq = [...new Set(synRes.synonyms.map(s=>s.trim()).filter(Boolean))];
        assembled.identity.synonyms = uniq.slice(0,20);
      }
    } catch(e){ logger.warn('[enrich] arabic synonyms generation failed', e.message); }
  const hash = productHash(product);
    const durationMs = Date.now()-started;
    // Derive quality score (light heuristic across sections)
    const qs = this.computeQualityScore(assembled);
    if (accum.meta.rules_quality_bonus){
      qs.score += accum.meta.rules_quality_bonus;
      qs.bucket = qs.score >=80 ? 'high' : qs.score >=50 ? 'medium' : 'low';
    }
    if (!(assembled.identity?.features?.length) && !(assembled.specs?.features?.length)){
      accum.warnings.push('no_features_extracted');
    }
    return { 
      enriched:true,
      version: process.env.ENRICH_VERSION || String(this.version),
      hash,
      sections: assembled,
  quality_score: qs.score,
  quality_bucket: qs.bucket,
  rules_applied_bonus: accum.meta.rules_quality_bonus||0,
      warnings: accum.warnings,
      errors: accum.errors,
      timings: stageTimings,
      durationMs
    };
  }

  async stage1_extract(product){
    // Placeholder: Could use AI prompt to extract structured specs/features
    const name = (product.name || product.ProductName || '').toLowerCase();
    const features = [];
    if (/switch|router/.test(name)) features.push('Network traffic management');
    if (/server/.test(name)) features.push('Enterprise compute node');
    if (/nas|storage/.test(name)) features.push('Centralized data storage');
    const specs = { manufacturer: product.manufacturer || product.Manufacturer || '', baseName: product.name || product.ProductName || '' };
    // Derive short description heuristic
    const baseName = specs.baseName || product.partNumber || 'Product';
    const shortDesc = `${baseName} high-quality solution`; // placeholder
    // Build simple specs_table from features
    const specsTable = features.map(f=>({ feature: f, note: f.split(' ').slice(0,3).join(' ') }));
    return { features, specs, specs_table: specsTable, short_description: shortDesc, keywords: features.map(f=>f.split(' ')[0].toLowerCase()) };
  }

  async stage2_marketing(product, stage1){
    const hashKey = productHash(product)+'::mkt';
    if (this._marketingCache.has(hashKey)) return this._marketingCache.get(hashKey);
    try {
      const prompt = `Generate concise JSON marketing enrichment for product. Product name: ${product.name}. Provide fields: value_statement, short_benefit_bullets (array max 5), use_cases (array max 4).`;
      const res = await aiService.classifyProduct({ name: product.name, description: product.description || product.ExtendedDescription || '' });
      const out = {
        value_statement: res.reasoning || 'High quality solution.',
        short_benefit_bullets: (stage1?.features||[]).slice(0,3),
        use_cases: ['General'],
      };
      this._marketingCache.set(hashKey, out);
      return out;
    } catch (e){
      logger.warn('stage2_marketing fallback', e);
      const fallback = { value_statement: 'High quality solution.', short_benefit_bullets: (stage1?.features||[]).slice(0,3), use_cases:['General'] };
      this._marketingCache.set(hashKey, fallback);
      return fallback;
    }
  }

  async stage3_compliance(product){
    // Simple heuristic compliance tags & risk
    const tags = [];
    const name = (product.name||'').toLowerCase();
    if (/firewall|security/.test(name)) tags.push('Security');
    if (/poe/.test(name)) tags.push('PoE');
    if (/rack|server/.test(name)) tags.push('Datacenter');
    const risk = /server|storage/.test(name) ? 65 : /switch|router/.test(name) ? 40 : 20;
    return { compliance_tags: tags, risk_score: risk };
  }

  async stage4_embeddings(product){
    // Placeholder – would call external embedding API
    return { embedding_ref: null };
  }

  assemble(accum, product){
    const s1 = accum.stages.stage1||{};
    const s2 = accum.stages.stage2||{};
    const s3 = accum.stages.stage3||{};
    const s4 = accum.stages.stage4||{};
    const identity = {
      partNumber: product.partNumber || product.PartNumber || null,
      manufacturer: product.manufacturer || product.Manufacturer || null,
      name: product.name || product.ProductName || null,
      // Bundling / rules placeholders (future heuristics)
      rule_tags: this.deriveRuleTags(product),
      bundle_candidates: this.deriveBundleCandidates(product)
    };
    const marketing = {
      short_description: s1.short_description || null,
      value_statement: s2.value_statement || null,
      short_benefit_bullets: s2.short_benefit_bullets || [],
      use_cases: s2.use_cases || []
    };
    const specs = {
      features: s1.features || [],
      specs_table: s1.specs_table || [],
      specs_meta: s1.specs || {}
    };
    const compliance = {
      compliance_tags: s3.compliance_tags || [],
      risk_score: s3.risk_score || null
    };
    const embeddings = { embedding_ref: s4.embedding_ref || null };
    return { identity, marketing, specs, compliance, embeddings };
  }

  deriveRuleTags(product){
    const name = (product.name||'').toLowerCase();
    const tags = [];
    if (/switch/.test(name)) tags.push('network');
    if (/firewall|security/.test(name)) tags.push('security');
    if (/server/.test(name)) tags.push('compute');
    if (/license|subscription/.test(name)) tags.push('software');
    return tags;
  }

  deriveBundleCandidates(product){
    const name = (product.name||'').toLowerCase();
    const bundles = [];
    if (/switch/.test(name)) bundles.push('rack_mount_kit');
    if (/server/.test(name)) bundles.push('rack_rails');
    if (/security|endpoint/.test(name)) bundles.push('support_subscription');
    return bundles;
  }

  computeQualityScore(sections){
    // Simple weighted presence approach
    const weights = {
      identity_name: 10,
      identity_part: 10,
      marketing_value: 15,
      marketing_bullets: 10,
      specs_features: 15,
      compliance_tags: 10,
      compliance_risk: 5,
      bundles: 10,
      rule_tags: 15,
      synonyms: 12
    };
    let score = 0;
    const has = (cond, w)=>{ if (cond) score += w; };
    has(!!sections.identity?.name, weights.identity_name);
    has(!!sections.identity?.partNumber, weights.identity_part);
    has(!!sections.marketing?.value_statement, weights.marketing_value);
    has(Array.isArray(sections.marketing?.short_benefit_bullets) && sections.marketing.short_benefit_bullets.length>0, weights.marketing_bullets);
    has(Array.isArray(sections.specs?.features) && sections.specs.features.length>0, weights.specs_features);
    has(Array.isArray(sections.compliance?.compliance_tags) && sections.compliance.compliance_tags.length>0, weights.compliance_tags);
    has(typeof sections.compliance?.risk_score === 'number', weights.compliance_risk);
    has(Array.isArray(sections.identity?.bundle_candidates) && sections.identity.bundle_candidates.length>0, weights.bundles);
  has(Array.isArray(sections.identity?.rule_tags) && sections.identity.rule_tags.length>0, weights.rule_tags);
  has(Array.isArray(sections.identity?.synonyms) && sections.identity.synonyms.length>=4, weights.synonyms);
    const bucket = score >=80 ? 'high' : score >=50 ? 'medium' : 'low';
    return { score, bucket };
  }

  // Re-run only selected stages; existingResult is previously enriched object
  async reEnrichPartial(product, existingResult, stages){
    const started = Date.now();
    const out = { ...(existingResult||{}) };
    const wanted = new Set(stages);
    const stageTimings = {};
    const run = async (key, fn, ...args) => {
      const t0 = Date.now();
      try { out[key] = await fn.apply(this, args); } catch(e){ (out.errors = out.errors||[]).push(`${key}:${e.message}`); }
      stageTimings[key] = Date.now()-t0;
    };
    if (wanted.has('stage1')) await run('stage1', this.stage1_extract, product);
    if (wanted.has('stage2')) await run('stage2', this.stage2_marketing, product, out.stage1||existingResult?.stage1);
    if (wanted.has('stage3')) await run('stage3', this.stage3_compliance, product, out.stage1||existingResult?.stage1);
    if (wanted.has('stage4')) await run('stage4', this.stage4_embeddings, product, out.stage2||existingResult?.stage2);
    const assembled = { ...(out.stage1||existingResult?.stage1||{}), ...(out.stage2||existingResult?.stage2||{}), ...(out.stage3||existingResult?.stage3||{}), ...(out.stage4||existingResult?.stage4||{}) };
    return { ...existingResult, ...assembled, partial:true, stagesUpdated:[...wanted], durationMs: Date.now()-started, timings: { ...(existingResult?.timings||{}), ...stageTimings } };
  }
}

const pipeline = new EnrichmentPipeline();
export default pipeline;
