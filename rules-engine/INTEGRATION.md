# Rules Engine & AI Enrichment Integration Guide

This guide shows how to integrate the Rules Engine module with the main qiq-chat application.

## 🔗 Integration Methods

The Rules Engine can be integrated in multiple ways:

1. **Direct Module Import** (Recommended for same Node.js process)
2. **API Endpoint** (Recommended for microservices)
3. **CLI Execution** (For scheduled batch jobs)
4. **Vercel Serverless Function** (For cloud deployment)

## 🚀 New: AI Enrichment Module

The enrichment module automatically enhances product data with:
- Marketing descriptions (short & long)
- Technical specifications
- Key features & FAQs
- Professional services scope
- Upsell & bundle suggestions
- Product images (via Google Custom Search)
- Customer value statements

---

## Method 1: Direct Module Import

### Single Product Classification

```javascript
// In your qiq-chat API endpoint or service
import { processInput } from './rules-engine/src/rulesEngine.js';

async function classifyProduct(productData) {
  try {
    const result = await processInput({
      name: productData.name,
      partNumber: productData.pn || productData.sku,
      manufacturer: productData.brand,
      description: productData.description,
      price: productData.price
    });
    
    return {
      success: result.success,
      category: result.classification?.category,
      autoApprove: result.approval?.approved,
      confidence: result.classification?.confidence,
      reason: result.approval?.reason
    };
  } catch (error) {
    console.error('Classification failed:', error);
    return { success: false, error: error.message };
  }
}

// Usage in an Express route
app.post('/api/classify', async (req, res) => {
  const product = req.body;
  const result = await classifyProduct(product);
  res.json(result);
});
```

### Batch Product Classification

```javascript
import rulesEngine from './rules-engine/src/rulesEngine.js';

async function classifyProductBatch(products) {
  try {
    await rulesEngine.initialize();
    
    const results = await rulesEngine.processProducts(products);
    
    await rulesEngine.shutdown();
    
    return {
      success: true,
      total: results.total,
      approved: results.summary.autoApproved,
      requiresReview: results.summary.requiresReview,
      details: results.results
    };
  } catch (error) {
    console.error('Batch classification failed:', error);
    return { success: false, error: error.message };
  }
}

// Usage
const products = await getProductsFromCatalog();
const results = await classifyProductBatch(products);
```

---

## Method 2: Create API Endpoint

### Create API Route

Create `api/rules-classify.js` in your main qiq-chat project:

```javascript
// api/rules-classify.js
import { processInput } from '../rules-engine/src/rulesEngine.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      ok: false, 
      error: 'Method not allowed' 
    });
  }
  
  try {
    const { product, products } = req.body;
    
    // Single product classification
    if (product) {
      const result = await processInput(product);
      return res.status(200).json({
        ok: true,
        result: {
          category: result.classification?.category,
          subCategory: result.classification?.subCategory,
          autoApprove: result.approval?.approved,
          confidence: result.classification?.confidence,
          reasoning: result.classification?.reasoning,
          approvalReason: result.approval?.reason
        }
      });
    }
    
    // Batch classification
    if (Array.isArray(products)) {
      // Import and use batch processing
      const { default: rulesEngine } = await import('../rules-engine/src/rulesEngine.js');
      await rulesEngine.initialize();
      const results = await rulesEngine.processProducts(products);
      await rulesEngine.shutdown();
      
      return res.status(200).json({
        ok: true,
        summary: results.summary,
        results: results.results.map(r => ({
          product: r.product.name,
          category: r.classification?.category,
          autoApprove: r.approval?.approved
        }))
      });
    }
    
    return res.status(400).json({
      ok: false,
      error: 'Missing product or products in request body'
    });
    
  } catch (error) {
    console.error('Rules classification error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
```

### Client-Side Usage

```javascript
// In your frontend JavaScript (e.g., public/js/quote-management.js)

async function classifyAndAddProduct(product) {
  try {
    // Call the classification API
    const response = await fetch('/api/rules-classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      const classification = data.result;
      
      // Show classification info to user
      console.log(`Category: ${classification.category}`);
      console.log(`Auto-approve: ${classification.autoApprove ? 'Yes' : 'No'}`);
      console.log(`Confidence: ${classification.confidence}%`);
      
      // Add to quote with classification metadata
      await addToQuote({
        ...product,
        category: classification.category,
        subCategory: classification.subCategory,
        autoApproved: classification.autoApprove,
        requiresReview: !classification.autoApprove
      });
      
      // Show notification
      if (classification.autoApprove) {
        showNotification('Product auto-approved and added to quote', 'success');
      } else {
        showNotification('Product added - requires manual review', 'warning');
      }
    }
  } catch (error) {
    console.error('Classification failed:', error);
    showNotification('Failed to classify product', 'error');
  }
}
```

