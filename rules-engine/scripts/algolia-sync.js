#!/usr/bin/env node
// algolia-sync.js - Sync enriched products from SQL to Algolia
import dotenv from 'dotenv';
import algoliasearch from 'algoliasearch';
import logger from '../src/logger.js';
import dbService from '../src/dbService.js';

// Load environment variables
dotenv.config({ path: '../../.env' });
dotenv.config({ path: '../.env' });

class AlgoliaSyncService {
  constructor() {
    this.algoliaAppId = process.env.ALGOLIA_APP_ID;
    this.algoliaApiKey = process.env.ALGOLIA_API_KEY; // Admin key required for indexing
    this.indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';
    this.batchSize = 100;
    this.maxRecordSize = 10240; // 10KB limit per record
  }

  /**
   * Initialize Algolia client
   */
  async initialize() {
    if (!this.algoliaAppId || !this.algoliaApiKey) {
      throw new Error('Algolia credentials not configured. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY.');
    }

    this.client = algoliasearch(this.algoliaAppId, this.algoliaApiKey);
    this.index = this.client.initIndex(this.indexName);
    
    logger.success(`Algolia sync initialized for index: ${this.indexName}`);
  }

  /**
   * Fetch enriched products from SQL database
   * @returns {Promise<Array>} Products with enrichment data
   */
  async fetchEnrichedProducts() {
    const query = `
      SELECT 
        p.ID,
        p.InternalPartNumber,
        p.ManufacturerPartNumber,
        p.ProductName,
        p.Manufacturer,
        p.Category,
        p.UnitPrice,
        p.ListPrice,
        p.Cost,
        p.UnitOfMeasure,
        p.Availability,
        p.Discontinued,
        p.ShortDescription,
        p.ExtendedDescription,
        p.ImagePath,
        p.SpecSheetPath,
        p.ProductURL,
        p.KeywordList,
        p.LastModified,
        p.CustomMemo01, p.CustomMemo02, p.CustomMemo03, p.CustomMemo04, p.CustomMemo05,
        p.CustomText01, p.CustomText02, p.CustomText03, p.CustomText04, p.CustomText05,
        p.CustomText06, p.CustomText07, p.CustomText08, p.CustomText09, p.CustomText10,
        p.CustomText11, p.CustomText12, p.CustomText13, p.CustomText14, p.CustomText15,
        p.CustomText16, p.CustomText17, p.CustomText18, p.CustomText19, p.CustomText20,
        pe.AIShortDescription,
        pe.AILongDescription,
        pe.AISpecsTable,
        pe.AIFeatures,
        pe.AIPrerequisites,
        pe.AIServicesScope,
        pe.AIFAQ,
        pe.AIUpsells,
        pe.AIBundles,
        pe.AIValueStatement,
        pe.AIProductRules,
        pe.AICategoryRules,
        pe.AIImageURL,
        pe.AIImageSource,
        pe.AIProcessed,
        pe.AIProcessedDate,
        pe.AIConfidence,
        pe.AIProvider
      FROM Products p
      LEFT JOIN Product_Enrichment pe ON p.ID = pe.ProductID
      WHERE p.IsActive = 1
      ORDER BY p.LastModified DESC
    `;

    try {
      const result = await dbService.query(query);
      return result.recordset || [];
    } catch (error) {
      logger.error('Failed to fetch products from database', error);
      throw error;
    }
  }

