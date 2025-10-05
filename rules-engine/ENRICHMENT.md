# Product Enrichment Engine - rules-engine.js

## Overview

The `rules-engine.js` module provides automated product data enrichment using OpenAI and Google Custom Search APIs. It processes QuoteWerks products, enriches them with AI-generated content, fetches product images, and updates SQL records.

## Features

- ✅ **OpenAI Product Enrichment**: Generates enhanced descriptions, features, specs, FAQs, and marketing content
- ✅ **Google Image Search**: Fetches product images with white background detection
- ✅ **SQL Updates**: Safely updates QuoteWerks database with parameterized queries
- ✅ **Smart Skipping**: Automatically skips invalid products (cost=0, localization items)
- ✅ **Retry Logic**: Retries failed API calls up to 2 times
- ✅ **Concurrency Control**: Processes 3 products simultaneously to optimize throughput
- ✅ **Progress Tracking**: Live progress bar and colored console output
- ✅ **Comprehensive Logging**: Logs all operations to `/logs/rules-engine.log`

## Installation

```bash
cd qiq-chat/rules-engine
npm install
```

## Configuration

### 1. Environment Variables

Create or update `.env` file in the **root qiq-chat directory**:

```bash
# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Google Custom Search (Optional - for image fetching)
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GOOGLE_CX_ID=xxxxxxxxxxxxxxxxxxxx
```

### 2. Database Configuration

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

### 3. Database Schema

Ensure your QuoteWerks database has the required fields. Run this SQL to add enrichment fields:

```sql
-- Add enrichment fields to Products table
ALTER TABLE Products ADD EnhancedDescription NVARCHAR(MAX);
ALTER TABLE Products ADD ProductFeatures NVARCHAR(MAX);
ALTER TABLE Products ADD TechnicalSpecs NVARCHAR(MAX);
ALTER TABLE Products ADD FAQ NVARCHAR(MAX);
ALTER TABLE Products ADD MarketingText NVARCHAR(1000);
ALTER TABLE Products ADD CategoryRule NVARCHAR(200);
ALTER TABLE Products ADD ProductRule NVARCHAR(200);
ALTER TABLE Products ADD BundleSuggestions NVARCHAR(MAX);
ALTER TABLE Products ADD AIProcessed BIT DEFAULT 0;
ALTER TABLE Products ADD AIProcessedDate DATETIME;
ALTER TABLE Products ADD AIConfidence DECIMAL(5,2);
```

## Usage

### Run Enrichment Process

```bash
npm run enrich
```

Or directly:

```bash
node rules-engine.js
```

### What It Does

1. **Connects to Database**: Uses config from `config/dbConfig.json`
2. **Selects Products**: Randomly selects 20 products where `AIProcessed = 0`
3. **Enriches Data**: For each product:
   - Calls OpenAI to generate enhanced content
   - Fetches product image from Google (if needed)
   - Updates QuoteWerks database record
   - Logs all operations
4. **Shows Summary**: Displays statistics and runtime information

## Functions

### 1️⃣ enrichProductData(product)

Enriches product data using OpenAI API.

**Input:**
```javascript
{
  ProductName: "Cisco Catalyst Switch",
  Manufacturer: "Cisco",
  Category: "Networking",
  Description: "24-port switch",
  Cost: 1500
}
```

**Output:**
```javascript
{
  description: "Enhanced description...",
  features: ["Feature 1", "Feature 2", ...],
  specs: { "Ports": "24", "Speed": "1Gbps" },
  faq: [{ question: "Q?", answer: "A." }],
  marketingMessage: "Marketing copy...",
  rulesProduct: "Standard",
  rulesCategory: "Networking",
  bundleSuggestion: ["Cable", "Rack mount"],
  confidenceScore: 85
}
```

**Features:**
- ✅ Skips products with cost=0
- ✅ Skips "localization" and "base unit" items
- ✅ Retries up to 2 times on failure
- ✅ Logs all API calls and responses
- ✅ Returns normalized data structure

