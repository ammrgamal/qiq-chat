# Enrichment Pipeline Documentation

> Status: ACTIVE (v1 sectioned model) — formerly flat keys. This doc reflects the new structured `sections.*` output.

## 1. Overview
Pipeline: `rules-engine/src/enrichmentPipeline.js`  
Optional Config: `rules-engine/config/enrichment.json`

Purpose: Transform raw product inputs into richer, searchable, scored entities powering facets, ranking, analytics, localization, and bundling logic.

## 2. Implementation Status (Sprint Snapshot)
Stage | Section | Status | Notes
------|---------|--------|------
stage1_extract | sections.identity / sections.specs | DONE | Adds `features`, heuristics, `short_description`, `specs_table`.
stage2_marketing | sections.marketing | DONE (fallback) | AI optional; cache in-memory by hash.
stage3_compliance | sections.compliance | DONE (heuristic) | Risk + compliance tags (keyword rules).
stage4_embeddings | sections.embeddings | PLACEHOLDER | Returns `embedding_ref: null` (future vector store).
rules/bundling (next) | sections.identity | PLANNED | Will inject `rule_tags`, `bundle_candidates`.
localization | sections.marketing | PLANNED | AR / multi-language duplication of value fields.

## 3. Configuration Defaults
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

## 4. Sectioned Stage Pipeline
| Stage | Method | Populates Section | Description | Key Outputs |
|-------|--------|------------------|-------------|-------------|
| 1 Extract | `stage1_extract` | `identity`, `specs` | Heuristic feature & spec tokens | `features`, `keywords`, `short_description`, `specs_table` |
| 2 Marketing | `stage2_marketing` | `marketing` | AI (optional) or deterministic fallback | `value_statement`, `short_benefit_bullets`, `use_cases` |
| 3 Compliance | `stage3_compliance` | `compliance` | Lightweight risk & tag heuristics | `compliance_tags`, `risk_score` |
| 4 Embeddings | `stage4_embeddings` | `embeddings` | Placeholder embedding reference | `embedding_ref` |

## 5. Field Dictionary (Sectioned)
Field (Path) | Type | Source Stage | Notes
-------------|------|--------------|------
sections.identity.features | string[] | 1 | Name-derived keyword phrases.
sections.identity.keywords | string[] | 1 | Tokenized from features.
sections.identity.short_description | string | 1 | Truncated clean synopsis (for cards / tooltips).
sections.identity.specs_table | array<{key,label,value}> | 1 | Lightweight spec rows (currently heuristic scaffold).
sections.specs.manufacturer | string | 1 | Normalized manufacturer.
sections.specs.baseName | string | 1 | Canonical product name (future normalization pass).
sections.marketing.value_statement | string | 2 | AI or fallback sentence.
sections.marketing.short_benefit_bullets | string[] | 2 | Up to 3 trimmed benefits.
sections.marketing.use_cases | string[] | 2 | Default `["General"]` if AI absent.
sections.compliance.compliance_tags | string[] | 3 | Security / PoE / Datacenter / Software / etc.
sections.compliance.risk_score | number | 3 | 20 / 40 / 65 tiers.
sections.embeddings.embedding_ref | string|null | 4 | Future pointer (vector DB id).

Legacy / Derived (outside the section object or computed downstream): `ai_version`, `enrichment_version`, `data_quality_bucket`, `risk_bucket`, `lifecycle_stage`, `marketing_blurb`, `normalized_specs`, `search_blob`, `boost_terms`.

## 6. Output Shape (Current)
Root metadata + nested `sections` plus optional metrics.
```jsonc
{
  "enriched": true,
  "version": "v1.0.0",
  "hash": "18e11f1c",
  "sections": {
    "identity": {
      "features": ["Fiber patch panel", "24-port distribution"],
      "keywords": ["fiber", "patch", "panel"],
      "short_description": "CommScope fiber patch panel 24-port for structured cabling.",
      "specs_table": [
        { "key": "manufacturer", "label": "Manufacturer", "value": "CommScope" }
      ]
    },
    "specs": {
      "manufacturer": "CommScope",
      "baseName": "CommScope Fiber Patch Panel 24 Port"
    },
    "marketing": {
      "value_statement": "Reliable structured cabling component.",
      "short_benefit_bullets": ["High-density", "Reliable"],
      "use_cases": ["General"]
    },
    "compliance": {
      "compliance_tags": ["Datacenter"],
      "risk_score": 40
    },
    "embeddings": { "embedding_ref": null }
  },
  "quality_score": 72,
  "warnings": [],
  "errors": [],
  "timings": { "stage1": 2, "stage2": 0, "stage3": 0 },
  "durationMs": 6
}
```

