# 📘 Rules Engine & Algolia Sync — Developer Manual
### QuickITQuote AI Automation Framework

This document explains how to install, configure, and run  
the **AI-based Rules Engine** that enriches product data  
from **QuoteWerks SQL**, syncs it to **Algolia**,  
and supports fully automated AI-driven content generation.

---

## 🧱 1️⃣ Folder Structure

```
qiq-chat/
└── rules-engine/
    ├── README.md
    ├── .env.example
    ├── mapping-reference.md
    ├── copilot-instructions.md
    ├── inline-prompts.md
    ├── inline-prompts-algolia.md
    ├── rules-engine.js
    ├── algolia-sync.js
    ├── schema.sql
    ├── logs/
    │   ├── rules-engine.log
    │   └── sync.log
    └── utils/
        ├── ai-helper.js
        ├── google-helper.js
        └── sql-helper.js
```

---

## ⚙️ 2️⃣ Environment Setup

1. Copy `.env.example` → rename to `.env`  
2. Fill with your credentials:
   ```env
   OPENAI_API_KEY=sk-...
   GOOGLE_API_KEY=AIza...
   GOOGLE_CX_ID=c49466d...
   SQL_HOST=localhost
   SQL_USER=your_user
   SQL_PASS=your_password
   SQL_DB=QuoteWerks
   ALGOLIA_APP_ID=your_algolia_app_id
   ALGOLIA_API_KEY=your_algolia_api_key
   ALGOLIA_INDEX_NAME=woocommerce_products
   ```

3. Run schema.sql on your QuoteWerks database to add AI fields.

---

## 🧠 3️⃣ Copilot Context Setup

Open the `/rules-engine/` folder in VS Code and verify:

- `copilot-instructions.md` — contains the main prompt for generating the core code.
- `inline-prompts.md` — contains inline prompts for each AI enrichment function.
- `inline-prompts-algolia.md` — contains inline prompts for the Algolia sync module.

You'll use these to generate the code incrementally with GitHub Copilot.

---

## 🚀 4️⃣ Generating the Rules Engine

### Step-by-Step (inside VS Code)

1. Open Copilot Chat sidebar.

2. Paste this command:
   ```
   Use copilot-instructions.md to generate rules-engine.js
   ```

3. Copilot will automatically:
   - Connect to SQL
   - Call OpenAI for text enrichment
   - Call Google API for image search
   - Update SQL fields
   - Write logs & progress
   - Add confidence, timestamp, and flags

4. Once done, open `rules-engine.js` and test manually.

---

## 🧩 5️⃣ Generating Each Function Manually (Optional)

Use `inline-prompts.md` if you prefer building step-by-step:

- `enrichProductData()` → generates OpenAI results
- `fetchProductImage()` → fetches & filters images
- `updateSQLRecord()` → writes back to SQL
- `logProgress()` → handles logging
- `runRulesEngine()` → coordinates everything

Each section can be pasted directly in the file,
press Enter, and Copilot will expand it automatically.

---

## 🔄 6️⃣ Setting up Algolia Sync

1. Open `algolia-sync.js`.

2. Paste inline prompts from `inline-prompts-algolia.md`.

3. Generate:
   - Connection setup
   - SQL data fetch
   - Data transformation (HTML-rich, color #0055A4)
   - Sync upload using `saveObjects()`
   - Logging and summary functions

4. Add at the bottom:
   ```javascript
   runAlgoliaSync();
   ```

---

## 📊 7️⃣ Logs & Monitoring

- `logs/rules-engine.log` → product-level enrichment log
- `logs/sync.log` → Algolia synchronization log

Each log entry includes:
- Product ID
- Timestamp
- Confidence
- Result (success, skipped, error)

### Auto-Approval Threshold

- `AIConfidence ≥ 90` → mark as approved (`AIProcessed = TRUE`)
- `< 90` → flagged for manual review.

---

## 🧩 8️⃣ Integration with QuickITQuote Chat

After you test locally:

1. Add an API endpoint `/api/rules-engine/enrich`

2. When a product is requested in chat:
   - If `AIProcessed = TRUE` → fetch enriched version.
   - If not → queue enrichment automatically.

This turns your chat assistant into a self-learning sales AI.

---

## 💡 9️⃣ Optimization & Scaling Tips

| Feature | Description |
|---------|-------------|
| 🔁 Caching | Cache prompts & images to minimize API cost |
| ⚙️ Concurrency | Limit to 3 simultaneous API calls |
| 🧠 Confidence Logging | Store AIConfidence for tracking |
| 📅 Scheduling | Run Algolia Sync via cron or Vercel Job |
| 🧾 Cost Tracking | Add OpenAI token usage in logs |
| 🧰 Modularity | Utils folder ready for refactoring or reuse |

---

## 🧰 10️⃣ Optional Enhancements

1. **React Dashboard** for manual review & confidence visualization.
2. **Feedback Loop**: train prompts based on rejection patterns.
3. **Power Automate Desktop Integration**: auto-trigger enrichment when new SKUs are imported.

---

## ✅ 11️⃣ Quick Test Run (20 Products)

Once everything is ready:

```bash
node rules-engine.js
```

Expected output:
```
🚀 Starting Rules Engine...
Processing 20 items...
✅ 18 enriched | ⚠️ 1 skipped | ❌ 1 failed
✨ Completed in 2m 34s
```

Then run:
```bash
node algolia-sync.js
```

Expected output:
```
🔄 Fetching enriched products...
📦 Uploading 18 items to Algolia...
✨ Algolia Sync Complete
```

---

## 🧭 12️⃣ Maintenance Notes

- Keep all `.env` keys private.
- Backup your SQL regularly.
- Review low-confidence enrichments weekly.
- Update prompts in `copilot-instructions.md` if your data model changes.
- Re-run `schema.sql` only if adding new fields.

---

## 💬 Author Notes

**Developed and structured by Amr Gamal**  
as part of **QuickITQuote.com** —  
the first B2B IT Quotation AI platform in Egypt. 🇪🇬

**Purpose**: Automate product enrichment, ensure data quality,  
and enable AI-assisted quoting with real-time intelligence.

---

**Version**: 1.0.0  
**Date**: October 2025  
**Maintainer**: Amr Gamal  
**License**: Internal / Proprietary — QuickITQuote.com
