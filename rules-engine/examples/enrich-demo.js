#!/usr/bin/env node
// examples/enrich-demo.js - Demo script for product enrichment

import enrichmentService from '../src/enrichmentService.js';
import logger from '../src/logger.js';

/**
 * Demo: Enrich sample products
 */
async function main() {
  logger.banner('Product Enrichment Demo');

  // Sample products to enrich
  const sampleProducts = [
    {
      ProductName: 'Cisco Catalyst 2960-24TT-L Switch',
      PartNumber: 'WS-C2960-24TT-L',
      Manufacturer: 'Cisco',
      Category: 'Networking',
      SubCategory: 'Switches',
      MinPrice: 1500,
      MaxPrice: 2000
    },
    {
      ProductName: 'Dell PowerEdge R740 Server',
      PartNumber: 'R740-001',
      Manufacturer: 'Dell',
      Category: 'Servers',
      SubCategory: 'Rack Servers',
      MinPrice: 8000,
      MaxPrice: 15000
    },
    {
      ProductName: 'NetApp FAS2750 Storage System',
      PartNumber: 'FAS2750-BASE',
      Manufacturer: 'NetApp',
      Category: 'Storage',
      SubCategory: 'NAS',
      MinPrice: 25000,
      MaxPrice: 50000
    }
  ];

  logger.info(`Enriching ${sampleProducts.length} sample products...\n`);

  for (let i = 0; i < sampleProducts.length; i++) {
    const product = sampleProducts[i];
    
    logger.separator('-');
    logger.info(`Product ${i + 1}/${sampleProducts.length}: ${product.ProductName}`);
    logger.separator('-');

    try {
      // Enrich the product
      const result = await enrichmentService.enrichProduct(product);

      if (result.success) {
        logger.success('✅ Enrichment successful');
        
        // Display results
        console.log('\n📊 Enrichment Results:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log(`\n📝 Short Description:`);
        console.log(result.enrichedData.ShortDescription || 'N/A');
        
        console.log(`\n📄 Long Description:`);
        const longDesc = result.enrichedData.LongDescription || 'N/A';
        console.log(longDesc.substring(0, 300) + (longDesc.length > 300 ? '...' : ''));
        
        if (result.enrichedData.TechnicalSpecs) {
          console.log(`\n🔧 Technical Specifications:`);
          const specs = JSON.parse(result.enrichedData.TechnicalSpecs);
          for (const [key, value] of Object.entries(specs)) {
            console.log(`  • ${key}: ${value}`);
          }
        }
        
        if (result.enrichedData.KeyFeatures) {
          console.log(`\n⭐ Key Features:`);
          const features = JSON.parse(result.enrichedData.KeyFeatures);
          features.slice(0, 5).forEach(feature => {
            console.log(`  • ${feature}`);
          });
        }
        
        if (result.enrichedData.ProductImage) {
          console.log(`\n🖼️ Product Image:`);
          console.log(`  ${result.enrichedData.ProductImage}`);
        }
        
        console.log(`\n📈 Quality Metrics:`);
        console.log(`  • Confidence Score: ${result.confidence}%`);
        console.log(`  • Auto-Approved: ${result.enrichedData.AIProcessed ? 'Yes ✓' : 'No ✗'}`);
        console.log(`  • Requires Review: ${result.requiresReview ? 'Yes ⚠️' : 'No ✓'}`);
        console.log(`  • Processing Time: ${result.processingTimeMs}ms`);
        console.log(`  • Fields Enriched: ${result.fieldsEnriched.length}`);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      } else {
        logger.error('❌ Enrichment failed', result.error);
      }

      // Small delay between products
      if (i < sampleProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      logger.error('Error enriching product', error);
    }
  }

  logger.separator('=');
  logger.success('Demo completed!');
  logger.info('\nNext steps:');
  logger.info('  1. Review the enriched data above');
  logger.info('  2. Check logs/rules-engine.log for detailed logs');
  logger.info('  3. Adjust confidence thresholds if needed');
  logger.info('  4. Run npm run algolia:sync to sync to Algolia');
  logger.separator('=');
}

// Run demo
main()
  .then(() => process.exit(0))
  .catch(error => {
    logger.error('Demo failed', error);
    process.exit(1);
  });
