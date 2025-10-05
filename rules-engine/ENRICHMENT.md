# Product Enrichment Module

## Overview

The Product Enrichment Module automatically enhances product data from QuoteWerks SQL Database using AI (OpenAI/Gemini) and Google Custom Search APIs. It generates marketing-ready descriptions, technical specifications, product images, and intelligent recommendations.

---

## ✨ Features

### AI-Generated Content
- **Marketing Descriptions**: Short (150-200 char) and long HTML-formatted descriptions
- **Technical Specifications**: Structured spec tables with key product attributes
- **Key Features**: Bullet-point list of product benefits
- **FAQ Entries**: Common questions and answers
- **Prerequisites**: Installation and usage requirements
- **Professional Services**: Service scope descriptions

### Product Intelligence
- **Upsell Recommendations**: Related products for cross-selling
- **Bundle Suggestions**: Complementary product bundles
- **Value Statements**: Customer value propositions
- **Product Rules**: Item-specific approval rules
- **Category Rules**: Category-level guidelines

### Enhanced Media
- **Product Images**: Fetched via Google Custom Search API
- **Image Filtering**: Preference for white background product shots
- **Image Attribution**: Source tracking for compliance

### Quality Control
- **Confidence Scoring**: 0-100% confidence for each enrichment
- **Auto-Approval**: Products ≥90% confidence auto-approved
- **Manual Review**: Products <90% flagged for review
- **Processing Logs**: Complete audit trail in AI_Log table

---

## 🗄️ Database Schema

The enrichment module extends the Rules Engine database with the `Product_Enrichment` table.

### Installation

```bash
# Run the enrichment schema SQL script
sqlcmd -S your-server -d QuoteWerksDB -i rules-engine/db/enrichment-schema.sql
```

Or using SQL Server Management Studio (SSMS), execute `enrichment-schema.sql`.

### Table Structure

See `db/enrichment-schema.sql` for complete schema. Key fields include:

- **Identity**: `ProductID`, `PartNumber`
- **Descriptions**: `AIShortDescription`, `AILongDescription`
- **Technical**: `AISpecsTable`, `AIFeatures`
- **Services**: `AIPrerequisites`, `AIServicesScope`, `AIFAQ`
- **Intelligence**: `AIUpsells`, `AIBundles`, `AIValueStatement`, `AIProductRules`, `AICategoryRules`
- **Media**: `AIImageURL`, `AIImageSource`
- **Metadata**: `AIProcessed`, `AIConfidence`, `AIProvider`, `RequiresReview`

---

## 🚀 Usage

### 1. Via API Endpoint

The enrichment module provides a REST API endpoint for on-demand enrichment:

**Endpoint**: `POST /api/rules-engine/enrich`

**Request Body**:
```json
{
  "productId": "12345"
}
```

Or:
```json
{
  "partNumber": "WS-C2960-24TT-L"
}
```

**Response** (Success):
```json
{
  "ok": true,
  "message": "Product enriched successfully",
  "enriched": true,
  "data": {
    "productId": "12345",
    "partNumber": "WS-C2960-24TT-L",
    "confidence": 95.5,
    "aiProcessed": true,
    "requiresReview": false,
    "approvalStatus": "Approved",
    "processingTimeMs": 2345
  },
  "cached": false
}
```

**Response** (Already Enriched):
```json
{
  "ok": true,
  "message": "Product already enriched",
  "enriched": true,
  "data": { /* full enrichment data */ },
  "cached": true
}
```

### 2. Integration with Chat

When a user queries a product in the chat interface:

```javascript
// Example chat integration
async function handleProductQuery(productId) {
  // Check if product is enriched
  const product = await getProduct(productId);
  
  if (!product.AIProcessed) {
    // Queue for enrichment
    await fetch('/api/rules-engine/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    
    // Use basic data while enrichment completes
    return product;
  }
  
  // Return enriched data
  return getEnrichedProduct(productId);
}
```

### 3. Batch Enrichment (CLI)

For bulk processing of products:

```bash
# Navigate to rules-engine directory
cd rules-engine

# Enrich all unenriched products
node src/index.js --enrich-batch --limit=100

# Enrich specific product
node src/index.js --enrich --product-id=12345
```

### 4. Programmatic Usage

```javascript
import productEnrichment from './rules-engine/src/productEnrichment.js';

// Single product
const product = {
  ID: '12345',
  name: 'Cisco Catalyst 2960 Switch',
  manufacturer: 'Cisco',
  category: 'Networking',
  partNumber: 'WS-C2960-24TT-L'
};

const enrichedData = await productEnrichment.enrichProduct(product);
console.log(`Enriched with ${enrichedData.aiConfidence}% confidence`);

// Batch processing
const products = [...]; // Array of products
const results = await productEnrichment.enrichProductBatch(products, 
  (processed, total, enriched) => {
    console.log(`Progress: ${processed}/${total} - ${enriched.aiConfidence}% confidence`);
  }
);
```

---

## 🔄 Algolia Sync

### Automatic Sync

Run the sync script periodically to mirror enriched products to Algolia:

```bash
# Manual sync
node rules-engine/scripts/algolia-sync.js

# Cron job (every 6 hours)
0 */6 * * * cd /path/to/qiq-chat && node rules-engine/scripts/algolia-sync.js >> logs/algolia-sync.log 2>&1
```

