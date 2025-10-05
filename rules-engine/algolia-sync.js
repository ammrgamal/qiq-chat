// algolia-sync.js
// Sync enriched SQL data to Algolia index
// Reference: mapping-reference.md

import dotenv from 'dotenv';
import sqlHelper from './utils/sql-helper.js';
import { appendFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
try {
  const rootEnvPath = join(__dirname, '..', '.env');
  dotenv.config({ path: rootEnvPath });
} catch (error) {
  console.warn('Could not load .env file:', error.message);
}

class AlgoliaSync {
  constructor() {
    this.algoliaAppId = process.env.ALGOLIA_APP_ID;
    this.algoliaApiKey = process.env.ALGOLIA_API_KEY;
    this.algoliaIndexName = process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';
    this.logPath = join(__dirname, 'logs', 'sync.log');
    this.stats = {
      total: 0,
      synced: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Log message to console and file
   * @param {string} message - Log message
   * @param {string} level - Log level
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
   * Check if Algolia is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.algoliaAppId && this.algoliaApiKey);
  }

  /**
   * Get Algolia client
   * @returns {Promise<Object>} Algolia client and index
   */
  async getAlgoliaClient() {
    // Dynamic import of algoliasearch
    const { default: algoliasearch } = await import('algoliasearch');

    const client = algoliasearch(this.algoliaAppId, this.algoliaApiKey);
    const index = client.initIndex(this.algoliaIndexName);

    return { client, index };
  }

  /**
   * Transform SQL product to Algolia object
   * @param {Object} product - Product from SQL database
   * @returns {Object} Algolia object
   */
  transformProduct(product) {
    // Parse JSON fields
    let rulesProduct = null;
    let rulesCategory = null;

    try {
      if (product.CustomText05) {
        rulesProduct = JSON.parse(product.CustomText05);
      }
    } catch (error) {
      console.warn(`Failed to parse CustomText05 for product ${product.ProductID}`);
    }

    try {
      if (product.CustomText06) {
        rulesCategory = JSON.parse(product.CustomText06);
      }
    } catch (error) {
      console.warn(`Failed to parse CustomText06 for product ${product.ProductID}`);
    }

    // Split features into array if it's an HTML list
    let featuresArray = [];
    if (product.CustomMemo03) {
      const matches = product.CustomMemo03.match(/<li>(.*?)<\/li>/g);
      if (matches) {
        featuresArray = matches.map(m => m.replace(/<\/?li>/g, '').trim());
      }
    }

    return {
      objectID: product.ProductID.toString(),
      productId: product.ProductID,
      partNumber: product.PartNumber || '',
      description: product.Description || '',
      manufacturerName: product.ManufacturerName || '',
      price: product.Price || 0,
      imageUrl: product.ImageFile || '',

      // Enriched content
      shortDescription: product.CustomMemo01 || '',
      longDescription: product.CustomMemo02 || '',
      features: featuresArray,
      featuresHtml: product.CustomMemo03 || '',
      specifications: product.CustomMemo04 || '',
      faq: product.CustomMemo05 || '',
      prerequisites: product.CustomMemo06 || '',
      relatedItems: product.CustomMemo07 || '',
      professionalServices: product.CustomMemo08 || '',
      upsellRecommendations: product.CustomMemo09 || '',
      marketingMessage: product.CustomMemo10 || '',

      // Classification
      category: product.CustomText01 || '',
      subcategory: product.CustomText02 || '',
      manufacturer: product.CustomText03 || product.ManufacturerName || '',
      productType: product.CustomText04 || '',

      // Rules
      rulesProduct: rulesProduct,
      rulesCategory: rulesCategory,

      // AI metadata
      aiConfidence: product.CustomNumber01 || 0,
      aiProcessed: product.CustomNumber02 === 1,
      aiProcessedDate: product.CustomDate01 ? new Date(product.CustomDate01).getTime() : null,

      // Searchable attributes (for Algolia)
      _tags: [
        product.CustomText01, // category
        product.CustomText02, // subcategory
        product.ManufacturerName
      ].filter(Boolean)
    };
  }

  /**
   * Sync products to Algolia
   * @param {number} batchSize - Batch size for syncing
   */
  async sync(batchSize = 100) {
    console.log('\n🔄 Starting Algolia Sync...\n');
    console.log('━'.repeat(70));

    this.log('=== Starting Algolia Sync ===');

    try {
      // Check configuration
      if (!this.isConfigured()) {
        throw new Error('Algolia not configured. Please set ALGOLIA_APP_ID and ALGOLIA_API_KEY in .env');
      }

      this.log('Algolia configuration found');
      this.log(`Target index: ${this.algoliaIndexName}`);

      // Connect to database
      this.log('Connecting to QuoteWerks database...');
      await sqlHelper.connect();

      // Get all processed products
      this.log('Fetching processed products...');
      const products = await this.getProcessedProducts();

      if (products.length === 0) {
        console.log('✓ No processed products to sync');
        return;
      }

      this.log(`Found ${products.length} products to sync`);
      this.stats.total = products.length;

      // Get Algolia client
      this.log('Initializing Algolia client...');
      const { index } = await this.getAlgoliaClient();

      // Transform products
      this.log('Transforming product data...');
      const algoliaObjects = products.map(p => this.transformProduct(p));

      // Sync in batches
      this.log(`Syncing ${algoliaObjects.length} products in batches of ${batchSize}...`);

      for (let i = 0; i < algoliaObjects.length; i += batchSize) {
        const batch = algoliaObjects.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(algoliaObjects.length / batchSize);

        console.log(`📤 Syncing batch ${batchNum}/${totalBatches} (${batch.length} products)...`);

        try {
          await index.saveObjects(batch);
          this.stats.synced += batch.length;
          this.log(`✓ Batch ${batchNum} synced successfully`);
        } catch (error) {
          this.stats.failed += batch.length;
          this.log(`✗ Batch ${batchNum} failed: ${error.message}`, 'ERROR');
          console.error(`❌ Batch ${batchNum} failed:`, error.message);
        }

        // Small delay between batches
        if (i + batchSize < algoliaObjects.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log('\n');
      console.log('━'.repeat(70));

      // Display summary
      this.displaySummary();

      this.log('=== Algolia Sync Complete ===');
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
   * Get processed products from database
   * @returns {Promise<Array>} Array of products
   */
  async getProcessedProducts() {
    const result = await sqlHelper.pool.request().query(`
      SELECT
        ProductID, PartNumber, Description, ManufacturerName, Price,
        CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
        CustomMemo06, CustomMemo07, CustomMemo08, CustomMemo09, CustomMemo10,
        CustomText01, CustomText02, CustomText03, CustomText04, CustomText05, CustomText06,
        CustomNumber01, CustomNumber02,
        CustomDate01,
        ImageFile
      FROM Products
      WHERE CustomNumber02 = 1
      ORDER BY CustomDate01 DESC
    `);

    return result.recordset;
  }

  /**
   * Display sync summary
   */
  displaySummary() {
    console.log('\n📊 Sync Summary');
    console.log('─'.repeat(70));
    console.log(`Total Products:            ${this.stats.total}`);
    console.log(`✓ Synced to Algolia:       ${this.stats.synced}`);
    console.log(`✗ Failed:                  ${this.stats.failed}`);
    console.log(`⊝ Skipped:                 ${this.stats.skipped}`);
    console.log('');
    console.log(`Algolia Index:             ${this.algoliaIndexName}`);
    console.log('');
    console.log('Next Steps:');
    console.log('  → Test search functionality in your application');
    console.log('  → Verify products appear in Algolia dashboard');
    console.log('  → Schedule periodic sync (every 6 hours recommended)');
    console.log('━'.repeat(70));
  }

  /**
   * Configure Algolia index settings
   * @returns {Promise<void>}
   */
  async configureIndexSettings() {
    this.log('Configuring Algolia index settings...');

    const { index } = await this.getAlgoliaClient();

    const settings = {
      searchableAttributes: [
        'partNumber',
        'description',
        'shortDescription',
        'longDescription',
        'features',
        'manufacturerName',
        'category',
        'subcategory',
        'productType'
      ],
      attributesForFaceting: [
        'category',
        'subcategory',
        'manufacturer',
        'productType',
        'aiProcessed'
      ],
      customRanking: [
        'desc(aiConfidence)',
        'desc(price)'
      ],
      attributesToRetrieve: [
        'objectID',
        'productId',
        'partNumber',
        'description',
        'shortDescription',
        'longDescription',
        'features',
        'imageUrl',
        'manufacturerName',
        'price',
        'category',
        'subcategory',
        'aiConfidence'
      ],
      attributesToHighlight: [
        'description',
        'shortDescription',
        'features'
      ],
      highlightPreTag: '<mark style="color: #0055A4; background-color: transparent; font-weight: bold;">',
      highlightPostTag: '</mark>',
      removeWordsIfNoResults: 'allOptional'
    };

    await index.setSettings(settings);
    this.log('✓ Index settings configured');
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new AlgoliaSync();

  // Check for --configure flag
  const shouldConfigure = process.argv.includes('--configure');

  (async () => {
    try {
      if (shouldConfigure) {
        console.log('🔧 Configuring Algolia index settings...\n');
        await sync.configureIndexSettings();
        console.log('\n✅ Index settings configured successfully!\n');
      }

      await sync.sync();
      console.log('\n✅ Sync completed successfully!\n');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Sync failed:', error.message);
      process.exit(1);
    }
  })();
}

export default AlgoliaSync;
