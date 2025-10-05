// dbService.js - Database service for SQL Server operations
import sql from 'mssql';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseService {
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
      logger.info('Database configuration loaded');
      return this.config;
    } catch (error) {
      logger.error('Failed to load database configuration', error);
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
      logger.success('Connected to SQL Server database');
    } catch (error) {
      logger.error('Database connection failed', error);
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
        logger.info('Disconnected from database');
      }
    } catch (error) {
      logger.error('Error disconnecting from database', error);
    }
  }

  /**
   * Execute a query
   * @param {string} query - SQL query
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(query, params = {}) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const request = this.pool.request();
      
      // Add parameters
      for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
      }

      const result = await request.query(query);
      return result;
    } catch (error) {
      logger.error('Query execution failed', error);
      throw error;
    }
  }

  /**
   * Log AI processing to database
   * @param {Object} logData - Log data
   * @returns {Promise<number>} Log ID
   */
  async logAIProcess(logData) {
    try {
      const query = `
        INSERT INTO dbo.AI_Log 
        (InputText, OutputText, AIProvider, Model, TokensUsed, ProcessingTimeMs, Status, ErrorMessage, UserID, SessionID, Metadata)
        OUTPUT INSERTED.LogID
        VALUES 
        (@inputText, @outputText, @aiProvider, @model, @tokensUsed, @processingTimeMs, @status, @errorMessage, @userID, @sessionID, @metadata)
      `;

      const result = await this.query(query, {
        inputText: logData.inputText || null,
        outputText: logData.outputText || null,
        aiProvider: logData.aiProvider || null,
        model: logData.model || null,
        tokensUsed: logData.tokensUsed || null,
        processingTimeMs: logData.processingTimeMs || null,
        status: logData.status || 'Success',
        errorMessage: logData.errorMessage || null,
        userID: logData.userID || null,
        sessionID: logData.sessionID || null,
        metadata: logData.metadata ? JSON.stringify(logData.metadata) : null
      });

      const logId = result.recordset[0].LogID;
      logger.debug(`AI process logged with ID: ${logId}`);
      return logId;
    } catch (error) {
      logger.error('Failed to log AI process', error);
      throw error;
    }
  }

  /**
   * Save or update product rule
   * @param {Object} ruleData - Rule data
   * @returns {Promise<number>} Rule ID
   */
  async saveProductRule(ruleData) {
    try {
      // Check if rule exists
      const checkQuery = `
        SELECT RuleID FROM dbo.Rules_Item 
        WHERE PartNumber = @partNumber AND Manufacturer = @manufacturer
      `;
      
      const existing = await this.query(checkQuery, {
        partNumber: ruleData.partNumber || '',
        manufacturer: ruleData.manufacturer || ''
      });

      if (existing.recordset.length > 0) {
        // Update existing rule
        const updateQuery = `
          UPDATE dbo.Rules_Item 
          SET ProductName = @productName,
              Category = @category,
              SubCategory = @subCategory,
              Classification = @classification,
              AutoApprove = @autoApprove,
              MinPrice = @minPrice,
              MaxPrice = @maxPrice,
              LeadTimeDays = @leadTimeDays,
              Keywords = @keywords,
              AIGenerated = @aiGenerated,
              Confidence = @confidence,
              ModifiedDate = GETDATE(),
              Notes = @notes
          WHERE RuleID = @ruleId
        `;

        await this.query(updateQuery, {
          ruleId: existing.recordset[0].RuleID,
          productName: ruleData.productName || '',
          category: ruleData.category || null,
          subCategory: ruleData.subCategory || null,
          classification: ruleData.classification || 'Standard',
          autoApprove: ruleData.autoApprove ? 1 : 0,
          minPrice: ruleData.minPrice || null,
          maxPrice: ruleData.maxPrice || null,
          leadTimeDays: ruleData.leadTimeDays || null,
          keywords: ruleData.keywords || null,
          aiGenerated: ruleData.aiGenerated ? 1 : 0,
          confidence: ruleData.confidence || null,
          notes: ruleData.notes || null
        });

        logger.debug(`Updated rule for: ${ruleData.productName}`);
        return existing.recordset[0].RuleID;
      } else {
        // Insert new rule
        const insertQuery = `
          INSERT INTO dbo.Rules_Item 
          (ProductName, PartNumber, Manufacturer, Category, SubCategory, Classification, AutoApprove, 
           MinPrice, MaxPrice, LeadTimeDays, Keywords, AIGenerated, Confidence, Notes, CreatedBy)
          OUTPUT INSERTED.RuleID
          VALUES 
          (@productName, @partNumber, @manufacturer, @category, @subCategory, @classification, @autoApprove,
           @minPrice, @maxPrice, @leadTimeDays, @keywords, @aiGenerated, @confidence, @notes, @createdBy)
        `;

        const result = await this.query(insertQuery, {
          productName: ruleData.productName || '',
          partNumber: ruleData.partNumber || null,
          manufacturer: ruleData.manufacturer || null,
          category: ruleData.category || null,
          subCategory: ruleData.subCategory || null,
          classification: ruleData.classification || 'Standard',
          autoApprove: ruleData.autoApprove ? 1 : 0,
          minPrice: ruleData.minPrice || null,
          maxPrice: ruleData.maxPrice || null,
          leadTimeDays: ruleData.leadTimeDays || null,
          keywords: ruleData.keywords || null,
          aiGenerated: ruleData.aiGenerated ? 1 : 0,
          confidence: ruleData.confidence || null,
          notes: ruleData.notes || null,
          createdBy: 'RulesEngine'
        });

        const ruleId = result.recordset[0].RuleID;
        logger.debug(`Created new rule for: ${ruleData.productName} (ID: ${ruleId})`);
        return ruleId;
      }
    } catch (error) {
      logger.error('Failed to save product rule', error);
      throw error;
    }
  }

  /**
   * Get all active categories
   * @returns {Promise<Array>} List of categories
   */
  async getCategories() {
    try {
      const query = `
        SELECT CategoryID, CategoryName, Description, AutoApproveLimit, RequiresReview, LeadTimeDays
        FROM dbo.Rules_Category
        WHERE IsActive = 1
        ORDER BY SortOrder, CategoryName
      `;

      const result = await this.query(query);
      return result.recordset;
    } catch (error) {
      logger.error('Failed to get categories', error);
      throw error;
    }
  }

  /**
   * Get product rule by part number
   * @param {string} partNumber - Part number
   * @returns {Promise<Object|null>} Rule object or null
   */
  async getProductRule(partNumber) {
    try {
      const query = `
        SELECT * FROM dbo.Rules_Item
        WHERE PartNumber = @partNumber AND IsActive = 1
      `;

      const result = await this.query(query, { partNumber });
      return result.recordset.length > 0 ? result.recordset[0] : null;
    } catch (error) {
      logger.error('Failed to get product rule', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new DatabaseService();
