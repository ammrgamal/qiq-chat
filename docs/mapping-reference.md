# SQL to Algolia Field Mapping Reference

This document defines the complete field mapping between QuoteWerks SQL Database and Algolia search index for the Rules Engine & AI Enrichment Module.

## Product Data Sources

### QuoteWerks SQL Database (Primary Source)
- **Table**: `Products` (main product catalog)
- **Enrichment Tables**: 
  - `AI_Log` - AI processing history
  - `Rules_Item` - Product classification and rules
  - `Product_Enrichment` - AI-generated enriched fields

### Algolia Index (Read-Only Mirror)
- **Index Name**: Configured via `ALGOLIA_INDEX` env variable
- **Sync Frequency**: Every 6 hours via cron/Vercel Job
- **Direction**: SQL → Algolia (one-way sync)

---

## Core Field Mappings

### Identity & SKU Fields

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `ID` | `objectID` | string | Stable unique identifier (fallback: InternalPartNumber) |
| `InternalPartNumber` | `sku` | string | Internal SKU |
| `ManufacturerPartNumber` | `mpn` | string | Manufacturer Part Number |
| `ProductName` | `name` | string | Clean product name |
| `Manufacturer` | `brand` | string | Manufacturer/brand name |
| `Category` | `category` | string | Product category |

### Pricing & Availability

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `UnitPrice` | `price` | number | Current selling price |
| `ListPrice` | `list_price` | number | MSRP/List price |
| `Cost` | `cost` | number | Dealer cost |
| `UnitOfMeasure` | `unit` | string | ea, box, pack, etc. |
| `Availability` | `availability` | enum | 1="Stock", 0="on back order" |
| `Availability` | `availability_weight` | number | For sorting (Stock=10, BackOrder=1) |
| `Discontinued` | `discontinued` | boolean | Product discontinuation status |

### Descriptions (Standard Fields)

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `ShortDescription` | `ShortDescription` | string | Brief product description |
| `ExtendedDescription` | `ExtendedDescription` | string | Truncated to ≤4KB |

### Custom Fields

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `CustomMemo01` to `CustomMemo05` | `custom_memo` | string[] | Split by newline, deduplicated |
| `CustomText01` to `CustomText20` | `custom_text` | string[] | Split by semicolon, deduplicated |
| `KeywordList` | `tags` | string[] | Comma-separated keywords |

