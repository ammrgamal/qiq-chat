# Product Enrichment & Algolia Sync

This module provides automated product enrichment using AI and syncs the enriched data to Algolia for search.

## Overview

The enrichment system consists of:

1. **rules-engine.js** - Main AI enrichment engine
2. **algolia-sync.js** - Algolia synchronization script
3. **Helper utilities**:
   - `utils/sql-helper.js` - SQL database operations
   - `utils/ai-helper.js` - OpenAI API integration
   - `utils/google-helper.js` - Google Custom Search for images

## Prerequisites

### 1. Environment Variables

Create a `.env` file in the **root project directory** (`qiq-chat/.env`) with:

```bash
# OpenAI Configuration (Required for AI enrichment)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Google Custom Search (Optional for image search)
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GOOGLE_CX_ID=xxxxxxxxxxxxxxxxxxxx

# Algolia Configuration (Required for sync)
ALGOLIA_APP_ID=xxxxxxxxxxxxxxxxxxxx
ALGOLIA_API_KEY=xxxxxxxxxxxxxxxxxxxx
ALGOLIA_INDEX=woocommerce_products
```

### 2. Database Configuration

Ensure `config/dbConfig.json` is properly configured with your SQL Server credentials:

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

### 3. Database Schema

Run the following SQL to add required fields to your Products table:

```sql
USE QuoteWerksDB;
GO

-- Add AI processing fields if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'AIProcessed')
BEGIN
    ALTER TABLE dbo.Products ADD AIProcessed BIT NULL DEFAULT 0;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'AIConfidence')
BEGIN
    ALTER TABLE dbo.Products ADD AIConfidence DECIMAL(5,2) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'AIProcessedDate')
BEGIN
    ALTER TABLE dbo.Products ADD AIProcessedDate DATETIME NULL;
END

GO
```

Also ensure the AI_Log table exists (run `db/schema.sql` if needed).

### 4. Install Dependencies

```bash
cd rules-engine
npm install
```

## Usage

### AI Enrichment

Enrich products with AI-generated content:

```bash
# Enrich 20 products (default)
npm run enrich

# Enrich specific number of products
node rules-engine.js 50

# Enrich 100 products
node rules-engine.js 100
```

**What it does:**
1. Selects random products where `AIProcessed = 0`
2. Skips products with "Localization", "Test" in name, or `Cost = 0`
3. Generates AI content using OpenAI:
   - Short description (≤200 chars)
   - Extended description (≤4000 chars)
   - Features list
   - Technical specifications
   - FAQ (3-5 questions)
   - Marketing message
   - Business rules
   - Bundle suggestions
   - Keywords
   - Confidence score (0-100)
4. Searches Google for product images if `ImageFile` is empty
   - Finds images with ≥78% white background
   - Fallback: `{Manufacturer}.jpg`
5. Updates SQL database with enrichment data
6. Logs to `logs/rules-engine.log`
7. Auto-approves products with confidence ≥ 90%

