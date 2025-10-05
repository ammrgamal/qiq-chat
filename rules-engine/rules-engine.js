// rules-engine.js
// Entry point for Rules Engine enrichment
// Reference: mapping-reference.md, copilot-instructions.md

import sqlHelper from './utils/sql-helper.js';
import aiHelper from './utils/ai-helper.js';
import googleHelper from './utils/google-helper.js';
import { appendFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class RulesEngine {
  constructor() {
    this.logPath = join(__dirname, 'logs', 'rules-engine.log');
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      imagesFound: 0,
      totalTokens: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * Log message to console and file
   * @param {string} message - Log message
   * @param {string} level - Log level (INFO, WARN, ERROR)
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    console.log(message);

    try {
      appendFileSync(this.logPath, logEntry, 'utf-8');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Display progress bar
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} message - Optional message
   */
  showProgress(current, total, message = '') {
    const percent = Math.floor((current / total) * 100);
    const filled = '█'.repeat(Math.floor(percent / 2));
    const empty = '░'.repeat(50 - Math.floor(percent / 2));

    process.stdout.write(
      `\r🔄 Progress: [${filled}${empty}] ${percent}% | ${current}/${total} | ${message}${' '.repeat(20)}`
    );

    if (current >= total) {
      console.log(); // New line when complete
    }
  }

  /**
   * Enrich a single product
   * @param {Object} product - Product data from database
   * @returns {Promise<Object>} Enrichment result
   */
  async enrichProduct(product) {
    const startTime = Date.now();

    try {
      this.log(`Processing product: ${product.PartNumber || product.ProductID}`);

      // Step 1: AI Enrichment
      const enrichedData = await aiHelper.enrichProduct(product);

      // Step 2: Image Search (if needed)
      if (!product.ImageFile || product.ImageFile.trim() === '') {
        this.log(`Searching for product image...`);
        const imageUrl = await googleHelper.findProductImage(product);
        enrichedData.imageUrl = imageUrl;

        if (imageUrl && !imageUrl.includes('fallback') && !imageUrl.includes('.jpg')) {
          this.stats.imagesFound++;
        }
      }

      // Step 3: Update database
      const confidence = enrichedData.metadata?.confidence || 0;
      const updateData = {
        description: product.Description, // Keep existing if good
        shortDescription: enrichedData.shortDescription,
        longDescription: enrichedData.longDescription,
        features: enrichedData.features,
        specifications: enrichedData.specifications,
        faq: enrichedData.faq,
        prerequisites: enrichedData.prerequisites,
        relatedItems: enrichedData.relatedItems,
        professionalServices: enrichedData.professionalServices,
        upsellRecommendations: enrichedData.upsellRecommendations,
        marketingMessage: enrichedData.marketingMessage,
        category: enrichedData.category,
        subcategory: enrichedData.subcategory,
        manufacturer: enrichedData.manufacturer,
        productType: enrichedData.productType,
        rulesProduct: enrichedData.rulesProduct,
        rulesCategory: enrichedData.rulesCategory,
        confidence: confidence,
        imageUrl: enrichedData.imageUrl
      };

      await sqlHelper.updateProduct(product.ProductID, updateData);

      // Step 4: Log to database
      const processingTime = Date.now() - startTime;
      await sqlHelper.logEnrichment({
        inputText: JSON.stringify({
          productId: product.ProductID,
          partNumber: product.PartNumber,
          manufacturer: product.ManufacturerName
        }),
        outputText: JSON.stringify(enrichedData),
        aiProvider: 'OpenAI',
        model: aiHelper.openaiModel,
        tokensUsed: enrichedData.metadata?.tokensUsed?.total_tokens || 0,
        processingTimeMs: processingTime,
        status: 'Success'
      });

      // Update stats
      this.stats.successful++;
      if (confidence >= 90) this.stats.highConfidence++;
      else if (confidence >= 70) this.stats.mediumConfidence++;
      else this.stats.lowConfidence++;

      this.stats.totalTokens += enrichedData.metadata?.tokensUsed?.total_tokens || 0;
      this.stats.totalProcessingTime += processingTime;

      this.log(`✓ Successfully enriched product ${product.PartNumber} (Confidence: ${confidence}%)`);

      return {
        success: true,
        productId: product.ProductID,
        partNumber: product.PartNumber,
        confidence,
        processingTime
      };
    } catch (error) {
      this.stats.failed++;
      this.log(`✗ Failed to enrich product ${product.PartNumber}: ${error.message}`, 'ERROR');

      // Log failure to database
      await sqlHelper.logEnrichment({
        inputText: JSON.stringify({
          productId: product.ProductID,
          partNumber: product.PartNumber,
          manufacturer: product.ManufacturerName
        }),
        outputText: null,
        aiProvider: 'OpenAI',
        model: aiHelper.openaiModel,
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        status: 'Error',
        errorMessage: error.message
      });

      return {
        success: false,
        productId: product.ProductID,
        partNumber: product.PartNumber,
        error: error.message
      };
    }
  }

  /**
   * Main enrichment process
   * @param {number} count - Number of products to process
   */
  async run(count = 20) {
    console.log('\n🚀 Starting Rules Engine Enrichment for ' + count + ' products...\n');
    console.log('━'.repeat(70));

    this.log('=== Starting Rules Engine Enrichment ===');
    this.log(`Target: ${count} products`);

    try {
      // Check AI configuration
      if (!aiHelper.isConfigured()) {
        throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in .env file');
      }

      // Check Google configuration (optional)
      if (!googleHelper.isConfigured()) {
        this.log('⚠ Google Custom Search not configured. Image search will use fallbacks.', 'WARN');
      }

      // Connect to database
      this.log('Connecting to QuoteWerks database...');
      await sqlHelper.connect();

      // Get unprocessed products
      this.log(`Fetching ${count} unprocessed products...`);
      const products = await sqlHelper.getUnprocessedProducts(count);

      if (products.length === 0) {
        console.log('✓ No unprocessed products found. All products are up to date!');
        return;
      }

      this.log(`Found ${products.length} products to process`);
      this.stats.total = products.length;

      console.log(`\n📦 Processing ${products.length} products...\n`);

      // Process each product
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        this.showProgress(i + 1, products.length, `Processing ${product.PartNumber || product.ProductID}`);

        await this.enrichProduct(product);

        // Small delay to avoid rate limiting
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('\n');
      console.log('━'.repeat(70));

      // Display summary
      this.displaySummary();

      this.log('=== Enrichment Complete ===');
    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'ERROR');
      console.error('\n❌ Fatal error:', error.message);
      throw error;
    } finally {
      // Disconnect from database
      await sqlHelper.disconnect();
    }
  }

  /**
   * Display enrichment summary
   */
  displaySummary() {
    const avgTime = this.stats.total > 0
      ? Math.round(this.stats.totalProcessingTime / this.stats.total)
      : 0;

    const avgTokens = this.stats.successful > 0
      ? Math.round(this.stats.totalTokens / this.stats.successful)
      : 0;

    console.log('\n📊 Enrichment Summary');
    console.log('─'.repeat(70));
    console.log(`Total Products Processed:  ${this.stats.total}`);
    console.log(`✓ Successful:              ${this.stats.successful} (${Math.round(this.stats.successful / this.stats.total * 100)}%)`);
    console.log(`✗ Failed:                  ${this.stats.failed}`);
    console.log('');
    console.log('AI Confidence:');
    console.log(`  High (≥90%):             ${this.stats.highConfidence} products`);
    console.log(`  Medium (70-89%):         ${this.stats.mediumConfidence} products`);
    console.log(`  Low (<70%):              ${this.stats.lowConfidence} products`);
    console.log('');
    console.log('Token Usage:');
    console.log(`  Total Tokens:            ${this.stats.totalTokens.toLocaleString()}`);
    console.log(`  Average per product:     ${avgTokens.toLocaleString()} tokens`);
    console.log('');
    console.log('Processing Time:');
    console.log(`  Total:                   ${Math.round(this.stats.totalProcessingTime / 1000)}s`);
    console.log(`  Average per product:     ${avgTime}ms`);
    console.log('');
    console.log('Images:');
    console.log(`  Images Found:            ${this.stats.imagesFound}`);
    console.log('');
    console.log('Next Steps:');
    console.log('  → Run algolia-sync.js to push enriched data to Algolia');
    if (this.stats.lowConfidence > 0) {
      console.log(`  → Review ${this.stats.lowConfidence} low-confidence products manually`);
    }
    console.log('━'.repeat(70));
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = parseInt(process.argv[2]) || 20;
  const engine = new RulesEngine();

  engine.run(count)
    .then(() => {
      console.log('\n✅ Enrichment completed successfully!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Enrichment failed:', error.message);
      process.exit(1);
    });
}

export default RulesEngine;
