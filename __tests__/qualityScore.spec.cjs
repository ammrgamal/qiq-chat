// qualityScore.spec.cjs - tests enrichment quality scoring heuristic
const path = require('path');

// Dynamic import of ESM enrichmentPipeline
async function loadPipeline(){
  const mod = await import(path.join(process.cwd(),'rules-engine','src','enrichmentPipeline.js'));
  return mod.default;
}

describe('quality score computation', () => {
  let pipeline;
  beforeAll(async () => { pipeline = await loadPipeline(); });

  test('low score when minimal fields', () => {
    const sections = { identity:{}, marketing:{}, specs:{}, compliance:{}, embeddings:{} };
    const q = pipeline.computeQualityScore(sections);
    expect(q.score).toBeLessThan(30);
    expect(['low']).toContain(q.bucket);
  });

  test('high score when most fields populated incl synonyms', () => {
    const sections = {
      identity:{ name:'Prod', partNumber:'P1', bundle_candidates:['a'], rule_tags:['x'], synonyms:['a','b','c','d'] },
      marketing:{ value_statement:'Great', short_benefit_bullets:['one'] },
      specs:{ features:['f1'] },
      compliance:{ compliance_tags:['c1'], risk_score:10 },
      embeddings:{}
    };
    const q = pipeline.computeQualityScore(sections);
    expect(q.score).toBeGreaterThanOrEqual(80);
    expect(['high']).toContain(q.bucket);
  });
});