**Features:**
- ✅ Concurrency limit (max 3 concurrent API calls)
- ✅ Retry logic (up to 2 retries per request)
- ✅ Caching to minimize API calls
- ✅ Progress bar with real-time updates
- ✅ Comprehensive logging
- ✅ Error handling per product (failures don't break the batch)

### Algolia Sync

Sync enriched products to Algolia:

```bash
# Sync with default batch size (100)
npm run sync

# Sync with custom batch size
node algolia-sync.js 50
```

**What it does:**
1. Fetches all products where `AIProcessed = 1`
2. Transforms to Algolia canonical schema:
   - Maps SQL fields to Algolia fields
   - Normalizes file URLs (backslashes → forward slashes)
   - Truncates long descriptions (≤4k chars)
   - Splits and deduplicates custom fields
   - Maps availability (1 → "Stock", 0 → "on back order")
3. Syncs in batches to Algolia using `saveObjects` (replace/update)
4. Uses `product_id` (MPN || InternalPartNumber || ID) as objectID
5. Logs to `logs/algolia-sync.log`

**Algolia Record Structure:**
```javascript
{
  objectID: "MPN-123" // Stable unique ID
  sku: "MPN-123",
  mpn: "ManufacturerPartNumber",
  name: "Product Name",
  brand: "Manufacturer",
  category: "Category",
  unit: "UnitOfMeasure",
  availability: "Stock" | "on back order",
  availability_weight: 100 | 50,
  price: 999.99,
  list_price: 1199.99,
  cost: 799.99,
  image: "normalized/path/to/image.jpg",
  spec_sheet: "/specs/...",
  link: "https://...",
  ShortDescription: "...",
  ExtendedDescription: "...",
  custom_memo: ["feature1", "feature2"], // from CustomMemo01-05
  custom_text: ["text1", "text2"],       // from CustomText01-20
  tags: ["keyword1", "keyword2"],        // from KeywordList
  Discontinued: false,
  LastModified: "2024-01-01T00:00:00Z",
  _ai_confidence: 95,
  _ai_processed: true
}
```

## Workflow

### Complete Enrichment & Sync Pipeline

```bash
# Step 1: Enrich products with AI
cd rules-engine
npm run enrich

# Step 2: Sync enriched products to Algolia
npm run sync
```

### Batch Processing for Large Datasets

For 400,000+ products, process in batches:

```bash
# Enrich in batches of 100
for i in {1..40}; do
  node rules-engine.js 100
  sleep 60  # Wait 1 minute between batches
done

# Sync all enriched products
npm run sync
```

## Logs

Logs are stored in `logs/` directory:

- `logs/rules-engine.log` - Enrichment processing logs
- `logs/algolia-sync.log` - Algolia sync logs

**Log format:**
```
[2024-01-01T12:00:00.000Z] [INFO] Processing product: Dell Laptop (ID: 123)
[2024-01-01T12:00:05.000Z] [SUCCESS] SUCCESS: Dell Laptop (Confidence: 95%, Auto-approve: true)
```

## Output Examples

### Enrichment Output

```
🚀 QuickITQuote Rules Engine
================================================================================

📦 Fetching 20 products for processing...
✓ Found 20 products to process

Progress |████████████████████████████████████████████████| 100% | 20/20 Products

================================================================================

📊 Processing Summary
────────────────────────────────────────────────────────
Total Products:        20
Successful:            20 (100.0%)
Failed:                0
Skipped:               0

✓ Auto-Approved:       15 (75.0%)
⚠ Requires Review:     5

⏱ Processing Time:
  Total:               45.2s
  Average per product: 2260ms

🤖 Total Tokens Used:  12,450

================================================================================
```

### Algolia Sync Output

```
🔄 QuickITQuote Algolia Sync
================================================================================
✓ Connected to Algolia index: woocommerce_products

📦 Fetching enriched products from database...
✓ Found 20 enriched products to sync

Progress |████████████████████████████████████████████████| 100% | 20/20 Products

================================================================================

📊 Algolia Sync Summary
────────────────────────────────────────────────────────
Total Products:        20
Synced:                20 (100.0%)
Failed:                0
Skipped:               0

⏱ Sync Time:
  Total:               3.2s
  Average per product: 160ms

================================================================================
```

## Field Mapping Reference

### SQL → Algolia Mapping

| SQL Field | Algolia Field | Notes |
|-----------|---------------|-------|
| ManufacturerPartNumber | mpn, objectID, sku | Primary identifier |
| Manufacturer | brand | |
| ProductName | name | |
| ShortDescription | ShortDescription | Truncated ≤500 chars |
| ExtendedDescription | ExtendedDescription | Truncated ≤4000 chars |
| Category | category | |
| UnitOfMeasure | unit | |
| Price | price | Parsed as float |
| Cost | cost | Parsed as float |
| ListPrice | list_price | Parsed as float |
| Availability | availability | 1→"Stock", 0→"on back order" |
| ImageFile | image | Normalized path (\ → /) |
| KeywordList | tags | Split by comma/semicolon/newline |
| CustomMemo01-05 | custom_memo | Split, dedupe, combine |
| CustomText01-20 | custom_text | Split, dedupe, combine |
| Discontinued | Discontinued | Boolean |
| LastModified | LastModified | ISO 8601 string |
| AIConfidence | _ai_confidence | Metadata field |
| AIProcessed | _ai_processed | Metadata field |

### AI Enrichment → SQL Mapping

| AI Output | SQL Field | Notes |
|-----------|-----------|-------|
| shortDescription | ShortDescription | ≤200 chars |
| extendedDescription | ExtendedDescription | ≤4000 chars |
| features | CustomMemo01 | Bullet list |
| specifications | CustomMemo02 | Key:value format |
| faq | CustomMemo03 | Q&A format |
| marketingMessage | CustomMemo04 | 2-3 sentences |
| rules | CustomMemo05 | Business rules |
| bundleSuggestions | CustomText01 | Comma-separated |
| keywords | KeywordList | Comma-separated |
| imageFile | ImageFile | URL or filename |
| confidence | AIConfidence | 0-100 score |

## Troubleshooting

### No products found for processing

**Issue:** `⊘ No products found for processing`

**Solutions:**
1. Check that products exist with `AIProcessed = 0` or `NULL`
2. Verify products don't have "Localization" or "Test" in name
3. Ensure products have `Cost > 0`

### OpenAI API errors

**Issue:** `OpenAI API error: 401 Unauthorized`

**Solutions:**
1. Verify `OPENAI_API_KEY` is set correctly in root `.env`
2. Check API key is active and has credits
3. Ensure `.env` file is in root directory (`qiq-chat/.env`), not `rules-engine/.env`

### Algolia sync fails

**Issue:** `Algolia credentials not configured`

**Solutions:**
1. Set `ALGOLIA_APP_ID` and `ALGOLIA_API_KEY` in `.env`
2. Use **Admin API Key**, not search-only key
3. Verify index name matches: `ALGOLIA_INDEX=woocommerce_products`

### Database connection fails

**Issue:** `Database connection failed`

**Solutions:**
1. Check `config/dbConfig.json` credentials
2. Ensure SQL Server is running and accessible
3. Verify network connectivity to SQL Server
4. Check firewall settings

### Google image search not working

**Issue:** Images not being found or using fallback

**Solutions:**
1. Verify `GOOGLE_API_KEY` and `GOOGLE_CX_ID` are set
2. Check Google Custom Search API quota
3. Image search is optional - system will use fallback `{Manufacturer}.jpg`

## Performance Optimization

### Concurrency Settings

Default: 3 concurrent AI enrichment requests

Adjust in `rules-engine.js`:
```javascript
const concurrencyLimit = 3; // Increase for faster processing (watch rate limits)
```

### Caching

AI responses are cached in memory to avoid duplicate API calls for the same product.

Clear cache:
```javascript
import aiHelper from './utils/ai-helper.js';
aiHelper.clearCache();
```

### Batch Sizes

- **Enrichment**: Process 20-100 products at a time
- **Algolia Sync**: Sync 100-1000 records per batch

### Rate Limiting

Built-in delays to avoid API rate limits:
- 500ms between enrichment batches
- 200ms between image analyses
- 500ms between Algolia sync batches

## API Costs (Estimate)

### OpenAI (gpt-4o-mini)

- ~500-1000 tokens per product enrichment
- ~$0.0015-0.003 per product
- 20 products = ~$0.03-0.06
- 1000 products = ~$1.50-3.00

### Google Custom Search

- Free tier: 100 queries/day
- Paid: $5 per 1000 queries
- Only used when ImageFile is empty

### Algolia

- Included in Algolia plan (record operations)
- No additional cost for syncing

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review database AI_Log table for errors
3. Verify environment variables are set
4. Test with small batch (5-10 products) first

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Author:** QuickITQuote Team
