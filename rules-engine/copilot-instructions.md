# 🤖 GitHub Copilot Instructions — Rules Engine Product Enrichment

This document provides instructions for GitHub Copilot to generate the complete Rules Engine enrichment logic.

## Overview

Generate a Node.js script that enriches product data from QuoteWerks SQL Database using AI (OpenAI and Google APIs), then syncs the enriched data to Algolia for optimized search.

## Core Requirements

### 1. Database Connection
- Connect to QuoteWerks SQL Server database using `mssql` package
- Load configuration from `config/dbConfig.json`
- Use connection pooling for efficiency
- Handle connection errors gracefully

### 2. Product Selection
- Query 20 random unprocessed products where `AIProcessed = 0` or `CustomNumber02 = 0`
- Prioritize products with empty or minimal description fields
- Select from the Products table
- Order by random for variety

### 3. Field Detection
For each product, detect which fields are empty or need enrichment:
- Check if `Description` is empty or too short (< 50 chars)
- Check if `CustomMemo01` through `CustomMemo10` are empty
- Check if `CustomText01` through `CustomText06` are empty
- Check if `ImageFile` is empty or missing

### 4. AI Enrichment (OpenAI)

Use OpenAI API to generate:

#### Short Description (CustomMemo01)
- Max 500 characters
- Concise product summary
- Include key benefits

#### Long Marketing Description (CustomMemo02)
- Detailed product overview
- Marketing language
- Value proposition
- Use cases and benefits

#### Features List (CustomMemo03)
- Generate 5-8 key features
- Format as HTML bullet list
- Use QuickITQuote Blue (#0055A4) for styling

#### Specifications Table (CustomMemo04)
- Generate relevant technical specifications
- Format as HTML table
- Include headers: Specification | Value
- Style with QuickITQuote Blue (#0055A4)

#### FAQ (CustomMemo05)
- Generate 3-5 frequently asked questions
- Include both questions and answers
- Format as HTML with proper structure

#### Prerequisites (CustomMemo06)
- List system requirements
- Compatibility requirements
- Installation prerequisites

#### Related Items (CustomMemo07)
- Suggest complementary products
- Accessories and add-ons
- Compatible items

#### Professional Services (CustomMemo08)
- Installation services scope
- Setup and configuration
- Training and support options

#### Upsell Recommendations (CustomMemo09)
- Higher-tier alternatives
- Bundle opportunities
- Upgrade paths

#### Marketing Message (CustomMemo10)
- "Why buy this" statement
- Value proposition
- Competitive advantages

#### Category Classification (CustomText01, CustomText02)
- Main category
- Subcategory
- Product type (CustomText04)

#### Rules Engine (CustomText05, CustomText06)
- Product-level rules (JSON format)
- Category-level rules (JSON format)
- Include pricing thresholds
- Auto-approval criteria

### 5. Image Search (Google Custom Search API)

If `ImageFile` is empty:
1. Search for product images using Google Custom Search API
2. Query: `{PartNumber} {ManufacturerName} product`
3. Try first 8 image results
4. For each image:
   - Download and analyze background color
   - Calculate white background percentage
   - Select image with ≥78% white background
5. If no suitable image found:
   - Fallback to `{ManufacturerName}.jpg`
   - Log the fallback for manual review

### 6. Confidence Scoring

Calculate AI confidence score (0-100%) based on:
- API response quality
- Field completeness
- Data consistency
- Model confidence scores

Store in `CustomNumber01`

### 7. Database Update

Update the Products table with:
```sql
UPDATE Products SET
  Description = @description,
  CustomMemo01 = @shortDesc,
  CustomMemo02 = @longDesc,
  CustomMemo03 = @features,
  CustomMemo04 = @specs,
  CustomMemo05 = @faq,
  CustomMemo06 = @prerequisites,
  CustomMemo07 = @relatedItems,
  CustomMemo08 = @professionalServices,
  CustomMemo09 = @upsellRecommendations,
  CustomMemo10 = @marketingMessage,
  CustomText01 = @category,
  CustomText02 = @subcategory,
  CustomText03 = @manufacturer,
  CustomText04 = @productType,
  CustomText05 = @rulesProduct,
  CustomText06 = @rulesCategory,
  CustomNumber01 = @confidence,
  CustomNumber02 = 1,
  CustomDate01 = GETDATE(),
  ImageFile = @imageUrl
WHERE ProductID = @productId
```

### 8. Logging

Write detailed logs to `logs/rules-engine.log`:
- Timestamp
- Product ID and Part Number
- Fields processed
- AI confidence score
- Token usage
- Processing time
- Success/error status

### 9. Progress Display

Show real-time progress with:
- Progress bar (0-100%)
- Current product being processed
- Products completed / total
- Estimated time remaining
- Current operation status

### 10. API Optimization

- Cache OpenAI responses to avoid duplicate calls
- Batch similar prompts when possible
- Use appropriate model (gpt-4o-mini for cost efficiency)
- Implement retry logic with exponential backoff
- Rate limit API calls to avoid throttling

### 11. Error Handling

- Continue processing other products if one fails
- Log all errors with context
- Mark failed products for manual review
- Don't mark as processed if enrichment fails

### 12. Output Summary

After processing all products, display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Enrichment Summary
────────────────────────────────────────────────
Total Products Processed:  20
✓ Successful:             18 (90%)
✗ Failed:                 2

AI Confidence:
  High (≥90%):            12 products
  Medium (70-89%):        6 products
  Low (<70%):             2 products

Token Usage:
  Total Tokens:           45,230
  Average per product:    2,261 tokens

Processing Time:
  Total:                  2m 34s
  Average per product:    7.7s

Fields Enriched:
  Descriptions:           20
  Features:               20
  Specs:                  20
  FAQs:                   18
  Images:                 15

Next Steps:
  → Run algolia-sync.js to push to Algolia
  → Review 2 low-confidence products manually
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Implementation Guidelines

1. Use ES6 modules (`import`/`export`)
2. Use async/await for all async operations
3. Implement proper error handling and logging
4. Use environment variables for all API keys
5. Make code modular and reusable
6. Add helpful comments for complex logic
7. Follow existing code style in the repository
8. Optimize for 400,000+ products (though processing in batches)

## Reference Files

- `mapping-reference.md` - Field mapping documentation
- `utils/ai-helper.js` - OpenAI helper functions
- `utils/google-helper.js` - Google Search helper functions
- `utils/sql-helper.js` - SQL helper functions
- `.env` (in root) - API keys and configuration

## OpenAI Prompt Structure

Use structured prompts like:
```
You are a product data enrichment specialist for an IT products distributor.

Product Information:
- Part Number: {partNumber}
- Manufacturer: {manufacturer}
- Current Description: {description}
- Price: {price}

Task: Generate a comprehensive {fieldName} for this product.

Requirements:
- Professional tone
- Technically accurate
- Marketing-focused where appropriate
- Format: {format (HTML/JSON/plain text)}

Output:
```

## Google Image Search Query Format

```
{partNumber} {manufacturer} product white background
```

Additional parameters:
- searchType: image
- imgSize: large
- imgType: photo
- num: 8

## Auto-Approval Logic

Products with confidence ≥90% are auto-approved for:
- Standard categories (Networking, Software, Accessories)
- Products under category auto-approval limits
- Complete enrichment (all required fields filled)

Products requiring review:
- Confidence <90%
- Custom or special order classifications
- High-value items (>$10,000)
- Server and storage categories
