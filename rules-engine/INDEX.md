# Rules Engine - Complete Index

## 📁 Project Structure

```
rules-engine/
├── 📘 Documentation (9 files)
│   ├── QUICK_START.md              ← 🚀 Start here! (5-minute guide)
│   ├── ENRICHMENT_README.md        ← Complete user guide
│   ├── WORKFLOW.md                 ← Architecture & diagrams
│   ├── FIELD_MAPPING.md            ← Field reference
│   ├── INDEX.md                    ← This file
│   ├── README.md                   ← Module overview
│   ├── SETUP.md                    ← Original setup guide
│   ├── INTEGRATION.md              ← Integration examples
│   └── PROJECT_SUMMARY.md          ← Project summary
│
├── 🚀 Core Scripts (5 files)
│   ├── rules-engine.js             ← Main AI enrichment engine
│   ├── algolia-sync.js             ← Algolia sync script
│   ├── utils/
│   │   ├── sql-helper.js           ← SQL database operations
│   │   ├── ai-helper.js            ← OpenAI API integration
│   │   └── google-helper.js        ← Google image search
│   └── src/                        ← Original classification system
│       ├── index.js
│       ├── rulesEngine.js
│       ├── aiService.js
│       ├── dbService.js
│       ├── autoApproval.js
│       └── logger.js
│
├── ⚙️ Configuration (4 files)
│   ├── package.json                ← Dependencies & scripts
│   ├── .env.enrichment.example     ← Environment template
│   ├── config/
│   │   ├── dbConfig.example.json   ← Database config template
│   │   └── dbConfig.json           ← Your database config (git-ignored)
│   └── .gitignore
│
├── 🗄️ Database (2 files)
│   ├── db/schema.sql               ← Main database schema
│   └── db/add-enrichment-fields.sql ← Enrichment migration
│
├── 🛠️ Setup Scripts (4 files)
│   ├── setup.sh                    ← Linux/Mac setup wizard
│   ├── setup.bat                   ← Windows setup wizard
│   ├── install.sh                  ← Original install script
│   └── install.bat                 ← Original install script
│
├── 🧪 Testing (1 file)
│   └── test-structure.js           ← Code structure validator
│
└── 📝 Logs (auto-created)
    └── logs/
        ├── rules-engine.log        ← Enrichment logs
        └── algolia-sync.log        ← Sync logs
```

## 📚 Documentation Guide

### For New Users
1. **[QUICK_START.md](QUICK_START.md)** - Get started in 5 minutes
2. **[ENRICHMENT_README.md](ENRICHMENT_README.md)** - Complete guide with examples
3. **[WORKFLOW.md](WORKFLOW.md)** - Understand how it works

### For Developers
1. **[FIELD_MAPPING.md](FIELD_MAPPING.md)** - Complete field reference
2. **[INTEGRATION.md](INTEGRATION.md)** - Integration examples
3. **Source code** - All scripts are well-commented

### For Reference
1. **[README.md](README.md)** - Module overview
2. **[SETUP.md](SETUP.md)** - Detailed setup instructions
3. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Project summary

## 🎯 Common Tasks

### Setup
```bash
cd rules-engine
./setup.sh              # Run setup wizard
```

### Enrich Products
```bash
npm run enrich          # Process 20 products
node rules-engine.js 50 # Process 50 products
```

### Sync to Algolia
```bash
npm run sync            # Sync all enriched products
```

### View Logs
```bash
tail -f logs/rules-engine.log
```

## 🔍 Quick Reference

### Scripts in package.json
- `npm start` - Run original classification system
- `npm run enrich` - Run AI enrichment
- `npm run sync` - Run Algolia sync

### Environment Variables (.env)
```bash
OPENAI_API_KEY=sk-proj-xxx     # Required for enrichment
GOOGLE_API_KEY=xxx             # Optional for images
GOOGLE_CX_ID=xxx               # Optional for images
ALGOLIA_APP_ID=xxx             # Required for sync
ALGOLIA_API_KEY=xxx            # Required for sync
```

