# Rules Engine Specification

This document defines the lightweight rules engine used during enrichment and for downstream recommendation / bundling logic.

## Goals
1. Deterministic, explainable rule tagging (no black‑box ML yet).
2. Fast evaluation (pure in‑process JS, O(n · m) where m ≪ n).  
3. Pluggable: allow future move to DB‑stored or remote managed rules.
4. Diff‑friendly: rules expressed as JSON arrays, one object per rule.

## Rule Object Shapes

### Category Rule
```jsonc
{
  "id": "net.switch.base",
  "match": {
    "includes": ["switch"],          // ANY substring match on product name
    "regex": ["\\bpoe\\b"]          // OPTIONAL array of case-insensitive regex sources
  },
  "tagsAdd": ["network", "switch"],   // Tags to append (deduped)
  "bundlesAdd": ["rack_mount_kit"],    // Bundle candidate slugs
  "priority": 50,                      // Larger number = later override / stronger
  "stop": false,                       // If true, stop further rule evaluation after applying
  "notes": "Base switch detection"
}
```

### Product Rule (more specific)
```jsonc
{
  "id": "sec.firewall.poe",
  "match": {
    "includes": ["firewall"],
    "regex": ["poe"],
    "manufacturer": ["fortinet", "cisco"]   // OPTIONAL manufacturer filter (lowercase)
  },
  "tagsAdd": ["security", "firewall"],
  "bundlesAdd": ["support_subscription"],
  "qualityScoreBonus": 5,  // Optional additive score bump
  "priority": 90,
  "stop": true
}
```

## Evaluation Order
1. Load rule sets (category then product) from `rules-engine/config/rules.category.json` & `rules-engine/config/rules.product.json` (optional).  
2. Normalize product context: name (lowercase), manufacturer (lowercase), existing tags.
3. Apply all matching category rules sorted by `priority` ascending (stable).  
4. Apply product rules; for each match apply modifications; if `stop` encountered break loop.

## Matching Semantics
- `includes`: ANY substring (case-insensitive) must appear in `product.name`.
- `regex`: ANY regex test passes (case-insensitive). Precompile for speed.
- `manufacturer`: Product manufacturer must be in array (after lowercase trim).
- Future: `allIncludes`, `excludes`, `minTokens`.

## Output Merge Logic
The resolver returns:
```ts
interface RuleResolutionResult {
  tags: string[];            // final deduped tag list
  bundles: string[];         // final deduped bundle candidate list
  appliedRules: string[];    // ordered rule ids applied
  qualityBonus: number;      // accumulated quality score bonus
}
```

## Embedding Into Enrichment
`rulesEngine.resolve(product)` → result.  
Pipeline merges:
```
sections.identity.rule_tags = result.tags
sections.identity.bundle_candidates = result.bundles
quality_score += result.qualityBonus
```

## Minimal JSON Config Examples
`rules-engine/config/rules.category.json`:
```json
[
  {"id":"net.switch.base","match":{"includes":["switch"]},"tagsAdd":["network","switch"],"bundlesAdd":["rack_mount_kit"],"priority":10},
  {"id":"sec.firewall.base","match":{"includes":["firewall"]},"tagsAdd":["security","firewall"],"bundlesAdd":["support_subscription"],"priority":20}
]
```

`rules-engine/config/rules.product.json`:
```json
[
  {"id":"sec.firewall.poe","match":{"includes":["firewall"],"regex":["poe"],"manufacturer":["fortinet","cisco"]},"tagsAdd":["poe"],"bundlesAdd":["support_subscription"],"qualityScoreBonus":5,"priority":90,"stop":true}
]
```

## Future Enhancements
- DB-backed rule versioning & activation windows.
- Rule testing harness (dry-run expected tags vs actual).
- Conditional embeddings (e.g., trigger specialized embedding generation per tag group).
- Multi-language rule tokens (Arabic synonyms integration).

---
Document version: 2025-10-08
