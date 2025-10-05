# Algolia Sync Module

## Overview

The `algolia-sync.js` module provides a complete synchronization solution between QuoteWerks SQL database and Algolia search index. It fetches AI-processed products from the SQL database, transforms them according to the Algolia schema, and uploads them in batches with retry logic.

## Features

✅ **Algolia Connection Setup** - Reads credentials from environment variables  
✅ **SQL Fetch Function** - Connects to QuoteWerks SQL DB and fetches products where AIProcessed = 1  
✅ **Data Transformation** - Maps QuoteWerks fields to Algolia attributes with proper formatting  
✅ **Batch Sync with Retry** - Uploads products in 500-record batches with automatic retry (up to 2 attempts)  
✅ **Progress Tracking** - Live progress counter showing uploaded/total products  
✅ **Comprehensive Logging** - Appends to `/logs/sync.log` and creates summary reports  
✅ **Error Handling** - Graceful error handling with detailed error messages  

## Prerequisites

1. **Environment Variables** - Create a `.env` file in the project root with:
```env
# Algolia Configuration
ALGOLIA_APP_ID=your_app_id_here
ALGOLIA_API_KEY=your_api_key_here
ALGOLIA_INDEX_NAME=woocommerce_products
```

2. **Database Configuration** - Ensure `rules-engine/config/dbConfig.json` is configured with your SQL Server credentials:
```json
{
  "user": "YOUR_SQL_USER",
  "password": "YOUR_SQL_PASSWORD",
  "server": "localhost",
  "database": "QuoteWerksDB",
  "options": {
    "encrypt": false,
    "trustServerCertificate": true,
    "enableArithAbort": true
  }
}
```

3. **Dependencies** - Install required npm packages:
```bash
npm install
```

## Usage

### Run the Sync

```bash
npm run sync:algolia
```

Or directly:
```bash
node algolia-sync.js
```

### What Happens During Sync

1. **Initialization** - Connects to Algolia using credentials from `.env`
2. **Fetch Products** - Queries SQL database for products where `AIProcessed = 1`
3. **Transform Data** - Maps QuoteWerks fields to Algolia schema:
   - Creates stable `objectID` from MPN, Internal Part Number, or ID
   - Maps availability (1 → "Stock", 0 → "on back order")
   - Normalizes file URLs (replaces `\` with `/`)
   - Splits and deduplicates custom memo/text fields
   - Truncates long descriptions (ExtendedDescription ≤4k chars)
   - Extracts tags from KeywordList
4. **Batch Upload** - Uploads in 500-record batches with retry logic
5. **Logging** - Saves sync events and summary to `/logs/` directory

## Field Mapping

The module maps QuoteWerks fields to Algolia according to `docs/algolia_index_reference.md`:

| QuoteWerks Field | Algolia Field | Notes |
|------------------|---------------|-------|
| ID / ManufacturerPartNumber / InternalPartNumber | objectID | Stable unique identifier |
| ManufacturerPartNumber | mpn | Manufacturer part number |
| Description | name | Product name |
| Manufacturer | brand | Brand/manufacturer |
| Category | category | Product category |
| UnitOfMeasure | unit | Unit of measure |
| Availability | availability | "Stock" or "on back order" |
| Price | price | Current price |
| ListPrice | list_price | List price |
| Cost | cost | Product cost |
| ImageFile | image | Image URL (normalized) |
| SpecSheet | spec_sheet | Spec sheet URL (normalized) |
| ProductLink | link | Product link |
| ShortDescription | ShortDescription | Truncated to 500 chars |
| ExtendedDescription | ExtendedDescription | Truncated to 4000 chars |
| CustomMemo01-05 | custom_memo | Array (split & deduped) |
| CustomText01-20 | custom_text | Array (split & deduped) |
| KeywordList | tags | Array |
| Discontinued | Discontinued | Boolean |
| LastModified | LastModified | ISO timestamp |

## Performance

- **Optimized for Large Datasets** - Handles up to 400k products efficiently
- **Batch Size** - 500 records per batch to avoid API rate limits
- **Retry Logic** - Up to 2 retries per batch with exponential backoff
- **Progress Tracking** - Real-time progress bar shows completion percentage

## Logging

### Sync Log (`logs/sync.log`)
Appends timestamped events for each sync operation:
```
[2024-01-15T10:30:00.000Z] Algolia sync started
[2024-01-15T10:30:15.000Z] Sync completed: SUCCESS - 1500 synced, 0 failed
```

### Summary Log (`logs/sync-summary.log`)
JSON summary of the last sync:
```json
{
  "timestamp": "2024-01-15T10:30:15.000Z",
  "totalFetched": 1500,
  "totalSynced": 1500,
  "totalFailed": 0,
  "duration": "15.23s",
  "status": "SUCCESS"
}
```

## Error Handling

The module handles various error scenarios gracefully:

- **Missing Environment Variables** - Clear error message if Algolia credentials are missing
- **Database Connection Errors** - Detailed SQL connection error messages
- **Batch Upload Failures** - Retries failed batches up to 2 times
- **Partial Sync** - Continues processing even if some batches fail
- **Fatal Errors** - Logs errors and exits with proper status code

## Output Example

```
================================================================================
🔄 ALGOLIA SYNC STARTED
================================================================================

✅ Algolia client connected
   Index: woocommerce_products
📦 Connecting to QuoteWerks SQL database...
✅ Connected to SQL Server
🔍 Fetching products where AIProcessed = 1...
✅ Fetched 1500 products from database
🔌 Database connection closed
🔄 Transforming products for Algolia...
✅ Transformed 1500 products

📋 Sample product (first):
   objectID: ABC-123
   name: Network Switch 24-Port
   brand: Cisco
   price: $599.99
   availability: Stock

🚀 Starting Algolia sync...
📤 Progress: [1500/1500] 100% - Batch 3/3 ✓

================================================================================
📊 SYNC SUMMARY
================================================================================
Total Fetched:  1500
✅ Total Synced:   1500 (SUCCESS)
Duration:       15.23s
Timestamp:      2024-01-15T10:30:15.000Z
================================================================================

✨ Algolia Sync Complete
```

## Troubleshooting

### "ALGOLIA_APP_ID and ALGOLIA_API_KEY must be set"
- Ensure `.env` file exists in project root
- Check that `ALGOLIA_APP_ID` and `ALGOLIA_API_KEY` are set

### "Failed to load database configuration"
- Ensure `rules-engine/config/dbConfig.json` exists
- Verify the file contains valid JSON

### "Database connection failed"
- Check SQL Server credentials in `dbConfig.json`
- Ensure SQL Server is running and accessible
- Verify network connectivity to SQL Server

### "No products found with AIProcessed = 1"
- Run the rules-engine AI processing first
- Check that products have `AIProcessed = 1` in the database

## Related Documentation

- **Algolia Schema**: `docs/algolia_index_reference.md`
- **Database Service**: `rules-engine/src/dbService.js`
- **Index Schema TypeScript**: `src/search/indexSchema.ts`

## License

ISC - Part of the QuickITQuote project
