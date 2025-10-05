# Product Enrichment Workflow

## Overview

This document describes the complete workflow for AI-powered product enrichment and Algolia synchronization.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       QuoteWerks SQL Database                        │
│                         (Products Table)                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SELECT WHERE AIProcessed = 0
                                    │ (skip Test, Localization, Cost=0)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        rules-engine.js                               │
│                   Main Enrichment Orchestrator                       │
├─────────────────────────────────────────────────────────────────────┤
│  • Selects 20 random products                                        │
│  • Processes with concurrency limit (max 3)                          │
│  • Progress bar & logging                                            │
│  • Retry logic (up to 2 retries)                                     │
└─────────────────────────────────────────────────────────────────────┘
          │                      │                      │
          │                      │                      │
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  sql-helper.js   │  │  ai-helper.js    │  │ google-helper.js │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ • Fetch products │  │ • OpenAI API     │  │ • Image search   │
│ • Update results │  │ • Generate       │  │ • White BG detect│
│ • Log processing │  │   descriptions   │  │ • Fallback images│
└──────────────────┘  │ • Features, FAQ  │  └──────────────────┘
                      │ • Caching        │
                      │ • Confidence     │
                      └──────────────────┘
                                    │
                                    │ UPDATE Products SET
                                    │ AIProcessed=1, AIConfidence=XX
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       QuoteWerks SQL Database                        │
│                    (Products Table - Enriched)                       │
│                                                                       │
│  • ShortDescription, ExtendedDescription                             │
│  • CustomMemo01-05 (Features, Specs, FAQ, Marketing, Rules)         │
│  • CustomText01-20 (Bundle suggestions, etc.)                        │
│  • ImageFile (URL or {Manufacturer}.jpg)                             │
│  • KeywordList (AI-generated keywords)                               │
│  • AIProcessed = 1, AIConfidence = 0-100                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SELECT WHERE AIProcessed = 1
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         algolia-sync.js                              │
│                    Algolia Synchronization                           │
├─────────────────────────────────────────────────────────────────────┤
│  • Fetch enriched products                                           │
│  • Transform to Algolia schema                                       │
│  • Normalize URLs, truncate text                                     │
│  • Batch sync (100 records/batch)                                    │
│  • Replace/update existing records                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ saveObjects (batch)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Algolia Search Index                         │
│                      woocommerce_products                            │
│                                                                       │
│  objectID, sku, mpn, name, brand, category, price, image,           │
│  ShortDescription, ExtendedDescription, custom_memo, custom_text,   │
│  tags, availability, LastModified, _ai_confidence                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Detailed Flow

### Step 1: Product Selection

```sql
SELECT TOP 20 *
FROM dbo.Products
WHERE 
  ISNULL(AIProcessed, 0) = 0
  AND ProductName NOT LIKE '%Localization%'
  AND ProductName NOT LIKE '%Test%'
  AND ISNULL(Cost, 0) > 0
ORDER BY NEWID()
```

### Step 2: AI Enrichment

For each product:

1. **Generate Content** (OpenAI API)
   ```
   Input:
   - ProductName, MPN, Manufacturer
   - Current descriptions
   - Category, Price
   
   Output:
   - shortDescription (≤200 chars)
   - extendedDescription (≤4000 chars)
   - features (bullet list)
   - specifications (key:value)
   - faq (Q&A format)
   - marketingMessage (2-3 sentences)
   - rules (business rules)
   - bundleSuggestions (related products)
   - keywords (search terms)
   - confidence (0-100)
   ```

2. **Image Search** (Google Custom Search - Optional)
   ```
   If ImageFile is empty:
     - Search: "{Manufacturer} {ProductName} {MPN}"
     - Fetch first 8 images
     - Analyze for white background (≥78%)
     - Select best match
     - Fallback: {Manufacturer}.jpg
   ```

3. **Update Database**
   ```sql
   UPDATE dbo.Products
   SET 
     ShortDescription = @ShortDescription,
     ExtendedDescription = @ExtendedDescription,
     CustomMemo01 = @Features,
     CustomMemo02 = @Specifications,
     CustomMemo03 = @FAQ,
     CustomMemo04 = @MarketingMessage,
     CustomMemo05 = @Rules,
     CustomText01 = @BundleSuggestions,
     ImageFile = @ImageFile,
     KeywordList = @Keywords,
     AIProcessed = 1,
     AIConfidence = @Confidence,
     AIProcessedDate = GETDATE(),
     LastModified = GETDATE()
   WHERE ID = @ProductID
   ```

4. **Auto-Approval Decision**
   ```
   IF AIConfidence >= 90:
     → Auto-Approved ✓
   ELSE:
     → Requires Review ⚠
   ```

### Step 3: Logging

**File Logging** (`logs/rules-engine.log`):
```
[2024-01-01T12:00:00.000Z] [INFO] Processing product: Dell Laptop (ID: 123)
[2024-01-01T12:00:05.000Z] [SUCCESS] SUCCESS: Dell Laptop (Confidence: 95%, Auto-approve: true)
```

**Database Logging** (`AI_Log` table):
```sql
INSERT INTO dbo.AI_Log (ProcessDate, InputText, OutputText, AIProvider, Model, TokensUsed, ProcessingTimeMs, Status)
VALUES (GETDATE(), '{product data}', '{enrichment}', 'OpenAI', 'gpt-4o-mini', 850, 2500, 'Success')
```

### Step 4: Algolia Sync