  /**
   * Transform SQL product record to Algolia format
   * @param {Object} product - SQL product record
   * @returns {Object} Algolia-formatted record
   */
  transformToAlgoliaRecord(product) {
    // Create stable objectID
    const objectID = product.ManufacturerPartNumber || product.InternalPartNumber || String(product.ID);

    // Map availability
    const availability = product.Availability === 1 ? 'Stock' : 'on back order';
    const availabilityWeight = product.Availability === 1 ? 10 : 1;

    // Normalize file URLs
    const normalizeUrl = (path) => path ? path.replace(/\\/g, '/') : '';

    // Parse custom memo fields
    const customMemo = this.parseCustomFields([
      product.CustomMemo01, product.CustomMemo02, product.CustomMemo03,
      product.CustomMemo04, product.CustomMemo05
    ], '\n');

    // Parse custom text fields
    const customText = this.parseCustomFields([
      product.CustomText01, product.CustomText02, product.CustomText03, product.CustomText04,
      product.CustomText05, product.CustomText06, product.CustomText07, product.CustomText08,
      product.CustomText09, product.CustomText10, product.CustomText11, product.CustomText12,
      product.CustomText13, product.CustomText14, product.CustomText15, product.CustomText16,
      product.CustomText17, product.CustomText18, product.CustomText19, product.CustomText20
    ], ';');

    // Parse keywords
    const tags = product.KeywordList ? product.KeywordList.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Parse AI-enriched JSON fields safely
    const parseJSON = (str) => {
      try {
        return str ? JSON.parse(str) : null;
      } catch {
        return null;
      }
    };

    // Truncate long descriptions to fit size limits
    const truncateText = (text, maxLength) => {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    };

    const record = {
      objectID,
      sku: product.InternalPartNumber || objectID,
      mpn: product.ManufacturerPartNumber || '',
      name: product.ProductName || '',
      brand: product.Manufacturer || '',
      category: product.Category || '',
      unit: product.UnitOfMeasure || 'ea',
      availability,
      availability_weight: availabilityWeight,
      price: product.UnitPrice || 0,
      list_price: product.ListPrice || 0,
      cost: product.Cost || 0,
      image: normalizeUrl(product.AIImageURL || product.ImagePath),
      spec_sheet: normalizeUrl(product.SpecSheetPath),
      link: product.ProductURL || '',
      ShortDescription: truncateText(product.ShortDescription, 500),
      ExtendedDescription: truncateText(product.ExtendedDescription, 4000),
      custom_memo: customMemo,
      custom_text: customText,
      tags,
      discontinued: Boolean(product.Discontinued),
      LastModified: product.LastModified ? new Date(product.LastModified).toISOString() : null,
    };

    // Add AI-enriched fields if available
    if (product.AIProcessed) {
      record.ai_short_description = truncateText(product.AIShortDescription, 500);
      record.ai_long_description = truncateText(product.AILongDescription, 4000);
      record.features = parseJSON(product.AIFeatures) || [];
      record.specs = parseJSON(product.AISpecsTable) || {};
      record.prerequisites = parseJSON(product.AIPrerequisites) || [];
      record.services_scope = truncateText(product.AIServicesScope, 1000);
      record.faq = parseJSON(product.AIFAQ) || [];
      record.upsells = parseJSON(product.AIUpsells) || [];
      record.bundles = parseJSON(product.AIBundles) || [];
      record.value_statement = truncateText(product.AIValueStatement, 500);
      record.product_rules = parseJSON(product.AIProductRules) || [];
      record.category_rules = parseJSON(product.AICategoryRules) || [];
      record.ai_processed = true;
      record.ai_processed_date = product.AIProcessedDate ? new Date(product.AIProcessedDate).toISOString() : null;
      record.ai_confidence = product.AIConfidence || 0;
      record.ai_provider = product.AIProvider || '';
      record.ai_image_source = product.AIImageSource || '';
    } else {
      record.ai_processed = false;
    }

    // Validate record size
    const recordSize = JSON.stringify(record).length;
    if (recordSize > this.maxRecordSize) {
      logger.warn(`Record ${objectID} exceeds size limit (${recordSize} bytes), truncating...`);
      // Further truncate if needed
      if (record.ExtendedDescription) {
        record.ExtendedDescription = truncateText(record.ExtendedDescription, 2000);
      }
      if (record.ai_long_description) {
        record.ai_long_description = truncateText(record.ai_long_description, 2000);
      }
    }

    return record;
  }

  /**
   * Parse and deduplicate custom fields
   * @param {Array} fields - Array of field values
   * @param {String} delimiter - Split delimiter
   * @returns {Array} Deduplicated array
   */
  parseCustomFields(fields, delimiter) {
    const values = new Set();
    
    fields.forEach(field => {
      if (field) {
        field.split(delimiter).forEach(val => {
          const trimmed = val.trim();
          if (trimmed) {
            values.add(trimmed);
          }
        });
      }
    });

    return Array.from(values).slice(0, 50); // Limit to 50 items
  }

  /**
   * Sync products to Algolia in batches
   * @returns {Promise<Object>} Sync statistics
   */
  async syncToAlgolia() {
    try {
      logger.banner('Algolia Sync');
      logger.info('Fetching products from database...');

      const products = await this.fetchEnrichedProducts();
      logger.success(`Found ${products.length} products to sync`);

      if (products.length === 0) {
        logger.warn('No products to sync');
        return { synced: 0, failed: 0, skipped: 0 };
      }

      // Transform products
      logger.info('Transforming products to Algolia format...');
      const records = products.map(p => this.transformToAlgoliaRecord(p));

      // Sync in batches
      logger.info(`Syncing ${records.length} records in batches of ${this.batchSize}...`);
      let synced = 0;
      let failed = 0;

      for (let i = 0; i < records.length; i += this.batchSize) {
        const batch = records.slice(i, i + this.batchSize);
        
        try {
          await this.index.saveObjects(batch);
          synced += batch.length;
          logger.info(`Synced batch ${Math.floor(i / this.batchSize) + 1} (${synced}/${records.length})`);
        } catch (error) {
          logger.error(`Failed to sync batch ${Math.floor(i / this.batchSize) + 1}`, error);
          failed += batch.length;
        }

        // Brief delay between batches to avoid rate limiting
        await this.delay(500);
      }

      logger.success(`\n✅ Sync Complete!`);
      logger.info(`  • Synced: ${synced} records`);
      logger.info(`  • Failed: ${failed} records`);
      logger.info(`  • Total: ${records.length} records`);

      return { synced, failed, total: records.length };

    } catch (error) {
      logger.error('Algolia sync failed', error);
      throw error;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const syncService = new AlgoliaSyncService();

  try {
    // Initialize services
    await dbService.connect();
    await syncService.initialize();

    // Run sync
    const result = await syncService.syncToAlgolia();

    // Cleanup
    await dbService.disconnect();

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    logger.error('Sync process failed', error);
    await dbService.disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default AlgoliaSyncService;
