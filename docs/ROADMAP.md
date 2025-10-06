# QIQ Roadmap

Status Tags: DONE | ALPHA | PLANNED | BACKLOG | DEFERRED

## Phase 0 – Foundations (Q4 2025)
Item | Status | Notes
-----|--------|------
Repo + Basic Server | DONE | Express + dynamic API loader
Local Secrets (Dynamic) | DONE | Runtime import guarded
Offline Mode (--offline) | DONE | Fallback classification
AI Key Validation + CB | DONE | Threshold=3, cooldown=5m
Enrichment v1 (Stages 1–3) | ALPHA | Embeddings placeholder
Algolia Facets Expansion | DONE | ai_version, enrichment_version, risk, quality

## Phase 1 – Supplier & Search Quality
Item | Status | Notes
-----|--------|------
Supplier Onboarding Flow | PLANNED | Minimal CRUD + invite
Data Quality Scoring | PLANNED | coverage + weights
Risk Normalization v2 | PLANNED | Percentile based
Arabic Localization Stage | BACKLOG | value_statement_ar
Spec Normalization Dictionary | PLANNED | Vendor key mapping
Incremental Reprocessing | BACKLOG | Checksum-driven

## Phase 2 – AI Depth & Automation
Item | Status | Notes
-----|--------|------
OCR (Images → BOQ Lines) | PLANNED | GPT-4o Vision or Gemini Vision
WhatsApp Bot MVP | PLANNED | Meta Cloud API integration
QuoteWerks SDK Bridge | PLANNED | Local connector service
Auto Pricing Suggestions | BACKLOG | Supplier feed variance model
Embedding Integration | BACKLOG | External vector DB
Semantic Rerank (Hybrid) | BACKLOG | Combine lexical + vector

## Phase 3 – Monetization Layer
Item | Status | Notes
-----|--------|------
Supplier Subscription Tiers | PLANNED | Starter / Pro / Enterprise
Transaction Commission Engine | PLANNED | Fee capture + reporting
AI Module Licensing | PLANNED | OCR + enrichment API packaging
Sponsorship Placement | BACKLOG | Category banner injection
Market Intelligence Dashboards | BACKLOG | Aggregate pricing trends

## Phase 4 – Ecosystem & Insights
Item | Status | Notes
-----|--------|------
Integration Marketplace | BACKLOG | Zoho / Odoo / SAP B1 connectors
Data Export APIs | BACKLOG | Filtered/time-window endpoints
Anomaly Detection | BACKLOG | Outlier detection on price vs category
Lead Scoring Model | BACKLOG | Behavior + enrichment signals
Automated Retention Flows | BACKLOG | NPS + churn triggers

## Cross-Cutting Enhancements
Area | Planned Work
-----|-------------
Observability | Structured logs + metrics aggregator
Security | Secret scanning CI & key rotation helper
Performance | Streaming AI classification (batch mode)
Governance | Version registry for enrichment + schema
Testing | Synthetic product generator for stress tests

## Reprocessing Triggers (Operational)
Trigger | Action
-------|-------
Increase ai_version | Force reclass & reindex subset
Increase enrichment_version | Re-run enrichment pipeline
Config stage toggle change | Partial reprocess impacted fields
Risk rule modification | Recompute risk buckets

## KPIs by Phase (Snapshot)
Phase | KPI Focus | Target Gate
------|-----------|------------
0 | Technical readiness | Offline path stable, <2.5s AI latency
1 | Supplier density | 30 paying suppliers
2 | Automation adoption | 15% quotes from OCR/WhatsApp
3 | Monetization scale | 25% revenue from non-subscription streams
4 | Ecosystem breadth | ≥5 third-party integrations

---
*Maintain monthly; align with structure.md strategic metrics.*
