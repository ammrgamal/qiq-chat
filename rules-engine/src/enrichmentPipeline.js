// enrichmentPipeline.js - staged enrichment for product data
import fs from 'fs';
import path from 'path';
import aiService from './aiService.js';
import logger from './logger.js';

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
    if (!this.config.enabled) return { enriched:false };
    const accum = { input: product, stages: {}, meta: {} };

    if (this.config.stages.stage1_extract){
      accum.stages.stage1 = await this.stage1_extract(product);
    }
    if (this.config.stages.stage2_marketing){
      accum.stages.stage2 = await this.stage2_marketing(product, accum.stages.stage1);
    }
    if (this.config.stages.stage3_compliance){
      accum.stages.stage3 = await this.stage3_compliance(product, accum.stages.stage1);
    }
    if (this.config.stages.stage4_embeddings){
      accum.stages.stage4 = await this.stage4_embeddings(product, accum.stages.stage2);
    }

    return this.assemble(accum);
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
    const out = { ...accum.stages.stage1, ...accum.stages.stage2, ...accum.stages.stage3, ...accum.stages.stage4 };
    return { enriched:true, ...out };
  }
}

const pipeline = new EnrichmentPipeline();
export default pipeline;