---

### 2️⃣ fetchProductImage(product)

Fetches product image using Google Custom Search API.

**Process:**
1. Checks if `product.ImageFile` exists → returns if found
2. Searches Google: `"{Manufacturer} {ProductName}"`
3. Fetches top 8 image results
4. Calculates white background ratio for each
5. Selects image with ≥78% white background
6. Falls back to `{Manufacturer}.jpg` if none found
7. Caches results to minimize API calls

**Returns:** Image URL string

---

### 3️⃣ updateSQLRecord(productId, enrichedData)

Updates QuoteWerks SQL record with enriched data.

**Features:**
- ✅ Uses parameterized queries (prevents SQL injection)
- ✅ Updates all enrichment fields
- ✅ Sets `AIProcessed = 1` and `AIProcessedDate = CURRENT_TIMESTAMP`
- ✅ Stores `AIConfidence` score
- ✅ Logs updated fields to `/logs/rules-engine.log`

**Returns:**
```javascript
{
  success: true,
  rowsAffected: 1,
  productId: 123
}
```

---

### 4️⃣ Logging Functions

#### logProgress(message)
Appends to `/logs/rules-engine.log` with timestamp and color-coded console output:
- 🟢 Green: Success messages (✓)
- 🟡 Yellow: Warnings/skipped items (⚠, ⊘)
- 🔴 Red: Errors (✗)
- 🔵 Blue: Info messages (ℹ)
- 🔷 Cyan: Retry attempts (🔄)

#### logSummary(summary)
Displays final statistics:
- Total products processed
- Enriched/skipped/failed counts
- Success rate percentage
- Average processing time
- Total runtime

#### displayProgressBar(current, total, currentItem)
Shows live progress bar:
```
[████████████████████████████████████░░░░░░] 78% 16/20 Cisco Catalyst Switch
```

---

### 5️⃣ runRulesEngine()

Main orchestration function.

**Flow:**
1. Connect to SQL database
2. Select 20 random products (`WHERE AIProcessed = 0`)
3. Process products with concurrency limit = 3
4. For each product:
   - Call `enrichProductData()`
   - Call `fetchProductImage()`
   - Call `updateSQLRecord()`
5. Track success/fail counts
6. Display final summary
7. Print runtime statistics
8. Graceful shutdown on error

**Concurrency:** Processes 3 products simultaneously for optimal performance without overwhelming APIs.

---

## Field Mapping

See [mapping-reference.md](./mapping-reference.md) for complete field mapping documentation.

### QuoteWerks → Enrichment → Database

| Source | Enriched | Database Field |
|--------|----------|----------------|
| Description | description | EnhancedDescription |
| - | features | ProductFeatures (JSON) |
| - | specs | TechnicalSpecs (JSON) |
| - | faq | FAQ (JSON) |
| - | marketingMessage | MarketingText |
| Category | rulesCategory | CategoryRule |
| - | rulesProduct | ProductRule |
| - | bundleSuggestion | BundleSuggestions (JSON) |
| ImageFile | imageUrl | ImageFile |
| - | confidenceScore | AIConfidence |
| - | 1 | AIProcessed |
| - | CURRENT_TIMESTAMP | AIProcessedDate |

---

## Output Example

```
🚀 QuickITQuote Rules Engine - Product Enrichment

[14:23:01] ================================================================================
[14:23:01] Starting Rules Engine...
[14:23:01] 📊 Connecting to database...
[14:23:02] ✓ Database connected
[14:23:02] 📦 Found 20 products to process

[████████████████████████████████████████████] 100% 20/20 Complete!

[14:24:45] ✓ Enriched: Cisco Catalyst 2960 Switch (2341ms, confidence: 87%)
[14:24:46] ⊘ Skipped: Localization Package (cost=0 or localization/base unit)
[14:24:48] ✗ Error: Dell Server R740 - API timeout

================================================================================
📊 RULES ENGINE SUMMARY
================================================================================

Products Processed:    20
  ✓ Enriched:          17
  ⊘ Skipped:           2
  ✗ Failed:            1

Success Rate:          85%
Average Time:          2134ms per product
Total Runtime:         104523ms

Runtime Statistics:
  Start Time:          2024-01-15T14:23:01.234Z
  End Time:            2024-01-15T14:24:45.757Z
  Total Duration:      104s

================================================================================

✅ Rules Engine completed successfully!
```

