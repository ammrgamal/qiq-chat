# QuickITQuote — SQL to Algolia Mapping Reference

This document defines the complete mapping between QuoteWerks SQL Database fields and Algolia index fields for the Rules Engine & AI Enrichment Module.

## Overview

The Rules Engine enriches product data stored in QuoteWerks SQL DB using OpenAI/Google APIs, then syncs enhanced data to Algolia for optimized search and intelligent recommendations.

---

## Database Tables

### Primary Tables
- **Rules_Item** - Stores individual product rules and AI enrichment data
- **Rules_Category** - Stores category definitions and approval rules
- **AI_Log** - Stores AI processing logs and metadata

---

## SQL to Algolia Field Mapping

### Core Product Fields

| SQL Field (Rules_Item)    | Algolia Field       | Type      | Notes                                    |
|---------------------------|---------------------|-----------|------------------------------------------|
| PartNumber                | objectID            | string    | Primary unique identifier                |
| PartNumber                | sku                 | string    | Same as objectID                         |
| PartNumber                | mpn                 | string    | Manufacturer Part Number                 |
| ProductName               | name                | string    | Product name                             |
| Manufacturer              | brand               | string    | Manufacturer/brand name                  |
| Category                  | category            | string    | Main product category                    |
| SubCategory               | subcategory         | string    | Product subcategory                      |
| MinPrice                  | price               | number    | Current/minimum price                    |
| MaxPrice                  | list_price          | number    | Maximum/list price                       |

### AI Enrichment Fields

| SQL Field (Rules_Item)    | Algolia Field       | Type      | Notes                                    |
|---------------------------|---------------------|-----------|------------------------------------------|
| ShortDescription          | ShortDescription    | string    | AI-generated marketing description (≤500 chars) |
| LongDescription           | ExtendedDescription | string    | AI-generated detailed description (≤4000 chars) |
| TechnicalSpecs            | specs               | object    | JSON: technical specifications table     |
| KeyFeatures               | features            | string[]  | JSON array: key product features         |
| FAQ                       | faq                 | object[]  | JSON array: [{q: "", a: ""}]            |
| Prerequisites             | prerequisites       | string[]  | JSON array: prerequisite notes           |
| ProfessionalServices      | services            | object    | JSON: {scope, description, estimatedHours} |
| ProductImage              | image               | string    | URL to product image (white background)  |
| UpsellSuggestions         | upsells             | string[]  | JSON array: suggested upsell products    |
| BundleSuggestions         | bundles             | string[]  | JSON array: suggested bundle products    |
| CustomerValue             | value_statement     | string    | Customer value proposition               |

### Metadata & Status Fields

| SQL Field (Rules_Item)    | Algolia Field       | Type      | Notes                                    |
|---------------------------|---------------------|-----------|------------------------------------------|
| Keywords                  | tags                | string[]  | Split comma-separated to array           |
| AIProcessed               | ai_processed        | boolean   | Whether AI enrichment is complete        |
| AIProcessedDate           | ai_processed_date   | ISO string| When AI enrichment occurred              |
| Confidence                | classification_confidence | number | Classification confidence (0-100)   |
| EnrichmentConfidence      | enrichment_confidence | number  | Enrichment quality confidence (0-100)    |
| AutoApprove               | auto_approve        | boolean   | Whether auto-approval is enabled         |
| Classification            | classification_type | string    | Standard/Custom/Special Order            |
| LeadTimeDays              | lead_time_days      | number    | Estimated lead time                      |
| ModifiedDate              | LastModified        | ISO string| Last modification timestamp              |
| IsActive                  | Discontinued        | boolean   | Inverted: !IsActive → Discontinued       |

### Derived/Computed Fields

