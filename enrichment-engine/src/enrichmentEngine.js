// enrichmentEngine.js - Main enrichment engine orchestrator
import cliProgress from 'cli-progress';
import logger from './logger.js';
import dbService from './dbService.js';
import enrichmentService from './enrichmentService.js';
import imageService from './imageService.js';
import algoliaService from './algoliaService.js';

class EnrichmentEngine {
  constructor() {
    this.isInitialized = false;
    this.stats = {
      total: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Initialize the enrichment engine
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Enrichment engine already initialized');
      return;
    }

    try {
      logger.banner('Enrichment Engine Initialization');
      
      // Connect to database
      await dbService.connect();
      
      this.isInitialized = true;
      logger.success('Enrichment engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize enrichment engine', error);
      throw error;
    }
  }

  /**
   * Process products in batch
   * @param {number} batchSize - Number of products to process
   * @returns {Promise<Object>} Processing results
   */
  async processBatch(batchSize = 20) {
    if (!this.isInitialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    try {
      logger.banner('Product Enrichment Batch Processing');
      
      // Get products for enrichment
      logger.info(`Fetching ${batchSize} products for enrichment...`);
      const products = await dbService.getProductsForEnrichment(batchSize);
      
      if (products.length === 0) {
        logger.warn('No products found for enrichment');
        return {
          success: true,
          message: 'No products to process',
          stats: this.stats
        };
      }

      // Start batch tracking
      const batchId = await dbService.startBatch(products.length);
      logger.info(`Starting batch ${batchId} with ${products.length} products\n`);

      // Initialize stats
      this.stats = {
        total: products.length,
        processed: 0,
        skipped: 0,
        failed: 0,
        startTime: Date.now(),
        endTime: null
      };

      // Create progress bar
      const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% | {value}/{total} Products | ETA: {eta}s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      progressBar.start(products.length, 0);

      // Process each product
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
          await this.processProduct(product);
          this.stats.processed++;
        } catch (error) {
          logger.error(`Failed to process ${product.ManufacturerPartNo}`, error);
          this.stats.failed++;
        }
        
        progressBar.update(i + 1);
      }

      progressBar.stop();

      // Calculate stats
      this.stats.endTime = Date.now();
      const totalTime = (this.stats.endTime - this.stats.startTime) / 1000;
      const successRate = ((this.stats.processed / this.stats.total) * 100).toFixed(2);
      const avgTime = Math.round(totalTime * 1000 / this.stats.total);

      // Update batch in database
      await dbService.updateBatch(batchId, {
        processed: this.stats.processed,
        skipped: this.stats.skipped,
        failed: this.stats.failed,
        successRate: parseFloat(successRate),
        averageTime: avgTime,
        status: 'Completed',
        notes: `Processed ${this.stats.processed}/${this.stats.total} products successfully`
      });

      // Display summary
      this.displaySummary(totalTime, successRate, avgTime);

      // Sync to Algolia if there were successful enrichments
      if (this.stats.processed > 0) {
        await this.syncToAlgolia();
      }

      return {
        success: true,
        stats: this.stats,
        batchId
      };
    } catch (error) {
      logger.error('Batch processing failed', error);
      throw error;
    }
  }

  /**
   * Process a single product
   * @param {Object} product - Product object
   * @returns {Promise<void>}
   */
  async processProduct(product) {
    const startTime = Date.now();
    const fieldsUpdated = [];

    try {
      logger.debug(`Processing ${product.ManufacturerPartNo}...`);

      // Step 1: AI Enrichment
      const enrichedData = await enrichmentService.enrichProduct(product);
      
      // Step 2: Image fetching (if no image exists)
      if (!product.ImageFile && !product.CustomText05) {
        const imageData = await imageService.fetchProductImage(product);
        enrichedData.imageUrl = imageData.url;
        fieldsUpdated.push('image');
      }

      // Step 3: Update database
      await dbService.updateProduct(product.ManufacturerPartNo, enrichedData);
      
      // Track which fields were updated
      Object.keys(enrichedData).forEach(key => {
        if (enrichedData[key] && key !== 'provider' && key !== 'processingTime') {
          fieldsUpdated.push(key);
        }
      });

      // Step 4: Log the operation
      const timeTaken = Date.now() - startTime;
      await dbService.logEnrichment({
        productId: product.ManufacturerPartNo,
        productName: product.Description,
        operationType: 'Enrichment',
        aiProvider: enrichedData.provider,
        aiConfidence: enrichedData.confidence,
        timeTaken,
        status: 'Success',
        errorMessage: null,
        fieldsUpdated: JSON.stringify(fieldsUpdated),
        metadata: JSON.stringify({
          tokensUsed: enrichedData.tokensUsed || 0,
          model: enrichedData.model || 'N/A'
        })
      });

      logger.success(`✓ ${product.ManufacturerPartNo} (${timeTaken}ms, ${fieldsUpdated.length} fields)`);
    } catch (error) {
      const timeTaken = Date.now() - startTime;
      
      // Log the error
      await dbService.logEnrichment({
        productId: product.ManufacturerPartNo,
        productName: product.Description,
        operationType: 'Enrichment',
        aiProvider: null,
        aiConfidence: null,
        timeTaken,
        status: 'Error',
        errorMessage: error.message,
        fieldsUpdated: JSON.stringify(fieldsUpdated),
        metadata: null
      });

      throw error;
    }
  }

  /**
   * Sync enriched products to Algolia
   * @returns {Promise<void>}
   */
  async syncToAlgolia() {
    try {
      logger.section('Algolia Synchronization');
      
      if (!algoliaService.isConfigured()) {
        logger.warn('Algolia not configured - skipping sync');
        return;
      }

      logger.info('Fetching enriched products from database...');
      const products = await dbService.getProductsForAlgoliaSync();
      
      if (products.length === 0) {
        logger.warn('No enriched products to sync');
        return;
      }

      logger.info(`Syncing ${products.length} products to Algolia...`);
      const result = await algoliaService.syncProducts(products);
      
      if (result.success) {
        logger.success(`✓ Synced ${result.synced} products to Algolia`);
      } else {
        logger.warn(`Algolia sync failed: ${result.reason}`);
      }
    } catch (error) {
      logger.error('Failed to sync to Algolia', error);
      // Don't throw - Algolia sync failure shouldn't stop the process
    }
  }

  /**
   * Display processing summary
   * @param {number} totalTime - Total time in seconds
   * @param {string} successRate - Success rate percentage
   * @param {number} avgTime - Average time per product in ms
   */
  displaySummary(totalTime, successRate, avgTime) {
    logger.banner('Processing Summary');
    
    console.log(`
📊 Results:
────────────────────────────────────────────────────────
Total Products:        ${this.stats.total}
✓ Successfully Processed: ${this.stats.processed} (${successRate}%)
⚠ Failed:                 ${this.stats.failed}
⊘ Skipped:                ${this.stats.skipped}

⏱ Performance:
────────────────────────────────────────────────────────
Total Time:            ${totalTime.toFixed(2)}s
Average per Product:   ${avgTime}ms
Success Rate:          ${successRate}%

────────────────────────────────────────────────────────
    `);
  }

  /**
   * Shutdown the engine gracefully
   */
  async shutdown() {
    try {
      logger.info('Shutting down enrichment engine...');
      await dbService.disconnect();
      logger.success('Engine shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown', error);
    }
  }
}

// Export singleton instance
export default new EnrichmentEngine();
