# Product Enrichment Integration Examples

This document provides practical examples for integrating the Product Enrichment Module into the QuickITQuote chat and search interfaces.

---

## Example 1: Chat Integration

When a user asks about a product, check if it's enriched and trigger enrichment if needed.

### api/chat.js Integration

```javascript
// Add this helper function at the top of chat.js
async function checkAndEnrichProduct(productId) {
  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 3001}/api/rules-engine/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Enrichment check failed:', error);
  }
  return null;
}

// In the main handler, after searching products:
export default async function handler(req, res) {
  // ... existing code ...
  
  // After getting search results from Algolia
  const products = await searchAlgolia({ query: userQuery });
  
  // Check enrichment status for top results
  if (products.length > 0 && products[0].sku) {
    const enrichmentCheck = await checkAndEnrichProduct(products[0].sku);
    
    if (enrichmentCheck?.enriched) {
      // Product is enriched, include enhanced data in response
      products[0].enriched = true;
      products[0].confidence = enrichmentCheck.data?.confidence;
      products[0].aiDescription = enrichmentCheck.data?.aiShortDescription;
    }
  }
  
  // ... continue with existing code ...
}
```

---

## Example 2: Search Results Enhancement

Display enrichment status in search results.

### public/js/algolia-integration.js

```javascript
// Modify the search result rendering to show enrichment status
function renderSearchResult(hit) {
  const isEnriched = hit.ai_processed === true;
  const confidence = hit.ai_confidence || 0;
  
  return `
    <div class="search-result">
      <img src="${hit.image}" alt="${hit.name}">
      <div class="result-info">
        <h3>${hit.name}</h3>
        ${isEnriched ? `
          <span class="enrichment-badge" title="AI-Enriched with ${confidence}% confidence">
            ✨ AI Enhanced
          </span>
        ` : ''}
        <p>${hit.ai_short_description || hit.ShortDescription || ''}</p>
        <div class="price">${hit.price}</div>
      </div>
    </div>
  `;
}
```

### Add CSS styling

```css
.enrichment-badge {
  display: inline-block;
  padding: 2px 8px;
  background: linear-gradient(135deg, #0055A4 0%, #0077CC 100%);
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 8px;
}
```

---

## Example 3: Product Detail Page Integration

Show enriched product information when viewing product details.

### Product Detail Component

