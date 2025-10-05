// sql-helper.js - SQL database helper for QuoteWerks Products table operations
import sql from 'mssql';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * SQL Helper class for QuoteWerks database operations
 */
class SQLHelper {
  constructor() {
    this.pool = null;
    this.config = null;
  }

  /**
   * Load database configuration
   * @returns {Promise<Object>} Database configuration
   */
  async loadConfig() {
    try {
      const configPath = join(__dirname, '../config/dbConfig.json');
      const configData = await readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
      return this.config;
    } catch (error) {
      console.error('Failed to load database configuration:', error.message);
      throw error;
    }
  }

  /**
   * Connect to database
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      if (!this.config) {
        await this.loadConfig();
      }

      this.pool = await sql.connect(this.config);
      console.log('✓ Connected to SQL Server database');
    } catch (error) {
      console.error('✗ Database connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        console.log('✓ Disconnected from database');
      }
    } catch (error) {
      console.error('Error disconnecting from database:', error.message);
    }
  }

  /**
   * Get random products that need AI processing
   * @param {number} limit - Number of products to retrieve (default: 20)
   * @returns {Promise<Array>} Array of product objects
   */
  async getProductsForProcessing(limit = 20) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const query = `
        SELECT TOP ${limit}
          ID,
          ManufacturerPartNumber AS MPN,
          Manufacturer,
          ProductName,
          ShortDescription,
          ExtendedDescription,
          Category,
          UnitOfMeasure,
          Price,
          Cost,
          ListPrice,
          Availability,
          ImageFile,
          KeywordList,
          CustomMemo01,
          CustomMemo02,
          CustomMemo03,
          CustomMemo04,
          CustomMemo05,
          CustomText01,
          CustomText02,
          CustomText03,
          CustomText04,
          CustomText05,
          CustomText06,
          CustomText07,
          CustomText08,
          CustomText09,
          CustomText10,
          CustomText11,
          CustomText12,
          CustomText13,
          CustomText14,
          CustomText15,
          CustomText16,
          CustomText17,
          CustomText18,
          CustomText19,
          CustomText20,
          Discontinued,
          LastModified
        FROM dbo.Products
        WHERE 
          ISNULL(AIProcessed, 0) = 0
          AND ProductName NOT LIKE '%Localization%'
          AND ProductName NOT LIKE '%Test%'
          AND ISNULL(Cost, 0) > 0
        ORDER BY NEWID()
      `;

