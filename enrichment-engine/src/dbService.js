// dbService.js - SQL Server database service for QuoteWerks
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

class DatabaseService {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  /**
   * Connect to SQL Server database
   */
  async connect() {
    if (this.connected) {
      logger.debug('Database already connected');
      return;
    }

    try {
      const configPath = path.join(process.cwd(), 'config', 'dbConfig.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      logger.info('Connecting to SQL Server database...');
      this.pool = await sql.connect(config);
      this.connected = true;
      logger.success('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      this.connected = false;
      logger.info('Database disconnected');
    }
  }

  /**
   * Get products for enrichment (those not yet processed or need updates)
   * @param {number} limit - Number of products to fetch
   * @returns {Promise<Array>} Array of products
   */
  async getProductsForEnrichment(limit = 20) {
    try {
      const result = await this.pool.request()
        .input('limit', sql.Int, limit)
        .query(`
          SELECT TOP (@limit)
            Description,
            ManufacturerPartNo,
            Manufacturer,
            UnitPrice,
            ImageFile,
            CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
            CustomMemo06, CustomMemo07, CustomMemo08, CustomMemo09, CustomMemo10,
            CustomText01, CustomText02, CustomText03, CustomText04, CustomText05,
            CustomText06, CustomText07, CustomText08, CustomText09, CustomText10,
            CustomText11, CustomText12, CustomText19, CustomText20,
            CustomNumber01, CustomNumber02, CustomNumber03, CustomNumber04, CustomNumber05
          FROM Products
          WHERE ManufacturerPartNo IS NOT NULL
            AND (CustomText11 IS NULL OR CustomText11 != 'TRUE')
          ORDER BY NEWID()
        `);
      
      logger.info(`Retrieved ${result.recordset.length} products for enrichment`);
      return result.recordset;
    } catch (error) {
      logger.error('Failed to get products for enrichment', error);
      throw error;
    }
  }

  /**
   * Update product with enriched data
   * @param {string} partNumber - Product part number
   * @param {Object} enrichedData - Enriched product data
   * @returns {Promise<void>}
   */
  async updateProduct(partNumber, enrichedData) {
    try {
      const request = this.pool.request();
      request.input('partNumber', sql.NVarChar(200), partNumber);

      // Build dynamic update query based on provided fields
      const updates = [];
      
      // CustomMemo fields
      if (enrichedData.shortDescription) {
        request.input('memo01', sql.NVarChar(sql.MAX), enrichedData.shortDescription);
        updates.push('CustomMemo01 = @memo01');
      }
      if (enrichedData.features) {
        request.input('memo02', sql.NVarChar(sql.MAX), enrichedData.features);
        updates.push('CustomMemo02 = @memo02');
      }
      if (enrichedData.specs) {
        request.input('memo03', sql.NVarChar(sql.MAX), enrichedData.specs);
        updates.push('CustomMemo03 = @memo03');
      }
      if (enrichedData.faq) {
        request.input('memo04', sql.NVarChar(sql.MAX), enrichedData.faq);
        updates.push('CustomMemo04 = @memo04');
      }
      if (enrichedData.whyBuy) {
        request.input('memo05', sql.NVarChar(sql.MAX), enrichedData.whyBuy);
        updates.push('CustomMemo05 = @memo05');
      }
      if (enrichedData.prerequisites) {
        request.input('memo06', sql.NVarChar(sql.MAX), enrichedData.prerequisites);
        updates.push('CustomMemo06 = @memo06');
      }
      if (enrichedData.related) {
        request.input('memo07', sql.NVarChar(sql.MAX), enrichedData.related);
        updates.push('CustomMemo07 = @memo07');
      }
      if (enrichedData.productRule) {
        request.input('memo08', sql.NVarChar(sql.MAX), enrichedData.productRule);
        updates.push('CustomMemo08 = @memo08');
      }
      if (enrichedData.categoryRule) {
        request.input('memo09', sql.NVarChar(sql.MAX), enrichedData.categoryRule);
        updates.push('CustomMemo09 = @memo09');
      }

      // CustomText fields
      if (enrichedData.manufacturer) {
        request.input('text01', sql.NVarChar(255), enrichedData.manufacturer);
        updates.push('CustomText01 = @text01');
      }
      if (enrichedData.category) {
        request.input('text02', sql.NVarChar(255), enrichedData.category);
        updates.push('CustomText02 = @text02');
      }
      if (enrichedData.tags) {
        request.input('text03', sql.NVarChar(255), enrichedData.tags);
        updates.push('CustomText03 = @text03');
      }
      if (enrichedData.seoKeywords) {
        request.input('text04', sql.NVarChar(255), enrichedData.seoKeywords);
        updates.push('CustomText04 = @text04');
      }
      if (enrichedData.imageUrl) {
        request.input('text05', sql.NVarChar(255), enrichedData.imageUrl);
        updates.push('CustomText05 = @text05');
      }
      if (enrichedData.datasheetUrl) {
        request.input('text06', sql.NVarChar(255), enrichedData.datasheetUrl);
        updates.push('CustomText06 = @text06');
      }
      if (enrichedData.scopeOfWork) {
        request.input('text09', sql.NVarChar(255), enrichedData.scopeOfWork);
        updates.push('CustomText09 = @text09');
      }
      
      // Always set processed flag and timestamp
      request.input('text11', sql.NVarChar(10), 'TRUE');
      request.input('text12', sql.NVarChar(50), new Date().toISOString());
      updates.push('CustomText11 = @text11');
      updates.push('CustomText12 = @text12');

      // CustomNumber fields
      if (enrichedData.confidence !== undefined) {
        request.input('num03', sql.Decimal(5, 2), enrichedData.confidence);
        request.input('text10', sql.NVarChar(10), enrichedData.confidence.toString());
        updates.push('CustomNumber03 = @num03');
        updates.push('CustomText10 = @text10');
      }

      if (updates.length === 0) {
        logger.warn('No fields to update');
        return;
      }

      const query = `
        UPDATE Products
        SET ${updates.join(', ')}
        WHERE ManufacturerPartNo = @partNumber
      `;

      await request.query(query);
      logger.debug(`Updated product ${partNumber} with ${updates.length} fields`);
    } catch (error) {
      logger.error(`Failed to update product ${partNumber}`, error);
      throw error;
    }
  }

  /**
   * Log enrichment operation
   * @param {Object} logData - Log data
   */
  async logEnrichment(logData) {
    try {
      await this.pool.request()
        .input('productId', sql.NVarChar(200), logData.productId)
        .input('productName', sql.NVarChar(500), logData.productName)
        .input('operationType', sql.NVarChar(50), logData.operationType)
        .input('aiProvider', sql.NVarChar(50), logData.aiProvider)
        .input('aiConfidence', sql.Decimal(5, 2), logData.aiConfidence)
        .input('timeTaken', sql.Int, logData.timeTaken)
        .input('status', sql.NVarChar(20), logData.status)
        .input('errorMessage', sql.NVarChar(sql.MAX), logData.errorMessage)
        .input('fieldsUpdated', sql.NVarChar(sql.MAX), logData.fieldsUpdated)
        .input('metadata', sql.NVarChar(sql.MAX), logData.metadata)
        .query(`
          INSERT INTO Enrichment_Log 
          (ProductID, ProductName, OperationType, AIProvider, AIConfidence, 
           TimeTaken, Status, ErrorMessage, FieldsUpdated, Metadata)
          VALUES 
          (@productId, @productName, @operationType, @aiProvider, @aiConfidence,
           @timeTaken, @status, @errorMessage, @fieldsUpdated, @metadata)
        `);
    } catch (error) {
      logger.error('Failed to log enrichment', error);
      // Don't throw - logging failures shouldn't stop the main process
    }
  }

  /**
   * Start a new batch
   * @param {number} totalProducts - Total products in batch
   * @returns {Promise<number>} Batch ID
   */
  async startBatch(totalProducts) {
    try {
      const result = await this.pool.request()
        .input('totalProducts', sql.Int, totalProducts)
        .query(`
          INSERT INTO Enrichment_Batch (TotalProducts, Status)
          OUTPUT INSERTED.BatchID
          VALUES (@totalProducts, 'Running')
        `);
      
      return result.recordset[0].BatchID;
    } catch (error) {
      logger.error('Failed to start batch', error);
      return null;
    }
  }

  /**
   * Update batch status
   * @param {number} batchId - Batch ID
   * @param {Object} stats - Batch statistics
   */
  async updateBatch(batchId, stats) {
    try {
      await this.pool.request()
        .input('batchId', sql.Int, batchId)
        .input('processedCount', sql.Int, stats.processed)
        .input('skippedCount', sql.Int, stats.skipped)
        .input('failedCount', sql.Int, stats.failed)
        .input('successRate', sql.Decimal(5, 2), stats.successRate)
        .input('averageTimeMs', sql.Int, stats.averageTime)
        .input('status', sql.NVarChar(20), stats.status)
        .input('notes', sql.NVarChar(sql.MAX), stats.notes)
        .query(`
          UPDATE Enrichment_Batch
          SET EndTime = GETDATE(),
              ProcessedCount = @processedCount,
              SkippedCount = @skippedCount,
              FailedCount = @failedCount,
              SuccessRate = @successRate,
              AverageTimeMs = @averageTimeMs,
              Status = @status,
              Notes = @notes
          WHERE BatchID = @batchId
        `);
    } catch (error) {
      logger.error('Failed to update batch', error);
    }
  }

  /**
   * Get products for Algolia sync
   * @returns {Promise<Array>} Array of products
   */
  async getProductsForAlgoliaSync() {
    try {
      const result = await this.pool.request().query(`
        SELECT 
          ManufacturerPartNo as objectID,
          Description as name,
          Manufacturer as brand,
          CustomText02 as category,
          UnitPrice as price,
          CustomMemo01 as short_description,
          CustomMemo02 as features,
          CustomMemo03 as specs,
          CustomMemo04 as faq,
          CustomMemo05 as why_buy,
          CustomMemo06 as prerequisites,
          CustomMemo07 as related,
          CustomMemo08 as product_rules,
          CustomMemo09 as category_rules,
          CustomText03 as tags,
          CustomText04 as seo_keywords,
          CustomText05 as image,
          CustomText06 as datasheet,
          CustomText09 as scope,
          CustomText12 as processed_at,
          CustomNumber03 as ai_confidence
        FROM Products
        WHERE ManufacturerPartNo IS NOT NULL
          AND CustomText11 = 'TRUE'
      `);
      
      logger.info(`Retrieved ${result.recordset.length} products for Algolia sync`);
      return result.recordset;
    } catch (error) {
      logger.error('Failed to get products for Algolia sync', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new DatabaseService();
