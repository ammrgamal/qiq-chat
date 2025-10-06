# Security & Operational Controls

## 1. Scope
This document outlines current security practices for QuickITQuote (QIQ) codebase: secret handling, key rotation, rate limiting, offline safety, incident response basics.

## 2. Secrets Management
Area | Practice
-----|---------
Local Dev | `local.secrets.json` (gitignored) dynamically imported (runtime only).
Disable Local | Set `DISABLE_LOCAL_SECRETS=1` to skip loading.
Environment Vars | Standard `.env` for non-sensitive toggles; production secrets injected by platform.
Never Exposed | Admin Algolia key not returned via `/api/algolia-config`.
Logging | Only counts / provider names, never raw values.

### 2.1 Key Validation
- OpenAI keys validated by regex (`sk-...`).
- Gemini keys must start with `AIza`.
- Invalid keys → provider ignored (reduces 401 flood).

### 2.2 Rotation Guidelines
Trigger | Action
--------|-------
Key leak suspected | Revoke & replace in provider dashboard immediately.
Repo pastes (accidental) | Purge commit (history rewrite) + rotate.
Provider auth failures spike | Inspect circuit breaker logs; verify key validity.

## 3. Circuit Breaker
Config | Current
------|--------
Threshold | 3 consecutive auth-related failures
Cooldown | 5 minutes per provider
Scope | OpenAI & Gemini classification + enrichment
Effect | Provider skipped until cooldown expiry; fallback continues service.

## 4. Offline Mode Safeguards
Flag | Behavior
-----|---------
`--offline` | Sets `OFFLINE_MODE=1`, `SKIP_DB=1`, disables Algolia sync; AI calls short‑circuit to fallback.
Use Cases | Air‑gapped dev, quota preservation, rapid tests.

## 5. Rate Limiting
Path Group | Control
----------|--------
`/api/users/*` | In-memory per-IP counter (default 60/min) unless AUTO_APPROVE.
Sensitive (`/api/admin`, `/api/pdf-ai`, `/api/boq/parse`) | express-rate-limit (configurable window + max).
Future | Move to Redis or in-memory LRU with sliding window.

## 6. Data Exposure Controls
Control | Rationale
--------|----------
Dynamic Secret Loader | Prevent bundling secrets in front-end artifacts.
No Admin Key in Client | `/api/algolia-config` only returns search-only key.
Partial Logging | Avoid leaking product data in error stack traces (TODO structured sanitizer).
Future Masking | Add middleware to redact patterns (sk-, re_, AIza) from error logs.

## 7. Incident Response (Lightweight)
Scenario | Immediate Steps | Follow-up
---------|-----------------|----------
Secret Pasted Publicly | Invalidate & rotate key | Add test for pattern scanning
Unexpected 401 Burst | Check circuit breaker state | Validate environment sources
Algolia Ranking Anomaly | Export sample records | Rebuild index with locked settings
Abuse (brute force) | Tighten rate limits & add IP denylist | Introduce CAPTCHA for auth endpoints

## 8. Planned Enhancements
Priority | Item | Description
P1 | Secret Scan Script | Local script + CI job scanning regex patterns.
P1 | Structured Logging | JSON logs with request ID & provider metadata.
P2 | Metrics Aggregation | Success %, latency histograms, breaker trips.
P2 | Key Rotation Helper | CLI to list & rotate tracked keys.
P3 | Anomaly Detection | Outlier detection around risk_score + price.

## 9. Patterns to Scan (Initial Regex)
Type | Regex
----|------
OpenAI | `sk-[A-Za-z0-9]{20,}`
Resend | `re_[A-Za-z0-9_\-]{15,}`
Gemini | `AIza[0-9A-Za-z_\-]{15,}`
Algolia Admin | `[0-9a-fA-F]{32}` (context aware)
Generic JWT | `eyJ[a-zA-Z0-9_-]{10,}\.`

## 10. Manual Secret Audit
Run:
```
node scripts/check-secrets.mjs
```
(Shows presence only, not values.)

## 11. Future Zero-Trust Direction (Concept)
- Per-request short-lived tokens from a broker service.
- Provider key indirection (service identity signs requests; raw key not in app memory).
- Central auditing of outbound AI calls (payload hashing + signature log).

## 12. Governance & Versioning
Artifact | Tracking
--------|---------
`ai_version` | AI prompt logic / heuristics revision.
`enrichment_version` | Enrichment pipeline structural change.
`pricing-tiers.json` | Pricing rev version key.

## 13. Action Checklist (Quarterly)
Task | Owner | Notes
-----|-------|------
Rotate high-value keys | Ops | OpenAI / Algolia / Resend
Review breaker metrics | Eng | Adjust threshold if false positives
Validate rate limits | Eng | Tune under load tests
Run secret scan | DevOps | CI gating by regex hits
Update enrichment doc | Data | Reflect new fields

---
*Maintain alongside ARCHITECTURE.md – update after any security-affecting change.*