---

## Method 3: CLI Batch Processing

### Schedule Regular Batch Jobs

Create a scheduled task to process new products:

```bash
#!/bin/bash
# scripts/classify-new-products.sh

# Process products added in last 24 hours
cd /path/to/qiq-chat/rules-engine

# Export new products from database to JSON
node -e "
const fs = require('fs');
const products = await getNewProducts(); // Your DB query
fs.writeFileSync('/tmp/new-products.json', JSON.stringify(products));
"

# Run classification
npm start -- /tmp/new-products.json

# Process results and update database
node -e "
const results = require('/tmp/classification-results.json');
await updateProductRules(results); // Your DB update
"
```

### Cron Job Setup

```bash
# Add to crontab (crontab -e)
# Run every night at 2 AM
0 2 * * * /path/to/scripts/classify-new-products.sh >> /var/log/rules-engine.log 2>&1
```

---

## Method 4: Vercel Serverless Function

### Deploy as Separate Function

Create `api/serverless-classify.js`:

```javascript
// api/serverless-classify.js
// This runs as an isolated Vercel function
import aiService from '../rules-engine/src/aiService.js';
import autoApproval from '../rules-engine/src/autoApproval.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { product } = req.body;
    
    if (!product) {
      return res.status(400).json({ error: 'Product is required' });
    }
    
    // Classify with AI (no database dependency for serverless)
    const classification = await aiService.classifyProduct(product);
    
    // Check approval
    const approval = await autoApproval.checkAutoApproval(product, classification);
    
    // Return lightweight result
    return res.status(200).json({
      ok: true,
      category: classification.category,
      subCategory: classification.subCategory,
      autoApprove: approval.approved,
      confidence: classification.confidence,
      provider: classification.provider,
      reasoning: classification.reasoning,
      approvalReason: approval.reason
    });
    
  } catch (error) {
    console.error('Serverless classification error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
}

// Vercel configuration
export const config = {
  maxDuration: 30, // 30 seconds timeout
  memory: 512 // 512MB memory
};
```

### Environment Variables in Vercel

Add these in your Vercel project settings:

```
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_API_KEY=xxxxx
GEMINI_MODEL=gemini-1.5-flash
```

---

## Integration with Existing Features

### 1. Quote Management Integration

Modify `public/js/quote-management.js`:

```javascript
class QuoteManager {
  async addToQuote(productId) {
    const product = await this.getProduct(productId);
    
    // Classify before adding
    const classification = await this.classifyProduct(product);
    
    // Add classification metadata
    const item = {
      ...product,
      category: classification.category,
      autoApproved: classification.autoApprove,
      requiresReview: !classification.autoApprove,
      confidence: classification.confidence
    };
    
    this.items.push(item);
    this.updateUI();
    
    // Show appropriate notification
    if (classification.autoApprove) {
      this.showNotification('✓ Product auto-approved', 'success');
    } else {
      this.showNotification('⚠ Product requires review', 'warning');
    }
  }
  
  async classifyProduct(product) {
    try {
      const response = await fetch('/api/rules-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product })
      });
      return await response.json();
    } catch (error) {
      console.error('Classification failed:', error);
      return { autoApprove: false, requiresReview: true };
    }
  }
}
```

### 2. Admin Dashboard Integration

Add classification management to `public/admin.html`:

```html
<!-- Add to admin dashboard -->
<section id="rules-engine-section">
  <h3>Rules Engine Settings</h3>
  
  <div class="setting-group">
    <label>Auto-Approval Limits</label>
    <input type="number" id="networking-limit" placeholder="Networking ($)">
    <input type="number" id="software-limit" placeholder="Software ($)">
    <input type="number" id="accessories-limit" placeholder="Accessories ($)">
  </div>
  
  <div class="setting-group">
    <label>Minimum Confidence Score</label>
    <input type="range" id="confidence-threshold" min="0" max="100" value="70">
    <span id="confidence-value">70%</span>
  </div>
  
  <button onclick="saveRulesSettings()">Save Rules Settings</button>
  
  <div class="stats">
    <h4>Classification Statistics (Last 30 Days)</h4>
    <div id="rules-stats"></div>
  </div>
</section>
```

### 3. AI Chat Integration

Enhance `public/js/ai-chat-ui.js`:

```javascript
class AIChatUI {
  async handleProductQuery(query) {
    // Search for products
    const products = await this.searchProducts(query);
    
    // Classify all results
    const classifiedProducts = await Promise.all(
      products.map(async (product) => {
        const classification = await this.classifyProduct(product);
        return { ...product, ...classification };
      })
    );
    
    // Display with classification badges
    this.displayProducts(classifiedProducts);
  }
  
  displayProducts(products) {
    products.forEach(product => {
      const badge = product.autoApprove 
        ? '<span class="badge-success">Auto-Approved</span>'
        : '<span class="badge-warning">Requires Review</span>';
      
      const categoryBadge = `<span class="badge-info">${product.category}</span>`;
      
      // Render product card with badges
      this.renderProductCard(product, [categoryBadge, badge]);
    });
  }
}
```