      const result = await this.pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Failed to get products for processing:', error.message);
      throw error;
    }
  }

  /**
   * Update product with AI enrichment results
   * @param {number} productId - Product ID
   * @param {Object} enrichmentData - AI enrichment data
   * @returns {Promise<boolean>} Success status
   */
  async updateProductEnrichment(productId, enrichmentData) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const request = this.pool.request();
      
      // Build update query dynamically based on available enrichment data
      const updates = [];
      
      if (enrichmentData.shortDescription) {
        request.input('ShortDescription', sql.NVarChar, enrichmentData.shortDescription);
        updates.push('ShortDescription = @ShortDescription');
      }
      
      if (enrichmentData.extendedDescription) {
        request.input('ExtendedDescription', sql.NVarChar, enrichmentData.extendedDescription);
        updates.push('ExtendedDescription = @ExtendedDescription');
      }
      
      if (enrichmentData.features) {
        request.input('CustomMemo01', sql.NVarChar, enrichmentData.features);
        updates.push('CustomMemo01 = @CustomMemo01');
      }
      
      if (enrichmentData.specifications) {
        request.input('CustomMemo02', sql.NVarChar, enrichmentData.specifications);
        updates.push('CustomMemo02 = @CustomMemo02');
      }
      
      if (enrichmentData.faq) {
        request.input('CustomMemo03', sql.NVarChar, enrichmentData.faq);
        updates.push('CustomMemo03 = @CustomMemo03');
      }
      
      if (enrichmentData.marketingMessage) {
        request.input('CustomMemo04', sql.NVarChar, enrichmentData.marketingMessage);
        updates.push('CustomMemo04 = @CustomMemo04');
      }
      
      if (enrichmentData.rules) {
        request.input('CustomMemo05', sql.NVarChar, enrichmentData.rules);
        updates.push('CustomMemo05 = @CustomMemo05');
      }
      
      if (enrichmentData.bundleSuggestions) {
        request.input('CustomText01', sql.NVarChar, enrichmentData.bundleSuggestions);
        updates.push('CustomText01 = @CustomText01');
      }
      
      if (enrichmentData.imageFile) {
        request.input('ImageFile', sql.NVarChar, enrichmentData.imageFile);
        updates.push('ImageFile = @ImageFile');
      }
      
      if (enrichmentData.keywords) {
        request.input('KeywordList', sql.NVarChar, enrichmentData.keywords);
        updates.push('KeywordList = @KeywordList');
      }

      // Always update these fields
      request.input('AIProcessed', sql.Bit, 1);
      request.input('AIConfidence', sql.Decimal(5, 2), enrichmentData.confidence || 0);
      request.input('AIProcessedDate', sql.DateTime, new Date());
      request.input('ProductID', sql.Int, productId);
      
      updates.push('AIProcessed = @AIProcessed');
      updates.push('AIConfidence = @AIConfidence');
      updates.push('AIProcessedDate = @AIProcessedDate');
      updates.push('LastModified = GETDATE()');

      const query = `
        UPDATE dbo.Products
        SET ${updates.join(', ')}
        WHERE ID = @ProductID
      `;

      await request.query(query);
      return true;
    } catch (error) {
      console.error(`Failed to update product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all enriched products for Algolia sync
   * @returns {Promise<Array>} Array of enriched products
   */
  async getEnrichedProducts() {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const query = `
        SELECT 
          ID,
          ManufacturerPartNumber AS MPN,
          InternalPartNumber,
          Manufacturer,
          ProductName,
          ShortDescription,
          ExtendedDescription,
          Category,
          UnitOfMeasure,
          Price,
          Cost,
          ListPrice,
          Availability,
          ImageFile,
          KeywordList,
          CustomMemo01,
          CustomMemo02,
          CustomMemo03,
          CustomMemo04,
          CustomMemo05,
          CustomText01,
          CustomText02,
          CustomText03,
          CustomText04,
          CustomText05,
          CustomText06,
          CustomText07,
          CustomText08,
          CustomText09,
          CustomText10,
          CustomText11,
          CustomText12,
          CustomText13,
          CustomText14,
          CustomText15,
          CustomText16,
          CustomText17,
          CustomText18,
          CustomText19,
          CustomText20,
          Discontinued,
          LastModified,
          AIProcessed,
          AIConfidence
        FROM dbo.Products
        WHERE ISNULL(AIProcessed, 0) = 1
      `;

      const result = await this.pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Failed to get enriched products:', error.message);
      throw error;
    }
  }

  /**
   * Log processing result
   * @param {Object} logData - Log data
   * @returns {Promise<number>} Log ID
   */
  async logProcessing(logData) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const request = this.pool.request();
      
      request.input('ProcessDate', sql.DateTime, new Date());
      request.input('InputText', sql.NVarChar, JSON.stringify(logData.input));
      request.input('OutputText', sql.NVarChar, JSON.stringify(logData.output));
      request.input('AIProvider', sql.NVarChar, logData.provider);
      request.input('Model', sql.NVarChar, logData.model);
      request.input('TokensUsed', sql.Int, logData.tokensUsed);
      request.input('ProcessingTimeMs', sql.Int, logData.processingTimeMs);
      request.input('Status', sql.NVarChar, logData.status);
      request.input('ErrorMessage', sql.NVarChar, logData.errorMessage || null);

      const query = `
        INSERT INTO dbo.AI_Log 
        (ProcessDate, InputText, OutputText, AIProvider, Model, TokensUsed, ProcessingTimeMs, Status, ErrorMessage)
        VALUES 
        (@ProcessDate, @InputText, @OutputText, @AIProvider, @Model, @TokensUsed, @ProcessingTimeMs, @Status, @ErrorMessage);
        SELECT SCOPE_IDENTITY() AS LogID;
      `;

      const result = await request.query(query);
      return result.recordset[0].LogID;
    } catch (error) {
      console.error('Failed to log processing:', error.message);
      // Don't throw - logging failure shouldn't break the main flow
      return null;
    }
  }
}

// Export singleton instance
export default new SQLHelper();