| Computed Logic            | Algolia Field       | Type      | Notes                                    |
|---------------------------|---------------------|-----------|------------------------------------------|
| Based on IsActive         | availability        | enum      | IsActive=1 → "Stock", else "on back order" |
| Based on availability     | availability_weight | number    | Stock=100, back order=50                 |
| N/A (placeholder)         | unit                | string    | Default: "EA" (Each)                     |
| N/A (placeholder)         | cost                | number    | Internal cost (if available)             |
| N/A (placeholder)         | spec_sheet          | string    | URL to spec sheet PDF                    |
| N/A (placeholder)         | link                | string    | Product detail page URL                  |

---

## JSON Field Structures

### TechnicalSpecs (specs)
```json
{
  "Processor": "Intel Xeon Gold 6248",
  "RAM": "128GB DDR4",
  "Storage": "2x 1TB NVMe SSD",
  "Network": "4x 10GbE ports",
  "Power": "Redundant 800W PSU"
}
```

### KeyFeatures (features)
```json
[
  "Enterprise-grade reliability",
  "Hot-swappable components",
  "Advanced security features",
  "5-year warranty included"
]
```

### FAQ (faq)
```json
[
  {
    "question": "What is the warranty period?",
    "answer": "This product includes a 5-year manufacturer warranty."
  },
  {
    "question": "Is installation included?",
    "answer": "Professional installation services are available as an add-on."
  }
]
```

### ProfessionalServices (services)
```json
{
  "scope": "Installation, configuration, and knowledge transfer",
  "description": "Complete setup including rack mounting, cabling, OS installation, and 2-hour training session",
  "estimatedHours": 8,
  "recommendedTier": "Advanced"
}
```

### UpsellSuggestions (upsells)
```json
[
  "Extended 7-year warranty (WR-7Y-001)",
  "24/7 Premium support package (SP-247-001)",
  "Advanced monitoring suite (MON-ADV-001)"
]
```

### BundleSuggestions (bundles)
```json
[
  "Rack mount kit (RK-UNIV-001)",
  "UPS backup system (UPS-3000VA-001)",
  "Network cable bundle (CAT6-25FT-10)"
]
```

---

## Algolia Index Settings

### Searchable Attributes (Priority Order)
```javascript
[
  "sku",
  "mpn", 
  "name",
  "brand",
  "category",
  "tags",
  "ShortDescription",
  "ExtendedDescription",
  "features"
]
```

### Attributes for Faceting
```javascript
[
  "brand",
  "category",
  "subcategory",
  "unit",
  "availability",
  "auto_approve",
  "classification_type",
  "Discontinued",
  "tags"
]
```

### Custom Ranking
```javascript
[
  "desc(availability_weight)",  // Stock items first
  "desc(enrichment_confidence)", // Higher quality enrichment first
  "asc(price)",                  // Lower price first
  "desc(classification_confidence)", // Better classifications first
  "asc(name)"                    // Alphabetical
]
```

### Attributes to Retrieve
```javascript
[
  "objectID", "sku", "mpn", "name", "brand", "category", "subcategory",
  "unit", "availability", "availability_weight", "price", "list_price", 
  "cost", "image", "spec_sheet", "link", "tags", "ShortDescription",
  "ExtendedDescription", "specs", "features", "faq", "upsells", "bundles",
  "value_statement", "auto_approve", "ai_processed", "lead_time_days"
]
```

---

## Data Transformation Rules

### 1. Record Size Limits
- **Maximum record size**: 10KB
- **ShortDescription**: Truncate to 500 characters
- **ExtendedDescription**: Truncate to 4000 characters
- **Arrays (features, tags)**: Limit to 20 items max