## 7. AI Interaction & Caching
Only Stage 2 calls `aiService.classifyProduct()` when API keys are present; if absent it emits deterministic fallback content. A simple in-memory marketing cache keyed by product hash avoids duplicate AI calls during a batch run.

## 8. Fallback Seed (Development Safety)
File: `seed/enrich-brands.json` — currently 20 items (CommScope + Kaspersky) used when the source SQL table is missing. The enrichment script `run-enrichment-db.mjs`:
1. Attempts brand query.
2. On failure (e.g., invalid object name) loads seed list.
3. Processes list through pipeline; writes `enrichment-selected.json` summary.

## 9. Quality / Data Scoring (Planned)
Metric | Idea
------|-----
data_quality_score | Weighted completeness across sections (features count, marketing presence, compliance tags).
data_quality_bucket | Threshold mapping (High/Med/Low).
coverage_ratio | (# non-empty tracked fields) / (expected required fields).

## 10. Extensibility Patterns
Enhancement | Guidance
------------|---------
Add new stage | Implement `stageN_name` & toggle via config; output under new `sections.*` key.
Localization | A future `stage5_localization` may add `sections.marketing_localized.{ar,en}`.
Embeddings | Replace placeholder with external vector service; persist ID only.
Spec normalization | Dictionary + mapping pass after Stage 1 populates normalized keys.
Delta re-enrichment | Persist checksum of raw identity fields; skip stages if unchanged.

## 11. Safety & Cost Controls
Control | Rationale
--------|----------
Character limits | Bound AI token usage.
Stage flags | Fast disable of unstable logic.
Fallback path | Deterministic output offline.
Cache reuse | Avoid duplicated prompts.

## 12. Reprocessing Triggers
Trigger | Effect
--------|-------
Change config `version` or env `ENRICH_VERSION` | Bumps `enrichment_version`; downstream re-index.
Alter stage flags | Structural diff; treat as version-worthy if persisted.
AI prompt change | Also bump `ai_version` to separate semantic differences.

## 13. Testing Scenarios
Case | Expectation
-----|------------
Offline / no keys | Marketing fallback deterministic sentences.
Disable marketing stage | `sections.marketing` omitted.
Add new stage5_* | New `sections.someStage` present; existing unaffected.
Risk keyword tweak | Adjusted `risk_score` distribution.

## 14. Sprint Roadmap (Excerpt)
Sprint | Goal | Notes
-------|------|------
Sprint 1 | Sectioned baseline + cache | COMPLETE
Sprint 2 | Rules / Bundling metadata | Pending
Sprint 3 | Localization (AR) + quality scoring | Planned
Sprint 4 | Embeddings integration | Planned

## 16. Arabic / Bilingual Synonyms (Phase 1)
Added lightweight generator (`utils/arabicSynonyms.js`) producing `sections.identity.synonyms` when Arabic tokens detected:
Process: detect → normalize (remove tashkeel, unify letters, digits) → transliterate → optional AI translation → merge & dedupe (max 20).
Mapped to Algolia `search_synonyms` via sync script `scripts/sync-enriched-sqlite-algolia.mjs`.
Quality score now weights presence (>=4 synonyms adds bonus). Future phases: weighting, adaptive learning, multi-language expansion.

### Synonym Cap
Hard limit: we now cap to the first 20 unique normalized tokens to prevent Algolia attribute bloat and excessive indexing cost. If >20 generated, we retain order of appearance (English/Arabic mix) then truncate.

### New Utility Scripts
Script | Purpose
-------|--------
`npm run enrich:arabic-demo` | Inserts fabricated Arabic product for demo + prints enriched JSON.
`npm run algolia:apply-enriched` | Applies enriched index settings (adds `search_synonyms`, `quality_score`, `quality_bucket`).
`npm run sync:algolia:enriched` | Uploads enriched SQLite records (uses improved error hints for rights issues).

## 15. Maintenance Checklist
Action | Frequency
-------|----------
Review section coverage vs search facets | Monthly
Tune risk heuristic thresholds | Quarterly or drift event
Update manufacturer normalization map | As vendors onboard
Benchmark AI latency & token usage | Monthly

---
*Update this document after any structural change to `sections` or meta fields.*