### Media & Documents

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `ImagePath` | `image` | string | Normalized URL (replace `\` with `/`) |
| `SpecSheetPath` | `spec_sheet` | string | Normalized URL path |
| `ProductURL` | `link` | string | External product page |

### Metadata

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `LastModified` | `LastModified` | ISO string | Last update timestamp |

---

## AI-Enriched Fields

These fields are populated by the AI Enrichment Module and stored in the `Product_Enrichment` table.

### Enhanced Descriptions

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `AIShortDescription` | `ai_short_description` | string | Marketing-ready short description (150-200 chars) |
| `AILongDescription` | `ai_long_description` | string | Comprehensive product description with <span> styling |
| `AIFeatures` | `features` | string[] | Key product features (bullet points) |
| `AISpecsTable` | `specs` | object | Technical specifications {field: value} |

### Professional Services & Requirements

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `AIPrerequisites` | `prerequisites` | string[] | Installation/usage prerequisites |
| `AIServicesScope` | `services_scope` | string | Professional services description |
| `AIFAQ` | `faq` | object[] | [{question, answer}] |

### Product Intelligence

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `AIUpsells` | `upsells` | string[] | Recommended upsell products |
| `AIBundles` | `bundles` | string[] | Bundle suggestions |
| `AIValueStatement` | `value_statement` | string | Customer value proposition |
| `AIProductRules` | `product_rules` | string[] | Product-specific rules |
| `AICategoryRules` | `category_rules` | string[] | Category-level rules |

### AI Processing Metadata

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `AIProcessed` | `ai_processed` | boolean | Whether AI enrichment completed |
| `AIProcessedDate` | `ai_processed_date` | ISO string | Timestamp of last enrichment |
| `AIConfidence` | `ai_confidence` | number | Confidence score (0-100) |
| `AIProvider` | `ai_provider` | string | OpenAI, Gemini, etc. |

### Enhanced Images

| SQL Field | Algolia Field | Type | Notes |
|-----------|---------------|------|-------|
| `AIImageURL` | `ai_image` | string | Google Custom Search product image (white bg preferred) |
| `AIImageSource` | `ai_image_source` | string | Image source URL/attribution |

---

## Enrichment Process Flow

```
1. Detect Incomplete Product
   └─> Check AIProcessed flag = FALSE or NULL
   └─> Check missing: description, specs, category, etc.

2. AI Content Generation (OpenAI/Gemini)
   └─> Generate AIShortDescription (marketing copy)
   └─> Generate AILongDescription (with QuickITQuote blue styling)
   └─> Generate AISpecsTable (technical specifications)
   └─> Generate AIFeatures (key benefits)
   └─> Generate AIFAQ (common questions)
   └─> Generate AIPrerequisites (requirements)
   └─> Generate AIServicesScope (professional services)
   └─> Generate AIProductRules & AICategoryRules
   └─> Generate AIUpsells & AIBundles
   └─> Generate AIValueStatement

3. Image Enrichment (Google Custom Search API)
   └─> Query: "[brand] [model] product white background"
   └─> Filter: White background preference
   └─> Store: AIImageURL + AIImageSource

4. Confidence Scoring
   └─> Calculate overall confidence (0-100)
   └─> If confidence < 90% → flag for manual review
   └─> If confidence ≥ 90% → auto-approve (AIProcessed = TRUE)

5. SQL Database Update
   └─> Insert/Update Product_Enrichment table
   └─> Log to AI_Log table
   └─> Update timestamp and confidence

6. Algolia Sync
   └─> Run algolia-sync.js
   └─> Transform SQL → Algolia schema
   └─> Batch upload to Algolia index
   └─> Apply size limits (<10KB per record)
```

---

## Display Formatting Standards

### QuickITQuote Blue (#0055A4)
Use for highlighting key information in descriptions:

```html
<span style="color:#0055A4">highlighted text</span>
```

### Description Templates

**Short Description Format:**
```
[Product Name] - [Key Benefit]. [Primary Feature]. [Use Case].
```

**Long Description Format:**
```
<span style="color:#0055A4">Overview:</span> [Product description]

<span style="color:#0055A4">Key Features:</span>
• [Feature 1]
• [Feature 2]
• [Feature 3]

<span style="color:#0055A4">Specifications:</span>
[Technical details]

<span style="color:#0055A4">Ideal For:</span> [Target use cases]
```

---

## Data Quality & Validation

### Size Limits
- **Total Record Size**: ≤10KB
- **ExtendedDescription**: ≤4KB (truncate if needed)
- **Array Fields**: ≤50 items each
- **String Fields**: ≤2KB each

### URL Normalization
```javascript
// Normalize file paths
function normalizeFileUrl(path) {
  return path?.replace(/\\/g, '/') || '';
}
```

### Availability Mapping
```javascript
function mapAvailability(value) {
  return value === 1 ? 'Stock' : 'on back order';
}

function availabilityWeight(value) {
  return value === 1 ? 10 : 1;
}
```

---

## Algolia Search Configuration

### Searchable Attributes (Priority Order)
1. `sku`
2. `mpn`
3. `name`
4. `brand`
5. `category`
6. `custom_memo`
7. `custom_text`
8. `tags`
9. `features`
10. `ai_short_description`

### Faceting Attributes
- `brand`
- `category`
- `unit`
- `availability`
- `discontinued`
- `tags`
- `ai_processed`

### Custom Ranking
1. `desc(availability_weight)` - Stock items first
2. `asc(price)` - Lower price preferred
3. `desc(ai_confidence)` - Higher confidence first
4. `asc(name)` - Alphabetical

### Highlighting & Snippets
- **Snippet**: `ExtendedDescription:40`, `ai_long_description:40`
- **Highlight**: `sku`, `mpn`, `name`, `features`, `tags`

---

## Usage Examples

### Check if Product Needs Enrichment
```sql
SELECT * FROM Products 
WHERE AIProcessed IS NULL OR AIProcessed = 0
  AND (ShortDescription IS NULL OR ShortDescription = '')
LIMIT 100;
```

### Get Enriched Product for Chat
```sql
SELECT 
  p.*,
  pe.AIShortDescription,
  pe.AILongDescription,
  pe.AIFeatures,
  pe.AISpecsTable,
  pe.AIImageURL,
  pe.AIConfidence,
  pe.AIProcessed
FROM Products p
LEFT JOIN Product_Enrichment pe ON p.ID = pe.ProductID
WHERE p.ManufacturerPartNumber = @partNumber;
```

### Sync to Algolia
```javascript
// Transform SQL record to Algolia format
const algoliaRecord = {
  objectID: product.ManufacturerPartNumber || product.InternalPartNumber || product.ID,
  sku: product.InternalPartNumber,
  mpn: product.ManufacturerPartNumber,
  name: product.ProductName,
  brand: product.Manufacturer,
  category: product.Category,
  price: product.UnitPrice,
  availability: product.Availability === 1 ? 'Stock' : 'on back order',
  availability_weight: product.Availability === 1 ? 10 : 1,
  image: normalizeFileUrl(product.AIImageURL || product.ImagePath),
  features: product.AIFeatures ? JSON.parse(product.AIFeatures) : [],
  ai_short_description: product.AIShortDescription,
  ai_processed: product.AIProcessed,
  ai_confidence: product.AIConfidence,
  // ... additional fields
};
```

---

## Integration Points

### 1. Chat API Integration
When user asks about a product:
```javascript
// Check if enriched
if (product.AIProcessed) {
  return enrichedData;
} else {
  await fetch('/api/rules-engine/enrich', {
    method: 'POST',
    body: JSON.stringify({ productId: product.ID })
  });
}
```

### 2. Periodic Sync (Cron/Vercel Job)
```bash
# Run every 6 hours
0 */6 * * * node rules-engine/scripts/algolia-sync.js
```

### 3. Manual Enrichment
```bash
# Enrich specific product
node rules-engine/src/index.js --enrich --product-id=12345

# Batch enrich all incomplete
node rules-engine/src/index.js --enrich-batch --limit=100
```

---

## Related Documentation
- [Algolia Index Reference](./algolia_index_reference.md)
- [Rules Engine Setup](../rules-engine/SETUP.md)
- [Rules Engine Integration](../rules-engine/INTEGRATION.md)

---

**Last Updated**: 2025-01-08  
**Version**: 1.0.0  
**Maintained By**: QuickITQuote Development Team
