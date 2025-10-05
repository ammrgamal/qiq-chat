# Rules Engine & AI Enrichment - Quick Start Guide

Get started with the Rules Engine and Product Enrichment Module in 5 minutes.

---

## 📦 What's Included

The Rules Engine module provides:

✅ **AI-Powered Classification** - Categorize products automatically  
✅ **Auto-Approval Rules** - Intelligent approval workflows  
✅ **Product Enrichment** - AI-generated descriptions, specs, and images  
✅ **Algolia Sync** - Automated search index synchronization  
✅ **REST API** - Simple integration endpoints  

---

## 🚀 5-Minute Setup

### Step 1: Install Dependencies

```bash
cd rules-engine
npm install
```

### Step 2: Configure Database

Edit `config/dbConfig.json`:

```json
{
  "user": "your_username",
  "password": "your_password",
  "server": "localhost",
  "database": "QuoteWerksDB",
  "options": {
    "encrypt": false,
    "trustServerCertificate": true
  }
}
```

### Step 3: Run Database Scripts

```bash
# Install core schema
sqlcmd -S localhost -d QuoteWerksDB -i db/schema.sql

# Install enrichment schema
sqlcmd -S localhost -d QuoteWerksDB -i db/enrichment-schema.sql
```

### Step 4: Configure API Keys

Create `.env` in the **root** qiq-chat directory:

```bash
# OpenAI (recommended)
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Google Custom Search (for images)
GOOGLE_API_KEY=your-google-api-key
GOOGLE_CX_ID=your-custom-search-id

# Algolia (for search sync)
ALGOLIA_APP_ID=your-app-id
ALGOLIA_API_KEY=your-admin-key
ALGOLIA_INDEX=woocommerce_products
```

### Step 5: Test the Module

```bash
# Test classification
node src/index.js 5

# You should see sample products being classified
```

---

## 🎯 Common Use Cases

### Use Case 1: Enrich a Single Product via API

```bash
curl -X POST http://localhost:3001/api/rules-engine/enrich \
  -H "Content-Type: application/json" \
  -d '{"partNumber": "WS-C2960-24TT-L"}'
```

**Response:**
```json
{
  "ok": true,
  "message": "Product enriched successfully",
  "data": {
    "confidence": 95.5,
    "aiProcessed": true,
    "processingTimeMs": 2345
  }
}
```

### Use Case 2: Sync Products to Algolia

```bash
cd rules-engine
node scripts/algolia-sync.js
```

This will:
1. Fetch all products from SQL
2. Transform to Algolia format
3. Upload in batches
4. Report statistics

### Use Case 3: Check Enrichment Status

```sql
-- Products needing enrichment
SELECT COUNT(*) AS NeedsEnrichment
FROM Products p
LEFT JOIN Product_Enrichment pe ON p.ID = pe.ProductID
WHERE pe.AIProcessed IS NULL OR pe.AIProcessed = 0;

-- Enrichment statistics
SELECT 
  COUNT(*) AS TotalEnriched,
  AVG(AIConfidence) AS AvgConfidence,
  SUM(CASE WHEN RequiresReview = 1 THEN 1 ELSE 0 END) AS NeedsReview
FROM Product_Enrichment;
```

---

## 📊 File Structure

```
rules-engine/
├── db/
│   ├── schema.sql              # Core tables
│   └── enrichment-schema.sql   # Enrichment extension
├── config/
│   └── dbConfig.json           # Database config
├── src/
│   ├── index.js                # Entry point
│   ├── productEnrichment.js    # Enrichment service
│   └── aiService.js            # AI integration
├── scripts/
│   └── algolia-sync.js         # Algolia sync
└── ENRICHMENT.md               # Full documentation
```

---

## 🔑 Key Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | One of OpenAI or Gemini |
| `GOOGLE_API_KEY` | Google/Gemini API key | One of OpenAI or Gemini |
| `GOOGLE_CX_ID` | Custom Search Engine ID | For image fetching |
| `ALGOLIA_APP_ID` | Algolia App ID | For search sync |
| `ALGOLIA_API_KEY` | Algolia Admin Key | For search sync |
| `ALGOLIA_INDEX` | Index name | Defaults to `woocommerce_products` |

---

## 🔄 Typical Workflow

```
1. Product Added to Database
   ↓
2. Chat/Search encounters product
   ↓
3. POST /api/rules-engine/enrich
   ↓
4. AI generates content (2-5 seconds)
   ↓
5. Save to Product_Enrichment table
   ↓
6. Periodic sync to Algolia (every 6 hours)
   ↓
7. Enhanced search results available
```

---

## 📚 Documentation Quick Links

- **[ENRICHMENT.md](./ENRICHMENT.md)** - Complete enrichment guide
- **[mapping-reference.md](../docs/mapping-reference.md)** - SQL to Algolia field mapping
- **[enrichment-integration-example.md](../docs/enrichment-integration-example.md)** - Integration examples
- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[INTEGRATION.md](./INTEGRATION.md)** - Integration patterns

---

## 🆘 Troubleshooting

**Problem**: "No AI API keys configured"  
**Solution**: Add `OPENAI_API_KEY` or `GOOGLE_API_KEY` to `.env` in root directory

**Problem**: "Database connection failed"  
**Solution**: Check `config/dbConfig.json` and verify SQL Server is running

**Problem**: "Table 'Product_Enrichment' does not exist"  
**Solution**: Run `db/enrichment-schema.sql` on your database

**Problem**: Algolia sync fails  
**Solution**: Verify `ALGOLIA_APP_ID` and `ALGOLIA_API_KEY` in `.env`

---

## 🎓 Next Steps

1. **Read the full docs**: [ENRICHMENT.md](./ENRICHMENT.md)
2. **Set up automation**: Configure cron jobs for periodic sync
3. **Integrate with chat**: Add enrichment checks to your chat flow
4. **Monitor logs**: Check `AI_Log` table for processing history
5. **Optimize prompts**: Adjust AI prompts in `productEnrichment.js` for better results

---

## 💡 Pro Tips

- **Start with small batches**: Test enrichment on 10-20 products first
- **Monitor confidence scores**: Products with <90% confidence need review
- **Use caching**: The API checks if products are already enriched
- **Rate limiting**: Built-in 1-second delay between enrichments
- **Cost control**: Gemini is cheaper than OpenAI for classification tasks

---

## 📞 Support

Need help? Check:
1. [ENRICHMENT.md](./ENRICHMENT.md) for detailed documentation
2. [enrichment-integration-example.md](../docs/enrichment-integration-example.md) for code examples
3. Database logs in `AI_Log` table
4. Main project documentation

---

**Ready to enrich your products? Start with Step 1! 🚀**
