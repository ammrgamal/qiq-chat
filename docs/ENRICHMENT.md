# Enrichment Pipeline Documentation

## 1. Overview
Pipeline: `rules-engine/src/enrichmentPipeline.js`  
Config (optional): `rules-engine/config/enrichment.json`

Purpose: Transform raw product inputs into richer, searchable, scored entities powering facets, ranking, and future analytics.

## 2. Configuration Defaults
```jsonc
{
  "enabled": true,
  "version": 1,
  "stages": {
    "stage1_extract": true,
    "stage2_marketing": true,
    "stage3_compliance": true,
    "stage4_embeddings": false
  },
  "limits": {
    "maxExtendedDescription": 1500,
    "maxFeatures": 10,
    "maxFaq": 4
  }
}
```

## 3. Stage Pipeline
| Stage | Method | Description | Key Outputs |
|-------|--------|-------------|-------------|
| 1 Extract | `stage1_extract` | Heuristic feature/spec extraction | `features`, `specs`, `keywords` |
| 2 Marketing | `stage2_marketing` | AI-assisted value messaging (fallback safe) | `value_statement`, `short_benefit_bullets`, `use_cases` |
| 3 Compliance | `stage3_compliance` | Risk heuristics + compliance tagging | `compliance_tags`, `risk_score` |
| 4 Embeddings | `stage4_embeddings` | Placeholder embedding reference | `embedding_ref` |

## 4. Field Dictionary
Field | Type | Source Stage | Notes
------|------|--------------|------
features | string[] | 1 | Simple heuristics based on name keywords.
specs.manufacturer | string | 1 | Normalized manufacturer.
specs.baseName | string | 1 | Canonical product name.
keywords | string[] | 1 | First-word tokens of feature phrases.
value_statement | string | 2 | From AI reasoning or fallback text.
short_benefit_bullets | string[] | 2 | Up to 3 trimmed from `features`.
use_cases | string[] | 2 | Default `["General"]` if AI absent.
compliance_tags | string[] | 3 | Security / PoE / Datacenter, etc.
risk_score | number | 3 | 20/40/65 heuristic tiers.
embedding_ref | string|null | 4 | Future pointer to vector storage.

Additional Algolia-oriented / derived fields (outside this file) include:  
`ai_version`, `enrichment_version`, `data_quality_bucket`, `risk_bucket`, `lifecycle_stage`, `marketing_blurb`, `normalized_specs`, `search_blob`, `boost_terms`.

## 5. Assembly Shape
```jsonc
{
  "enriched": true,
  "features": ["Network traffic management"],
  "specs": {"manufacturer": "Cisco", "baseName": "Cisco Catalyst 2960-24TT-L Switch"},
  "keywords": ["network"],
  "value_statement": "High quality solution.",
  "short_benefit_bullets": ["Network traffic management"],
  "use_cases": ["General"],
  "compliance_tags": ["Security"],
  "risk_score": 40,
  "embedding_ref": null
}
```

## 6. AI Interaction
Only Stage 2 currently uses `aiService.classifyProduct()` to reuse JSON extraction & reasoning. Offline / invalid key → fallback instantly.

## 7. Quality / Data Scoring (Planned)
Metric | Idea
------|-----
data_quality_score | Weighted completeness (features count, presence of value_statement, compliance tags).
data_quality_bucket | Threshold mapping (A/B/C or High/Medium/Low).
coverage_ratio | (# filled enrichment fields) / (expected fields per stage).

## 8. Extensibility Patterns
Enhancement | Guidance
-----------|---------
Add new stage | Implement `stageN_name` & toggle in config.
Localization | Introduce `stageX_localization` generating `value_statement_ar` etc.
Embeddings | Use external vector service; persist ID only.
Spec normalization | Build dictionary mapping vendor synonyms → canonical keys.
Delta re-enrichment | Store checksum of (name+description); skip unchanged.

## 9. Safety & Cost Controls
Control | Rationale
--------|----------
Character limits | Prevent runaway AI tokens.
Stage flags | Disable unstable stages quickly.
Fallback path | Guarantees deterministic output when AI absent.
Cache reuse | Avoid repetitive prompt costs for similar items.

## 10. Reprocessing Triggers
Trigger | Effect
--------|-------
Change `version` in config | Marks new `enrichment_version` for facets.
Alter stage flags | Immediate structural change in outputs.
AI prompt updates | (Future) bump `ai_version` concurrently.

## 11. Testing Scenarios
Case | Expectation
-----|------------
Offline (`--offline`) | Stage 2 fallback text.
Disable marketing stage | Missing `value_statement`, `short_benefit_bullets`.
Add new stage5_* | Output includes additional keys; no collision.
Risk keyword change | Adjusted `risk_score` distribution.

## 12. Future Roadmap
- Structured spec extraction via dedicated AI prompt (YAML → parse → normalize).
- Embedding caching keyed by checksum.
- Confidence calibration & risk normalization (z-score across batch).
- Arabic & bilingual marketing layers.
- Anomaly detection: flag improbable price vs category.

## 13. Maintenance Checklist
Action | Frequency
-------|----------
Review stage outputs vs search facets | Monthly
Tune risk heuristic boundaries | Quarterly or model drift
Add new manufacturer synonyms | As new vendors onboard
Benchmark AI latency & token usage | Monthly

---
*Update this document with any new stage or indexing-impacting field.*