```javascript
async function loadProductDetails(productId) {
  // Fetch product from your database/API
  const product = await getProduct(productId);
  
  // Check for enriched data
  const enrichment = await fetch('/api/rules-engine/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId })
  }).then(r => r.json());
  
  // Display enriched content
  if (enrichment.ok && enrichment.enriched) {
    displayEnrichedProduct(product, enrichment.data);
  } else {
    displayStandardProduct(product);
  }
}

function displayEnrichedProduct(product, enrichmentData) {
  return `
    <div class="product-detail enriched">
      <div class="product-header">
        <h1>${product.name}</h1>
        <span class="ai-badge">✨ AI-Enhanced</span>
      </div>
      
      <div class="product-image">
        <img src="${enrichmentData.aiImageURL || product.image}" alt="${product.name}">
      </div>
      
      <div class="product-description">
        ${enrichmentData.aiLongDescription || product.description}
      </div>
      
      ${enrichmentData.features ? `
        <div class="product-features">
          <h3>Key Features</h3>
          <ul>
            ${enrichmentData.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${enrichmentData.specs ? `
        <div class="product-specs">
          <h3>Technical Specifications</h3>
          <table>
            ${Object.entries(enrichmentData.specs).map(([key, val]) => `
              <tr><th>${key}</th><td>${val}</td></tr>
            `).join('')}
          </table>
        </div>
      ` : ''}
      
      ${enrichmentData.faq && enrichmentData.faq.length > 0 ? `
        <div class="product-faq">
          <h3>Frequently Asked Questions</h3>
          ${enrichmentData.faq.map(item => `
            <div class="faq-item">
              <h4>${item.question}</h4>
              <p>${item.answer}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${enrichmentData.upsells && enrichmentData.upsells.length > 0 ? `
        <div class="product-upsells">
          <h3>You May Also Like</h3>
          <div class="upsell-grid">
            ${enrichmentData.upsells.map(u => `<div class="upsell-item">${u}</div>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
```

---

## Example 4: Batch Enrichment Script

Periodically enrich products that haven't been processed yet.

### scripts/batch-enrich.js

```javascript
#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Import enrichment services
const { default: dbService } = await import('../rules-engine/src/dbService.js');
const { default: productEnrichment } = await import('../rules-engine/src/productEnrichment.js');

async function batchEnrich() {
  console.log('Starting batch enrichment...');
  
  // Connect to database
  await dbService.connect();
  
  try {
    // Find products needing enrichment
    const query = `
      SELECT TOP 50 p.*
      FROM Products p
      LEFT JOIN Product_Enrichment pe ON p.ID = pe.ProductID
      WHERE pe.AIProcessed IS NULL OR pe.AIProcessed = 0
      ORDER BY p.LastModified DESC
    `;
    
    const result = await dbService.query(query);
    const products = result.recordset || [];
    
    console.log(`Found ${products.length} products to enrich`);
    
    // Enrich each product
    let processed = 0;
    for (const product of products) {
      try {
        console.log(`Enriching: ${product.ProductName}`);
        
        const enrichedData = await productEnrichment.enrichProduct({
          ID: product.ID,
          name: product.ProductName,
          ProductName: product.ProductName,
          partNumber: product.ManufacturerPartNumber,
          manufacturer: product.Manufacturer,
          category: product.Category,
          description: product.ShortDescription
        });
        
        // Save to database
        const insertQuery = `
          MERGE INTO Product_Enrichment AS target
          USING (SELECT @productID AS ProductID) AS source
          ON target.ProductID = source.ProductID
          WHEN MATCHED THEN UPDATE SET
            AIShortDescription = @aiShortDescription,
            AILongDescription = @aiLongDescription,
            AIProcessed = @aiProcessed,
            AIConfidence = @aiConfidence,
            ModifiedDate = GETDATE()
          WHEN NOT MATCHED THEN INSERT (
            ProductID, PartNumber, AIShortDescription, AILongDescription,
            AIProcessed, AIConfidence
          ) VALUES (
            @productID, @partNumber, @aiShortDescription, @aiLongDescription,
            @aiProcessed, @aiConfidence
          );
        `;
        
        await dbService.query(insertQuery, {
          productID: enrichedData.productID,
          partNumber: enrichedData.partNumber,
          aiShortDescription: enrichedData.aiShortDescription,
          aiLongDescription: enrichedData.aiLongDescription,
          aiProcessed: enrichedData.aiProcessed,
          aiConfidence: enrichedData.aiConfidence
        });
        
        processed++;
        console.log(`✓ Enriched: ${product.ProductName} (${enrichedData.aiConfidence}%)`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`✗ Failed to enrich ${product.ProductName}:`, error.message);
      }
    }
    
    console.log(`\nBatch enrichment complete: ${processed}/${products.length} products enriched`);
    
  } finally {
    await dbService.disconnect();
  }
}

// Run batch enrichment
batchEnrich().catch(console.error);
```

### Run the script

```bash
# Make it executable
chmod +x scripts/batch-enrich.js

# Run it
node scripts/batch-enrich.js
```

---

## Example 5: Cron Job Configuration

Automate enrichment and Algolia sync with cron jobs.

### crontab configuration

```bash
# Edit crontab
crontab -e

# Add these entries:

# Batch enrich products every 2 hours
0 */2 * * * cd /path/to/qiq-chat && node scripts/batch-enrich.js >> logs/batch-enrich.log 2>&1

# Sync to Algolia every 6 hours
0 */6 * * * cd /path/to/qiq-chat && node rules-engine/scripts/algolia-sync.js >> logs/algolia-sync.log 2>&1
```

### systemd timer (alternative to cron)

Create `/etc/systemd/system/qiq-enrich.service`:

```ini
[Unit]
Description=QuickITQuote Batch Enrichment
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/path/to/qiq-chat
ExecStart=/usr/bin/node scripts/batch-enrich.js
StandardOutput=append:/var/log/qiq-enrich.log
StandardError=append:/var/log/qiq-enrich-error.log
```

Create `/etc/systemd/system/qiq-enrich.timer`:

```ini
[Unit]
Description=Run QuickITQuote Batch Enrichment every 2 hours

[Timer]
OnBootSec=5min
OnUnitActiveSec=2h
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl enable qiq-enrich.timer
sudo systemctl start qiq-enrich.timer
```

---

## Example 6: Frontend Loading States

Show loading indicators while enrichment is in progress.

```javascript
async function handleProductView(productId) {
  const container = document.getElementById('product-container');
  
  // Show loading state
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading enhanced product information...</p>
    </div>
  `;
  
  try {
    // Check enrichment status
    const enrichmentResponse = await fetch('/api/rules-engine/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    
    const enrichmentData = await enrichmentResponse.json();
    
    if (enrichmentData.cached) {
      // Immediately show enriched data
      displayProduct(enrichmentData.data);
    } else {
      // Enrichment is in progress
      container.innerHTML = `
        <div class="enriching-state">
          <div class="ai-animation">✨</div>
          <p>AI is enhancing this product...</p>
          <small>This may take a few seconds</small>
        </div>
      `;
      
      // Poll for completion (or use WebSocket in production)
      setTimeout(() => {
        handleProductView(productId); // Retry
      }, 3000);
    }
  } catch (error) {
    // Show error state
    container.innerHTML = `
      <div class="error-state">
        <p>Failed to load product information</p>
        <button onclick="handleProductView('${productId}')">Retry</button>
      </div>
    `;
  }
}
```

---

## Summary

These examples demonstrate how to:

1. **Integrate enrichment into chat flows** - Check and trigger enrichment when products are discussed
2. **Enhance search results** - Display enrichment status in search interfaces
3. **Show enriched product details** - Present AI-generated content on product pages
4. **Batch process products** - Automate enrichment for multiple products
5. **Schedule automated tasks** - Use cron jobs or systemd timers
6. **Handle loading states** - Provide smooth UX during enrichment

For complete API documentation, see [ENRICHMENT.md](../rules-engine/ENRICHMENT.md).

---

**Related Documentation:**
- [Product Enrichment Module](../rules-engine/ENRICHMENT.md)
- [Field Mapping Reference](./mapping-reference.md)
- [Rules Engine Integration](../rules-engine/INTEGRATION.md)
