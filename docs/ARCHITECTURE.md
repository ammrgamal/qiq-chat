# QIQ Chat / QuickITQuote – Technical Architecture

## 1. High-Level Overview
User (Web / WhatsApp) → HTTP/WhatsApp Layer → API Endpoints (Node.js / Express) → Rules Engine (Classification + Enrichment + Sync) → External Providers (AI / Algolia / Email / CRM) → Persistence / Search → UI Facets / Quoting.

Key Themes:
- Offline-first resilience (fallback classification, --offline flag)
- Deterministic enrichment pipeline with versioning (`enrichment_version`, `ai_version`)
- Secure local secret loading (dynamic, runtime-only)
- Incremental search indexing (Algolia) + facet-driven UX.

## 2. Repository Layout
```
root
  server.js                 # Express entry: dynamic API loader + static assets
  api/                      # REST & feature endpoints
  rules-engine/             # AI + enrichment + sync orchestration
    src/
      aiService.js          # AI provider abstraction (OpenAI, Gemini, fallback)
      algoliaSync.js        # Transform & push documents to Algolia
      enrichmentPipeline.js # Multi-stage enrichment (extract/marketing/compliance)
      rulesEngine.js        # Orchestrates classification for each product
      index.js              # Entry + sample product generator
      logger.js             # Lightweight logger wrapper
    scripts/
      orchestrate.mjs       # CLI runner for classification + sync
  public/                   # Static web content & search UI
  scripts/
    smoke.ps1               # Basic sanity script
    check-secrets.mjs       # Non-intrusive secret presence audit
  docs/                     # Documentation (setup, architecture, etc.)
  structure.md              # Vision / business / roadmap hub
  local.secrets.example.json
```

## 3. Runtime Flow (Product Classification → Search)
1. Product Source: samples (`--samples`) or future DB/ingest.
2. Orchestrator (`orchestrate.mjs`) iterates products.
3. For each product:
   - `rulesEngine.processProduct()` → `aiService.classifyProduct()` with cache check.
   - If AI unavailable / offline or circuit-breaker active → fallback classification.
   - Enrichment pipeline attaches marketing / compliance / score fields.
4. Results collected (in-memory for current session).
5. Sync Phase (unless `--no-sync` or `--offline`): `algoliaSync.syncProducts()` transforms enriched objects to index schema & pushes.
6. Frontend search uses facets (`ai_version`, `enrichment_version`, `data_quality_bucket`, `risk_bucket`, `lifecycle_stage`).

## 4. Orchestrator CLI Flags
Flag | Description
-----|------------
--samples | Use generated products (default behaviour)
--count=N | Limit product count
--full | Force full sync context (e.g., re-index all in future)
--purge | Remove stale index entries
--manufacturers=CSV | Pre-filter products by manufacturer
--where=expr | Heuristic filter (manufacturer='X', price>100, price<500)
--skip-db | Bypass DB initialization
--no-sync | Skip Algolia sync phase
--offline | Implies skip-db + no-sync + OFFLINE_MODE + AI fallback

## 5. AI Layer
Component | Responsibility
----------|---------------
aiService.js | Routing between Gemini / OpenAI / fallback with caching.
Cache | File `.ai-cache.json` keyed by signature hash + version.
Offline Mode | `OFFLINE_MODE=1` enforced via `--offline` flag.
Validation | Regex patterns for key structure; invalid keys ignored.
Circuit Breaker | After 3 auth failures → provider disabled for 5m.
Fallback | Rule-based classification (category, subCategory, autoApprove logic).

### Prompt Strategy
- Concise structured request with explicit JSON schema & business rules.
- Response forced via `response_format` (OpenAI) or JSON MIME for Gemini.

