# AI Enrichment Module

> Comprehensive product data enrichment using OpenAI, Google Gemini, and Google Custom Search APIs

## 📋 Overview

The AI Enrichment Module automatically enhances product data stored in QuoteWerks SQL Database with:

- ✅ Marketing-ready descriptions (short & long)
- ✅ Technical specifications table
- ✅ Key product features
- ✅ FAQ and prerequisite notes
- ✅ Professional services scope
- ✅ Product images (white-background filtered)
- ✅ Upsell & bundle suggestions
- ✅ Customer value statements

## 🎯 Key Features

### 1. Intelligent Enrichment Detection

The system automatically detects products that need enrichment:

```javascript
// Checks for missing fields
- ShortDescription is NULL or empty
- LongDescription is NULL or empty
- TechnicalSpecs is NULL
- ProductImage is NULL
- AIProcessed = FALSE
```

### 2. Multi-Provider AI Support

- **Primary**: Google Gemini (cost-effective for long content)
- **Fallback**: OpenAI GPT-4o-mini
- **Emergency**: Rule-based fallback

### 3. Confidence-Based Approval

- **≥90% confidence**: Auto-approve (AIProcessed = TRUE)
- **<90% confidence**: Flag for manual review
- Tracks enrichment quality and logs for improvement

### 4. Google Custom Search Integration

- Searches for product images automatically
- Filters for white/light backgrounds
- Verifies image accessibility
- Prefers official product images from CDNs

### 5. Comprehensive Logging

All enrichments logged to `logs/rules-engine.log`:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "context": "RulesEngine",
  "message": "Product enriched successfully",
  "data": {
    "productId": "WS-C2960-24TT-L",
    "confidence": 95,
    "fieldsEnriched": ["ShortDescription", "LongDescription", "TechnicalSpecs", "KeyFeatures", "ProductImage"],
    "processingTimeMs": 3500,
    "tokensUsed": 2800
  }
}
```

---

## 🚀 Quick Start

### Prerequisites

1. **API Keys** (at least one AI provider):
   - OpenAI API key, or
   - Google Gemini API key
   
2. **Optional** (for image search):
   - Google API key
   - Google Custom Search Engine ID

3. **Database**: SQL Server with Rules_Item table

### Setup

1. **Configure Environment Variables**

Create `.env` in project root:

```bash
# AI Providers (at least one required)
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_API_KEY=xxxxx

# Image Search (optional)
GOOGLE_CX_ID=xxxxx

# Algolia (for sync)
ALGOLIA_APP_ID=xxxxx
ALGOLIA_ADMIN_API_KEY=xxxxx
ALGOLIA_INDEX_NAME=quickitquote_products
```

2. **Update Database Schema**

Run the updated `rules-engine/db/schema.sql` to add enrichment fields.

3. **Install Dependencies**

```bash
cd rules-engine
npm install
```

---

## 💻 Usage

### Option 1: API Endpoint (Recommended)

```javascript
// Enrich a product via API
const response = await fetch('/api/rules-engine/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    partNumber: 'WS-C2960-24TT-L',
    syncToAlgolia: true
  })
});

const result = await response.json();

if (result.ok && result.enriched) {
  console.log('✅ Product enriched');
  console.log('Confidence:', result.confidence);
  console.log('Description:', result.product.shortDescription);
  console.log('Image:', result.product.image);
}
```

### Option 2: Direct Module Import

```javascript
import enrichmentService from './rules-engine/src/enrichmentService.js';

// Enrich a single product
const product = {
  ProductName: 'Cisco Catalyst 2960 Switch',
  PartNumber: 'WS-C2960-24TT-L',
  Manufacturer: 'Cisco',
  Category: 'Networking',
  MinPrice: 1500
};

const result = await enrichmentService.enrichProduct(product);

console.log('Success:', result.success);
console.log('Confidence:', result.confidence);
console.log('Requires review:', result.requiresReview);
console.log('Enriched data:', result.enrichedData);
```

### Option 3: Batch Processing

```javascript
import enrichmentService from './rules-engine/src/enrichmentService.js';
import dbService from './rules-engine/src/dbService.js';

// Fetch unenriched products from database
await dbService.connect();
const result = await dbService.query(`
  SELECT * FROM dbo.Rules_Item 
  WHERE AIProcessed = 0 AND IsActive = 1
  LIMIT 100
`);

