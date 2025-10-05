# Quick Start Guide - AI Product Enrichment

## 🚀 Get Started in 5 Minutes

### 1. Setup (One-time)

```bash
cd rules-engine
./setup.sh          # Linux/Mac
# or
setup.bat           # Windows
```

### 2. Configure API Keys

Edit `../.env` (root directory):

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
ALGOLIA_APP_ID=xxxxxxxxxxxxxxxxxxxx
ALGOLIA_API_KEY=xxxxxxxxxxxxxxxxxxxx
```

### 3. Configure Database

Copy and edit `config/dbConfig.json`:

```bash
cp config/dbConfig.example.json config/dbConfig.json
# Edit with your SQL Server credentials
```

### 4. Run Database Migration

```sql
-- In SQL Server Management Studio
USE QuoteWerksDB;
GO
-- Run: db/add-enrichment-fields.sql
```

### 5. Enrich Products

```bash
npm run enrich      # Process 20 products
```

### 6. Sync to Algolia

```bash
npm run sync        # Sync enriched products
```

## 📊 What Happens

### AI Enrichment
- Selects 20 random products
- Generates descriptions, features, FAQ
- Finds product images
- Updates SQL database
- Logs results

### Algolia Sync
- Fetches enriched products
- Transforms to search format
- Syncs to Algolia index
- Ready for search

## 🎯 Common Tasks

### Process Specific Number of Products

```bash
node rules-engine.js 50    # Enrich 50 products
node rules-engine.js 100   # Enrich 100 products
```

### Process in Batches

```bash
# Process 1000 products in batches of 100
for i in {1..10}; do
  node rules-engine.js 100
  sleep 60  # Wait 1 minute between batches
done
```

### Check Progress

```sql
-- Total enriched products
SELECT COUNT(*) FROM Products WHERE AIProcessed = 1;

-- Average confidence
SELECT AVG(AIConfidence) FROM Products WHERE AIProcessed = 1;

-- Recent processing
SELECT TOP 10 * FROM AI_Log ORDER BY ProcessDate DESC;
```

### View Logs

```bash
# Real-time logs
tail -f logs/rules-engine.log

# Last 50 lines
tail -n 50 logs/rules-engine.log

# Search for errors
grep ERROR logs/rules-engine.log
```

## ❓ Troubleshooting

### "No products found for processing"

**Fix:** Products might already be enriched or filtered out.

```sql
-- Check available products
SELECT COUNT(*) FROM Products 
WHERE ISNULL(AIProcessed, 0) = 0
  AND ProductName NOT LIKE '%Test%'
  AND ISNULL(Cost, 0) > 0;
```

### "OpenAI API error: 401"

**Fix:** Check your API key in `../.env`

```bash
# Verify key exists
grep OPENAI_API_KEY ../.env
```

### "Database connection failed"

**Fix:** Check `config/dbConfig.json` credentials

```bash
# Test SQL Server connection
sqlcmd -S localhost -U sa -P YourPassword -Q "SELECT 1"
```

### "Algolia credentials not configured"

**Fix:** Set Algolia keys in `../.env`

```bash
ALGOLIA_APP_ID=your_app_id
ALGOLIA_API_KEY=your_admin_key
```

## 📈 Expected Output

```
🚀 QuickITQuote Rules Engine
================================================================================

📦 Fetching 20 products for processing...
✓ Found 20 products to process

Progress |████████████████████████████████████████████████| 100% | 20/20

================================================================================

📊 Processing Summary
────────────────────────────────────────────────────────
Total Products:        20
Successful:            20 (100.0%)
Failed:                0

✓ Auto-Approved:       15 (75.0%)
⚠ Requires Review:     5

⏱ Processing Time:
  Total:               45.2s
  Average per product: 2260ms

🤖 Total Tokens Used:  12,450

================================================================================
```

## 💰 Cost Estimates

### OpenAI (gpt-4o-mini)
- **Per product:** ~$0.0015-0.003
- **20 products:** ~$0.03-0.06
- **100 products:** ~$0.15-0.30
- **1000 products:** ~$1.50-3.00

### Google Custom Search (Optional)
- **Free tier:** 100 queries/day
- **Paid:** $5 per 1000 queries

### Algolia
- **Included in plan** (no extra cost for syncing)

## 🔗 Full Documentation

- **ENRICHMENT_README.md** - Complete guide (300+ lines)
- **WORKFLOW.md** - Architecture diagram
- **README.md** - Module overview

## 💡 Pro Tips

1. **Test first:** Always test with 5-10 products before bulk processing
2. **Monitor costs:** Check OpenAI usage in their dashboard
3. **Backup data:** Backup database before large enrichments
4. **Check quality:** Review first 20-50 enrichments manually
5. **Schedule wisely:** Run during off-peak hours for large batches
6. **Use caching:** Re-running same products uses cached results (free!)
7. **Parallel processing:** Run multiple instances for faster processing

## 🆘 Need Help?

1. Check logs: `logs/rules-engine.log`
2. Review database: `SELECT * FROM AI_Log WHERE Status = 'Error'`
3. Read full docs: `ENRICHMENT_README.md`
4. Test structure: `node test-structure.js`

---

**🎉 You're ready to go!** Start with `npm run enrich` to process your first batch.
