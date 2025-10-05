// algoliaSync.js - Sync enriched product data to Algolia
import algoliasearch from 'algoliasearch';
import dotenv from 'dotenv';
import logger from './logger.js';
import dbService from './dbService.js';

// Load environment variables
dotenv.config({ path: '../.env' });

class AlgoliaSyncService {
  constructor() {
    this.algoliaAppId = process.env.ALGOLIA_APP_ID;
    this.algoliaApiKey = process.env.ALGOLIA_ADMIN_API_KEY;
    this.indexName = process.env.ALGOLIA_INDEX_NAME || 'quickitquote_products';
    this.client = null;
    this.index = null;
    this.maxRecordSize = 10000; // 10KB max
    this.maxArrayItems = 20;
  }

  /**
   * Initialize Algolia client
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.algoliaAppId || !this.algoliaApiKey) {
      throw new Error('Algolia credentials not configured. Set ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY in .env');
    }

    try {
      this.client = algoliasearch(this.algoliaAppId, this.algoliaApiKey);
      this.index = this.client.initIndex(this.indexName);
      logger.success(`Algolia client initialized for index: ${this.indexName}`);
    } catch (error) {
      logger.error('Failed to initialize Algolia client', error);
      throw error;
    }
  }

  /**
   * Sync enriched products to Algolia
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync results
   */
  async syncProducts(options = {}) {
    const {
      fullSync = false,
      batchSize = 1000,
      lastSyncTime = null
    } = options;

    try {
      await this.initialize();

      // Get products to sync
      const products = await this.getProductsForSync(fullSync, lastSyncTime);
      
      if (products.length === 0) {
        logger.info('No products to sync');
        return {
          success: true,
          synced: 0,
          failed: 0,
          skipped: 0
        };
      }

      logger.info(`Syncing ${products.length} products to Algolia...`);

      // Transform products to Algolia format
      const algoliaRecords = products.map(p => this.transformToAlgolia(p)).filter(r => r !== null);

      // Batch upload to Algolia
      const results = await this.batchUpload(algoliaRecords, batchSize);

      logger.success(`Sync complete: ${results.synced} synced, ${results.failed} failed`);

      return results;

    } catch (error) {
      logger.error('Algolia sync failed', error);
      throw error;
    }
  }

  /**
   * Get products from database for syncing
   * @param {boolean} fullSync - Whether to sync all products
   * @param {string} lastSyncTime - Last sync timestamp
   * @returns {Promise<Array>} Array of products
   */
  async getProductsForSync(fullSync, lastSyncTime) {
    try {
      let query;
      
      if (fullSync) {
        // Full sync: get all AI-processed products
        query = `
          SELECT * FROM dbo.Rules_Item
          WHERE AIProcessed = 1 AND IsActive = 1
          ORDER BY ModifiedDate DESC
        `;
      } else if (lastSyncTime) {
        // Incremental sync: get products modified since last sync
        query = `
          SELECT * FROM dbo.Rules_Item
          WHERE AIProcessed = 1 
            AND IsActive = 1
            AND (ModifiedDate > @lastSyncTime OR AIProcessedDate > @lastSyncTime)
          ORDER BY ModifiedDate DESC
        `;
      } else {
        // Default: get all AI-processed products from last 24 hours
        query = `
          SELECT * FROM dbo.Rules_Item
          WHERE AIProcessed = 1 
            AND IsActive = 1
            AND AIProcessedDate > DATEADD(hour, -24, GETDATE())
          ORDER BY ModifiedDate DESC
        `;
      }

      const result = await dbService.query(query, { lastSyncTime });
      return result.recordset || [];

    } catch (error) {
      logger.error('Failed to fetch products for sync', error);
      throw error;
    }
  }