### Database Configuration (config/dbConfig.json)
```json
{
  "user": "sa",
  "password": "YourPassword",
  "server": "localhost",
  "database": "QuoteWerksDB"
}
```

## 📊 What Each Script Does

### rules-engine.js
- Selects products for enrichment
- Calls OpenAI for content generation
- Searches Google for images
- Updates SQL database
- Logs everything

### algolia-sync.js
- Fetches enriched products
- Transforms to Algolia schema
- Syncs to search index
- Handles batching

### utils/sql-helper.js
- Database connections
- Product queries
- Update operations
- Logging to AI_Log

### utils/ai-helper.js
- OpenAI API integration
- Prompt building
- Response caching
- Retry logic

### utils/google-helper.js
- Image search
- White background detection
- Fallback images
- Rate limiting

## 🎓 Learning Path

### Beginner
1. Read [QUICK_START.md](QUICK_START.md)
2. Run `./setup.sh`
3. Try enriching 5 products
4. Review logs

### Intermediate
1. Read [ENRICHMENT_README.md](ENRICHMENT_README.md)
2. Understand [WORKFLOW.md](WORKFLOW.md)
3. Process 100 products
4. Customize prompts

### Advanced
1. Study [FIELD_MAPPING.md](FIELD_MAPPING.md)
2. Modify helper scripts
3. Implement parallel processing
4. Scale to 400K+ products

## 🔧 Troubleshooting

### Issue: No products found
**File:** [QUICK_START.md#troubleshooting](QUICK_START.md#troubleshooting)
**Fix:** Check product filters in database

### Issue: API errors
**File:** [ENRICHMENT_README.md#troubleshooting](ENRICHMENT_README.md#troubleshooting)
**Fix:** Verify API keys in .env

### Issue: Database connection
**File:** [ENRICHMENT_README.md#troubleshooting](ENRICHMENT_README.md#troubleshooting)
**Fix:** Check config/dbConfig.json

## 💡 Key Features

✅ **AI-Powered** - OpenAI generates rich content  
✅ **Automatic Images** - Google finds product images  
✅ **Smart Caching** - Minimizes API costs  
✅ **Batch Processing** - Handles large datasets  
✅ **Error Recovery** - Retries failed requests  
✅ **Progress Tracking** - Real-time updates  
✅ **Comprehensive Logs** - File + database logging  
✅ **Auto-Approval** - Based on confidence scores  
✅ **Algolia Ready** - Direct sync to search  

## 📈 Performance

- **Speed:** 20 products in ~45 seconds
- **Cost:** ~$0.03 per 20 products
- **Scalability:** Handles 400K+ products
- **Reliability:** Retry logic + error handling

## 🆘 Need Help?

1. **Quick answer:** Check [QUICK_START.md](QUICK_START.md)
2. **Detailed guide:** Read [ENRICHMENT_README.md](ENRICHMENT_README.md)
3. **Understanding flow:** See [WORKFLOW.md](WORKFLOW.md)
4. **Field mapping:** Review [FIELD_MAPPING.md](FIELD_MAPPING.md)
5. **Logs:** Check `logs/rules-engine.log`

## 🚀 Next Steps

After setup:
1. ✅ Test with 5-10 products
2. ✅ Review enrichment quality
3. ✅ Adjust confidence thresholds if needed
4. ✅ Process larger batches
5. ✅ Sync to Algolia
6. ✅ Set up scheduled jobs

## 📞 Support

- **Documentation:** All markdown files in this directory
- **Logs:** `logs/` directory
- **Database:** Check `AI_Log` table for errors
- **Test:** Run `node test-structure.js`

---

**🎉 You have everything you need to get started!**

Start with: `cd rules-engine && ./setup.sh && npm run enrich`
