# Arabic Synonyms Module Specification

Status: Draft (Oct 2025)
Owner: Rules Engine / Enrichment

## 1. Purpose
Enhance multilingual (Arabic/English) product discoverability by generating, normalizing and persisting bilingual synonyms used for:
- Algolia search expansion (search_synonyms)
- Chat intent expansion (Rules Engine NLP)
- Rule Tags / Bundling inference (future weighting)

## 2. Scope (Phase 1)
- Detect Arabic script tokens in (name, description, manufacturer, category)
- Normalize Arabic text (remove diacritics, unify variants, convert Arabic-Indic digits → Latin)
- Lightweight transliteration (approximate phonetics for search fallback)
- Generate base synonyms set: [English term, Arabic original, transliteration, enriched composite forms]
- Cache results by hash (productHash + version) to reduce AI cost
- Store combined list into enrichment output `sections.identity.synonyms` + flattened `search_synonyms` for Algolia
- Optional: route through OpenAI for translation if API keys configured (skip gracefully offline)

## 3. Data Flow
```
Raw Product → Enrichment Stage1 (identity/specs) → Synonym Generator → sections.identity.synonyms [] → quality_score includes synonyms weight → storageAdapter.saveItem → Algolia Sync maps to search_synonyms
```

## 4. Functions
| Function | Responsibility | Notes |
|----------|---------------|-------|
| detectArabic(text) | Returns true if any Arabic range chars present | /[\u0600-\u06FF]/ |
| normalizeArabic(text) | Remove tashkeel, unify letters (أإآ→ا, ة→ه optional), digits | Regex replacements |
| arabicIndicToLatin(str) | ٠١٢٣٤٥٦٧٨٩ → 0123456789 | Map table |
| transliterateArabic(text) | Basic consonant mapping (ف=f, ر=r, ت=t, ن=n, ي=y, ج=j/gh heuristic...) | Non-perfect; acceptable for search broadening |
| generateArabicSynonyms(product, opts) | Orchestrates: collect candidates, dedupe, optional AI translation, scoring | Returns { synonyms:[], meta:{} } |
| mergeSynonyms(existing, newOnes) | Set union preserve order | | 

## 5. AI Integration (Optional)
Prompt skeleton (English instructions):
```
System: You generate concise product synonym arrays (max 12 items) for bilingual Arabic/English search. No commentary.
User: Product name: <NAME>\nDescription: <DESC>\nManufacturer: <MANU>\nArabic tokens: <ARABIC_TOKENS>\nReturn JSON: {"synonyms":["..."]}
```
Fallback (no AI):
- Use tokens (manufacturer, base words of name) + transliteration forms + Arabic originals.

## 6. Output Placement
Enriched JSON root:
```
{
  "sections": {
    "identity": {
      ...,
      "synonyms": ["Fortinet", "فورتينت", "FortiGate", "فورتي جيت", "Firewall", "فايروول"]
    }
  }
}
```
Algolia record mapping:
- `search_synonyms` = identity.synonyms (dedup) + any existing synonyms from legacy fields.
- Weighted in index settings (manually configure searchable attributes ordering / optional synonyms feature in Algolia dashboard).

## 7. Quality & Weighting
- quality_score adds +8 if >=4 bilingual pairs (>=8 items)
- Additional +4 if at least one transliteration variant exists

## 8. Caching Strategy
Key: `syn:hash:version` in in-memory Map (future: file / Redis) storing synonyms array + timestamp.
Eviction: simple size cap (e.g., 500 entries) LRU-like by insertion order.

## 9. Edge Cases
Case | Handling
-----|---------
No Arabic tokens | Return empty array (do not penalize quality_score heavily)
Arabic only name | Provide transliteration + raw forms
Mixed digits (e.g., ٨٠F) | Convert digits → 80F, add both forms
AI error | Log warning, fallback deterministic list
Oversized synonyms (>20) | Truncate to 20

## 10. Minimal Implementation Steps
1. Create `rules-engine/src/utils/arabicSynonyms.js`
2. Implement normalization + transliteration + generateArabicSynonyms
3. Hook into enrichment pipeline after stage1 (before marketing) OR inside stage1_extract final lines
4. Merge into `identity.synonyms` (new array)
5. Adjust computeQualityScore to weight synonyms
6. Update Algolia sync script (SQLite version) to map synonyms → search_synonyms
7. Doc update (ENRICHMENT.md) quick note

## 11. Future (Phase 2)
- Adaptive learning: store accepted search terms from logs → feed back
- Frequency weighting per synonym (expose `synonym_weights`)
- Language detection beyond Arabic (French, Turkish)
- External transliteration lib evaluation

## 12. Acceptance Criteria
- Running enrichment on seed (20 items) produces synonyms for any Arabic-containing sample (if none, simulate by injecting one test item)
- Synonyms appear in print script output
- Algolia record (dry run) contains `search_synonyms` array <= 20 items

---
*End of spec*
