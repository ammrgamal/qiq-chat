# Canonical Data Model for Enrichment and Search

This document defines the QIQ_* extension fields added to QuoteWerks product tables (dbo.Products_%_Products) to store AI-enriched content in a structured, scalable way and to power Algolia search and the assistant.

## Goals
- Keep enrichment outputs structured (JSON where applicable)
- Avoid collisions with CustomMemo*/CustomText* legacy fields
- Prefer QIQ_* in pipelines; fallback to legacy when absent
- Make URLs deterministic using R2 base paths

## QIQ_* Fields
- QIQ_ShortDescription: NVARCHAR(MAX) – 1-3 lines marketing summary
- QIQ_FeaturesJSON: NVARCHAR(MAX) – JSON array of features [{title, detail?} | string]
- QIQ_SpecsJSON: NVARCHAR(MAX) – JSON object or array of spec key/values
- QIQ_FAQJSON: NVARCHAR(MAX) – JSON array of {q, a}
- QIQ_ValueStatement: NVARCHAR(MAX) – Why buy / value proposition
- QIQ_UseCasesJSON: NVARCHAR(MAX) – JSON array of strings or {title, detail}
- QIQ_ComplianceTagsJSON: NVARCHAR(MAX) – JSON array of strings (e.g., ISO27001)
- QIQ_ProductRules: NVARCHAR(MAX) – Text/JSON rules for product quoting
- QIQ_CategoryRules: NVARCHAR(MAX) – Text/JSON rules for category quoting
- QIQ_ScopeOfWork: NVARCHAR(MAX) – Text scope-of-work notes
- QIQ_Tags: NVARCHAR(500) – Comma-separated tags
- QIQ_SEOKeywords: NVARCHAR(500) – Comma-separated keywords
- QIQ_ImagePath: NVARCHAR(500) – Relative path or absolute URL
- QIQ_SpecSheetPath: NVARCHAR(500) – Relative path or absolute URL
- QIQ_Processed: BIT – Flag set when enrichment finished
- QIQ_ProcessedAt: DATETIME2 – Timestamp when enrichment finished
- QIQ_AIConfidence: DECIMAL(5,2) – Confidence (0-100)
- QIQ_AIVersion: NVARCHAR(50) – Model/version used
- QIQ_DataQualityScore: INT – Internal score for data completeness
- QIQ_RiskScore: INT – Internal risk rating

## Algolia Mapping
Algolia sync prefers QIQ_* fields, then falls back to legacy fields:
- short_description ← QIQ_ShortDescription | CustomMemo01
- features ← QIQ_FeaturesJSON (parsed JSON) | CustomMemo02 (string)
- specs ← QIQ_SpecsJSON (parsed JSON) | CustomMemo03 (string)
- faq ← QIQ_FAQJSON (parsed JSON) | CustomMemo04 (string)
- why_buy ← QIQ_ValueStatement | CustomMemo05
- product_rules ← QIQ_ProductRules | CustomText09
- category_rules ← QIQ_CategoryRules | CustomText10
- scope ← QIQ_ScopeOfWork | CustomText13
- processed_at ← QIQ_ProcessedAt | CustomText12
- ai_confidence ← QIQ_AIConfidence | CustomNumber03
- tags ← QIQ_Tags | CustomText03
- seo_keywords ← QIQ_SEOKeywords | CustomText04
- image resolution prioritizes QIQ_ImagePath/CustomText05/PictureFileName with R2_IMAGES_BASE
- datasheet resolution prioritizes QIQ_SpecSheetPath/CustomText06 with R2_SPECS_BASE

## URL Construction
Set env:
- R2_IMAGES_BASE – e.g., https://cdn.example.com/Products Images
- R2_SPECS_BASE – e.g., https://cdn.example.com/Spec Sheets

Spaces are percent-encoded, and join preserves subfolders.

## Migrations and Usage
1) Run schema extension (idempotent):
   - npm run db:schema:extend
2) Enrichment writers should populate QIQ_* fields first; keep legacy fields for backward compatibility.
3) Re-sync Algolia after enrichment:
   - npm run algolia:sync:kaspersky12

## Next Steps
- Generalize sync across all lists/brands
- Add tests for QIQ JSON parsing
- Tune Algolia settings for new attributes