---

## Database Integration

### Query Classified Products

```javascript
// Get auto-approved products
const query = `
  SELECT p.*, r.Category, r.SubCategory, r.AutoApprove, r.Confidence
  FROM Products p
  LEFT JOIN dbo.Rules_Item r ON p.PartNumber = r.PartNumber
  WHERE r.AutoApprove = 1 AND r.IsActive = 1
  ORDER BY r.Confidence DESC
`;

// Get products requiring review
const reviewQuery = `
  SELECT p.*, r.Category, r.AutoApprove, r.Notes
  FROM Products p
  LEFT JOIN dbo.Rules_Item r ON p.PartNumber = r.PartNumber
  WHERE r.AutoApprove = 0 AND r.IsActive = 1
  ORDER BY p.Price DESC
`;
```

### Sync with QuoteWerks

```javascript
// Sync Rules_Item with QuoteWerks product catalog
async function syncWithQuoteWerks() {
  const qwProducts = await getQuoteWerksProducts();
  
  for (const product of qwProducts) {
    const result = await processInput(product);
    
    // Update QuoteWerks with classification
    await updateQuoteWerksProduct(product.id, {
      Category: result.classification.category,
      AutoApprove: result.approval.approved,
      Notes: result.approval.reason
    });
  }
}
```

---

## Error Handling & Fallbacks

```javascript
async function robustClassification(product) {
  try {
    // Try Rules Engine
    const result = await processInput(product);
    return result;
  } catch (error) {
    console.error('Rules Engine failed, using fallback:', error);
    
    // Fallback to simple rule-based classification
    return {
      success: true,
      classification: {
        category: inferCategoryFromName(product.name),
        subCategory: 'General',
        confidence: 50,
        provider: 'fallback'
      },
      approval: {
        approved: false,
        requiresReview: true,
        reason: 'Fallback classification - requires manual review'
      }
    };
  }
}
```

---

## Performance Considerations

### Caching

```javascript
// Add simple in-memory cache
const classificationCache = new Map();

async function classifyWithCache(product) {
  const cacheKey = `${product.partNumber}:${product.manufacturer}`;
  
  if (classificationCache.has(cacheKey)) {
    console.log('Using cached classification');
    return classificationCache.get(cacheKey);
  }
  
  const result = await processInput(product);
  classificationCache.set(cacheKey, result);
  
  // Expire after 1 hour
  setTimeout(() => classificationCache.delete(cacheKey), 3600000);
  
  return result;
}
```

### Rate Limiting

```javascript
// Prevent API abuse
const rateLimit = require('express-rate-limit');

const classifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many classification requests, please try again later'
});

app.post('/api/rules-classify', classifyLimiter, handler);
```

---

## Testing Integration

```javascript
// test/rules-engine-integration.test.js
import { processInput } from '../rules-engine/src/rulesEngine.js';

describe('Rules Engine Integration', () => {
  test('should classify networking product', async () => {
    const product = {
      name: 'Cisco Switch',
      partNumber: 'CS-001',
      manufacturer: 'Cisco',
      price: 1500
    };
    
    const result = await processInput(product);
    
    expect(result.success).toBe(true);
    expect(result.classification.category).toBe('Networking');
    expect(result.approval.approved).toBe(true);
  });
  
  test('should require review for servers', async () => {
    const product = {
      name: 'Dell Server',
      partNumber: 'DS-001',
      manufacturer: 'Dell',
      price: 5000
    };
    
    const result = await processInput(product);
    
    expect(result.success).toBe(true);
    expect(result.classification.category).toBe('Servers');
    expect(result.approval.approved).toBe(false);
    expect(result.approval.requiresReview).toBe(true);
  });
});
```

---

## AI Enrichment Integration

### Using the Enrichment API

The `/api/rules-engine/enrich` endpoint provides comprehensive product enrichment.

#### Basic Usage

```javascript
// Client-side: Enrich a product
async function enrichProduct(productData) {
  const response = await fetch('/api/rules-engine/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: {
        ProductName: 'Cisco Catalyst 2960',
        PartNumber: 'WS-C2960-24TT-L',
        Manufacturer: 'Cisco',
        Category: 'Networking',
        price: 1500
      },
      syncToAlgolia: true // Optional: sync to Algolia after enrichment
    })
  });
  
  const result = await response.json();
  
  if (result.ok && result.enriched) {
    console.log('Product enriched:', result.product);
    console.log('Confidence:', result.confidence);
    console.log('Requires review:', result.requiresReview);
  }
}
```

