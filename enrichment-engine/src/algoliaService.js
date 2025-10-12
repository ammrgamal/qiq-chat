// algoliaService.js - Algolia index synchronization
import dotenv from 'dotenv';
import algoliasearch from 'algoliasearch';
import logger from './logger.js';

// Load environment variables from root .env
dotenv.config({ path: '../.env' });

class AlgoliaService {
  constructor() {
    this.client = null;
    this.index = null;
    
    const appId = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
    const indexName = process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';
    
    if (!appId || !apiKey) {
      logger.warn('Algolia not configured - sync will be skipped');
    } else {
      this.client = algoliasearch(appId, apiKey);
      this.index = this.client.initIndex(indexName);
      logger.info(`Algolia client initialized (index: ${indexName})`);
    }
  }

  /**
   * Check if Algolia is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.client !== null;
  }

  /**
   * Transform SQL product to Algolia object
   * @param {Object} product - Product from SQL
   * @returns {Object} Algolia object
   */
  transformProduct(product) {
    const obj = {
      objectID: product.objectID || product.ManufacturerPartNo,
      name: product.name || product.Description,
      brand: product.brand || product.Manufacturer,
      category: product.category,
      price: parseFloat(product.price) || 0,
      short_description: product.short_description,
      features: product.features,
      specs: product.specs,
      faq: product.faq,
      why_buy: product.why_buy,
      prerequisites: product.prerequisites,
      related: product.related,
      product_rules: product.product_rules,
      category_rules: product.category_rules,
      image: product.image,
      datasheet: product.datasheet,
      scope: product.scope,
      processed_at: product.processed_at,
      ai_confidence: parseFloat(product.ai_confidence) || 0,
      _tags: product.tags ? product.tags.split(',').map(t => t.trim()) : []
    };
    // Pass-through nested attributes if provided by caller
    if (product.prices) obj.prices = product.prices;
    if (product.media) obj.media = product.media;
    if (product.rules) obj.rules = product.rules;
    if (product.ai) obj.ai = product.ai;
    if (product.content) obj.content = product.content;
    if (product.seo_keywords) obj.seo_keywords = product.seo_keywords;
    return obj;
  }

  /**
   * Sync products to Algolia
   * @param {Array} products - Array of products from SQL
   * @returns {Promise<Object>} Sync results
   */
  async syncProducts(products) {
    if (!this.isConfigured()) {
      logger.warn('Algolia sync skipped - not configured');
      return {
        success: false,
        reason: 'Algolia not configured',
        synced: 0
      };
    }

    try {
      logger.info(`Syncing ${products.length} products to Algolia...`);
      
      // Transform products to Algolia format
      const algoliaObjects = products.map(p => this.transformProduct(p));
      
      // Batch save to Algolia
      const result = await this.index.saveObjects(algoliaObjects);
      
      logger.success(`Synced ${products.length} products to Algolia`);
      
      return {
        success: true,
        synced: products.length,
        objectIDs: result.objectIDs
      };
    } catch (error) {
      logger.error('Failed to sync products to Algolia', error);
      throw error;
    }
  }

  /**
   * Sync a single product to Algolia
   * @param {Object} product - Product from SQL
   * @returns {Promise<Object>} Sync result
   */
  async syncProduct(product) {
    if (!this.isConfigured()) {
      logger.debug('Algolia sync skipped - not configured');
      return { success: false };
    }

    try {
      const algoliaObject = this.transformProduct(product);
      await this.index.saveObject(algoliaObject);
      
      logger.debug(`Synced product ${product.objectID} to Algolia`);
      
      return {
        success: true,
        objectID: algoliaObject.objectID
      };
    } catch (error) {
      logger.error(`Failed to sync product ${product.objectID} to Algolia`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete products from Algolia
   * @param {Array} objectIDs - Array of object IDs to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteProducts(objectIDs) {
    if (!this.isConfigured()) {
      return { success: false, reason: 'Algolia not configured' };
    }

    try {
      await this.index.deleteObjects(objectIDs);
      
      logger.info(`Deleted ${objectIDs.length} products from Algolia`);
      
      return {
        success: true,
        deleted: objectIDs.length
      };
    } catch (error) {
      logger.error('Failed to delete products from Algolia', error);
      throw error;
    }
  }

  /**
   * Clear entire Algolia index
   * @returns {Promise<Object>} Clear result
   */
  async clearIndex() {
    if (!this.isConfigured()) {
      return { success: false, reason: 'Algolia not configured' };
    }

    try {
      logger.warn('Clearing Algolia index...');
      await this.index.clearObjects();
      
      logger.success('Algolia index cleared');
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear Algolia index', error);
      throw error;
    }
  }

  /**
   * Get Algolia index statistics
   * @returns {Promise<Object>} Index stats
   */
  async getIndexStats() {
    if (!this.isConfigured()) {
      return { configured: false };
    }

    try {
      const settings = await this.index.getSettings();
      
      // Note: Algolia doesn't provide a direct count API in the free tier
      // You would need to search with empty query to get approximate count
      const searchResult = await this.index.search('', { hitsPerPage: 0 });
      
      return {
        configured: true,
        nbHits: searchResult.nbHits,
        indexName: this.index.indexName
      };
    } catch (error) {
      logger.error('Failed to get Algolia stats', error);
      return { configured: true, error: error.message };
    }
  }

  /**
   * Configure Algolia index settings
   * @returns {Promise<void>}
   */
  async configureIndex() {
    if (!this.isConfigured()) {
      logger.warn('Cannot configure index - Algolia not configured');
      return;
    }

    try {
      logger.info('Configuring Algolia index settings...');
      
      await this.index.setSettings({
        searchableAttributes: [
          'name',
          'brand',
          'category',
          'short_description',
          'features',
          '_tags',
          // nested content for better recall
          'content.short_description',
          'content.features',
          'content.faq',
          'content.why_buy'
        ],
        attributesForFaceting: [
          'searchable(brand)',
          'searchable(category)',
          'searchable(_tags)',
          // filterable numeric nested attributes
          'filterOnly(prices.net)',
          'filterOnly(prices.gross)',
          'filterOnly(prices.cost)',
          'filterOnly(prices.list)',
          'filterOnly(prices.margin)'
        ],
        customRanking: [
          'desc(ai_confidence)',
          'desc(price)'
        ],
        ranking: [
          'typo',
          'geo',
          'words',
          'filters',
          'proximity',
          'attribute',
          'exact',
          'custom'
        ]
      });
      
      logger.success('Algolia index configured');
    } catch (error) {
      logger.error('Failed to configure Algolia index', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new AlgoliaService();