  /**
   * Transform SQL product to Algolia record format
   * @param {Object} product - Product from SQL
   * @returns {Object|null} Algolia record or null if invalid
   */
  transformToAlgolia(product) {
    try {
      // Build base record
      const record = {
        // Core identifiers
        objectID: this.generateObjectID(product),
        sku: product.PartNumber || product.RuleID.toString(),
        mpn: product.PartNumber || '',
        name: product.ProductName || '',
        brand: product.Manufacturer || '',
        category: product.Category || '',
        subcategory: product.SubCategory || '',
        
        // Availability
        unit: 'EA', // Default unit
        availability: product.IsActive ? 'Stock' : 'on back order',
        availability_weight: product.IsActive ? 100 : 50,
        
        // Pricing
        price: product.MinPrice || 0,
        list_price: product.MaxPrice || 0,
        cost: 0, // Not available in Rules_Item
        
        // URLs (placeholders)
        image: this.normalizeUrl(product.ProductImage) || '',
        spec_sheet: '',
        link: '',
        
        // Descriptions
        ShortDescription: this.truncateString(product.ShortDescription, 500) || '',
        ExtendedDescription: this.truncateString(product.LongDescription, 4000) || '',
        
        // Metadata
        tags: this.parseKeywords(product.Keywords),
        Discontinued: !product.IsActive,
        LastModified: this.toISOString(product.ModifiedDate),
        
        // Enrichment data
        ai_processed: !!product.AIProcessed,
        ai_processed_date: this.toISOString(product.AIProcessedDate),
        auto_approve: !!product.AutoApprove,
        classification_type: product.Classification || 'Standard',
        classification_confidence: product.Confidence || 0,
        enrichment_confidence: product.EnrichmentConfidence || 0,
        lead_time_days: product.LeadTimeDays || 7
      };

      // Add enrichment fields if available
      if (product.TechnicalSpecs) {
        record.specs = this.parseJSON(product.TechnicalSpecs);
      }
      
      if (product.KeyFeatures) {
        record.features = this.limitArray(this.parseJSON(product.KeyFeatures), this.maxArrayItems);
      }
      
      if (product.FAQ) {
        record.faq = this.limitArray(this.parseJSON(product.FAQ), 10);
      }
      
      if (product.UpsellSuggestions) {
        record.upsells = this.limitArray(this.parseJSON(product.UpsellSuggestions), this.maxArrayItems);
      }
      
      if (product.BundleSuggestions) {
        record.bundles = this.limitArray(this.parseJSON(product.BundleSuggestions), this.maxArrayItems);
      }
      
      if (product.CustomerValue) {
        record.value_statement = product.CustomerValue;
      }

      // Apply size guard
      const recordSize = JSON.stringify(record).length;
      if (recordSize > this.maxRecordSize) {
        logger.warn(`Record too large (${recordSize} bytes): ${record.name}. Truncating...`);
        return this.truncateRecord(record);
      }

      return record;

    } catch (error) {
      logger.error(`Failed to transform product ${product.ProductName}`, error);
      return null;
    }
  }

  /**
   * Generate stable objectID for product
   * @param {Object} product - Product object
   * @returns {string} Object ID
   */
  generateObjectID(product) {
    // Prefer PartNumber, fall back to RuleID
    if (product.PartNumber && product.PartNumber.trim()) {
      return product.PartNumber.trim();
    }
    return `RULE_${product.RuleID}`;
  }