#### Check by Part Number

```javascript
// Enrich by part number (fetches from DB first)
async function enrichByPartNumber(partNumber) {
  const response = await fetch('/api/rules-engine/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partNumber })
  });
  
  const result = await response.json();
  
  if (result.alreadyProcessed) {
    console.log('Already enriched:', result.product);
  } else if (result.enriched) {
    console.log('Newly enriched:', result.product);
  }
}
```

### Direct Module Usage

```javascript
import enrichmentService from './rules-engine/src/enrichmentService.js';

// Enrich a single product
const result = await enrichmentService.enrichProduct({
  ProductName: 'Dell PowerEdge R740',
  PartNumber: 'R740-001',
  Manufacturer: 'Dell',
  Category: 'Servers'
});

console.log('Enriched data:', result.enrichedData);
console.log('Confidence:', result.confidence);
console.log('Fields enriched:', result.fieldsEnriched);

// Batch enrich multiple products
const products = [...]; // Array of product objects
const batchResult = await enrichmentService.enrichProducts(products);

console.log(`Enriched: ${batchResult.enriched}`);
console.log(`Requires review: ${batchResult.requiresReview}`);
console.log(`Failed: ${batchResult.failed}`);
```

---

## Algolia Sync Integration

### Sync Enriched Products to Algolia

```bash
# Incremental sync (last 24 hours)
cd rules-engine
npm run algolia:sync

# Full sync (all products)
npm run algolia:sync:full

# Apply index settings
npm run algolia:settings
```

### Programmatic Sync

```javascript
import algoliaSync from './rules-engine/src/algoliaSync.js';

// Full sync
const result = await algoliaSync.syncProducts({ fullSync: true });
console.log(`Synced ${result.synced} products`);

// Incremental sync (since last sync time)
const lastSync = '2024-01-01T00:00:00Z';
const result = await algoliaSync.syncProducts({ 
  fullSync: false,
  lastSyncTime: lastSync 
});

// Apply Algolia index settings
await algoliaSync.initialize();
await algoliaSync.applyIndexSettings();
```

### Scheduled Sync (Cron)

Create a cron job to sync regularly:

```bash
# Add to crontab (crontab -e)
# Sync every 6 hours
0 */6 * * * cd /path/to/qiq-chat/rules-engine && npm run algolia:sync >> logs/sync.log 2>&1
```

### Vercel Cron Job

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/algolia-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Create `api/cron/algolia-sync.js`:

```javascript
import algoliaSync from '../../rules-engine/src/algoliaSync.js';

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await algoliaSync.syncProducts({ fullSync: false });
    return res.status(200).json({
      ok: true,
      synced: result.synced,
      failed: result.failed
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
```

---

## Chat Integration Flow

### Example: Product Query with Auto-Enrichment

```javascript
// In your chat handler (e.g., api/chat.js)

async function handleProductQuery(query) {
  // 1. Search for products
  const products = await searchProducts(query);
  
  // 2. Check enrichment status for each product
  for (const product of products) {
    if (!product.AIProcessed) {
      // Queue for enrichment
      fetch('/api/rules-engine/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          partNumber: product.PartNumber,
          syncToAlgolia: true 
        })
      }).catch(err => console.error('Enrichment failed:', err));
    }
  }
  
  // 3. Return products (enriched or not)
  return products;
}
```

### Example: Add to Quote with Enrichment Check

```javascript
async function addProductToQuote(partNumber) {
  // Check if product is enriched
  const response = await fetch('/api/rules-engine/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partNumber })
  });
  
  const result = await response.json();
  
  if (result.ok) {
    // Add to quote with enriched data
    await addToQuote({
      partNumber,
      name: result.product.name,
      description: result.product.shortDescription,
      image: result.product.image,
      features: result.product.keyFeatures,
      confidence: result.confidence
    });
    
    // Show notification
    if (result.alreadyProcessed) {
      showNotification('Product added with AI-enhanced data', 'success');
    } else if (result.enriched) {
      showNotification('Product enriched and added to quote', 'success');
    }
  }
}
```

---

## Summary

The Rules Engine can be integrated in multiple ways depending on your needs:

- **Direct import**: Best for monolithic apps, lowest latency
- **API endpoint**: Best for microservices, easier scaling
- **CLI batch**: Best for scheduled jobs, bulk processing
- **Serverless**: Best for cloud deployment, auto-scaling

**New Enrichment Features:**
- **AI Enrichment**: Automatic product data enhancement with 90% confidence threshold
- **Algolia Sync**: Periodic sync of enriched data to Algolia search index
- **Image Search**: Automatic product image discovery via Google Custom Search
- **Logging**: Comprehensive logging to `logs/rules-engine.log` for audit and cost tracking

Choose the method that best fits your architecture and use case.
