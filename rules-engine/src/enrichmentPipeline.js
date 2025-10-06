// enrichmentPipeline.js - staged enrichment for product data
import fs from 'fs';
import path from 'path';
import aiService from './aiService.js';
import logger from './logger.js';
import { productHash } from './utils/hash.js';

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
  }

  async enrich(product){
    const started = Date.now();
    if (!this.config.enabled) return { enriched:false, disabled:true };
    const accum = { input: product, stages: {}, meta: {}, warnings: [], errors: [] };
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

    const assembled = this.assemble(accum);
    const hash = productHash(product);
    const durationMs = Date.now()-started;
    if (!assembled.features || (assembled.features||[]).length===0){ accum.warnings.push('no_features_extracted'); }
    return { ...assembled, enriched:true, version: process.env.ENRICH_VERSION || String(this.version), hash, warnings: accum.warnings, errors: accum.errors, timings: stageTimings, durationMs };
  }

  async stage1_extract(product){
    // Placeholder: Could use AI prompt to extract structured specs/features
    const name = (product.name || product.ProductName || '').toLowerCase();
    const features = [];
    if (/switch|router/.test(name)) features.push('Network traffic management');
    if (/server/.test(name)) features.push('Enterprise compute node');
    if (/nas|storage/.test(name)) features.push('Centralized data storage');
    const specs = { manufacturer: product.manufacturer || product.Manufacturer || '', baseName: product.name || product.ProductName || '' };
    return { features, specs, keywords: features.map(f=>f.split(' ')[0].toLowerCase()) };
  }

  async stage2_marketing(product, stage1){
    // Use AI for marketing copy (fallback to heuristic)
    try {
      const prompt = `Generate concise JSON marketing enrichment for product. Product name: ${product.name}. Provide fields: value_statement, short_benefit_bullets (array max 5), use_cases (array max 4).`;
      const res = await aiService.classifyProduct({ name: product.name, description: product.description || product.ExtendedDescription || '' });
      // We reused classifyProduct to leverage JSON path; adapt outcome
      return {
        value_statement: res.reasoning || 'High quality solution.',
        short_benefit_bullets: (stage1?.features||[]).slice(0,3),
        use_cases: ['General'],
      };
    } catch (e){
      logger.warn('stage2_marketing fallback', e);
      return { value_statement: 'High quality solution.', short_benefit_bullets: (stage1?.features||[]).slice(0,3), use_cases:['General'] };
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

  assemble(accum){
    const out = { ...(accum.stages.stage1||{}), ...(accum.stages.stage2||{}), ...(accum.stages.stage3||{}), ...(accum.stages.stage4||{}) };
    return out;
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
