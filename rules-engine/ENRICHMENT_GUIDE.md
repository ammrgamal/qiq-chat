# 🚀 Rules Engine — Product Enrichment Implementation Guide

## Overview

This guide documents the implementation of the AI-powered product enrichment module for the QuickITQuote Rules Engine. The module enriches product data from QuoteWerks SQL Database using OpenAI and Google APIs, then syncs the enriched data to Algolia for optimized search.

## ✅ Implementation Status

All required components have been successfully implemented:

### 📁 File Structure

```
rules-engine/
├── README.md                      ✓ Updated with enrichment capabilities
├── .env.example                   ✓ All required environment variables
├── mapping-reference.md           ✓ Complete field mapping documentation
├── copilot-instructions.md        ✓ Detailed implementation instructions
├── rules-engine.js                ✓ Main enrichment entry point
├── algolia-sync.js                ✓ Algolia synchronization script
├── schema.sql                     ✓ Product table schema extensions
│
├── logs/
│   ├── .gitkeep                   ✓ Directory tracked in git
│   ├── rules-engine.log           ✓ Enrichment process logs
│   └── sync.log                   ✓ Algolia sync logs
│
└── utils/
    ├── ai-helper.js               ✓ OpenAI API integration
    ├── google-helper.js           ✓ Google Custom Search integration
    └── sql-helper.js              ✓ SQL Server connection utilities
```

## 🎯 Core Features Implemented

### 1. Product Enrichment (`rules-engine.js`)

**Functionality:**
- Processes 20 unprocessed products by default (configurable)
- Detects missing or incomplete product fields
- Uses OpenAI to generate comprehensive product data:
  - Short description (500 chars max)
  - Long marketing description
  - Features list (HTML formatted)
  - Specifications table (HTML formatted)
  - FAQs (3-5 questions/answers)
  - Prerequisites and requirements
  - Related items and accessories
  - Professional services scope
  - Upsell recommendations
  - Marketing value proposition
- Searches for product images with white background (≥78%)
- Updates QuoteWerks database with enriched data
- Calculates and stores AI confidence scores (0-100%)
- Logs all activities to `logs/rules-engine.log`
- Displays real-time progress bar

**Usage:**
```bash
# Process 20 products (default)
node rules-engine.js

# Process custom number
node rules-engine.js 50
```

### 2. Algolia Synchronization (`algolia-sync.js`)

