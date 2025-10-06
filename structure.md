# 📁 QIQ Chat – Project Knowledge Base

> Technical implementation details now live in `docs/ARCHITECTURE.md` (see also: `docs/ENRICHMENT.md`, `docs/ROADMAP.md`, `docs/SECURITY.md`). This document focuses on vision, strategy, monetization, and high-level roadmap.

---

## 💡 Ideas Hub

### 🧠 Marketing Automation
- Email & WhatsApp campaign automation.
- Power Automate workflows for lead nurturing.
- Retargeting ads linked to Quote requests.

---

### 💬 WhatsApp Bot
**Goal:** Build an AI WhatsApp assistant that receives customer requests, analyses text/images, and generates QuickITQuote quotations automatically.  
**Next Steps:**
- Connect to Meta Cloud API.
- Use GPT-4o Vision for OCR.
- Send structured JSON to QuickITQuote API.
- Generate PDF via QuoteWerks SDK.

---

### 🔗 QuoteWerks API Integrations
**Concept:**  
Automate creation of quotes inside QuoteWerks from QuickITQuote or WhatsApp requests.  
**Ideas:**
- REST endpoint triggers local SDK.
- Export to PDF and push back to customer.
- CRM sync (HelloLeads / Zoho).

---

### 🤖 AI Features Roadmap
| Phase | Feature | Description |
|-------|----------|-------------|
| 1 | AI Quote Builder | Generate quote text automatically |
| 2 | OCR Item Extractor | Read BOQs from images |
| 3 | Follow-Up Bot | WhatsApp reminders after 48 h |
| 4 | Supplier Auto-Pricing | Route custom quotes to vendors |

---

## 🧭 Strategy

### 🧩 Business Model Canvas
**Value Proposition:**  
AI-driven quotation platform connecting customers, suppliers, and sales teams.  
**Customer Segments:**  
System integrators, distributors, enterprises, vendors.  
**Revenue Streams:**  
Supplier subscriptions, commissions, sponsorships, AI tools, data reports.

---

### 💰 Revenue Streams (Expanded)

| Stream | Description | Pricing Model | Rollout Phase | Core Metrics |
|--------|-------------|---------------|---------------|--------------|
| Supplier Subscriptions | Access to priority listing, enriched catalog insights, faster quote routing | Tiered: Starter 500 EGP / Pro 1,200 EGP / Enterprise 2,000 EGP monthly | Phase 1 | MRR, churn %, active suppliers |
| Transaction Commission | Fee on successful converted deals (closed quotes) | 1–1.5% (intro), up to 2% later | Phase 2 | Gross GMV, net revenue, win rate |
| Vendor Sponsorship | Brand placement, promoted categories, data spotlight | 50k–200k EGP / year packages | Phase 3 | Sponsor retention, CTR, category lift |
| AI Module Licensing | Advanced OCR, enrichment scoring, auto-pricing intelligence | Per-seat (E.g. 300–600 EGP) or usage tier | Phase 2–3 | API calls, seat adoption |
| Data / Market Intelligence Dashboards | Aggregated anonymized pricing & velocity trends | Subscription (Quarterly / Annual) | Phase 3 | Dashboard logins, report downloads |
| WhatsApp Bot Premium | Automated conversational quote builder | Volume tiers (Conversations / Month) | Phase 2 | Bot sessions, completion rate |
| QuoteWerks Automation Add-on | Direct quote creation & PDF pushback | Fixed monthly + setup fee | Phase 3 | Activated connectors |
| Integration Marketplace (Future) | Connectors (Zoho, Odoo, SAP B1) | Rev-share per integration | Phase 4 | Installs per integration |

#### Pricing Principles
1. Land & expand: start with low-friction supplier tier (Starter) to seed network density.
2. Usage → value mapping: AI & WhatsApp priced by actual leverage (calls / conversations).
3. Sponsorship staged after reaching minimum viable data volume (≥ 50 active suppliers, ≥ 3k monthly quotes).
4. Data products only after reliable enrichment quality (≥ 85% classification confidence median) + compliance review.

#### Rollout Timeline (Indicative)
| Quarter | Focus | KPI Gate |
|---------|-------|----------|
| Q1 | Supplier subscription onboarding | 30 paying suppliers |
| Q2 | Commission + AI OCR module | 15% quotes w/ OCR ingestion |
| Q3 | WhatsApp Bot premium + sponsorship pilots | 2 sponsors signed |
| Q4 | Data dashboards + QuoteWerks automation | 1k dashboard MAU |

#### Core KPI Dashboard (Monetization)
Group | Metrics
------|--------
Acquisition | New suppliers / month, CAC proxy
Activation | % suppliers uploading price lists
Retention | Supplier churn %, bot returning users
Monetization | ARPU, MRR growth, GMV
Product Usage | OCR jobs/day, AI enrichment latency, quote creation velocity
Quality | Classification confidence median, enrichment coverage %, WhatsApp bot completion rate

#### Expansion Levers
- Cross-sell: AI module → Data dashboards.
- Up-sell: Starter → Pro triggered by usage thresholds (quotes/month or API calls).
- Network effect: More suppliers → better pricing intelligence → stronger sponsorship pitch.

#### Risk Mitigations
Risk | Mitigation
-----|-----------
Low supplier adoption | Lower entry tier + assisted onboarding
AI accuracy concerns | Hybrid human validation queue for outliers
WhatsApp compliance changes | Abstract provider layer; fallback to web capture
Data privacy concerns | Anonymization + opt-out controls
QuoteWerks API fragility | Local connector watchdog + retry strategy

---

### 🤝 Supplier Network Plan
- Onboard 100 suppliers across brands (GBG / Raya / Redington / Ingram).  
- Categorize by product line.  
- Automate quote routing to best supplier per product.  

---

## 🧰 Technical Blueprints

### 🧱 Architecture Diagrams

Customer → WhatsApp / Web → QuickITQuote API → QuoteWerks SDK → CRM / PDF

Components:
- WhatsApp Cloud API
- Node.js Backend
- OpenAI GPT-4o Vision
- QuoteWerks COM SDK
- HelloLeads CRM

---

### 🌐 API Workflows
**Endpoints:**
1. `/webhook/whatsapp` – receive message/image.  
2. `/ai/ocr` – extract text from image.  
3. `/quote/create` – send data to QuoteWerks.  
4. `/crm/sync` – push lead info to HelloLeads.  

---

### ⚙️ Power Automate Flows
- Excel batch export (1500 rows per file).  
- Automatic quote follow-up reminder (48 h).  
- Supplier quote import to QuickITQuote DB.  

---

## 📊 KPI Tracker

| Metric | Target | Tool |
|---------|--------|------|
| Leads generated | 500 / month | HelloLeads |
| Quotes created | 300 / month | QuoteWerks |
| Supplier response rate | 80 % | Internal |
| Quote → Deal conversion | ≥ 25 % | Dashboard |

---

## 🗓️ Weekly Progress Journal

### 📅 Week 1 (Oct 5 – 12 2025)
**Done:**  
- Built project structure on GitHub.  
- Planned WhatsApp Bot MVP.  
- Created documentation folders.  

**Next Week:**  
- Build webhook in Node.js.  
- Integrate with QuickITQuote API.  
- Test QuoteWerks SDK connection.

---

*End of Structure – see also: `docs/ARCHITECTURE.md` for implementation details.*
