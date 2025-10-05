# 📘 Mapping Reference (QuoteWerks ↔ Algolia)

This document defines the field mapping between QuoteWerks SQL Database and Algolia search index for product enrichment.

## Field Mapping Table

| Field Name | Source | Purpose |
|-------------|---------|---------|
| Description | QW | Main description |
| CustomMemo01 | QW | Short description |
| CustomMemo02 | QW | Long marketing description |
| CustomMemo03 | QW | Features (bullet list) |
| CustomMemo04 | QW | Specs table (HTML) |
| CustomMemo05 | QW | FAQ |
| CustomMemo06 | QW | Prerequisites |
| CustomMemo07 | QW | Related items / accessories |
| CustomMemo08 | QW | Professional services scope |
| CustomMemo09 | QW | Upsell / bundle recommendations |
| CustomMemo10 | QW | Marketing "Why buy this" value |
| CustomText01 | QW | Category |
| CustomText02 | QW | Subcategory |
| CustomText03 | QW | Manufacturer |
| CustomText04 | QW | Product type |
| CustomText05 | QW | Rules Engine (Product-level) |
| CustomText06 | QW | Rules Engine (Category-level) |
| CustomNumber01 | QW | AI Confidence (0–100%) |
| CustomNumber02 | QW | AIProcessed flag (0/1) |
| CustomDate01 | QW | AIProcessed Date |
| ImageFile | QW | Product image URL |
| Algolia._highlightResult | Algolia | Pre-rendered rich content |

## QuoteWerks Products Table Schema

The enrichment process updates these fields in the QuoteWerks SQL Database:

### Core Product Fields
- **ProductID** (INT, Primary Key) - Unique product identifier
- **PartNumber** (NVARCHAR(200)) - Product part/model number
- **Description** (NVARCHAR(MAX)) - Main product description
- **ManufacturerName** (NVARCHAR(200)) - Manufacturer name
- **Price** (DECIMAL(18,2)) - Product price

### Custom Memo Fields (Long Text)
- **CustomMemo01** - Short description (max 500 chars)
- **CustomMemo02** - Long marketing description
- **CustomMemo03** - Features bullet list (HTML)
- **CustomMemo04** - Specifications table (HTML)
- **CustomMemo05** - Frequently Asked Questions
- **CustomMemo06** - Prerequisites and requirements
- **CustomMemo07** - Related items and accessories
- **CustomMemo08** - Professional services scope
- **CustomMemo09** - Upsell and bundle recommendations
- **CustomMemo10** - Marketing value proposition

### Custom Text Fields (Short Text)
- **CustomText01** - Category classification
- **CustomText02** - Subcategory classification
- **CustomText03** - Manufacturer (standardized)
- **CustomText04** - Product type
- **CustomText05** - Product-level rules (JSON)
- **CustomText06** - Category-level rules (JSON)

### Custom Number Fields
- **CustomNumber01** - AI Confidence score (0-100)
- **CustomNumber02** - AIProcessed flag (0 or 1)

### Custom Date Fields
- **CustomDate01** - AI Processing timestamp

### Image Field
- **ImageFile** - Product image URL or filename

## Algolia Index Structure

The Algolia index mirrors the enriched QuoteWerks data with these searchable attributes:

### Primary Attributes
```json
{
  "objectID": "productId",
  "partNumber": "string",
  "description": "string",
  "manufacturerName": "string",
  "price": "number",
  "imageUrl": "string"
}
```

### Enriched Content Attributes
```json
{
  "shortDescription": "string",
  "longDescription": "string",
  "features": ["array", "of", "features"],
  "specifications": "html string",
  "faq": "html string",
  "prerequisites": "string",
  "relatedItems": ["array"],
  "professionalServices": "string",
  "upsellRecommendations": "string",
  "marketingMessage": "string"
}
```

### Classification Attributes
```json
{
  "category": "string",
  "subcategory": "string",
  "productType": "string",
  "manufacturer": "string"
}
```

### AI Metadata
```json
{
  "aiConfidence": "number (0-100)",
  "aiProcessed": "boolean",
  "aiProcessedDate": "timestamp",
  "rulesProduct": "json string",
  "rulesCategory": "json string"
}
```

## Data Flow

1. **Enrichment Flow**: QuoteWerks DB → AI Processing → Update QuoteWerks
2. **Sync Flow**: QuoteWerks DB → Read enriched data → Push to Algolia
3. **Search Flow**: User query → Algolia search → Return enriched results

## HTML Formatting Guidelines

### Features (CustomMemo03)
```html
<ul class="product-features">
  <li>Feature 1</li>
  <li>Feature 2</li>
  <li>Feature 3</li>
</ul>
```

### Specifications Table (CustomMemo04)
```html
<table class="product-specs" style="color: #0055A4;">
  <tr><th>Specification</th><th>Value</th></tr>
  <tr><td>Processor</td><td>Intel Core i7</td></tr>
  <tr><td>Memory</td><td>16GB DDR4</td></tr>
</table>
```

### FAQ (CustomMemo05)
```html
<div class="product-faq">
  <div class="faq-item">
    <h4>Q: Question here?</h4>
    <p>A: Answer here.</p>
  </div>
</div>
```

## QuickITQuote Brand Color

All HTML highlighting uses QuickITQuote Blue: **#0055A4**

## Notes

- All fields are nullable except ProductID and PartNumber
- AI confidence below 90% requires manual review
- Images default to `{ManufacturerName}.jpg` if not found
- Algolia index is read-only from QuoteWerks perspective
- Sync runs periodically (recommended: every 6 hours)
