# 🚀 QuickITQuote – Rules Engine Launch Checklist

This document serves as the official checklist for setting up, testing, and deploying the AI-powered Rules Engine & Product Enrichment system within QuickITQuote.

---

## 🧩 1. Project Setup

- [ ] Create a new branch in VS Code: `rules-engine-integration`
- [ ] Ensure `.env` file includes:
  ```bash
  OPENAI_API_KEY=sk-proj-xxxxxxxx...
  GOOGLE_API_KEY=AIzaSy...
  GOOGLE_CX_ID=c49466d953bc4438b
  ```
- [ ] Folder structure:
  ```
  /rules-engine/
    ├─ sql/
    ├─ api/
    ├─ utils/
    ├─ logs/
    ├─ sync/
    ├─ tests/
    └─ README.md
  ```

---

## 🗄️ 2. Database Preparation

- [ ] Ensure QuoteWerks SQL DB is accessible (read/write)
- [ ] Add extended fields (CustomText / CustomMemo / CustomNumber) as per mapping
- [ ] Verify ProcessedByAI, ProcessedDate, and AI_Score columns exist
- [ ] Backup SQL before first run

---

## 🧠 3. AI Enrichment Configuration

- [ ] Set sampling limit (LIMIT 20) for testing
- [ ] Apply Google API image-filter logic (white background ≥ 78%)
- [ ] Fallback rule → if image missing → use ManufacturerName.jpg
- [ ] AI-generated fields include:
  - Technical specs table
  - Key features summary
  - Product FAQs
  - Prerequisites
  - Professional Services scope
  - Value proposition & motivation text
  - Related products / bundle suggestions

---

## ⚙️ 4. Rules Engine Logic

- [ ] Create Category-level rules table
- [ ] Create Item-level rules table
- [ ] Enable self-learning with score threshold ≥ 90%
- [ ] Auto-log all AI updates in /rules-engine/logs/
- [ ] Dashboard for human approval of new rules

---

## 🔄 5. Algolia Sync

- [ ] Run enrichment first, then update SQL
- [ ] Trigger algoliaSync.js after QA
- [ ] Ensure Algolia mirrors SQL structure
- [ ] Use rich-text formatting for info fields
- [ ] Plain/facet text only for filters

---

## 📊 6. Testing & QA

- [ ] Test batch of 20 items from multiple vendors
- [ ] Review logs for progress & API usage count
- [ ] Validate caching and batch request optimization
- [ ] Review Algolia output for visual & filter accuracy

---

## 🧩 7. Deployment

- [ ] Merge rules-engine-integration → main
- [ ] Deploy API endpoints via Vercel
- [ ] Add .env keys securely in environment variables
- [ ] Schedule SQL auto-backup every 24 hours

---

## 📈 8. Continuous Improvement

- [ ] Monitor AI learning quality weekly
- [ ] Review accuracy and score reports
- [ ] Tune NLP prompts or retrain templates if needed
- [ ] Expand rule coverage to new product categories

---

## ✅ Notes

- This module works independently from the QuickITQuote frontend.
- Algolia acts as a mirror, not a data source.
- SQL DB is the single source of truth for all enrichment data.
- Logs and learning history are versioned for auditing and rollback.

---

**Author**: Amr Gamal  
**Project**: QuickITQuote – AI Rules Engine Integration  
**Version**: 1.0.0  
**Date**: 2024
