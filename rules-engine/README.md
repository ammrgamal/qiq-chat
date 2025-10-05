# Rules Engine & AI Enrichment Module

> AI-powered product classification, auto-approval, and comprehensive product data enrichment for QuickITQuote (qiq-chat)

## 📋 Overview

The Rules Engine is a standalone service module within the qiq-chat project that provides:

### 🎯 Product Classification
- Product category and subcategory
- Classification type (Standard, Custom, Special Order)
- Auto-approval eligibility based on rules
- Lead time estimates
- Relevant keywords and metadata

### ✨ AI Enrichment (NEW)
- Marketing-ready product descriptions (short & long)
- Technical specifications tables
- Key features and benefits
- FAQ and prerequisite notes
- Professional services recommendations
- Product images (via Google Custom Search)
- Upsell & bundle suggestions
- Customer value statements

### 🔄 Algolia Integration
- Automatic sync of enriched data to Algolia
- Optimized search index with confidence scoring
- Periodic batch updates

## 🏗️ Architecture

```
rules-engine/
├── db/
│   └── schema.sql              # SQL Server database schema (with enrichment fields)
├── config/
│   └── dbConfig.json           # Database configuration
├── src/
│   ├── index.js                # Main entry point
│   ├── aiService.js            # AI integration (OpenAI/Gemini + enrichment)
│   ├── enrichmentService.js    # Product enrichment orchestrator (NEW)
│   ├── algoliaSync.js          # Algolia sync service (NEW)
│   ├── dbService.js            # Database operations
│   ├── rulesEngine.js          # Core rules processing
│   ├── autoApproval.js         # Auto-approval logic
│   └── logger.js               # Logging utility (with file logging)
├── examples/
│   └── enrich-demo.js          # Enrichment demo script
├── logs/
│   └── rules-engine.log        # Enrichment and processing logs
├── .gitignore
├── package.json
├── README.md
├── ENRICHMENT.md               # Enrichment module documentation (NEW)
└── INTEGRATION.md              # Integration guide
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** version 18 or higher
2. **SQL Server** database (QuoteWerksDB or similar)
3. **API Keys** (at least one):
   - OpenAI API key, or
   - Google Gemini API key

### Installation

```bash
# Navigate to the rules-engine directory
cd qiq-chat/rules-engine

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

Then run the schema script to create required tables:

```sql
-- Connect to your SQL Server and run:
USE QuoteWerksDB;
GO

-- Execute the schema.sql file
-- This creates: AI_Log, Rules_Item, Rules_Category tables
```

#### 2. Environment Variables

Create or update `.env` file in the **root qiq-chat directory** (not in rules-engine):

```bash
# AI Providers (at least one required)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-flash

# Image Search (optional, for enrichment)
GOOGLE_CX_ID=xxxxxxxxxxxxxxxxxxxx

# Algolia (for sync)
ALGOLIA_APP_ID=your_app_id
ALGOLIA_ADMIN_API_KEY=your_admin_api_key
ALGOLIA_INDEX_NAME=quickitquote_products
```

**Note**: The Rules Engine uses `dotenv` to read from the parent directory's `.env` file automatically.

### Usage

#### Run Classification with Sample Data

Process 20 sample products (default):

```bash
npm start
```

Process a custom number of products:

```bash
node src/index.js 10    # Process 10 sample products
node src/index.js 50    # Process 50 sample products (repeats from sample list)
```

#### Run Enrichment Demo (NEW)

Test the AI enrichment on sample products:

```bash
npm run demo:enrich
```

This will enrich 3 sample products and display detailed results including descriptions, specs, features, and confidence scores.

#### Use as a Module

You can import and use the Rules Engine in your own code:

```javascript
import { processInput } from './rules-engine/src/rulesEngine.js';

// Process a single product
const product = {
  name: 'Cisco Catalyst 2960 Switch',
  partNumber: 'WS-C2960-24TT-L',
  manufacturer: 'Cisco',
  description: '24-port Ethernet switch',
  price: 1499.99
};

const result = await processInput(product);
console.log(result);
```

#### Batch Processing

```javascript
import rulesEngine from './rules-engine/src/rulesEngine.js';

const products = [
  { name: 'Product 1', partNumber: 'PN-001', ... },
  { name: 'Product 2', partNumber: 'PN-002', ... }
];

await rulesEngine.initialize();
const results = await rulesEngine.processProducts(products);
await rulesEngine.shutdown();
```

## 📊 Database Schema

### AI_Log Table

Stores AI processing logs including input, output, and performance metrics.

| Column | Type | Description |
|--------|------|-------------|
| LogID | INT | Primary key |
| ProcessDate | DATETIME | When the process occurred |
| InputText | NVARCHAR(MAX) | Input product data (JSON) |
| OutputText | NVARCHAR(MAX) | AI classification result (JSON) |
| AIProvider | NVARCHAR(50) | 'OpenAI', 'Gemini', 'fallback' |
| Model | NVARCHAR(100) | Model name used |
| TokensUsed | INT | Number of tokens consumed |
| ProcessingTimeMs | INT | Processing duration in milliseconds |
| Status | NVARCHAR(20) | 'Success', 'Error', 'Partial' |

### Rules_Item Table

Stores individual product classification rules.

