# Product Enrichment Engine

> AI-powered product enrichment system for QuoteWerks database with Algolia synchronization

## 📋 Overview

The Enrichment Engine is a comprehensive system that automatically processes products from your QuoteWerks SQL database, enriches them with AI-generated content, fetches missing images, and synchronizes everything to Algolia for fast search capabilities.

### Key Features

- ✅ **AI-Powered Content Generation**: Automatic generation of descriptions, features, specs, FAQ, and more
- ✅ **Multi-Provider Support**: Works with OpenAI GPT and Google Gemini
- ✅ **Image Intelligence**: Fetches product images with white background detection (≥78%)
- ✅ **Self-Learning Rules Engine**: Generates smart product and category rules
- ✅ **Batch Processing**: Processes 20 products at a time with progress tracking
- ✅ **Confidence Scoring**: AI confidence scoring (0-100) with auto-approval logic
- ✅ **Algolia Mirror**: Automatic synchronization to Algolia search index
- ✅ **Comprehensive Logging**: Detailed logs for all operations and batch tracking
- ✅ **QuoteWerks Integration**: Full mapping to CustomMemo and CustomText fields

## 🏗️ Architecture

```
QuoteWerks SQL DB → Enrichment Engine → Algolia Index
                         │
                         ├── OpenAI/Gemini API (Content)
                         ├── Google Custom Search (Images)
                         └── Enrichment Logs
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** version 18 or higher
2. **SQL Server** with QuoteWerks database
3. **API Keys** (at least one AI provider):
   - OpenAI API key (recommended), or
   - Google Gemini API key
4. **Optional**: Google Custom Search API (for image fetching)
5. **Optional**: Algolia credentials (for search index)

### Installation

```bash
# Navigate to the enrichment-engine directory
cd qiq-chat/enrichment-engine

# Install dependencies
npm install
```

### Configuration

#### 1. Database Setup

Edit `config/dbConfig.json` with your SQL Server credentials:

```json
{
  "user": "your_username",
  "password": "your_password",
  "server": "localhost",
  "database": "QuoteWerksDB",
  "options": {
    "encrypt": false,
    "trustServerCertificate": true
  }
}
```

Run the schema script to create required tables:

```sql
-- Connect to your SQL Server and run:
USE QuoteWerksDB;
GO

-- Execute the db/quoteworks-schema.sql file
```

#### 2. Environment Variables

Create or update `.env` file in the **root qiq-chat directory**:

```bash
# OpenAI Configuration (recommended)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Google Gemini Configuration (alternative)
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-flash

# Google Custom Search (optional, for images)
GOOGLE_CX_ID=xxxxxxxxxxxxxxxxxxxx

