// utils/sql-helper.js
// SQL connection pool and update/insert utilities for QuoteWerks database

import sql from 'mssql';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SQLHelper {
  constructor() {
    this.pool = null;
    this.config = null;
  }

  /**
   * Load database configuration from config/dbConfig.json
   * @returns {Promise<Object>} Database configuration
   */
  async loadConfig() {
    try {
      const configPath = join(__dirname, '..', 'config', 'dbConfig.json');
      const configData = await readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      return this.config;
    } catch (error) {
      console.error('Failed to load database configuration:', error.message);
      throw new Error('Database configuration not found. Please create config/dbConfig.json');
    }
  }

  /**
   * Connect to SQL Server database
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.pool && this.pool.connected) {
      return;
    }

    if (!this.config) {
      await this.loadConfig();
    }

    try {
      this.pool = await sql.connect(this.config);
      console.log('✓ Connected to QuoteWerks SQL Database');
    } catch (error) {
      console.error('Failed to connect to database:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('✓ Disconnected from database');
    }
  }

  /**
   * Get random unprocessed products
   * @param {number} count - Number of products to retrieve
   * @returns {Promise<Array>} Array of product objects
   */
  async getUnprocessedProducts(count = 20) {
    await this.connect();

    try {
      const result = await this.pool.request()
        .input('count', sql.Int, count)
        .query(`
          SELECT TOP (@count)
            ProductID,
            PartNumber,
            Description,
            ManufacturerName,
            Price,
            CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
            CustomMemo06, CustomMemo07, CustomMemo08, CustomMemo09, CustomMemo10,
            CustomText01, CustomText02, CustomText03, CustomText04, CustomText05, CustomText06,
            CustomNumber01, CustomNumber02,
            CustomDate01,
            ImageFile
          FROM Products
          WHERE ISNULL(CustomNumber02, 0) = 0
          ORDER BY NEWID()
        `);

      return result.recordset;
    } catch (error) {
      console.error('Failed to retrieve products:', error.message);
      throw error;
    }
  }

  /**
   * Update product with enriched data
   * @param {number} productId - Product ID
   * @param {Object} enrichedData - Enriched product data
   * @returns {Promise<void>}
   */
  async updateProduct(productId, enrichedData) {
    await this.connect();

    try {
      const request = this.pool.request();

      // Add all parameters
      request.input('productId', sql.Int, productId);
      request.input('description', sql.NVarChar(sql.MAX), enrichedData.description || null);
      request.input('shortDesc', sql.NVarChar(sql.MAX), enrichedData.shortDescription || null);
      request.input('longDesc', sql.NVarChar(sql.MAX), enrichedData.longDescription || null);
      request.input('features', sql.NVarChar(sql.MAX), enrichedData.features || null);
      request.input('specs', sql.NVarChar(sql.MAX), enrichedData.specifications || null);
      request.input('faq', sql.NVarChar(sql.MAX), enrichedData.faq || null);
      request.input('prerequisites', sql.NVarChar(sql.MAX), enrichedData.prerequisites || null);
      request.input('relatedItems', sql.NVarChar(sql.MAX), enrichedData.relatedItems || null);
      request.input('professionalServices', sql.NVarChar(sql.MAX), enrichedData.professionalServices || null);
      request.input('upsellRecommendations', sql.NVarChar(sql.MAX), enrichedData.upsellRecommendations || null);
      request.input('marketingMessage', sql.NVarChar(sql.MAX), enrichedData.marketingMessage || null);
      request.input('category', sql.NVarChar(200), enrichedData.category || null);
      request.input('subcategory', sql.NVarChar(200), enrichedData.subcategory || null);
      request.input('manufacturer', sql.NVarChar(200), enrichedData.manufacturer || null);
      request.input('productType', sql.NVarChar(200), enrichedData.productType || null);
      request.input('rulesProduct', sql.NVarChar(sql.MAX), enrichedData.rulesProduct ? JSON.stringify(enrichedData.rulesProduct) : null);
      request.input('rulesCategory', sql.NVarChar(sql.MAX), enrichedData.rulesCategory ? JSON.stringify(enrichedData.rulesCategory) : null);
      request.input('confidence', sql.Float, enrichedData.confidence || 0);
      request.input('imageUrl', sql.NVarChar(500), enrichedData.imageUrl || null);

      await request.query(`
        UPDATE Products SET
          Description = COALESCE(@description, Description),
          CustomMemo01 = @shortDesc,
          CustomMemo02 = @longDesc,
          CustomMemo03 = @features,
          CustomMemo04 = @specs,
          CustomMemo05 = @faq,
          CustomMemo06 = @prerequisites,
          CustomMemo07 = @relatedItems,
          CustomMemo08 = @professionalServices,
          CustomMemo09 = @upsellRecommendations,
          CustomMemo10 = @marketingMessage,
          CustomText01 = @category,
          CustomText02 = @subcategory,
          CustomText03 = @manufacturer,
          CustomText04 = @productType,
          CustomText05 = @rulesProduct,
          CustomText06 = @rulesCategory,
          CustomNumber01 = @confidence,
          CustomNumber02 = 1,
          CustomDate01 = GETDATE(),
          ImageFile = COALESCE(@imageUrl, ImageFile)
        WHERE ProductID = @productId
      `);

      console.log(`✓ Updated product ${productId} in database`);
    } catch (error) {
      console.error(`Failed to update product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Log enrichment activity
   * @param {Object} logData - Log data
   * @returns {Promise<number>} Log ID
   */
  async logEnrichment(logData) {
    await this.connect();

    try {
      const request = this.pool.request();

      request.input('inputText', sql.NVarChar(sql.MAX), logData.inputText || null);
      request.input('outputText', sql.NVarChar(sql.MAX), logData.outputText || null);
      request.input('aiProvider', sql.NVarChar(50), logData.aiProvider || null);
      request.input('model', sql.NVarChar(100), logData.model || null);
      request.input('tokensUsed', sql.Int, logData.tokensUsed || null);
      request.input('processingTimeMs', sql.Int, logData.processingTimeMs || null);
      request.input('status', sql.NVarChar(20), logData.status || 'Success');
      request.input('errorMessage', sql.NVarChar(sql.MAX), logData.errorMessage || null);

      const result = await request.query(`
        INSERT INTO AI_Log (
          ProcessDate, InputText, OutputText, AIProvider, Model,
          TokensUsed, ProcessingTimeMs, Status, ErrorMessage
        )
        OUTPUT INSERTED.LogID
        VALUES (
          GETDATE(), @inputText, @outputText, @aiProvider, @model,
          @tokensUsed, @processingTimeMs, @status, @errorMessage
        )
      `);

      return result.recordset[0].LogID;
    } catch (error) {
      console.error('Failed to log enrichment:', error.message);
      // Don't throw - logging failure shouldn't stop enrichment
      return null;
    }
  }

  /**
   * Get enrichment statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    await this.connect();

    try {
      const result = await this.pool.request().query(`
        SELECT
          COUNT(*) AS totalProducts,
          SUM(CASE WHEN ISNULL(CustomNumber02, 0) = 1 THEN 1 ELSE 0 END) AS processedProducts,
          SUM(CASE WHEN ISNULL(CustomNumber02, 0) = 0 THEN 1 ELSE 0 END) AS unprocessedProducts,
          AVG(CASE WHEN CustomNumber01 > 0 THEN CustomNumber01 ELSE NULL END) AS avgConfidence
        FROM Products
      `);

      return result.recordset[0];
    } catch (error) {
      console.error('Failed to get statistics:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export default new SQLHelper();
