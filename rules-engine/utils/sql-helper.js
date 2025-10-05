// sql-helper.js - SQL Server database helper functions
import sql from 'mssql';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pool = null;
let config = null;

/**
 * Load database configuration from config file
 * @returns {Promise<Object>} Database configuration
 */
async function loadConfig() {
  if (config) return config;
  
  try {
    const configPath = join(__dirname, '../config/dbConfig.json');
    const configData = await readFile(configPath, 'utf8');
    config = JSON.parse(configData);
    return config;
  } catch (error) {
    console.error('Failed to load database configuration:', error);
    throw error;
  }
}

/**
 * Connect to SQL Server database
 * @returns {Promise<void>}
 */
export async function connectDatabase() {
  if (pool) {
    return pool;
  }

  try {
    const dbConfig = await loadConfig();
    pool = await sql.connect(dbConfig);
    return pool;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from database
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

/**
 * Get unprocessed products from database
 * @param {number|null} limit - Number of products to fetch (null for all)
 * @returns {Promise<Array>} Array of product objects
 */
export async function getUnprocessedProducts(limit = null) {
  try {
    const request = pool.request();
    
    let query = `
      SELECT TOP ${limit || 999999}
        PartNumber,
        ProductName,
        Manufacturer,
        Description,
        Price,
        ImageFile,
        CustomMemo01,
        CustomText01,
        CustomText02,
        CustomNumber02 as AIProcessed
      FROM Products
      WHERE ISNULL(CustomNumber02, 0) = 0
      ORDER BY NEWID()
    `;
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Failed to fetch unprocessed products:', error);
    throw error;
  }
}

/**
 * Get processed products for Algolia sync
 * @returns {Promise<Array>} Array of processed product objects
 */
export async function getProcessedProducts() {
  try {
    const request = pool.request();
    
    const query = `
      SELECT 
        PartNumber,
        ProductName,
        Manufacturer,
        Description,
        Price,
        ImageFile,
        CustomMemo01,
        CustomMemo09,
        CustomMemo10,
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
        CustomNumber01 as AIConfidence,
        CustomNumber02 as AIProcessed,
        AIProcessedDate,
        ModifiedDate,
        Category
      FROM Products
      WHERE CustomNumber02 = 1
      ORDER BY AIProcessedDate DESC
    `;
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Failed to fetch processed products:', error);
    throw error;
  }
}

/**
 * Update product with AI-generated content
 * @param {string} partNumber - Product part number
 * @param {Object} data - Data to update
 * @returns {Promise<void>}
 */
export async function updateProduct(partNumber, data) {
  try {
    const request = pool.request();
    
    const query = `
      UPDATE Products SET
        CustomMemo01 = @CustomMemo01,
        CustomText01 = @CustomText01,
        CustomText02 = @CustomText02,
        CustomText03 = @CustomText03,
        CustomText04 = @CustomText04,
        CustomText05 = @CustomText05,
        CustomText06 = @CustomText06,
        CustomText07 = @CustomText07,
        CustomText08 = @CustomText08,
        CustomText09 = @CustomText09,
        CustomText10 = @CustomText10,
        CustomNumber01 = @CustomNumber01,
        CustomNumber02 = @CustomNumber02,
        CustomMemo09 = @CustomMemo09,
        CustomMemo10 = @CustomMemo10,
        ImageFile = @ImageFile,
        AIProcessedDate = GETDATE()
      WHERE PartNumber = @PartNumber
    `;
    
    request.input('PartNumber', sql.NVarChar, partNumber);
    request.input('CustomMemo01', sql.NVarChar, data.CustomMemo01 || '');
    request.input('CustomText01', sql.NVarChar, data.CustomText01 || '');
    request.input('CustomText02', sql.NVarChar, data.CustomText02 || '');
    request.input('CustomText03', sql.NVarChar, data.CustomText03 || '');
    request.input('CustomText04', sql.NVarChar, data.CustomText04 || '');
    request.input('CustomText05', sql.NVarChar, data.CustomText05 || '');
    request.input('CustomText06', sql.NVarChar, data.CustomText06 || '');
    request.input('CustomText07', sql.NVarChar, data.CustomText07 || '');
    request.input('CustomText08', sql.NVarChar, data.CustomText08 || '');
    request.input('CustomText09', sql.NVarChar, data.CustomText09 || '');
    request.input('CustomText10', sql.NVarChar, data.CustomText10 || '');
    request.input('CustomNumber01', sql.Float, data.CustomNumber01 || 0);
    request.input('CustomNumber02', sql.Bit, data.CustomNumber02 || 0);
    request.input('CustomMemo09', sql.NVarChar, data.CustomMemo09 || '');
    request.input('CustomMemo10', sql.NVarChar, data.CustomMemo10 || '');
    request.input('ImageFile', sql.NVarChar, data.ImageFile || '');
    
    await request.query(query);
  } catch (error) {
    console.error('Failed to update product:', error);
    throw error;
  }
}

/**
 * Log AI processing to AI_Log table
 * @param {Object} logData - Log data object
 * @returns {Promise<number>} Log ID
 */
export async function logAIProcess(logData) {
  try {
    const request = pool.request();
    
    const query = `
      INSERT INTO AI_Log (
        InputText,
        OutputText,
        AIProvider,
        Model,
        TokensUsed,
        ProcessingTimeMs,
        Status,
        ErrorMessage,
        Metadata
      )
      VALUES (
        @InputText,
        @OutputText,
        @AIProvider,
        @Model,
        @TokensUsed,
        @ProcessingTimeMs,
        @Status,
        @ErrorMessage,
        @Metadata
      );
      SELECT SCOPE_IDENTITY() as LogID;
    `;
    
    request.input('InputText', sql.NVarChar, logData.InputText || null);
    request.input('OutputText', sql.NVarChar, logData.OutputText || null);
    request.input('AIProvider', sql.NVarChar, logData.AIProvider || null);
    request.input('Model', sql.NVarChar, logData.Model || null);
    request.input('TokensUsed', sql.Int, logData.TokensUsed || 0);
    request.input('ProcessingTimeMs', sql.Int, logData.ProcessingTimeMs || 0);
    request.input('Status', sql.NVarChar, logData.Status || 'Unknown');
    request.input('ErrorMessage', sql.NVarChar, logData.ErrorMessage || null);
    request.input('Metadata', sql.NVarChar, logData.Metadata || null);
    
    const result = await request.query(query);
    return result.recordset[0].LogID;
  } catch (error) {
    console.error('Failed to log AI process:', error);
    throw error;
  }
}

export default {
  connectDatabase,
  disconnectDatabase,
  getUnprocessedProducts,
  getProcessedProducts,
  updateProduct,
  logAIProcess
};
