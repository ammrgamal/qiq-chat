# Platform Subscription & Advanced Access Plan

## Purpose
Define forward-looking subscription model for two primary paid user groups:
1. System Integrators (SI)
2. Suppliers / Distributors

This document guides future implementation (pricing engine, entitlement checks, onboarding flows) and is non-binding until monetization activation milestone.

## Personas
Persona | Goals | Pain Points | Desired Outcomes
--------|------|-------------|-----------------
System Integrator (Mid-size) | Rapid multi-vendor quotation, accuracy, follow-up automation | Manual spec collation, slow supplier responses | Faster turnaround, higher win rate
Supplier (Regional Distributor) | Visibility, lead qualification, pricing intelligence | Low differentiation, delayed lead signals | Qualified leads, demand analytics
Enterprise SI (Large) | Workflow integration & compliance | Fragmented tools, governance | Unified pipeline + auditability

## Subscription Pillars
Pillar | SI Value | Supplier Value | Platform Effect
------|----------|---------------|-----------------
Speed | OCR + AI enrichment auto-drafts quotes | Faster quote routing API | Higher transaction velocity
Insight | Historical quote analytics | Market demand heatmap | Data moat
Automation | Follow-up / WhatsApp sequences | Automatic lead scoring | Higher conversion
Trust | Compliance tagging + risk scoring | Verified supplier badges | Reduced friction
Differentiation | Private bundles & templates | Sponsored category placement | Monetization lever

## Feature Matrix (Phased)
Feature | Free | SI Starter | SI Pro | Supplier Core | Supplier Pro | Enterprise Add-on
--------|------|-----------|-------|--------------|-------------|------------------
Basic Search & Quote | ✓ | ✓ | ✓ | ✓ | ✓ | ✓
AI Classification (Fallback) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓
Advanced Enrichment (Marketing + Risk) | – | ✓ (rate limited) | ✓ | ✓ | ✓ | ✓
OCR BOQ Extraction | – | 50 pages/mo | 300 pages/mo | 100 pages/mo | 500 pages/mo | Custom
WhatsApp Bot Conversations | – | 200 / mo | 1000 / mo | 100 / mo | 300 / mo | Custom
Custom Supplier Routing Rules | – | – | ✓ | ✓ | ✓ (priority) | ✓ (advanced)
Follow-up Automation | – | Basic sequences | Advanced branching | Basic | Advanced | Advanced + audit
Analytics Dashboard | – | Summary | Deep drill-down | SKU demand | Competitive lens | Full multi-org
Sponsorship / Category Boost | – | – | – | Add-on | Included | Strategic slot
Data Export API | – | – | ✓ | – | ✓ | ✓
QuoteWerks Direct Bridge | – | Add-on | Included | Add-on | Included | Included

## Rollout Timeline (Indicative)
Phase | Focus | Unlock Criteria | Key Metric Gate
------|-------|-----------------|----------------
MVP (Current) | Core classification + basic search | Stable offline + enrichment v1 | <2.5s AI latency
Phase 1 | SI Starter + Supplier Core tiers | 30 active suppliers | 30 paying suppliers
Phase 2 | OCR + WhatsApp + Pro tiers | OCR accuracy ≥85% sample | 15% quotes from OCR
Phase 3 | Analytics + Sponsorship | ≥3k monthly quotes | 2 pilot sponsors
Phase 4 | Enterprise controls + Exports | Audit log design passed | 2 enterprise design partners

## Scenario (Illustrative Journey)
1. A mid-size SI signs up (Free) → builds 5 manual quotes → friction from retyping specs.
2. Upgrades to SI Starter to unlock auto enrichment + limited OCR → reduces quote assembly time 40%.
3. Hits OCR quota ceiling → nudged upgrade to SI Pro (unlock higher OCR + advanced follow-up) → increases repeat conversions.
4. Suppliers responding to those quotes join Supplier Core to view structured demand & appear in smart routing.
5. Top performing supplier upgrades to Supplier Pro for category boost & market demand comparative heatmap.
6. Platform aggregates anonymized enrichment metadata to power paid insight add-ons (later sponsorship deals anchor vertical credibility).

## Entitlement Enforcement (Future Design)
Layer | Mechanism | Notes
------|-----------|------
API Middleware | Token claims: tier, quotas | Rate limiter per entitlement bucket
Feature Flags | Config store keyed by tenant | Fast toggles for alpha/beta
Usage Ledger | Append-only events (ocr_page, whatsapp_session) | Feeds quota evaluator
Quota Evaluator | Rolling window counters | Auto-upgrade suggestion triggers
UI Gating | Soft (upsell panel) + hard (limit reached modal) | Preserve read-only access

## Quotas (Preliminary)
Metric | Window | Starter | Pro | Enterprise
-------|--------|--------|-----|-----------
OCR Pages | 30d | 50 | 300 | Custom
WhatsApp Conversations | 30d | 200 | 1000 | Custom
Enrichment AI Calls | 24h | 200 | 1200 | Custom
Export Rows | 30d | – | 20k | Custom
Follow-Up Flows | Active | 2 | 8 | Custom

## Pricing Strategy Notes
- Land & expand: low entry for Starter tiers → expand via usage signals.
- Avoid over-bundling early; keep AI/OCR usage explicit for cost clarity.
- Sponsorship only after data density & stable classification confidence (median ≥80%).

## Risk Mitigations
Risk | Mitigation
-----|----------
Over-complex tiering early | Limit v1 to Starter/Core + Pro; defer Enterprise
AI cost spike (misuse) | Strict daily caps + anomaly alerting
Churn from unused features | Trigger win-back emails based on cold usage
Supplier distrust of data usage | Publish anonymization & opt-out policy
Quota gaming | Signed usage ledger + tamper checks

## Implementation Checklist (High-Level)
Track | Tasks
------|------
Data Model | Add tenant tier, quota counters, usage event schema
Auth | Extend session / token with tier + entitlements
Billing | Simple manual invoicing → usage-based automation later
Metrics | Daily materialized usage rollups
UI | Upsell surfaces + real-time quota chips
Automation | Upgrade suggestion engine (threshold watchers)

## Dependencies / Preconditions
- Accurate enrichment & stable classification latency
- Logging of usage events (structured)
- Circuit breaker reliability metrics
- Search analytics baseline to define upgrade triggers

## Exit Criteria Before Monetization Launch
Criterion | Target
---------|-------
Fallback coverage | 100% (no dead classification paths)
AI error rate | <3% user-visible failures
Enrichment consistency | No schema drift over 30d
Secret scanning CI | Passing consistently
Support playbooks | Onboarding + quota FAQ published

## References
- `docs/ROADMAP.md` – macro phase alignment
- `config/pricing-tiers.json` – base tier definitions
- `docs/ARCHITECTURE.md` – technical layout
- `docs/SECURITY.md` – controls & rotation

---
*Revise as metrics & market feedback evolve. This file does not represent final pricing commitment.*
