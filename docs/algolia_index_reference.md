# Algolia Index Reference — QuickITQuote

**Index name:** `woocommerce_products`

## Canonical Schema
| Field                | Type      | Notes |
|----------------------|-----------|-------|
| objectID             | string    | Stable unique id (MPN \|\| InternalPartNumber \|\| ID) |
| sku                  | string    | Same as objectID logic; shown first |
| mpn                  | string    | ManufacturerPartNumber |
| name                 | string    | Product name (short/clean) |
| brand                | string    | Manufacturer |
| category             | string    |  |
| unit                 | string    | UnitOfMeasure |
| availability         | enum      | "Stock" \| "on back order" (from Availability=1/0) |
| availability_weight  | number    |  |
| price                | number    |  |
| list_price           | number    |  |
| cost                 | number    |  |
| image                | string    | URL, normalized path |
| spec_sheet           | string    | URL, normalized path `/specs/...` |
| link                 | string    | URL |
| ShortDescription     | string    |  |
| ExtendedDescription  | string    | Truncated ≤4k chars |
| custom_memo          | string[]  | From CustomMemo01..05, split/dedup |
| custom_text          | string[]  | From CustomText01..20, split/dedup |
| tags                 | string[]  | From KeywordList |
| Discontinued         | boolean   |  |
| LastModified         | ISO string|  |

## Search Settings
- `searchableAttributes`: ["sku","mpn","name","brand","category","custom_memo","custom_text","tags"]
- `attributesForFaceting`: ["brand","category","unit","availability","discontinued","tags"]
- `customRanking`: ["desc(availability_weight)","asc(price)","asc(name)"]
- `attributesToSnippet`: ["ExtendedDescription:40","ShortDescription:20"]
- `attributesToHighlight`: ["sku","mpn","name","custom_memo","custom_text","tags"]
- `attributesToRetrieve`: ["objectID","sku","mpn","name","brand","category","unit","availability","availability_weight","price","list_price","cost","image","spec_sheet","link","tags","ShortDescription","ExtendedDescription","custom_memo","custom_text"]
- General: removeWordsIfNoResults="allOptional", ignorePlurals=true, typoTolerance="min", decompoundQuery=true.

## Record Size & URL Normalization
- Max record size ≤10KB (truncate long ExtendedDescription, ShortDescription, memo/text arrays).
- `normalizeFileUrl`: replace "\" with "/" only (do NOT encode spaces).

## Availability Mapping
- 1 → "Stock"
- 0 → "on back order"

## Notes
- All code should use canonical field names and helpers from `src/search/indexSchema.ts`.
- Apply size guard and normalization before sync.

## Enriched / Synonym-Enabled Index (Proposed)
When using enriched pipeline output + Arabic synonym expansion:

Recommended settings (delta over base):
```
searchableAttributes: [
	"sku","mpn","name","brand","category",
	"custom_memo","custom_text","tags",
	"search_synonyms",              // from enrichment identity.synonyms merged
	"sections.identity.synonyms"    // if stored nested
]
attributesForFaceting: ["brand","category","availability","quality_bucket"]
customRanking: ["desc(availability_weight)","desc(quality_score)","asc(price)"]
optionalWords: (dynamic per Arabic query via API) // not static setting
removeWordsIfNoResults: "allOptional"
ignorePlurals: true
typoTolerance: "min"
decompoundQuery: true
distinct: false
```

Add numeric attribute:
```
quality_score (int)
```
and textual `quality_bucket` one of: low | medium | high.

Replica indices suggestions:
- `{indexName}_price_asc`  (ranking price ascending)
- `{indexName}_price_desc` (ranking price descending)
- `{indexName}_fresh` (customRanking adds `desc(LastModified)`)

Index update workflow:
1. Apply base settings.
2. Add new attributes (`search_synonyms`, `quality_score`, `quality_bucket`).
3. Reindex or partial update enriched records.
4. Validate search relevance with Arabic + English sample queries.

Security: DO NOT expose admin key to client; generate a search-only key with restrictIndices + validity TTL.
