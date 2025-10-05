# Enrichment Engine - Integration Guide

Guide for integrating the Enrichment Engine with the main qiq-chat application.

---

## 📋 Overview

The Enrichment Engine can be integrated with qiq-chat in multiple ways:

1. **Standalone Mode**: Run independently via CLI/cron
2. **API Integration**: Call from qiq-chat backend
3. **Module Import**: Direct import in Node.js code
4. **Webhook Integration**: Receive notifications on completion

---

## Method 1: Standalone Mode (Recommended for Batch Processing)

Run the enrichment engine independently from your main application.

### Setup

1. Configure as described in [SETUP.md](SETUP.md)
2. Create a scheduled task or cron job
3. Monitor logs and database

### Advantages

- ✅ Independent processing
- ✅ No impact on main application performance
- ✅ Easy to schedule and monitor
- ✅ Simple rollback if issues occur

### Example: Cron Job

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/enrichment-engine && node src/index.js 20
```

---

## Method 2: API Integration

Create API endpoints in qiq-chat to trigger enrichment.

### Create API Endpoint

Add to `api/enrichment.js`:

```javascript
import enrichmentEngine from '../enrichment-engine/src/enrichmentEngine.js';

export default async function handler(req, res) {
  // Verify authentication
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { batchSize = 20 } = req.body;

    // Initialize engine
    await enrichmentEngine.initialize();

    // Process batch
    const result = await enrichmentEngine.processBatch(batchSize);

    // Shutdown
    await enrichmentEngine.shutdown();

    return res.status(200).json({
      success: true,
      stats: result.stats,
      batchId: result.batchId
    });
  } catch (error) {
    console.error('Enrichment failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

### Frontend Integration

Add to admin dashboard (`public/admin.html`):

```html
<section id="enrichment-section">
  <h3>Product Enrichment</h3>
  
  <div class="enrichment-controls">
    <label>Batch Size:</label>
    <input type="number" id="batch-size" value="20" min="5" max="100">
    
    <button onclick="runEnrichment()" id="enrich-btn">
      Run Enrichment
    </button>
  </div>
  
  <div id="enrichment-status" class="status-box">
    Ready to process products
  </div>
  
  <div id="enrichment-stats" class="stats-grid">
    <!-- Stats will be displayed here -->
  </div>
</section>
```

Add JavaScript:

```javascript
async function runEnrichment() {
  const batchSize = document.getElementById('batch-size').value;
  const statusDiv = document.getElementById('enrichment-status');
  const btn = document.getElementById('enrich-btn');
  
  // Disable button
  btn.disabled = true;
  btn.textContent = 'Processing...';
  statusDiv.innerHTML = '⏳ Enrichment in progress...';
  
  try {
    const response = await fetch('/api/enrichment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ batchSize: parseInt(batchSize) })
    });
    
    const result = await response.json();
    
    if (result.success) {
      statusDiv.innerHTML = `
        ✅ Enrichment completed successfully!<br>
        Processed: ${result.stats.processed}/${result.stats.total}<br>
        Success Rate: ${((result.stats.processed / result.stats.total) * 100).toFixed(1)}%
      `;
      
      // Display detailed stats
      displayEnrichmentStats(result.stats);
      
      // Refresh product list
      refreshProducts();
    } else {
      statusDiv.innerHTML = `❌ Error: ${result.error}`;
    }
  } catch (error) {
    statusDiv.innerHTML = `❌ Failed to run enrichment: ${error.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Enrichment';
  }
}

function displayEnrichmentStats(stats) {
  const statsDiv = document.getElementById('enrichment-stats');
  statsDiv.innerHTML = `
    <div class="stat-card">
      <h4>Total Products</h4>
      <p class="stat-value">${stats.total}</p>
    </div>
    <div class="stat-card">
      <h4>Processed</h4>
      <p class="stat-value">${stats.processed}</p>
    </div>
    <div class="stat-card">
      <h4>Failed</h4>
      <p class="stat-value">${stats.failed}</p>
    </div>
    <div class="stat-card">
      <h4>Processing Time</h4>
      <p class="stat-value">${((stats.endTime - stats.startTime) / 1000).toFixed(1)}s</p>
    </div>
  `;
}
```

---

## Method 3: Direct Module Import

Import enrichment services directly in your Node.js code.

### Example: Enrich Single Product

```javascript
import enrichmentService from '../enrichment-engine/src/enrichmentService.js';
import dbService from '../enrichment-engine/src/dbService.js';

// In your product creation/update handler
export async function handleProductUpdate(req, res) {
  const product = req.body;
  
  try {
    // Connect to database
    await dbService.connect();
    
    // Enrich the product
    const enrichedData = await enrichmentService.enrichProduct(product);
    
    // Update database
    await dbService.updateProduct(product.ManufacturerPartNo, enrichedData);
    
    // Disconnect
    await dbService.disconnect();
    
    res.json({
      success: true,
      enrichedData
    });
  } catch (error) {
    console.error('Enrichment failed:', error);
    res.status(500).json({ error: error.message });
  }
}
```

### Example: Real-Time Enrichment

```javascript
import enrichmentEngine from '../enrichment-engine/src/enrichmentEngine.js';

// Enrich product immediately when added to catalog
export async function addProduct(req, res) {
  const product = req.body;
  
  // Save product to database first
  await saveProduct(product);
  
  // Enrich in background (non-blocking)
  enrichmentEngine.initialize()
    .then(() => enrichmentEngine.processProduct(product))
    .then(() => enrichmentEngine.shutdown())
    .catch(error => console.error('Background enrichment failed:', error));
  
  // Return immediately
  res.json({ success: true, message: 'Product added, enrichment in progress' });
}
```

---

## Method 4: Webhook Integration

Configure the enrichment engine to send webhooks on completion.

### Add Webhook Support

Create `src/webhookService.js`:

```javascript
import axios from 'axios';
import logger from './logger.js';

class WebhookService {
  constructor() {
    this.webhookUrl = process.env.ENRICHMENT_WEBHOOK_URL;
  }

  async notifyCompletion(batchResult) {
    if (!this.webhookUrl) {
      logger.debug('No webhook URL configured');
      return;
    }

    try {
      await axios.post(this.webhookUrl, {
        event: 'enrichment.completed',
        timestamp: new Date().toISOString(),
        batchId: batchResult.batchId,
        stats: batchResult.stats
      });
      
      logger.success('Webhook notification sent');
    } catch (error) {
      logger.error('Failed to send webhook', error);
    }
  }

  async notifyFailure(error, batchId) {
    if (!this.webhookUrl) return;

    try {
      await axios.post(this.webhookUrl, {
        event: 'enrichment.failed',
        timestamp: new Date().toISOString(),
        batchId,
        error: error.message
      });
    } catch (err) {
      logger.error('Failed to send failure webhook', err);
    }
  }
}

export default new WebhookService();
```

Update `src/enrichmentEngine.js`:

```javascript
import webhookService from './webhookService.js';

// In processBatch method, after completion:
const result = await enrichmentEngine.processBatch(batchSize);
await webhookService.notifyCompletion(result);
```

### Receive Webhook in qiq-chat

Add webhook handler `api/webhooks/enrichment.js`:

```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, batchId, stats, error } = req.body;

  try {
    if (event === 'enrichment.completed') {
      // Handle completion
      console.log(`Enrichment batch ${batchId} completed:`, stats);
      
      // Trigger Algolia sync
      await triggerAlgoliaSync();
      
      // Notify admins
      await notifyAdmins(`Enrichment completed: ${stats.processed} products processed`);
      
    } else if (event === 'enrichment.failed') {
      // Handle failure
      console.error(`Enrichment batch ${batchId} failed:`, error);
      
      // Alert admins
      await alertAdmins(`Enrichment failed: ${error}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook handling failed:', err);
    res.status(500).json({ error: err.message });
  }
}
```

---

## Integration with Algolia Search

### Frontend Search Integration

Use enriched product data in search results:

```javascript
// In public/js/algolia-integration.js

class AlgoliaIntegration {
  renderProducts(products) {
    products.forEach(product => {
      const enrichedContent = `
        <div class="product-card enhanced">
          <img src="${product.image || '/images/placeholder.jpg'}" alt="${product.name}">
          
          <h3>${product.name}</h3>
          
          <!-- Show AI confidence badge -->
          <div class="confidence-badge ${this.getConfidenceClass(product.ai_confidence)}">
            AI Confidence: ${product.ai_confidence}%
          </div>
          
          <!-- Short description from enrichment -->
          <p class="short-desc">${product.short_description || product.description}</p>
          
          <!-- Features -->
          ${product.features ? `
            <div class="features">
              <h4>Key Features:</h4>
              ${this.formatFeatures(product.features)}
            </div>
          ` : ''}
          
          <!-- Show if product has rules -->
          ${product.product_rules ? `
            <span class="rule-badge" title="${product.product_rules}">
              <i class="icon-rules"></i> Smart Rules Available
            </span>
          ` : ''}
          
          <button onclick="viewDetails('${product.objectID}')">View Details</button>
        </div>
      `;
      
      // Render to DOM
      this.renderCard(enrichedContent);
    });
  }
  
  getConfidenceClass(confidence) {
    if (confidence >= 90) return 'high';
    if (confidence >= 70) return 'medium';
    return 'low';
  }
  
  formatFeatures(featuresText) {
    return featuresText
      .split('\n')
      .filter(f => f.trim().startsWith('•'))
      .map(f => `<li>${f.trim().substring(1).trim()}</li>`)
      .join('');
  }
}
```

### Display Enriched Content

Show full enriched content on product detail page:

```javascript
async function displayProductDetails(productId) {
  const product = await algolia.getProduct(productId);
  
  const detailsHtml = `
    <div class="product-details enriched">
      <div class="product-header">
        <img src="${product.image}" alt="${product.name}">
        <div class="header-info">
          <h1>${product.name}</h1>
          <p class="brand">${product.brand}</p>
          <p class="category">${product.category}</p>
          <p class="price">$${product.price}</p>
        </div>
      </div>
      
      <!-- Short Description -->
      <section class="short-description">
        <p>${product.short_description}</p>
      </section>
      
      <!-- Features -->
      ${product.features ? `
        <section class="features">
          <h2>Key Features</h2>
          <ul>${formatFeaturesList(product.features)}</ul>
        </section>
      ` : ''}
      
      <!-- Technical Specs -->
      ${product.specs ? `
        <section class="specifications">
          <h2>Technical Specifications</h2>
          <table>${formatSpecsTable(product.specs)}</table>
        </section>
      ` : ''}
      
      <!-- FAQ -->
      ${product.faq ? `
        <section class="faq">
          <h2>Frequently Asked Questions</h2>
          <div class="faq-list">${formatFAQ(product.faq)}</div>
        </section>
      ` : ''}
      
      <!-- Why Buy -->
      ${product.why_buy ? `
        <section class="why-buy">
          <h2>Why Choose This Product?</h2>
          <p>${product.why_buy}</p>
        </section>
      ` : ''}
      
      <!-- Related Products -->
      ${product.related ? `
        <section class="related">
          <h2>Related Products</h2>
          <p>${product.related}</p>
        </section>
      ` : ''}
      
      <!-- Scope of Work -->
      ${product.scope ? `
        <section class="scope">
          <h2>Professional Services Available</h2>
          <p>${product.scope}</p>
        </section>
      ` : ''}
      
      <!-- Datasheet Link -->
      ${product.datasheet ? `
        <a href="${product.datasheet}" class="btn-datasheet" target="_blank">
          📄 Download Datasheet
        </a>
      ` : ''}
    </div>
  `;
  
  document.getElementById('product-details').innerHTML = detailsHtml;
}
```

---

## Integration with AI Chat

Use enriched product data in chatbot responses:

```javascript
// In api/v0-chat.js or api/chat.js

import dbService from '../enrichment-engine/src/dbService.js';

async function handleProductQuery(query) {
  // Connect to database
  await dbService.connect();
  
  // Get enriched products
  const products = await dbService.getProductsForAlgoliaSync();
  
  // Filter relevant products
  const relevantProducts = products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.tags?.includes(query.toLowerCase())
  );
  
  // Build rich response using enriched data
  const response = relevantProducts.map(product => ({
    name: product.name,
    description: product.short_description,
    features: product.features?.split('\n').filter(f => f.startsWith('•')),
    whyBuy: product.why_buy,
    price: product.price,
    confidence: product.ai_confidence,
    rules: product.product_rules
  }));
  
  await dbService.disconnect();
  
  return response;
}
```

---

## Monitoring Integration

### Dashboard Integration

Add enrichment statistics to admin dashboard:

```javascript
// api/admin/enrichment-stats.js

import dbService from '../../enrichment-engine/src/dbService.js';

export default async function handler(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.connect();
    
    // Get recent batches
    const batches = await dbService.pool.request().query(`
      SELECT TOP 10
        BatchID,
        StartTime,
        TotalProducts,
        ProcessedCount,
        SuccessRate,
        Status
      FROM Enrichment_Batch
      ORDER BY StartTime DESC
    `);
    
    // Get enrichment summary
    const summary = await dbService.pool.request().query(`
      SELECT 
        COUNT(*) as TotalEnriched,
        AVG(AIConfidence) as AvgConfidence,
        SUM(CASE WHEN Status = 'Success' THEN 1 ELSE 0 END) as SuccessCount,
        SUM(CASE WHEN Status = 'Error' THEN 1 ELSE 0 END) as ErrorCount
      FROM Enrichment_Log
      WHERE ProcessDate > DATEADD(day, -30, GETDATE())
    `);
    
    await dbService.disconnect();
    
    res.json({
      recentBatches: batches.recordset,
      summary: summary.recordset[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

Display in dashboard:

```javascript
async function loadEnrichmentStats() {
  const response = await fetch('/api/admin/enrichment-stats');
  const data = await response.json();
  
  // Display summary
  document.getElementById('total-enriched').textContent = data.summary.TotalEnriched;
  document.getElementById('avg-confidence').textContent = 
    `${data.summary.AvgConfidence.toFixed(1)}%`;
  document.getElementById('success-rate').textContent = 
    `${((data.summary.SuccessCount / data.summary.TotalEnriched) * 100).toFixed(1)}%`;
  
  // Display recent batches
  const batchesTable = data.recentBatches.map(batch => `
    <tr>
      <td>${batch.BatchID}</td>
      <td>${new Date(batch.StartTime).toLocaleString()}</td>
      <td>${batch.ProcessedCount}/${batch.TotalProducts}</td>
      <td>${batch.SuccessRate}%</td>
      <td><span class="status-${batch.Status.toLowerCase()}">${batch.Status}</span></td>
    </tr>
  `).join('');
  
  document.getElementById('batches-table').innerHTML = batchesTable;
}
```

---

## Best Practices

### 1. Separate Concerns
- Keep enrichment logic in enrichment-engine module
- Use qiq-chat for presentation and API routing
- Maintain clear separation of responsibilities

### 2. Error Handling
- Always handle enrichment failures gracefully
- Don't block main application on enrichment errors
- Log all errors for debugging
- Implement retry logic for transient failures

### 3. Performance
- Run enrichment during off-peak hours
- Use batch processing for large datasets
- Cache enriched data
- Monitor API usage and costs

### 4. Testing
- Test with small batches first
- Validate enriched content quality
- Monitor confidence scores
- Review failed enrichments regularly

### 5. Security
- Validate all inputs
- Use authentication for API endpoints
- Sanitize enriched content before display
- Protect API keys and credentials

---

## Example: Complete Integration

Here's a complete example showing all integration points:

```javascript
// api/products/enrich.js - API endpoint

import enrichmentEngine from '../../enrichment-engine/src/enrichmentEngine.js';
import algoliaService from '../../enrichment-engine/src/algoliaService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productIds, batchSize } = req.body;

  try {
    // Initialize
    await enrichmentEngine.initialize();

    let result;
    if (productIds && productIds.length > 0) {
      // Enrich specific products
      result = await enrichSpecificProducts(productIds);
    } else {
      // Enrich batch
      result = await enrichmentEngine.processBatch(batchSize || 20);
    }

    // Sync to Algolia
    if (result.stats.processed > 0) {
      await enrichmentEngine.syncToAlgolia();
    }

    // Shutdown
    await enrichmentEngine.shutdown();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Enrichment failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

---

## Troubleshooting Integration

### Issue: Module not found

**Solution**: Ensure correct relative path:
```javascript
import enrichmentEngine from '../enrichment-engine/src/enrichmentEngine.js';
```

### Issue: Database connection conflicts

**Solution**: Use connection pooling and proper cleanup:
```javascript
await dbService.connect();
try {
  // Your code
} finally {
  await dbService.disconnect();
}
```

### Issue: API timeout

**Solution**: Run enrichment asynchronously:
```javascript
// Don't wait for completion
enrichmentEngine.processBatch(20)
  .then(() => console.log('Enrichment completed'))
  .catch(error => console.error('Enrichment failed:', error));

res.json({ success: true, message: 'Enrichment started' });
```

---

## Support

For integration issues:
1. Check main [README.md](README.md)
2. Review [SETUP.md](SETUP.md)
3. Enable debug logging
4. Check integration logs
5. Contact development team

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Author**: QuickITQuote Team