1. **Fetch Enriched Products**
   ```sql
   SELECT * FROM dbo.Products WHERE ISNULL(AIProcessed, 0) = 1
   ```

2. **Transform to Algolia Schema**
   ```javascript
   {
     objectID: MPN || InternalPartNumber || `product-${ID}`,
     sku: objectID,
     mpn: ManufacturerPartNumber,
     name: ProductName,
     brand: Manufacturer,
     category: Category,
     price: parseFloat(Price),
     availability: Availability === 1 ? "Stock" : "on back order",
     image: normalizeFileUrl(ImageFile), // \ → /
     ShortDescription: truncate(ShortDescription, 500),
     ExtendedDescription: truncate(ExtendedDescription, 4000),
     custom_memo: [CustomMemo01, ...CustomMemo05].split().dedupe(),
     custom_text: [CustomText01, ...CustomText20].split().dedupe(),
     tags: KeywordList.split(','),
     LastModified: ISOString(LastModified),
     _ai_confidence: AIConfidence
   }
   ```

3. **Batch Sync to Algolia**
   ```javascript
   await index.saveObjects(records, {
     autoGenerateObjectIDIfNotExist: false
   });
   ```

## Concurrency & Rate Limiting

```
┌─────────────────────────────────────────────────────────────┐
│ Batch 1 (3 products)                                         │
├─────────────────────────────────────────────────────────────┤
│ Product A ─→ [AI] ─→ [Image] ─→ [DB Update] ┐              │
│ Product B ─→ [AI] ─→ [Image] ─→ [DB Update] ├─→ 500ms delay│
│ Product C ─→ [AI] ─→ [Image] ─→ [DB Update] ┘              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Batch 2 (3 products)                                         │
├─────────────────────────────────────────────────────────────┤
│ Product D ─→ [AI] ─→ [Image] ─→ [DB Update] ┐              │
│ Product E ─→ [AI] ─→ [Image] ─→ [DB Update] ├─→ 500ms delay│
│ Product F ─→ [AI] ─→ [Image] ─→ [DB Update] ┘              │
└─────────────────────────────────────────────────────────────┘
```

**Settings:**
- Max concurrent AI calls: 3
- Delay between batches: 500ms
- Retry attempts: 2
- Exponential backoff: 1s, 2s

## Error Handling

```
Product Processing:
├─ Try: AI Enrichment
│  ├─ Retry 1 (after 1s)
│  ├─ Retry 2 (after 2s)
│  └─ Fail: Log error, continue to next product
├─ Try: Image Search (optional)
│  └─ Fail: Use fallback {Manufacturer}.jpg
└─ Try: Database Update
   └─ Fail: Log error, mark as failed
```

## Performance Estimates

### AI Enrichment (20 products)
- **Time:** 40-60 seconds
- **Tokens:** 10,000-20,000 tokens
- **Cost:** ~$0.03-0.06 (gpt-4o-mini)
- **Concurrency:** 3 parallel requests

### Algolia Sync (1000 products)
- **Time:** 10-20 seconds
- **Batches:** 10 batches × 100 records
- **Delay:** 500ms between batches

### Full Pipeline (100 products)
- **Enrichment:** 3-5 minutes
- **Sync:** 10-20 seconds
- **Total:** ~3.5-5.5 minutes

## Scalability

For **400,000 products**:

### Strategy 1: Continuous Processing
```bash
# Run in background with nohup
nohup node rules-engine.js 100 >> enrichment.log 2>&1 &

# Cron job: every hour
0 * * * * cd /path/to/rules-engine && node rules-engine.js 100
```

### Strategy 2: Batch Script
```bash
#!/bin/bash
for i in {1..4000}; do
  echo "Processing batch $i of 4000"
  node rules-engine.js 100
  sleep 60  # Wait 1 minute
done
```

### Strategy 3: Multi-Instance
```bash
# Run 3 parallel instances (different servers/containers)
# Each processes different batches
# Total: 300 products per cycle
```

**Estimated Time for 400K products:**
- Single instance (100/batch, 3min/batch): ~20 days
- 3 parallel instances: ~7 days
- 10 parallel instances: ~2 days

## Monitoring

### Log Files
- `logs/rules-engine.log` - Enrichment logs
- `logs/algolia-sync.log` - Sync logs

### Database Queries
```sql
-- Check enrichment progress
SELECT 
  COUNT(*) as Total,
  SUM(CASE WHEN AIProcessed = 1 THEN 1 ELSE 0 END) as Enriched,
  AVG(AIConfidence) as AvgConfidence
FROM dbo.Products;

-- Recent AI processing
SELECT TOP 100 * FROM dbo.AI_Log ORDER BY ProcessDate DESC;

-- Failed enrichments
SELECT * FROM dbo.AI_Log WHERE Status = 'Error';
```

### Algolia Dashboard
- Monitor index size
- Check search analytics
- Review sync status

## Best Practices

1. **Start Small**: Test with 5-10 products first
2. **Monitor Costs**: Track OpenAI token usage
3. **Check Logs**: Review logs regularly for errors
4. **Backup Data**: Backup database before bulk enrichment
5. **Rate Limits**: Stay within API rate limits
6. **Quality Check**: Manually review first 20-50 enrichments
7. **Auto-Approval**: Verify confidence thresholds are appropriate
8. **Incremental Sync**: Sync enriched products in batches

---

**Last Updated:** 2024  
**Version:** 1.0.0