## 6. Enrichment Pipeline (Planned/Partial)
Stage | Purpose | Example Output
------|---------|---------------
extract | Normalize input specs | Cleaned manufacturer, part number
marketing | Generate marketing copy | `marketing_blurb`, `keyFeatures`
compliance | Policy / risk scoring | `risk_bucket`, `data_quality_bucket`
embeddings (future) | Vectorization for semantic search | `embedding` field
arabic_localization (future) | Arabic marketing copy | `marketing_blurb_ar`

Versions tracked with `enrichment_version` and `ai_version` to allow reprocessing.

## 7. Search Index Schema (Algolia)
Key attributes already/expected:
- objectID (partNumber or synthetic)
- title / name
- manufacturer
- price / pricing tier
- ai_version, enrichment_version
- data_quality_bucket (A/B/C...)
- risk_bucket (low/med/high)
- lifecycle_stage (planned/EOL etc.)
- marketing_blurb / normalized_specs

Index Settings (conceptual): searchable attributes, facet attributes (above), ranking (custom weights + textual relevance + freshness if added later).

## 8. Secrets & Configuration
Pattern | Detail
--------|-------
local.secrets.json | Gitignored; dynamic runtime import; no bundling.
DISABLE_LOCAL_SECRETS | Set=1 to skip local secrets.
check-secrets.mjs | Presence only; no value printing.
/ api/algolia-config | Returns only search-only key; never admin key.
Circuit Breaker | Prevents runaway auth failures spam.

## 9. Security Controls
Area | Control
-----|--------
API Keys | Dynamic load, no exposure in client bundles.
Rate Limits | Basic limiter for sensitive endpoints & user auth routes.
Secrets Logging | Only counts/names, never values.
Algolia | Admin key withheld; search-only key exposed.
Offline Mode | Prevents accidental external calls in air‑gapped dev.

## 10. Performance / SLA (Internal Targets)
Metric | Target (Initial)
-------|----------------
Classification latency | < 2.5s (AI) / <50ms (fallback)
Sync batch push | < 1s / 100 docs (typical)
Cache hit ratio | > 40% on iterative runs
Cold start load | < 1.5s server ready

## 11. Observability (Planned)
Future Enhancements:
- Structured logs (JSON) for classification results.
- Metrics: provider success %, circuit-breaker trips.
- Reprocessing queue for failed products.

## 12. Roadmap Status Tags
Tag | Meaning
----|--------
DONE | Implemented & stable
ALPHA | Implemented, needs validation
PLANNED | Not yet started
BACKLOG | Idea only

## 13. Current Status Snapshot
Component | Status | Notes
----------|--------|------
Offline Mode | DONE | --offline + fallback enforced
Key Validation | DONE | Regex filters
Circuit Breaker | ALPHA | Basic threshold; no persistence
Enrichment v2 fields | PLANNED | Additional scoring & localization
Embeddings | BACKLOG | For semantic search & recall blending
Admin Analytics | PLANNED | Usage metrics & churn dashboard
WhatsApp Bot | PLANNED | Meta API integration upcoming
QuoteWerks SDK Bridge | PLANNED | Local connector service

## 14. Glossary
Term | Definition
-----|----------
ai_version | Logical version tag for AI classification logic.
enrichment_version | Version of enrichment pipeline stages output.
offline mode | Run without external AI/DB/Algolia calls.
circuit breaker | Temporary provider disable after repeated failures.
search-only key | Algolia key safe for client; limited ACL.

## 15. Appendix – Example Orchestrator Session
```
$ node rules-engine/scripts/orchestrate.mjs --samples --count=3 --offline
[BANNER] Orchestrator: classify -> sync
WARN  Running in OFFLINE mode: will skip DB, skip sync, force AI fallback.
INFO  Processing 3 products (full=false) manuFilters=[] where='none'
INFO  AI cache loaded: 0 entries
SUCCESS Done.
```

---
*Maintained alongside `structure.md` (vision). Related docs: `docs/ENRICHMENT.md`, `docs/ROADMAP.md`, `docs/SECURITY.md`, pricing config `config/pricing-tiers.json`. Quick summary script: `node scripts/print-architecture.mjs`.*