const products = result.recordset;

// Batch enrich
const batchResult = await enrichmentService.enrichProducts(products);

console.log(`Total: ${batchResult.total}`);
console.log(`Enriched: ${batchResult.enriched}`);
console.log(`Requires review: ${batchResult.requiresReview}`);
console.log(`Failed: ${batchResult.failed}`);
```

---

## 📊 Enrichment Output Example

### Input Product

```javascript
{
  ProductName: "Cisco Catalyst 2960-24TT-L",
  PartNumber: "WS-C2960-24TT-L",
  Manufacturer: "Cisco",
  Category: "Networking",
  MinPrice: 1500
}
```

### Enriched Output

```javascript
{
  ShortDescription: "Cisco Catalyst 2960-24TT-L 24-port Gigabit Ethernet managed switch with advanced Layer 2 features, ideal for small to medium business networks requiring reliable connectivity and security.",
  
  LongDescription: "The Cisco Catalyst 2960-24TT-L is a professional-grade managed Ethernet switch designed for growing businesses. Featuring 24 10/100/1000 Ethernet ports and 2 dual-purpose uplink ports, this switch delivers high-performance connectivity with advanced security, QoS, and management capabilities. <span style=\"color:#0055A4\">Built on Cisco's legendary reliability</span>, it provides enterprise-class features in a cost-effective package perfect for expanding network infrastructure...",
  
  TechnicalSpecs: {
    "Ports": "24x 10/100/1000 Ethernet + 2x SFP uplink",
    "Switching Capacity": "56 Gbps",
    "MAC Address Table": "8,000 entries",
    "Power": "29W typical",
    "Dimensions": "17.5 x 11 x 1.73 inches",
    "Management": "CLI, SNMP, Web UI"
  },
  
  KeyFeatures: [
    "24 Gigabit Ethernet ports for high-speed connectivity",
    "Advanced Layer 2 switching with QoS support",
    "Cisco IOS Software for enterprise-grade management",
    "Energy Efficient Ethernet (IEEE 802.3az)",
    "Lifetime limited hardware warranty"
  ],
  
  FAQ: [
    {
      question: "What is the warranty period?",
      answer: "This switch includes Cisco's Limited Lifetime Hardware Warranty with next-business-day advance replacement."
    },
    {
      question: "Does it support PoE?",
      answer: "No, the 2960-24TT-L model does not support Power over Ethernet. Consider the 2960-24PC-L for PoE support."
    },
    {
      question: "What are the power requirements?",
      answer: "100-240V AC, 50-60Hz with internal power supply. Typical power consumption is 29W."
    }
  ],
  
  Prerequisites: [
    "Network infrastructure with Ethernet cabling",
    "Basic networking knowledge for configuration",
    "TFTP server for IOS updates (optional)"
  ],
  
  ProfessionalServices: {
    scope: "Installation, configuration, and knowledge transfer",
    description: "Complete switch deployment including rack mounting, cabling, VLAN configuration, security setup, and 2-hour administrator training",
    estimatedHours: 4,
    recommendedTier: "Standard"
  },
  
  ProductImage: "https://cdn.cisco.com/products/switches/catalyst-2960-24tt-l.jpg",
  
  UpsellSuggestions: [
    "Cisco SMARTnet 8x5xNBD Support (CON-SNT-2960)",
    "Extended 5-year warranty (CON-5YR-2960)",
    "Cisco Prime Infrastructure monitoring license"
  ],
  
  BundleSuggestions: [
    "19-inch rack mount kit (RACK-KIT-T1)",
    "Cat6 Ethernet cable bundle (50ft, 10-pack)",
    "UPS battery backup (APC Smart-UPS 1500VA)"
  ],
  
  CustomerValue: "Choose the Cisco Catalyst 2960-24TT-L for reliable, enterprise-grade networking backed by Cisco's industry-leading support and lifetime warranty. Perfect for businesses that demand professional performance without compromising on quality.",
  
  EnrichmentConfidence: 95
}
```

---

## 🔄 Algolia Sync

After enrichment, sync to Algolia for optimized search:

```bash
# Sync recently enriched products (last 24 hours)
npm run algolia:sync