### Vercel Cron Job

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/algolia-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Create `api/cron/algolia-sync.js`:

```javascript
import AlgoliaSyncService from '../../rules-engine/scripts/algolia-sync.js';

export default async function handler(req, res) {
  try {
    const syncService = new AlgoliaSyncService();
    await syncService.initialize();
    const result = await syncService.syncToAlgolia();
    
    res.status(200).json({
      ok: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
```

### Sync Process

1. **Fetch**: Load all active products with enrichment data from SQL
2. **Transform**: Convert SQL format to Algolia schema (see `mapping-reference.md`)
3. **Validate**: Check record sizes (<10KB), truncate if needed
4. **Batch Upload**: Upload in batches of 100 records
5. **Report**: Log sync statistics

---

## 🔑 Configuration

### Environment Variables

Add to `.env` file in the **root** of qiq-chat:

```bash
# OpenAI (Primary AI Provider)
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Google Gemini (Alternative AI Provider)
GOOGLE_API_KEY=your-google-key-here
GEMINI_MODEL=gemini-1.5-flash

# Google Custom Search (for product images)
GOOGLE_CX_ID=your-custom-search-engine-id

# Algolia (for search index sync)
ALGOLIA_APP_ID=your-app-id
ALGOLIA_API_KEY=your-admin-api-key
ALGOLIA_INDEX=woocommerce_products
```

### Getting API Keys

**OpenAI**:
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add to `.env` as `OPENAI_API_KEY`

**Google Custom Search**:
1. Go to https://developers.google.com/custom-search/v1/overview
2. Get an API key
3. Create a Custom Search Engine at https://cse.google.com/cse/
4. Get the Search Engine ID (CX)
5. Add both to `.env`

**Algolia**:
1. Go to https://www.algolia.com/
2. Get your Application ID and Admin API Key
3. Add to `.env`

---

## 📊 Monitoring & Logs

### Database Logs

All enrichment operations are logged in the `AI_Log` table:

```sql
-- Recent enrichments
SELECT TOP 10
  LogID,
  ProcessDate,
  AIProvider,
  Model,
  TokensUsed,
  ProcessingTimeMs,
  Status
FROM AI_Log
ORDER BY ProcessDate DESC;

-- Failed enrichments
SELECT *
FROM AI_Log
WHERE Status = 'Error'
ORDER BY ProcessDate DESC;
```

### Enrichment Status

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
  SUM(CASE WHEN RequiresReview = 1 THEN 1 ELSE 0 END) AS RequiresReview,
  SUM(CASE WHEN AIProcessed = 1 THEN 1 ELSE 0 END) AS AutoApproved
FROM Product_Enrichment;
```

### Performance Metrics

```sql
-- Average enrichment time by provider
SELECT 
  AIProvider,
  AVG(ProcessingTimeMs) AS AvgTimeMs,
  COUNT(*) AS Count
FROM AI_Log
WHERE Status = 'Success'
GROUP BY AIProvider;
```

---

## 🎨 Styling Standards

### QuickITQuote Blue

Use `#0055A4` for section headers in descriptions:

```html
<span style="color:#0055A4">Section Title:</span> Content here...
```

### Description Templates

**Short Description** (150-200 chars):
```
[Product Name] - [Key Benefit]. [Primary Feature]. [Use Case].
```

**Long Description** (HTML formatted):
```html
<span style="color:#0055A4">Overview:</span> Comprehensive product overview.<br><br>
<span style="color:#0055A4">Key Features:</span><br>
• Feature 1<br>
• Feature 2<br>
• Feature 3<br><br>
<span style="color:#0055A4">Ideal For:</span> Target use cases.
```

---

## 🔧 Troubleshooting

### Common Issues

**Issue**: Enrichment fails with "No AI API keys configured"
**Solution**: Add `OPENAI_API_KEY` or `GOOGLE_API_KEY` to `.env`

**Issue**: Database connection fails
**Solution**: Verify `config/dbConfig.json` settings and database server is running

**Issue**: Image fetch fails
**Solution**: Check `GOOGLE_CX_ID` and `GOOGLE_API_KEY` in `.env`, or disable image fetch

**Issue**: Algolia sync fails with "Index not found"
**Solution**: Verify `ALGOLIA_INDEX` name in `.env` matches your Algolia index

**Issue**: Products not syncing to Algolia
**Solution**: Check database schema includes `Product_Enrichment` table, run `enrichment-schema.sql`

### Debug Mode

Enable detailed logging:

```javascript
// In productEnrichment.js or algolia-sync.js
logger.setLevel('debug');
```

---

## 📚 Related Documentation

- [Field Mapping Reference](../docs/mapping-reference.md) - Complete SQL to Algolia field mapping
- [Algolia Index Reference](../docs/algolia_index_reference.md) - Algolia search configuration
- [Rules Engine Setup](./SETUP.md) - Initial setup instructions
- [Rules Engine Integration](./INTEGRATION.md) - Integration examples

---

## 🆘 Support

For issues or questions:
1. Check the [troubleshooting section](#troubleshooting)
2. Review [mapping-reference.md](../docs/mapping-reference.md) for field details
3. Check database logs in `AI_Log` table
4. Contact QuickITQuote development team

---

**Last Updated**: 2025-01-08  
**Version**: 1.0.0  
**Module**: Rules Engine & AI Enrichment