### 2. URL Normalization
- Replace backslashes (`\`) with forward slashes (`/`)
- Do NOT URL-encode spaces in file paths
- Ensure URLs start with `http://` or `https://`

### 3. Date Formatting
- Convert SQL DATETIME to ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Use UTC timezone

### 4. Boolean Conversions
- SQL BIT (1/0) → JavaScript boolean (true/false)
- IsActive inverted for Discontinued: `Discontinued = !IsActive`

### 5. String Array Splitting
- Keywords: Split by comma, trim whitespace, remove empties
- Max 50 tags per product

### 6. Availability Mapping
```javascript
if (IsActive === 1) {
  availability = "Stock"
  availability_weight = 100
} else {
  availability = "on back order"
  availability_weight = 50
}
```

### 7. Confidence Thresholds
- **Auto-Approval**: EnrichmentConfidence ≥ 90%
- **Manual Review**: EnrichmentConfidence < 90%
- **Classification**: Confidence ≥ 70% for auto-approval

---

## AI Enrichment Process

### 1. Detection Phase
Check for missing/incomplete fields:
- ShortDescription is NULL or empty
- LongDescription is NULL or empty
- TechnicalSpecs is NULL
- ProductImage is NULL
- AIProcessed = FALSE

### 2. Enrichment Phase
For each product needing enrichment:

1. **Generate Descriptions** (OpenAI/Gemini)
   - Short description (marketing-ready, 100-500 chars)
   - Long description (detailed, 500-4000 chars)

2. **Generate Technical Data**
   - Technical specifications table
   - Key features list (5-10 items)
   - FAQ (3-5 Q&A pairs)
   - Prerequisites/requirements

3. **Generate Business Data**
   - Professional services scope
   - Upsell suggestions (3-5 items)
   - Bundle suggestions (3-5 items)
   - Customer value statement

4. **Fetch Product Image** (Google Custom Search)
   - Search for product by name + part number
   - Filter for white background images
   - Verify image URL accessibility
   - Fallback to placeholder if not found

### 3. Validation Phase
- Verify all JSON fields are valid
- Check field length constraints
- Validate URL accessibility
- Calculate enrichment confidence score

### 4. Update Phase
- Update Rules_Item with all enriched fields
- Set AIProcessed = TRUE
- Set AIProcessedDate = GETDATE()
- Log to AI_Log table

---

## Sync to Algolia

### Sync Frequency
- **Initial sync**: Full export on first run
- **Incremental sync**: Every 6 hours via cron/Vercel Job
- **Real-time sync**: On enrichment completion (optional)

### Sync Process (algolia-sync.js)

```javascript
// 1. Query products where AIProcessed = TRUE AND (LastModified > LastSync OR AIProcessedDate > LastSync)
// 2. Transform SQL records to Algolia format
// 3. Apply size guards and normalization
// 4. Batch upload to Algolia (max 1000 records per batch)
// 5. Update sync timestamp
```

### Error Handling
- Retry failed uploads (max 3 attempts)
- Log sync errors to AI_Log
- Send alert if >10% of records fail
- Continue sync despite individual failures

---

## Logging Requirements

Every enrichment operation must log:

| Log Field          | Description                                      |
|--------------------|--------------------------------------------------|
| ProductID          | PartNumber of enriched product                   |
| Timestamp          | ISO 8601 timestamp of enrichment                 |
| ConfidenceLevel    | Overall enrichment confidence (0-100)            |
| FieldsEnriched     | JSON array of field names enriched               |
| AIProvider         | "OpenAI", "Gemini", or "fallback"                |
| Model              | Model name used (e.g., "gpt-4o-mini")           |
| TokensUsed         | OpenAI completion tokens                         |
| ProcessingTimeMs   | Total processing time in milliseconds            |
| Status             | "Success", "Partial", "Error"                    |
| ErrorDetails       | Error message if Status = "Error"                |

---

## QuickITQuote Blue Styling

For rich display in Algolia index, use brand colors:

```html
<span style="color:#0055A4">QuickITQuote Blue Text</span>
<span style="color:#FFD700">Gold Accent Text</span>
```

Apply to:
- Category headers in descriptions
- Feature highlights
- Value statements

---

## Notes

1. All code should use canonical field names from `src/search/indexSchema.ts`
2. Apply size guards and normalization before sync
3. Test enrichment on 10-20 products before full rollout
4. Monitor token usage to control costs
5. Keep sync logs for audit trail
6. Algolia is read-only mirror (no writes back to SQL)
7. SQL is source of truth for all data

---

**Last Updated**: 2024  
**Version**: 1.0.0  
**Related Documents**: algolia_index_reference.md, INTEGRATION.md