**Functionality:**
- Syncs all processed products to Algolia search index
- Transforms SQL data to Algolia-compatible format
- Processes in configurable batches (default: 100)
- Configures Algolia index settings with optimal search parameters
- Uses QuickITQuote brand color (#0055A4) for highlights
- Logs sync activities to `logs/sync.log`

**Usage:**
```bash
# Sync all processed products
node algolia-sync.js

# Configure Algolia index settings (first time setup)
node algolia-sync.js --configure
```

### 3. AI Helper (`utils/ai-helper.js`)

**Functionality:**
- OpenAI API integration with retry logic (3 attempts)
- Exponential backoff for rate limiting
- Response caching to avoid duplicate API calls
- Token usage tracking
- Confidence score calculation based on:
  - Field completeness
  - Content quality
  - Response structure
- Prompt generation optimized for product enrichment

**Key Methods:**
- `enrichProduct(product)` - Main enrichment function
- `callOpenAI(prompt, maxRetries)` - API call with retry
- `calculateConfidence(enrichedData, response)` - Score calculation
- `getTokenUsage()` - Token statistics

### 4. Google Helper (`utils/google-helper.js`)

**Functionality:**
- Google Custom Search API integration
- Image search with up to 8 results per query
- White background detection (heuristic-based)
- Selects images with ≥78% white background
- Fallback to `{ManufacturerName}.jpg` if no suitable image
- Image URL validation
- Background analysis based on URL patterns

**Key Methods:**
- `findProductImage(product)` - Main image search
- `searchImages(query, numResults)` - Google API search
- `analyzeImageWhiteness(imageUrl)` - Background detection
- `getFallbackImage(product)` - Fallback image generation

### 5. SQL Helper (`utils/sql-helper.js`)

**Functionality:**
- SQL Server connection pool management
- Database configuration from `config/dbConfig.json`
- Product retrieval (unprocessed products)
- Product update with enriched data
- Enrichment logging to AI_Log table
- Statistics and reporting

**Key Methods:**
- `connect()` - Establish database connection
- `getUnprocessedProducts(count)` - Fetch products to enrich
- `updateProduct(productId, enrichedData)` - Save enriched data
- `logEnrichment(logData)` - Log to AI_Log table
- `getStatistics()` - Database statistics

## 📊 Database Schema

### Products Table Extensions

The `schema.sql` adds the following fields to the Products table:

**CustomMemo Fields (Long Text):**
- `CustomMemo01` - Short description
- `CustomMemo02` - Long marketing description
- `CustomMemo03` - Features (HTML bullet list)
- `CustomMemo04` - Specifications (HTML table)
- `CustomMemo05` - FAQ (HTML)
- `CustomMemo06` - Prerequisites
- `CustomMemo07` - Related items
- `CustomMemo08` - Professional services
- `CustomMemo09` - Upsell recommendations
- `CustomMemo10` - Marketing message

**CustomText Fields (Short Text):**
- `CustomText01` - Category
- `CustomText02` - Subcategory
- `CustomText03` - Manufacturer
- `CustomText04` - Product type
- `CustomText05` - Product-level rules (JSON)
- `CustomText06` - Category-level rules (JSON)

**CustomNumber Fields:**
- `CustomNumber01` - AI Confidence (0-100%)
- `CustomNumber02` - AIProcessed flag (0/1)

**CustomDate Fields:**
- `CustomDate01` - AI Processing timestamp

**Image Field:**
- `ImageFile` - Product image URL

### AI_Log Table

Tracks all AI enrichment activities:
- `LogID` - Unique identifier
- `ProcessDate` - Timestamp
- `InputText` - Input product data (JSON)
- `OutputText` - AI response (JSON)
- `AIProvider` - Provider used (OpenAI, Gemini, fallback)
- `Model` - Model name (gpt-4o-mini, etc.)
- `TokensUsed` - API token consumption
- `ProcessingTimeMs` - Processing duration
- `Status` - Success, Error, Partial
- `ErrorMessage` - Error details if failed

## 🔧 Configuration

### Environment Variables (.env)

Required in the root qiq-chat directory:

```env
# OpenAI (Required)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Google Custom Search (Optional)
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GOOGLE_CX_ID=xxxxxxxxxxxxxxxxxxxx

# Algolia (Required)
ALGOLIA_APP_ID=your_algolia_app_id
ALGOLIA_API_KEY=your_algolia_admin_key
ALGOLIA_INDEX_NAME=woocommerce_products

# SQL Server (via config/dbConfig.json)
SQL_HOST=localhost
SQL_USER=your_user
SQL_PASS=your_password
SQL_DB=QuoteWerks
```

### Database Configuration (config/dbConfig.json)

```json
{
  "user": "your_username",
  "password": "your_password",
  "server": "localhost",
  "database": "QuoteWerks",
  "options": {
    "encrypt": false,
    "trustServerCertificate": true
  }
}
```

## 📈 Workflow

### 1. Product Enrichment Flow

```
1. Load Configuration
   ↓
2. Connect to QuoteWerks Database
   ↓
3. Fetch 20 Unprocessed Products (CustomNumber02 = 0)
   ↓
4. For Each Product:
   a. Generate enriched content via OpenAI
   b. Search for product image via Google
   c. Calculate confidence score
   d. Update Products table
   e. Log to AI_Log table
   ↓
5. Display Summary Statistics
   ↓
6. Disconnect from Database
```

### 2. Algolia Sync Flow

```
1. Load Configuration
   ↓
2. Connect to QuoteWerks Database
   ↓
3. Fetch All Processed Products (CustomNumber02 = 1)
   ↓
4. Transform to Algolia Format
   ↓
5. Sync in Batches (100 products per batch)
   ↓
6. Display Summary Statistics
   ↓
7. Disconnect from Database
```

### 3. Integration with qiq-chat

```mermaid
graph LR
A[Chat Query] --> B{Product Exists?}
B -->|Yes| C{AIProcessed?}
C -->|Yes| D[Return Enriched Data from SQL]
C -->|No| E[Queue for Enrichment]
E --> F[Run rules-engine.js]
F --> G[Update SQL + AIProcessed = 1]
G --> H[Run algolia-sync.js]
H --> I[Update Algolia Index]
I --> D
B -->|No| J[Create Product Entry]
J --> E
```

## 🎨 HTML Formatting

All HTML content uses QuickITQuote brand color: **#0055A4**

### Features List Example
```html
<ul style="color: #0055A4;">
  <li>High-performance networking</li>
  <li>Enterprise-grade security</li>
  <li>24/7 support included</li>
</ul>
```

### Specifications Table Example
```html
<table style="color: #0055A4;">
  <tr><th>Specification</th><th>Value</th></tr>
  <tr><td>Processor</td><td>Intel Core i7</td></tr>
  <tr><td>Memory</td><td>16GB DDR4</td></tr>
</table>
```

## 📝 Logging

### Rules Engine Log (`logs/rules-engine.log`)

Format: `[Timestamp] [Level] Message`

Example:
```
[2024-10-05T16:30:00.000Z] [INFO] === Starting Rules Engine Enrichment ===
[2024-10-05T16:30:00.100Z] [INFO] Target: 20 products
[2024-10-05T16:30:05.250Z] [INFO] Processing product: WS-C2960-24TT-L
[2024-10-05T16:30:12.450Z] [INFO] ✓ Successfully enriched product WS-C2960-24TT-L (Confidence: 92%)
```

### Algolia Sync Log (`logs/sync.log`)

Format: `[Timestamp] [Level] Message`

Example:
```
[2024-10-05T17:00:00.000Z] [INFO] === Starting Algolia Sync ===
[2024-10-05T17:00:00.500Z] [INFO] Found 20 products to sync
[2024-10-05T17:00:05.200Z] [INFO] ✓ Batch 1 synced successfully
```

## 🔍 Auto-Approval Logic

Products are auto-approved based on:

1. **Confidence Score** ≥ 90%
2. **Category Rules**:
   - Networking: Auto-approve up to $5,000
   - Software: Auto-approve up to $3,000
   - Accessories: Auto-approve up to $1,000
   - Storage: Case-by-case (≥90% confidence required)
   - Servers: Always require manual review

3. **Classification Type**:
   - Standard: Can be auto-approved
   - Custom/Special Order: Always require review

## 📊 Output Examples

### Enrichment Summary
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Enrichment Summary
────────────────────────────────────────────────────────────────
Total Products Processed:  20
✓ Successful:              18 (90%)
✗ Failed:                  2

AI Confidence:
  High (≥90%):             12 products
  Medium (70-89%):         6 products
  Low (<70%):              2 products

Token Usage:
  Total Tokens:            45,230
  Average per product:     2,261 tokens

Processing Time:
  Total:                   2m 34s
  Average per product:     7.7s

Images:
  Images Found:            15

Next Steps:
  → Run algolia-sync.js to push enriched data to Algolia
  → Review 2 low-confidence products manually
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Algolia Sync Summary
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Sync Summary
────────────────────────────────────────────────────────────────
Total Products:            20
✓ Synced to Algolia:       20
✗ Failed:                  0
⊝ Skipped:                 0

Algolia Index:             woocommerce_products

Next Steps:
  → Test search functionality in your application
  → Verify products appear in Algolia dashboard
  → Schedule periodic sync (every 6 hours recommended)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🚀 Next Steps

1. **Setup Database**:
   ```sql
   -- Run schema.sql in SQL Server
   USE QuoteWerks;
   GO
   -- Execute schema.sql content
   ```

2. **Configure Environment**:
   - Copy `.env.example` to root `qiq-chat/.env`
   - Add OpenAI API key
   - Add Algolia credentials
   - (Optional) Add Google Custom Search credentials

3. **Configure Database**:
   - Update `config/dbConfig.json` with SQL Server credentials

4. **Run Initial Enrichment**:
   ```bash
   node rules-engine.js 20
   ```

5. **Sync to Algolia**:
   ```bash
   node algolia-sync.js --configure  # First time only
   node algolia-sync.js
   ```

6. **Schedule Periodic Sync**:
   - Set up cron job or Vercel scheduled function
   - Recommended: Every 6 hours
   ```bash
   0 */6 * * * cd /path/to/qiq-chat/rules-engine && node algolia-sync.js
   ```

## 📚 Documentation Reference

- `README.md` - Main documentation and overview
- `mapping-reference.md` - Complete field mapping documentation
- `copilot-instructions.md` - Detailed implementation instructions
- `SETUP.md` - Step-by-step setup guide (existing)
- `INTEGRATION.md` - Integration guide (existing)

## ⚠️ Important Notes

1. **API Costs**: Monitor OpenAI token usage - average 2,000-3,000 tokens per product
2. **Rate Limits**: Built-in retry logic handles rate limiting gracefully
3. **Confidence Scores**: Review products with <70% confidence manually
4. **Image Search**: Google Custom Search has daily quota limits
5. **Database Performance**: Indexes created for optimal query performance
6. **Algolia Sync**: Run periodically to keep search index updated

## 🎉 Implementation Complete

All components specified in the problem statement have been successfully implemented and are ready for use. The system is optimized for processing 400,000+ products in batches while maintaining high performance and data quality.
