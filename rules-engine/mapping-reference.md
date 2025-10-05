# QuoteWerks Product Field Mapping Reference

This document defines the field mappings between OpenAI enrichment data, product sources, and QuoteWerks database fields.

## Product Input Fields (from QuoteWerks)

| Source Field | Type | Description |
|-------------|------|-------------|
| ProductName | string | Product name |
| ManufacturerPartNumber | string | Part number / SKU |
| Manufacturer | string | Brand/manufacturer name |
| Category | string | Product category |
| Description | string | Product description |
| Cost | decimal | Product cost (skip if 0) |
| ImageFile | string | Image file path/URL |
| UnitOfMeasure | string | Unit (skip if "localization" or "base unit") |

## Skip Conditions

Products should be skipped if any of these conditions are met:
- `Cost = 0` or null
- `ProductName` contains "localization" (case-insensitive)
- `ProductName` contains "base unit" (case-insensitive)
- `UnitOfMeasure` contains "localization" (case-insensitive)
- `UnitOfMeasure` contains "base unit" (case-insensitive)

## OpenAI Enrichment Output Fields

The AI enrichment should return an object with the following fields:

| Field | Type | Description | Max Length |
|-------|------|-------------|------------|
| description | string | Enhanced product description | 2000 chars |
| features | array | Key product features (bullet points) | 10 items |
| specs | object | Technical specifications | - |
| faq | array | Frequently asked questions | 5 items |
| marketingMessage | string | Marketing copy | 500 chars |
| rulesProduct | string | Product classification rule | 200 chars |
| rulesCategory | string | Category classification | 200 chars |
| bundleSuggestion | array | Suggested bundle products | 5 items |
| confidenceScore | number | AI confidence (0-100) | - |

## QuoteWerks Update Fields

After enrichment, update the following fields in QuoteWerks database:

| QuoteWerks Field | Source | Type | Notes |
|-----------------|--------|------|-------|
| EnhancedDescription | description | NVARCHAR(MAX) | AI-generated description |
| ProductFeatures | features | NVARCHAR(MAX) | JSON array of features |
| TechnicalSpecs | specs | NVARCHAR(MAX) | JSON object of specs |
| FAQ | faq | NVARCHAR(MAX) | JSON array of Q&A pairs |
| MarketingText | marketingMessage | NVARCHAR(1000) | Marketing copy |
| CategoryRule | rulesCategory | NVARCHAR(200) | Category classification |
| ProductRule | rulesProduct | NVARCHAR(200) | Product-specific rule |
| BundleSuggestions | bundleSuggestion | NVARCHAR(MAX) | JSON array of bundle items |
| ImageFile | fetchProductImage() | NVARCHAR(500) | Image URL/path |
| AIProcessed | - | BIT | Set to 1 after processing |
| AIProcessedDate | - | DATETIME | CURRENT_TIMESTAMP |
| AIConfidence | confidenceScore | DECIMAL(5,2) | Confidence score |

## Google Custom Search Fields

When fetching product images:

| Parameter | Description |
|-----------|-------------|
| GOOGLE_API_KEY | Google API key from env |
| GOOGLE_CX_ID | Custom Search Engine ID from env |
| searchQuery | "{Manufacturer} {ProductName}" |
| imageType | "photo" |
| num | 8 (fetch top 8 results) |

### Image Selection Criteria

1. Calculate white background ratio for each image
2. Select image with **≥78% white background**
3. If no image meets threshold → fallback to `{Manufacturer}.jpg`
4. Cache results to minimize API calls

## Database Tables

### AI Processing Log

Log to `AI_Log` table after each enrichment:

```sql
INSERT INTO AI_Log (
    ProcessDate,
    InputText,
    OutputText,
    AIProvider,
    Model,
    TokensUsed,
    ProcessingTimeMs,
    Status,
    ErrorMessage,
    Metadata
) VALUES (...)
```

### Product Rules

Update or insert into `Rules_Item` table:

```sql
INSERT INTO Rules_Item (
    ProductName,
    PartNumber,
    Manufacturer,
    Category,
    SubCategory,
    Classification,
    AutoApprove,
    MinPrice,
    MaxPrice,
    AIGenerated,
    Confidence,
    Notes
) VALUES (...)
```

## OpenAI Prompt Structure

```
You are a product data enrichment specialist for IT products.

Product Information:
- Name: {ProductName}
- Manufacturer: {Manufacturer}
- Category: {Category}
- Description: {Description}

Please provide:
1. Enhanced description (2000 chars max)
2. Key features (10 max)
3. Technical specifications (key-value pairs)
4. FAQ (5 common questions)
5. Marketing message (500 chars)
6. Product classification rule
7. Category classification
8. Bundle suggestions (5 related products)
9. Confidence score (0-100)

Return as JSON object with fields: description, features, specs, faq, marketingMessage, rulesProduct, rulesCategory, bundleSuggestion, confidenceScore
```

## Error Handling

### Retry Logic
- Retry failed OpenAI API calls up to **2 times**
- Wait 2 seconds between retries
- Log all errors with timestamp

### Logging Requirements
- All API calls → log to `/logs/rules-engine.log`
- Include timestamp, product ID, status
- Color coding: green (success), yellow (skipped), red (error)

## Example Flow

```javascript
// 1. Fetch product from database
const product = await getProduct(productId);

// 2. Check skip conditions
if (product.Cost === 0 || product.ProductName.includes('localization')) {
  logProgress('Skipped: ' + product.ProductName);
  return;
}

// 3. Enrich with OpenAI
const enriched = await enrichProductData(product);

// 4. Fetch image if needed
if (!product.ImageFile) {
  enriched.imageUrl = await fetchProductImage(product);
}

// 5. Update database
await updateSQLRecord(product.ID, enriched);

// 6. Log success
logProgress('Processed: ' + product.ProductName);
```

## Concurrency Settings

- **Batch size**: 20 products per run
- **Concurrent requests**: 3 max (to avoid API rate limits)
- **Timeout**: 30 seconds per product
- **Selection**: Random WHERE AIProcessed = 0

## Progress Tracking

Display live progress bar with:
- Current product name
- Progress percentage
- Success/fail/skip counts
- Estimated time remaining

---

**Last Updated**: 2024
**Purpose**: Rules engine product enrichment
