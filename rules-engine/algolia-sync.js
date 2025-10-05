// algolia-sync.js - Sync enriched SQL products to Algolia
import dotenv from 'dotenv';
import algoliasearch from 'algoliasearch';
import { appendFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cliProgress from 'cli-progress';
import sqlHelper from './utils/sql-helper.js';

// Load environment variables
dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Algolia Sync class for syncing enriched products
 */
class AlgoliaSync {
  constructor() {
    this.logFilePath = join(__dirname, 'logs', 'algolia-sync.log');
    this.appId = process.env.ALGOLIA_APP_ID;
    this.apiKey = process.env.ALGOLIA_API_KEY;
    this.indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';
    this.client = null;
    this.index = null;
    this.totalSynced = 0;
    this.totalFailed = 0;
    this.totalSkipped = 0;
    this.startTime = null;

    if (!this.appId || !this.apiKey) {
      throw new Error('Algolia credentials not configured. Please set ALGOLIA_APP_ID and ALGOLIA_API_KEY in .env file.');
    }
  }

  /**
   * Initialize Algolia client
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Ensure logs directory exists
      await mkdir(join(__dirname, 'logs'), { recursive: true });
      
      // Log initialization
      await this.log('='.repeat(80));
      await this.log('Algolia Sync Initialization');
      await this.log(`Started at: ${new Date().toISOString()}`);
      await this.log('='.repeat(80));

      // Initialize Algolia client
      this.client = algoliasearch(this.appId, this.apiKey);
      this.index = this.client.initIndex(this.indexName);
      
      console.log('');
      console.log('🔄 QuickITQuote Algolia Sync');
      console.log('='.repeat(80));
      console.log(`✓ Connected to Algolia index: ${this.indexName}`);

      // Connect to database
      await sqlHelper.connect();
      
      this.startTime = Date.now();
    } catch (error) {
      console.error('✗ Failed to initialize Algolia sync:', error.message);
      throw error;
    }
  }

  /**
   * Log message to file
   * @param {string} message - Message to log
   * @param {string} level - Log level
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
   * Normalize file URL (replace backslashes with forward slashes)
   * @param {string} url - File URL
   * @returns {string} Normalized URL
   */
  normalizeFileUrl(url) {
    if (!url) return '';
    return url.replace(/\\/g, '/');
  }

  /**
   * Truncate long text to max length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Split and deduplicate custom fields
   * @param {string} text - Text to split
   * @returns {Array<string>} Array of unique values
   */
  splitAndDedupe(text) {
    if (!text) return [];
    const values = text
      .split(/[,;\n]+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);
    return [...new Set(values)]; // Deduplicate
  }

  /**
   * Map availability value
   * @param {number} availability - Availability value (1 or 0)
   * @returns {string} "Stock" or "on back order"
   */
  mapAvailability(availability) {
    return availability === 1 ? 'Stock' : 'on back order';
  }

  /**
   * Transform SQL product to Algolia record
   * @param {Object} product - SQL product object
   * @returns {Object} Algolia record
   */
  transformProduct(product) {
    try {
      // Generate objectID (stable unique identifier)
      const objectID = product.MPN || product.InternalPartNumber || `product-${product.ID}`;
      
      // Collect custom_memo fields (CustomMemo01-05)
      const customMemo = [];
      for (let i = 1; i <= 5; i++) {
        const field = product[`CustomMemo0${i}`];
        if (field) {
          customMemo.push(...this.splitAndDedupe(field));
        }
      }

      // Collect custom_text fields (CustomText01-20)
      const customText = [];
      for (let i = 1; i <= 20; i++) {
        const fieldNum = i.toString().padStart(2, '0');
        const field = product[`CustomText${fieldNum}`];
        if (field) {
          customText.push(...this.splitAndDedupe(field));
        }
      }

      // Parse tags from KeywordList
      const tags = this.splitAndDedupe(product.KeywordList);

      // Calculate availability_weight
      const availabilityWeight = product.Availability === 1 ? 100 : 50;

      // Build Algolia record according to canonical schema
      const record = {
        objectID,
        sku: objectID,
        mpn: product.MPN || '',
        name: product.ProductName || '',
        brand: product.Manufacturer || '',
        category: product.Category || '',
        unit: product.UnitOfMeasure || '',
        availability: this.mapAvailability(product.Availability),
        availability_weight: availabilityWeight,
        price: parseFloat(product.Price) || 0,
        list_price: parseFloat(product.ListPrice) || 0,
        cost: parseFloat(product.Cost) || 0,
        image: this.normalizeFileUrl(product.ImageFile),
        spec_sheet: '', // Can be populated if available
        link: '', // Can be populated if available
        ShortDescription: this.truncateText(product.ShortDescription, 500),
        ExtendedDescription: this.truncateText(product.ExtendedDescription, 4000),
        custom_memo: [...new Set(customMemo)].slice(0, 20), // Dedupe and limit
        custom_text: [...new Set(customText)].slice(0, 50), // Dedupe and limit
        tags: [...new Set(tags)].slice(0, 30), // Dedupe and limit
        Discontinued: product.Discontinued === 1,
        LastModified: product.LastModified ? new Date(product.LastModified).toISOString() : new Date().toISOString(),
        
        // Additional metadata
        _ai_confidence: product.AIConfidence || 0,
        _ai_processed: product.AIProcessed === 1
      };

      return record;
    } catch (error) {
      console.error(`✗ Failed to transform product ${product.ID}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync a batch of products to Algolia
   * @param {Array} products - Array of product objects
   * @returns {Promise<Object>} Sync result
   */
  async syncBatch(products) {
    try {
      // Transform products to Algolia records
      const records = products.map(product => this.transformProduct(product));

      // Save objects to Algolia (replace or update)
      const result = await this.index.saveObjects(records);

      this.totalSynced += records.length;
      
      await this.log(`Synced batch of ${records.length} products`, 'SUCCESS');
      
      return {
        success: true,
        count: records.length,
        objectIDs: result.objectIDs
      };
    } catch (error) {
      this.totalFailed += products.length;
      await this.log(`Failed to sync batch: ${error.message}`, 'ERROR');
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync all enriched products to Algolia
   * @param {number} batchSize - Batch size for syncing (default: 100)
   * @returns {Promise<Object>} Sync summary
   */
  async syncProducts(batchSize = 100) {
    try {
      // Get enriched products from SQL
      console.log('\n📦 Fetching enriched products from database...');
      const products = await sqlHelper.getEnrichedProducts();

      if (products.length === 0) {
        console.log('⊘ No enriched products found to sync');
        await this.log('No enriched products found to sync', 'WARN');
        return { synced: 0, failed: 0 };
      }

      console.log(`✓ Found ${products.length} enriched products to sync\n`);
      await this.log(`Found ${products.length} enriched products to sync`);

      // Create progress bar
      const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% | {value}/{total} Products',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });

      progressBar.start(products.length, 0);

      // Process products in batches
      const results = [];
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        try {
          const result = await this.syncBatch(batch);
          results.push(result);
          progressBar.update(Math.min(i + batchSize, products.length));
          
          // Small delay between batches to avoid rate limiting
          if (i + batchSize < products.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`✗ Failed to sync batch starting at index ${i}:`, error.message);
          results.push({ success: false, error: error.message });
          progressBar.update(Math.min(i + batchSize, products.length));
        }
      }

      progressBar.stop();

      // Generate summary
      const summary = this.generateSummary(products.length);
      this.displaySummary(summary);

      return summary;
    } catch (error) {
      console.error('✗ Failed to sync products:', error.message);
      await this.log(`Failed to sync products: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Generate sync summary
   * @param {number} totalProducts - Total number of products
   * @returns {Object} Summary object
   */
  generateSummary(totalProducts) {
    const totalTime = Date.now() - this.startTime;
    const avgTimePerProduct = totalProducts > 0 ? totalTime / totalProducts : 0;

    return {
      totalProducts,
      synced: this.totalSynced,
      failed: this.totalFailed,
      skipped: this.totalSkipped,
      totalTime,
      avgTimePerProduct,
      successRate: totalProducts > 0 ? (this.totalSynced / totalProducts * 100).toFixed(1) : 0
    };
  }

  /**
   * Display summary in console
   * @param {Object} summary - Summary object
   */
  displaySummary(summary) {
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Algolia Sync Summary');
    console.log('─'.repeat(80));
    console.log(`Total Products:        ${summary.totalProducts}`);
    console.log(`Synced:                ${summary.synced} (${summary.successRate}%)`);
    console.log(`Failed:                ${summary.failed}`);
    console.log(`Skipped:               ${summary.skipped}`);
    console.log('');
    console.log('⏱ Sync Time:');
    console.log(`  Total:               ${(summary.totalTime / 1000).toFixed(1)}s`);
    console.log(`  Average per product: ${summary.avgTimePerProduct.toFixed(0)}ms`);
    console.log('');
    console.log('='.repeat(80));
  }

  /**
   * Shutdown Algolia sync
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      await this.log('='.repeat(80));
      await this.log('Algolia Sync Shutdown');
      await this.log(`Completed at: ${new Date().toISOString()}`);
      await this.log('='.repeat(80));
      
      await sqlHelper.disconnect();
      
      console.log('\n✓ Algolia sync shutdown complete\n');
    } catch (error) {
      console.error('Error during shutdown:', error.message);
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  const sync = new AlgoliaSync();

  try {
    // Initialize
    await sync.initialize();

    // Get batch size from command line argument (default: 100)
    const batchSize = parseInt(process.argv[2]) || 100;

    // Sync products
    await sync.syncProducts(batchSize);

    // Shutdown
    await sync.shutdown();

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    await sync.log(`FATAL ERROR: ${error.message}`, 'ERROR');
    
    try {
      await sync.shutdown();
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
export default AlgoliaSync;
export { main };
