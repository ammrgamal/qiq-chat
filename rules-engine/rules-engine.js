// rules-engine.js - Main AI enrichment engine for QuoteWerks products
import dotenv from 'dotenv';
import { appendFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cliProgress from 'cli-progress';
import sqlHelper from './utils/sql-helper.js';
import aiHelper from './utils/ai-helper.js';
import googleHelper from './utils/google-helper.js';

// Load environment variables
dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Rules Engine class for product enrichment
 */
class RulesEngine {
  constructor() {
    this.logFilePath = join(__dirname, 'logs', 'rules-engine.log');
    this.totalProcessed = 0;
    this.totalSucceeded = 0;
    this.totalFailed = 0;
    this.totalSkipped = 0;
    this.autoApproved = 0;
    this.requiresReview = 0;
    this.startTime = null;
  }

  /**
   * Initialize the rules engine
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Ensure logs directory exists
      await mkdir(join(__dirname, 'logs'), { recursive: true });
      
      // Log initialization
      await this.log('='.repeat(80));
      await this.log('Rules Engine Initialization');
      await this.log(`Started at: ${new Date().toISOString()}`);
      await this.log('='.repeat(80));

      // Connect to database
      await sqlHelper.connect();
      
      this.startTime = Date.now();
      
      console.log('');
      console.log('🚀 QuickITQuote Rules Engine');
      console.log('='.repeat(80));
    } catch (error) {
      console.error('✗ Failed to initialize rules engine:', error.message);
      throw error;
    }
  }

  /**
   * Log message to file and optionally console
   * @param {string} message - Message to log
   * @param {string} level - Log level (INFO, SUCCESS, ERROR, WARN)
   * @returns {Promise<void>}
   */
  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    
    try {
      await appendFile(this.logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Process a single product
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Processing result
   */
  async processProduct(product) {
    const productId = product.ID;
    const productName = product.ProductName;

    try {
      await this.log(`Processing product: ${productName} (ID: ${productId})`);

      // Step 1: AI Enrichment
      const enrichmentResult = await aiHelper.enrichProduct(product);
      
      if (enrichmentResult.status === 'Error') {
        throw new Error(enrichmentResult.error);
      }

      // Step 2: Image Search (if ImageFile is empty)
      let imageFile = product.ImageFile;
      if (!imageFile || imageFile.trim() === '') {
        imageFile = await googleHelper.findProductImage(product);
        enrichmentResult.imageFile = imageFile;
      }

      // Step 3: Update SQL database
      await sqlHelper.updateProductEnrichment(productId, enrichmentResult);

      // Step 4: Log to AI_Log table
      await sqlHelper.logProcessing({
        input: {
          productId,
          productName,
          manufacturer: product.Manufacturer,
          mpn: product.MPN
        },
        output: enrichmentResult,
        provider: enrichmentResult.provider,
        model: enrichmentResult.model,
        tokensUsed: enrichmentResult.tokensUsed,
        processingTimeMs: enrichmentResult.processingTimeMs,
        status: 'Success'
      });

      // Determine auto-approval status
      const autoApprove = enrichmentResult.confidence >= 90;
      if (autoApprove) {
        this.autoApproved++;
      } else {
        this.requiresReview++;
      }

      this.totalSucceeded++;
      await this.log(`SUCCESS: ${productName} (Confidence: ${enrichmentResult.confidence}%, Auto-approve: ${autoApprove})`, 'SUCCESS');

      return {
        productId,
        productName,
        success: true,
        confidence: enrichmentResult.confidence,
        autoApprove,
        tokensUsed: enrichmentResult.tokensUsed,
        processingTimeMs: enrichmentResult.processingTimeMs
      };
    } catch (error) {
      this.totalFailed++;
      await this.log(`FAILED: ${productName} - ${error.message}`, 'ERROR');
      
      // Log failure to database
      await sqlHelper.logProcessing({
        input: {
          productId,
          productName,
          manufacturer: product.Manufacturer,
          mpn: product.MPN
        },
        output: null,
        provider: 'OpenAI',
        model: aiHelper.openaiModel,
        tokensUsed: 0,
        processingTimeMs: 0,
        status: 'Error',
        errorMessage: error.message
      });

      return {
        productId,
        productName,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process multiple products with progress tracking
   * @param {number} limit - Number of products to process (default: 20)
   * @returns {Promise<Object>} Processing results
   */
  async processProducts(limit = 20) {
    try {
      // Get products for processing
      console.log(`\n📦 Fetching ${limit} products for processing...`);
      const products = await sqlHelper.getProductsForProcessing(limit);

      if (products.length === 0) {
        console.log('⊘ No products found for processing');
        await this.log('No products found for processing', 'WARN');
        return { results: [], summary: this.generateSummary([]) };
      }

      console.log(`✓ Found ${products.length} products to process\n`);
      await this.log(`Found ${products.length} products to process`);

      // Create progress bar
      const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% | {value}/{total} Products | Current: {product}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });

      progressBar.start(products.length, 0, { product: 'Starting...' });

      // Process products with concurrency limit (max 3 at a time)
      const results = [];
      const concurrencyLimit = 3;

      for (let i = 0; i < products.length; i += concurrencyLimit) {
        const batch = products.slice(i, i + concurrencyLimit);
        
        const batchPromises = batch.map(async (product) => {
          try {
            const result = await this.processProduct(product);
            this.totalProcessed++;
            progressBar.update(this.totalProcessed, { 
              product: product.ProductName.substring(0, 40) 
            });
            return result;
          } catch (error) {
            this.totalProcessed++;
            progressBar.update(this.totalProcessed, { 
              product: product.ProductName.substring(0, 40) 
            });
            return {
              productId: product.ID,
              productName: product.ProductName,
              success: false,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches
        if (i + concurrencyLimit < products.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      progressBar.stop();

      // Generate summary
      const summary = this.generateSummary(results);
      this.displaySummary(summary);

      return { results, summary };
    } catch (error) {
      console.error('✗ Failed to process products:', error.message);
      await this.log(`Failed to process products: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Generate processing summary
   * @param {Array} results - Array of processing results
   * @returns {Object} Summary object
   */
  generateSummary(results) {
    const totalTime = Date.now() - this.startTime;
    const avgTimePerProduct = results.length > 0 ? totalTime / results.length : 0;
    
    const totalTokens = results
      .filter(r => r.success && r.tokensUsed)
      .reduce((sum, r) => sum + r.tokensUsed, 0);

    return {
      totalProducts: results.length,
      successful: this.totalSucceeded,
      failed: this.totalFailed,
      skipped: this.totalSkipped,
      autoApproved: this.autoApproved,
      requiresReview: this.requiresReview,
      totalTime,
      avgTimePerProduct,
      totalTokens,
      successRate: results.length > 0 ? (this.totalSucceeded / results.length * 100).toFixed(1) : 0
    };
  }

  /**
   * Display summary in console
   * @param {Object} summary - Summary object
   */
  displaySummary(summary) {
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Processing Summary');
    console.log('─'.repeat(80));
    console.log(`Total Products:        ${summary.totalProducts}`);
    console.log(`Successful:            ${summary.successful} (${summary.successRate}%)`);
    console.log(`Failed:                ${summary.failed}`);
    console.log(`Skipped:               ${summary.skipped}`);
    console.log('');
    console.log(`✓ Auto-Approved:       ${summary.autoApproved} (${summary.autoApproved > 0 ? (summary.autoApproved / summary.totalProducts * 100).toFixed(1) : 0}%)`);
    console.log(`⚠ Requires Review:     ${summary.requiresReview}`);
    console.log('');
    console.log('⏱ Processing Time:');
    console.log(`  Total:               ${(summary.totalTime / 1000).toFixed(1)}s`);
    console.log(`  Average per product: ${summary.avgTimePerProduct.toFixed(0)}ms`);
    console.log('');
    console.log(`🤖 Total Tokens Used:  ${summary.totalTokens.toLocaleString()}`);
    console.log('');
    console.log('='.repeat(80));
  }

  /**
   * Shutdown the rules engine
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      await this.log('='.repeat(80));
      await this.log('Rules Engine Shutdown');
      await this.log(`Completed at: ${new Date().toISOString()}`);
      await this.log('='.repeat(80));
      
      await sqlHelper.disconnect();
      
      console.log('\n✓ Rules engine shutdown complete\n');
    } catch (error) {
      console.error('Error during shutdown:', error.message);
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  const engine = new RulesEngine();

  try {
    // Initialize
    await engine.initialize();

    // Get number of products from command line argument (default: 20)
    const limit = parseInt(process.argv[2]) || 20;

    // Process products
    await engine.processProducts(limit);

    // Shutdown
    await engine.shutdown();

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    await engine.log(`FATAL ERROR: ${error.message}`, 'ERROR');
    
    try {
      await engine.shutdown();
    } catch (shutdownError) {
      console.error('Error during emergency shutdown:', shutdownError.message);
    }

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export for use as module
export default RulesEngine;
export { main };