---

## Logs

All operations are logged to `/logs/rules-engine.log`:

```
[2024-01-15T14:23:01.234Z] Starting Rules Engine...
[2024-01-15T14:23:02.456Z] ✓ Database connected
[2024-01-15T14:23:05.789Z] OpenAI Success: Cisco Catalyst 2960 Switch
  Tokens: 1234, Time: 2341ms
  Confidence: 87%
[2024-01-15T14:23:07.012Z] SQL Update: Product ID 456
  Rows affected: 1
  Confidence: 87%
  Fields updated: EnhancedDescription, ProductFeatures, ...
```

Image fetching is cached in `/logs/image-cache.log`:

```
[2024-01-15T14:23:10.123Z] Cisco Catalyst Switch -> https://example.com/image.jpg
```

---

## Skip Conditions

Products are automatically skipped if:
- `Cost = 0` or null
- `ProductName` contains "localization" (case-insensitive)
- `ProductName` contains "base unit" (case-insensitive)
- `UnitOfMeasure` contains "localization" (case-insensitive)
- `UnitOfMeasure` contains "base unit" (case-insensitive)

---

## Error Handling

### Retry Logic
- OpenAI API calls retry up to **2 times**
- 2-second delay between retries
- All errors logged with details

### Graceful Shutdown
- Closes database connections on error
- Saves partial results
- Logs error details
- Exits with error code 1

---

## Performance

### Batch Size
- Processes **20 products** per run
- Random selection ensures variety

### Concurrency
- **3 simultaneous requests**
- Prevents API rate limit issues
- Optimizes throughput

### API Limits
- OpenAI: ~60 requests/minute (safe with 3 concurrent)
- Google Custom Search: 100 queries/day (free tier)

---

## Troubleshooting

### "No OpenAI API key"
**Solution:** Add `OPENAI_API_KEY` to root `.env` file

### "Database connection failed"
**Solution:** Check `config/dbConfig.json` credentials and SQL Server status

### "No products found"
**Solution:** Products already processed. Set `AIProcessed = 0` manually:
```sql
UPDATE Products SET AIProcessed = 0 WHERE ID IN (1,2,3...)
```

### "Image fetch failed"
**Solution:** Add Google API credentials or images will fall back to manufacturer filename

---

## Integration

### With Existing Rules Engine

The new `rules-engine.js` complements the existing `src/rulesEngine.js`:

| File | Purpose |
|------|---------|
| `src/rulesEngine.js` | Product classification and auto-approval |
| `rules-engine.js` | Product enrichment with AI content |

Both can run independently or together.

### Scheduled Batch Processing

Run daily via cron:

```bash
# crontab -e
0 2 * * * cd /path/to/qiq-chat/rules-engine && node rules-engine.js >> logs/cron.log 2>&1
```

---

## Development

### Test Mode
Modify `runRulesEngine()` to process fewer products:

```javascript
// Change from TOP 20 to TOP 5
SELECT TOP 5
  ID, ProductName, ...
```

### Dry Run
Comment out `updateSQLRecord()` call to test without database updates.

---

## Future Enhancements

- [ ] Add support for other AI providers (Gemini, Claude)
- [ ] Implement image analysis with AI vision models
- [ ] Add multilingual support for descriptions
- [ ] Create web UI for manual review
- [ ] Add webhook notifications on completion
- [ ] Export enriched data to CSV/JSON

---

**Author:** QuickITQuote Team  
**Version:** 1.0.0  
**Last Updated:** 2024
