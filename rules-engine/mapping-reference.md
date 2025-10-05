# Field Mapping Reference

This document provides a complete mapping of fields between QuoteWerks database and Algolia index, along with explanations of each column's purpose.

## QuoteWerks → Algolia Field Mapping

| Field Name | Source | Purpose | Data Type |
|------------|--------|---------|-----------|
| Description | QW | Main product description | NVARCHAR(MAX) |
| CustomMemo01 | QW | Short description (auto-filled if empty) | NVARCHAR(MAX) |
| CustomText01 | QW | Category / Family | NVARCHAR(255) |
| CustomText02 | QW | Subcategory | NVARCHAR(255) |
| CustomText03 | QW | Prerequisites | NVARCHAR(255) |
| CustomText04 | QW | Related Items / Accessories | NVARCHAR(255) |
| CustomText05 | QW | Professional Services Scope | NVARCHAR(255) |
| CustomText06 | QW | Product FAQ | NVARCHAR(255) |
| CustomText07 | QW | Main Features | NVARCHAR(255) |
| CustomText08 | QW | Specifications Table | NVARCHAR(255) |
| CustomText09 | QW | AI Rule (Product-level) | NVARCHAR(255) |
| CustomText10 | QW | AI Rule (Category-level) | NVARCHAR(255) |
| CustomNumber01 | QW | AI Confidence Score | FLOAT |
| CustomNumber02 | QW | AIProcessed Flag (0/1) | BIT |
| CustomMemo10 | QW | Marketing Message / Purchase Value | NVARCHAR(MAX) |
| CustomMemo09 | QW | Upsell / Bundle Suggestions | NVARCHAR(MAX) |
| CustomText11-20 | Expansion | Optional AI extensions | NVARCHAR(255) |
| ImageFile | QW | Product image URL | NVARCHAR(500) |
| PartNumber | QW | Manufacturer part number | NVARCHAR(200) |
| Manufacturer | QW | Product manufacturer | NVARCHAR(200) |
| Price | QW | Product price | DECIMAL(18,2) |

## Field Details

### Core Product Information
- **Description**: Full product description used for AI processing
- **CustomMemo01**: Shortened version for quick reference (auto-generated from Description if empty)
- **PartNumber**: Unique manufacturer part number
- **Manufacturer**: Product manufacturer/vendor name
- **Price**: Current product price

### Classification Fields
- **CustomText01**: Primary category (e.g., "Networking", "Storage")
- **CustomText02**: Secondary subcategory (e.g., "Switches", "NAS")
- **CustomText03**: Any prerequisites or requirements for installation/usage
- **CustomText04**: Related or complementary products

### AI-Enhanced Content
- **CustomText07**: AI-generated main features list
- **CustomText08**: AI-generated specifications table
- **CustomMemo10**: AI-generated marketing message explaining purchase value
- **CustomMemo09**: AI-generated upsell and bundle suggestions

### AI Rules & Metadata
- **CustomText09**: Product-specific AI rules for processing
- **CustomText10**: Category-level AI rules
- **CustomNumber01**: AI confidence score (0-100)
- **CustomNumber02**: Flag indicating whether AI processing completed

### Professional Services
- **CustomText05**: Scope of professional services required/available
- **CustomText06**: Frequently asked questions about the product

### Media
- **ImageFile**: URL to product image (auto-fetched from Google if empty)

### Extension Fields
- **CustomText11-20**: Reserved for future AI-powered extensions

## Image Selection Criteria

When fetching images from Google Custom Search:
1. Try first 8 image results
2. Select image with ≥78% white background
3. Fallback: Use `{Manufacturer}.jpg` if available
4. Store final URL in ImageFile field

## AI Processing Workflow

1. Read products where `CustomNumber02` (AIProcessed) = 0
2. Generate content for empty fields using OpenAI/Gemini
3. Fetch product image if `ImageFile` is empty
4. Update all fields with generated content
5. Set `CustomNumber02` = 1 (processed)
6. Set `CustomNumber01` = confidence score
7. Log processing in AI_Log table

## Algolia Sync Process

After AI processing:
1. Read all processed products (AIProcessed = 1)
2. Map fields to Algolia schema
3. Upload/update records in Algolia index
4. Log sync results in logs/sync.log