# Full sync of all enriched products
npm run algolia:sync:full

# Apply/update Algolia index settings
npm run algolia:settings
```

Or programmatically:

```javascript
import algoliaSync from './rules-engine/src/algoliaSync.js';

const result = await algoliaSync.syncProducts({ fullSync: false });
console.log(`✅ Synced ${result.synced} products to Algolia`);
```

---

## 📈 Confidence Scoring

The enrichment confidence is calculated based on:

| Factor | Weight | Notes |
|--------|--------|-------|
| Short description quality | 10% | Must be 100-500 chars |
| Long description quality | 15% | Must be 500+ chars |
| Technical specs present | 10% | At least 5 specs |
| Key features (3+) | 10% | Minimum 3 features |
| FAQ present (3+) | 10% | At least 3 Q&A pairs |
| Prerequisites present | 5% | At least 2 items |
| Professional services | 10% | Complete scope |
| Upsell suggestions (3+) | 10% | Minimum 3 items |
| Bundle suggestions (3+) | 10% | Minimum 3 items |
| Customer value statement | 10% | Present and 100+ chars |
| Product image found | 10% | Valid URL |

**Total**: 100%

- **≥90%**: Auto-approved (AIProcessed = TRUE)
- **<90%**: Flagged for manual review

---

## 🛠️ Troubleshooting

### No enrichment happening

**Check**:
1. At least one AI API key is configured
2. Product has `AIProcessed = FALSE`
3. Product is missing at least one enrichment field

### Low confidence scores

**Causes**:
- AI provider returned incomplete data
- Product information is too generic
- API rate limits or errors

**Solutions**:
- Provide more detailed product input
- Check API quotas and billing
- Review logs for specific errors

### Image search not working

**Check**:
1. `GOOGLE_API_KEY` is set
2. `GOOGLE_CX_ID` is set
3. Google Custom Search API is enabled
4. Billing is enabled on Google Cloud project

### Algolia sync failures

**Check**:
1. `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_API_KEY` are correct
2. Index name matches configuration
3. Records don't exceed 10KB size limit
4. Network connectivity to Algolia

---

## 📝 Best Practices

### 1. Start Small
Test enrichment on 10-20 products before scaling up:

```javascript
const testProducts = await dbService.query(`
  SELECT TOP 20 * FROM dbo.Rules_Item 
  WHERE AIProcessed = 0 
  ORDER BY NEWID()
`);
```

### 2. Monitor Token Usage
Track OpenAI token consumption in logs for cost analysis:

```bash
grep "tokensUsed" rules-engine/logs/rules-engine.log | \
  awk '{sum+=$2} END {print "Total tokens:", sum}'
```

### 3. Schedule Regular Syncs
Set up cron jobs for automatic enrichment and sync:

```bash
# Enrich new products daily at 2 AM
0 2 * * * cd /path/to/rules-engine && node src/batchEnrich.js

# Sync to Algolia every 6 hours
0 */6 * * * cd /path/to/rules-engine && npm run algolia:sync
```

### 4. Review Low-Confidence Items
Regularly check products flagged for review:

```sql
SELECT * FROM dbo.Rules_Item
WHERE EnrichmentConfidence < 90
  AND AIProcessed = 1
ORDER BY EnrichmentConfidence ASC
```

### 5. Keep Prompts Updated
Refine enrichment prompts based on output quality and user feedback.

---

## 🔐 Security Notes

- **Never commit API keys** to version control
- Store `.env` file securely
- Use read-only database credentials when possible
- Validate and sanitize all product data before enrichment
- Rate limit API endpoints to prevent abuse

---

## 📚 Related Documentation

- [INTEGRATION.md](./INTEGRATION.md) - Integration patterns and examples
- [mapping-reference.md](../docs/mapping-reference.md) - SQL to Algolia field mappings
- [README.md](./README.md) - Rules Engine overview

---

## 🆘 Support

For issues or questions:

1. Check the logs: `rules-engine/logs/rules-engine.log`
2. Review the database: Check `AI_Log` table for detailed processing history
3. Enable debug mode: Set `NODE_ENV=development`
4. Consult the main qiq-chat project documentation

---

**Last Updated**: 2024  
**Version**: 1.0.0  
**Module**: Rules Engine & AI Enrichment