| Column | Type | Description |
|--------|------|-------------|
| RuleID | INT | Primary key |
| ProductName | NVARCHAR(500) | Product name |
| PartNumber | NVARCHAR(200) | Part/model number |
| Manufacturer | NVARCHAR(200) | Manufacturer name |
| Category | NVARCHAR(200) | Main category |
| SubCategory | NVARCHAR(200) | Subcategory |
| AutoApprove | BIT | Whether auto-approval is enabled |
| MinPrice | DECIMAL(18,2) | Minimum expected price |
| MaxPrice | DECIMAL(18,2) | Maximum expected price |
| AIGenerated | BIT | Whether rule was AI-generated |
| Confidence | DECIMAL(5,2) | AI confidence score (0-100) |

### Rules_Category Table

Stores product category definitions and approval rules.

| Column | Type | Description |
|--------|------|-------------|
| CategoryID | INT | Primary key |
| CategoryName | NVARCHAR(200) | Category name |
| Description | NVARCHAR(MAX) | Category description |
| AutoApproveLimit | DECIMAL(18,2) | Max price for auto-approval |
| RequiresReview | BIT | Always requires manual review |
| LeadTimeDays | INT | Expected lead time |

## 🎯 Auto-Approval Rules

The system applies the following logic to determine auto-approval:

### Category-Based Rules

| Category | Price Limit | Auto-Approve | Notes |
|----------|-------------|--------------|-------|
| Networking | $5,000 | ✓ | Standard switches, routers |
| Software | $3,000 | ✓ | Licenses, subscriptions |
| Accessories | $1,000 | ✓ | Cables, adapters |
| Storage | $10,000 | ⚠ | Case-by-case |
| Servers | N/A | ✗ | Always requires review |

### Additional Checks

1. **Confidence Score**: Must be ≥70% for auto-approval
2. **Classification**: Only "Standard" items can be auto-approved
3. **Database Overrides**: Existing rules in the database take precedence
4. **Custom Items**: Never auto-approved, always require review

## 🔧 API Integration

### Use with QuickITQuote Backend

```javascript
// In your main qiq-chat application
import { processInput } from './rules-engine/src/rulesEngine.js';

// API endpoint example
app.post('/api/classify-product', async (req, res) => {
  try {
    const product = req.body;
    const result = await processInput(product);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Vercel Deployment

To deploy as a serverless function:

1. Create API endpoint in `api/rules-classify.js`:

```javascript
import { processInput } from '../rules-engine/src/rulesEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const result = await processInput(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

2. Add environment variables in Vercel dashboard:
   - `OPENAI_API_KEY`
   - `GOOGLE_API_KEY`
   - Database connection strings

## 📈 Output Example

```
🚀 QuickITQuote Rules Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Processing 20 Products
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Progress |████████████████████████████████████████████████| 100% | 20/20 Products

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Processing Summary
────────────────────────────────────────────────────────
Total Products:        20
Successful:            20 (100%)
Failed:                0

✓ Auto-Approved:       12 (60%)
⚠ Requires Review:     8

⏱ Processing Time:
  Total:               45s
  Average per product: 2250ms

📦 Categories:
  • Networking: 6
  • Servers: 5
  • Storage: 3
  • Software: 4
  • Accessories: 2

🤖 AI Providers:
  • gemini: 18
  • openai: 2
```

## 🐛 Troubleshooting

### Database Connection Issues

```bash
Error: Failed to connect to SQL Server
```

**Solution**: Check your `config/dbConfig.json` credentials and ensure SQL Server is running and accessible.

### AI API Errors

```bash
OpenAI API error: 401 Unauthorized
```

**Solution**: Verify your API keys in the root `.env` file. The module looks for keys in the parent directory.

### No AI Providers

```bash
Warning: No AI API keys configured. AI features will use fallback mode.
```

**Solution**: Add at least one API key (OpenAI or Gemini) to the `.env` file. The system will work with fallback rules but with lower accuracy.

## 🤝 Integration with qiq-chat

The Rules Engine is designed to work seamlessly with the main qiq-chat application:

1. **Shared Environment**: Uses the same `.env` file from the root project
2. **Database Integration**: Works with existing QuoteWorks database
3. **Modular Design**: Can be imported and used in any Node.js code
4. **Independent Operation**: Can run standalone for batch processing

## 📝 Development

### Running in Development Mode

```bash
# Enable debug logging
NODE_ENV=development npm start
```

### Adding New Rules

Edit `src/autoApproval.js` to modify approval logic:

```javascript
this.rules = {
  networking: 5000,    // Max price for networking auto-approval
  software: 3000,      // Max price for software auto-approval
  accessories: 1000,   // Max price for accessories auto-approval
  storage: 10000,      // Max price for storage auto-approval
  servers: 0           // Servers never auto-approve
};
```

### Custom AI Prompts

Modify `src/aiService.js` → `buildClassificationPrompt()` to customize how products are classified.

## 📄 License

This module is part of the QuickITQuote (qiq-chat) project and inherits its license.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the database logs in `AI_Log` table
3. Enable debug mode for detailed logging
4. Consult the main qiq-chat project documentation

---

**Last Updated**: 2024
**Version**: 1.0.0
**Author**: QuickITQuote Team