# Algolia Configuration (optional, for search)
ALGOLIA_APP_ID=xxxxxxxxxxxxxxxxxxxx
ALGOLIA_ADMIN_API_KEY=xxxxxxxxxxxxxxxxxxxx
ALGOLIA_INDEX_NAME=woocommerce_products
```

### Usage

#### Run Product Enrichment

Process 20 products (default):

```bash
npm start
```

Process a custom number of products:

```bash
node src/index.js 10    # Process 10 products
node src/index.js 50    # Process 50 products
```

#### Sync to Algolia Only

```bash
npm run sync
# or
node src/index.js --sync
```

#### View Statistics

```bash
node src/index.js --stats
```

#### Configure Algolia Index

```bash
node src/index.js --configure-algolia
```

## 📊 Database Schema

### QuoteWerks Custom Fields Mapping

The engine uses QuoteWerks custom fields to store enriched data:

#### CustomMemo Fields (Large Text)

| Field | Content | Description |
|-------|---------|-------------|
| CustomMemo01 | Short Description | Product summary (250 chars) |
| CustomMemo02 | Features | Key product features |
| CustomMemo03 | Specs Table | Technical specifications |
| CustomMemo04 | FAQs | Frequently asked questions |
| CustomMemo05 | Why Buy | Value proposition |
| CustomMemo06 | Prerequisites | Required items |
| CustomMemo07 | Related/Bundles | Recommended products |
| CustomMemo08 | Product Rule Engine | Product-specific rules |
| CustomMemo09 | Category Rule Engine | Category-level rules |
| CustomMemo10 | AI Learning Feedback | Self-learning data |

#### CustomText Fields (Short Text)

| Field | Content | Description |
|-------|---------|-------------|
| CustomText01 | Manufacturer | Brand name |
| CustomText02 | Category | Product category |
| CustomText03 | Tags | Keywords (comma-separated) |
| CustomText04 | SEO Keywords | Search optimization |
| CustomText05 | Image URL | Product image URL |
| CustomText06 | Datasheet URL | Technical datasheet |
| CustomText09 | Scope of Work | Professional services |
| CustomText10 | AI Confidence | Confidence score text |
| CustomText11 | AIProcessed Flag | "TRUE" if processed |
| CustomText12 | AIProcessedAt | Processing timestamp |

#### CustomNumber Fields

| Field | Content | Description |
|-------|---------|-------------|
| CustomNumber03 | Confidence Score | AI confidence (0-100) |

### Enrichment Log Tables

#### Enrichment_Log

Tracks individual product enrichment operations:

- LogID (PK)
- ProductID
- OperationType
- AIProvider
- AIConfidence
- TimeTaken
- Status
- ErrorMessage
- FieldsUpdated

#### Enrichment_Batch

Tracks batch processing:

- BatchID (PK)
- StartTime
- TotalProducts
- ProcessedCount
- SuccessRate
- Status

## 🎯 AI Content Generation

The engine generates the following content for each product:

1. **Short Description**: Concise 2-3 sentence summary
2. **Features**: 5-7 key bullet points
3. **Technical Specs**: Formatted specification table
4. **FAQ**: 3-5 common questions with answers
5. **Why Buy**: Compelling value proposition
6. **Prerequisites**: Required items or conditions
7. **Related Products**: 3-5 recommended items
8. **Product Rules**: Smart rules for this product
9. **Category Rules**: Category-level logic
10. **Tags & Keywords**: SEO optimization
11. **Scope of Work**: Professional services needed

## 🖼️ Image Fetching

The engine automatically fetches product images using Google Custom Search API:

1. Searches for product images with white background
2. Analyzes images for background whiteness (≥78% threshold)
3. Selects the best matching image
4. Falls back to manufacturer logo if no suitable image found
5. Updates CustomText05 with image URL

## 🔍 Algolia Synchronization

Products are automatically synced to Algolia as a "mirror" for search:

- **objectID**: ManufacturerPartNo
- **name**: Product description
- **brand**: Manufacturer
- **category**: Product category
- **features**, **specs**, **faq**: Enriched content
- **image**: Product image URL
- **ai_confidence**: Confidence score
- **_tags**: Searchable tags

### Algolia Index Configuration

The engine automatically configures:

- Searchable attributes
- Faceting attributes
- Custom ranking (by confidence and price)
- Relevance settings

## 📈 Processing Flow

1. **Fetch Products**: Get 20 unprocessed products from QuoteWerks
2. **AI Enrichment**: Generate content using OpenAI/Gemini
3. **Image Fetching**: Find and validate product images
4. **Database Update**: Store enriched data in CustomMemo/CustomText fields
5. **Logging**: Record operation details and statistics
6. **Algolia Sync**: Mirror enriched products to search index
7. **Statistics**: Display summary and save batch metrics

## 🔧 Performance & Optimization

### Batch Processing
- Processes 20 products per batch (configurable)
- Rate limiting: 1 second between AI requests
- Parallel operations where possible
- Progress bar with ETA

### Cost Optimization
- Skips already processed products (AIProcessed = TRUE)
- Uses cache to avoid redundant API calls
- Falls back to rule-based enrichment if AI unavailable
- Efficient database queries with indexes

### Auto-Approval Logic
- Confidence ≥90%: Auto-approved
- Confidence 70-89%: Requires review
- Confidence <70%: Manual review required

## 📊 Monitoring & Logs

### Console Output
- Real-time progress bar
- Success/error messages
- Batch summary statistics
- Performance metrics

### Database Logs
All operations logged to `Enrichment_Log` table:
- Product details
- AI provider used
- Confidence scores
- Processing time
- Fields updated
- Error messages

### File Logs
Daily log files in `logs/` directory:
- `enrichment-YYYY-MM-DD.log`
- JSON format for easy parsing
- Includes all operations and errors

## 🐛 Troubleshooting

### Database Connection Issues

```
Error: Failed to connect to SQL Server
```

**Solution**: 
1. Verify SQL Server is running
2. Check credentials in `config/dbConfig.json`
3. Ensure network connectivity
4. Check firewall settings

### AI API Errors

```
OpenAI API error: 401 Unauthorized
```

**Solution**:
1. Verify API key in root `.env` file
2. Check API key format (starts with `sk-` for OpenAI)
3. Verify API quota/billing
4. Try alternative provider (Gemini)

### No Products Found

```
Warning: No products found for enrichment
```

**Solution**:
1. Check Products table has data
2. Verify ManufacturerPartNo is not NULL
3. Check if products already processed (CustomText11 = 'TRUE')
4. Clear flags to reprocess: `UPDATE Products SET CustomText11 = NULL`

### Algolia Sync Failed

```
Algolia not configured
```

**Solution**:
1. Set ALGOLIA_APP_ID in `.env`
2. Set ALGOLIA_ADMIN_API_KEY in `.env`
3. Verify Algolia account is active
4. Check index name matches

## 🔐 Security Considerations

- Store API keys in `.env` file (not in code)
- Use restricted SQL Server credentials
- Never commit `.env` file to git
- Use HTTPS for all API calls
- Validate and sanitize all user inputs
- Use read-only Algolia keys for frontend

## 📝 Development

### Project Structure

```
enrichment-engine/
├── src/
│   ├── index.js              # Main entry point
│   ├── enrichmentEngine.js   # Main orchestrator
│   ├── enrichmentService.js  # AI content generation
│   ├── imageService.js       # Image fetching
│   ├── algoliaService.js     # Algolia sync
│   ├── dbService.js          # Database operations
│   └── logger.js             # Logging utility
├── config/
│   └── dbConfig.json         # Database configuration
├── db/
│   └── quoteworks-schema.sql # SQL schema
├── logs/                     # Log files (auto-generated)
├── package.json
└── README.md
```

### Running in Development

```bash
# Enable debug logging
NODE_ENV=development npm start
```

### Testing

```bash
# Process a small batch for testing
node src/index.js 5

# Test Algolia sync only
npm run sync

# View statistics
node src/index.js --stats
```

## 🤝 Integration with qiq-chat

The Enrichment Engine is designed to work seamlessly with the main qiq-chat application:

1. **Shared Environment**: Uses the same `.env` file from root
2. **Database Integration**: Works with QuoteWerks database
3. **Algolia Mirror**: Syncs to same index used by frontend
4. **Independent Operation**: Can run standalone or via cron job

### Scheduled Enrichment

Set up a cron job to run enrichment regularly:

```bash
# Run enrichment every day at 2 AM
0 2 * * * cd /path/to/qiq-chat/enrichment-engine && npm start >> /var/log/enrichment.log 2>&1
```

## 📄 License

This module is part of the QuickITQuote (qiq-chat) project and inherits its license.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review database logs in `Enrichment_Log` table
3. Check daily log files in `logs/` directory
4. Enable debug mode: `NODE_ENV=development`
5. Consult main qiq-chat project documentation

---

**Version**: 1.0.0  
**Author**: QuickITQuote Team  
**Last Updated**: 2024