  /**
   * Normalize file URL
   * @param {string} url - URL string
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    // Replace backslashes with forward slashes, don't encode spaces
    return url.replace(/\\/g, '/');
  }

  /**
   * Parse comma-separated keywords to array
   * @param {string} keywords - Comma-separated keywords
   * @returns {Array} Array of keywords
   */
  parseKeywords(keywords) {
    if (!keywords) return [];
    return keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 50); // Max 50 tags
  }

  /**
   * Parse JSON string safely
   * @param {string} jsonString - JSON string
   * @returns {any} Parsed object or default
   */
  parseJSON(jsonString) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn('Failed to parse JSON field', error);
      return null;
    }
  }

  /**
   * Truncate string to max length
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated string
   */
  truncateString(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Limit array to max items
   * @param {Array} arr - Array to limit
   * @param {number} maxItems - Maximum items
   * @returns {Array} Limited array
   */
  limitArray(arr, maxItems) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, maxItems);
  }

  /**
   * Convert date to ISO string
   * @param {Date|string} date - Date object or string
   * @returns {string} ISO date string
   */
  toISOString(date) {
    if (!date) return '';
    try {
      return new Date(date).toISOString();
    } catch (error) {
      return '';
    }
  }

  /**
   * Truncate record to fit size limit
   * @param {Object} record - Algolia record
   * @returns {Object} Truncated record
   */
  truncateRecord(record) {
    // Progressively truncate fields
    if (record.ExtendedDescription) {
      record.ExtendedDescription = this.truncateString(record.ExtendedDescription, 2000);
    }
    if (record.ShortDescription) {
      record.ShortDescription = this.truncateString(record.ShortDescription, 300);
    }
    if (record.features) {
      record.features = this.limitArray(record.features, 10);
    }
    if (record.faq) {
      record.faq = this.limitArray(record.faq, 5);
    }
    
    // If still too large, remove optional fields
    const size = JSON.stringify(record).length;
    if (size > this.maxRecordSize) {
      delete record.faq;
      delete record.specs;
    }

    return record;
  }

  /**
   * Batch upload records to Algolia
   * @param {Array} records - Array of Algolia records
   * @param {number} batchSize - Batch size
   * @returns {Promise<Object>} Upload results
   */
  async batchUpload(records, batchSize) {
    const results = {
      synced: 0,
      failed: 0,
      errors: []
    };

    // Split into batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        await this.index.saveObjects(batch);
        results.synced += batch.length;
        logger.info(`Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message
        });
        logger.error(`Failed to upload batch ${Math.floor(i / batchSize) + 1}`, error);
        
        // If >10% failures, abort
        if (results.failed / records.length > 0.1) {
          throw new Error('Too many failures, aborting sync');
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * Apply Algolia index settings
   * @returns {Promise<void>}
   */
  async applyIndexSettings() {
    const settings = {
      searchableAttributes: [
        'sku',
        'mpn',
        'name',
        'brand',
        'category',
        'tags',
        'ShortDescription',
        'ExtendedDescription',
        'features'
      ],
      attributesForFaceting: [
        'brand',
        'category',
        'subcategory',
        'unit',
        'availability',
        'auto_approve',
        'classification_type',
        'Discontinued',
        'tags'
      ],
      customRanking: [
        'desc(availability_weight)',
        'desc(enrichment_confidence)',
        'asc(price)',
        'desc(classification_confidence)',
        'asc(name)'
      ],
      attributesToSnippet: [
        'ExtendedDescription:40',
        'ShortDescription:20'
      ],
      attributesToHighlight: [
        'sku',
        'mpn',
        'name',
        'tags',
        'features'
      ],
      removeWordsIfNoResults: 'allOptional',
      ignorePlurals: true,
      typoTolerance: 'min',
      decompoundQuery: true
    };

    try {
      await this.index.setSettings(settings);
      logger.success('Algolia index settings applied successfully');
    } catch (error) {
      logger.error('Failed to apply Algolia index settings', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new AlgoliaSyncService();

// CLI interface for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new AlgoliaSyncService();
  
  const args = process.argv.slice(2);
  const fullSync = args.includes('--full');
  const applySettings = args.includes('--apply-settings');

  (async () => {
    try {
      logger.banner('Algolia Sync Service');
      
      if (applySettings) {
        logger.info('Applying index settings...');
        await service.initialize();
        await service.applyIndexSettings();
      } else {
        logger.info(`Starting ${fullSync ? 'full' : 'incremental'} sync...`);
        const results = await service.syncProducts({ fullSync });
        logger.success(`Sync complete: ${results.synced} products synced`);
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Sync failed', error);
      process.exit(1);
    }
  })();
}
