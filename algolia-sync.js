// algolia-sync.js - Synchronization module between QuoteWerks SQL DB and Algolia
// This module fetches products from SQL Server, transforms them, and syncs to Algolia

// ============================================
// 1. Imports & dotenv setup
// ============================================
import dotenv from 'dotenv';
import algoliasearch from 'algoliasearch';
import sql from 'mssql';
import { readFile, mkdir, appendFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// QuickITQuote brand color
const QIQ_BLUE = '#0055A4';

// ============================================
// 2. Algolia Connection Setup
// ============================================
let algoliaClient = null;
let productsIndex = null;

/**
 * Initialize Algolia client and index
 * @returns {Promise<void>}
 */
async function initAlgolia() {
  try {
    const appId = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_API_KEY;
    const indexName = process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';

    if (!appId || !apiKey) {
      throw new Error('ALGOLIA_APP_ID and ALGOLIA_API_KEY must be set in .env file');
    }

    algoliaClient = algoliasearch(appId, apiKey);
    productsIndex = algoliaClient.initIndex(indexName);

    console.log('✅ Algolia client connected');
    console.log(`   Index: ${indexName}`);
  } catch (error) {
    console.error('❌ Algolia connection error:', error.message);
    throw error;
  }
}

// ============================================
// 3. SQL Fetch Function
// ============================================

/**
 * Load database configuration from rules-engine config
 * @returns {Promise<Object>} Database configuration
 */
async function loadDbConfig() {
  try {
    const configPath = join(__dirname, 'rules-engine/config/dbConfig.json');
    const configData = await readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('❌ Failed to load database configuration:', error.message);
    throw error;
  }
}

/**
 * Fetch enriched products from QuoteWerks SQL database
 * Selects all products where AIProcessed = 1
 * @returns {Promise<Array>} Array of product objects
 */
async function fetchEnrichedProducts() {
  let pool = null;
  try {
    console.log('📦 Connecting to QuoteWerks SQL database...');
    
    const dbConfig = await loadDbConfig();
    pool = await sql.connect(dbConfig);
    
    console.log('✅ Connected to SQL Server');
    console.log('🔍 Fetching products where AIProcessed = 1...');

    // Query to fetch all relevant product fields
    const query = `
      SELECT 
        ID,
        Manufacturer,
        ManufacturerPartNumber,
        InternalPartNumber,
        PartNo,
        Description,
        ShortDescription,
        ExtendedDescription,
        Category,
        UnitOfMeasure,
        Availability,
        Price,
        ListPrice,
        Cost,
        ImageFile,
        SpecSheet,
        ProductLink,
        KeywordList,
        Discontinued,
        LastModified,
        CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
        CustomText01, CustomText02, CustomText03, CustomText04, CustomText05,
        CustomText06, CustomText07, CustomText08, CustomText09, CustomText10,
        CustomText11, CustomText12, CustomText13, CustomText14, CustomText15,
        CustomText16, CustomText17, CustomText18, CustomText19, CustomText20
      FROM Products
      WHERE AIProcessed = 1
      ORDER BY LastModified DESC
    `;

    const result = await pool.request().query(query);
    const products = result.recordset;

    console.log(`✅ Fetched ${products.length} products from database`);
    
    return products;
  } catch (error) {
    console.error('❌ SQL fetch error:', error.message);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// ============================================
// 4. Data Transformation Function
// ============================================

/**
 * Normalize file URL by replacing backslashes with forward slashes
 * @param {string} url - File URL
 * @returns {string} Normalized URL
 */
function normalizeFileUrl(url) {
  if (!url) return '';
  return url.replace(/\\/g, '/');
}

/**
 * Map availability code to string
 * @param {number} availability - Availability code (1 or 0)
 * @returns {string} Availability status
 */
function mapAvailability(availability) {
  return availability === 1 ? 'Stock' : 'on back order';
}

/**
 * Split and deduplicate custom fields
 * @param {Array<string>} fields - Array of custom field values
 * @returns {Array<string>} Deduplicated non-empty values
 */
function splitAndDedup(fields) {
  const values = new Set();
  fields.forEach(field => {
    if (field && typeof field === 'string') {
      // Split by common delimiters and trim
      field.split(/[,;\n]/).forEach(value => {
        const trimmed = value.trim();
        if (trimmed) {
          values.add(trimmed);
        }
      });
    }
  });
  return Array.from(values);
}

/**
 * Truncate text to max length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Add rich HTML formatting with QuickITQuote branding
 * @param {string} text - Text to format
 * @returns {string} HTML formatted text
 */
function addRichFormatting(text) {
  if (!text) return '';
  // Add simple paragraph wrapping with brand color for headings
  return text
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p>([^<]{1,50}:)<\/p>/g, `<h3 style="color: ${QIQ_BLUE};">$1</h3>`);
}

/**
 * Transform QuoteWerks products to Algolia format
 * Maps field names according to algolia_index_reference.md
 * @param {Array} products - Array of products from SQL
 * @returns {Array} Array of Algolia-formatted products
 */
function transformForAlgolia(products) {
  console.log('🔄 Transforming products for Algolia...');

  const formattedProducts = products.map(product => {
    // Determine objectID (stable unique identifier)
    const objectID = product.ManufacturerPartNumber || 
                     product.InternalPartNumber || 
                     product.ID.toString();

    // Collect custom memo fields
    const customMemoFields = [
      product.CustomMemo01, product.CustomMemo02, product.CustomMemo03,
      product.CustomMemo04, product.CustomMemo05
    ];
    const custom_memo = splitAndDedup(customMemoFields);

    // Collect custom text fields
    const customTextFields = [
      product.CustomText01, product.CustomText02, product.CustomText03, product.CustomText04,
      product.CustomText05, product.CustomText06, product.CustomText07, product.CustomText08,
      product.CustomText09, product.CustomText10, product.CustomText11, product.CustomText12,
      product.CustomText13, product.CustomText14, product.CustomText15, product.CustomText16,
      product.CustomText17, product.CustomText18, product.CustomText19, product.CustomText20
    ];
    const custom_text = splitAndDedup(customTextFields);

    // Process tags from KeywordList
    const tags = product.KeywordList ? 
      product.KeywordList.split(/[,;]/).map(t => t.trim()).filter(t => t) : 
      [];

    // Calculate availability weight for ranking
    const availability_weight = product.Availability === 1 ? 100 : 0;

    return {
      objectID,
      sku: objectID,
      mpn: product.ManufacturerPartNumber || '',
      name: product.Description || product.PartNo || '',
      brand: product.Manufacturer || '',
      category: product.Category || '',
      unit: product.UnitOfMeasure || '',
      availability: mapAvailability(product.Availability),
      availability_weight,
      price: parseFloat(product.Price) || 0,
      list_price: parseFloat(product.ListPrice) || 0,
      cost: parseFloat(product.Cost) || 0,
      image: normalizeFileUrl(product.ImageFile),
      spec_sheet: normalizeFileUrl(product.SpecSheet),
      link: product.ProductLink || '',
      ShortDescription: truncateText(product.ShortDescription, 500),
      ExtendedDescription: truncateText(product.ExtendedDescription, 4000),
      custom_memo,
      custom_text,
      tags,
      Discontinued: product.Discontinued === 1 || product.Discontinued === true,
      LastModified: product.LastModified ? product.LastModified.toISOString() : new Date().toISOString()
    };
  });

  console.log(`✅ Transformed ${formattedProducts.length} products`);
  
  // Log first sample for verification
  if (formattedProducts.length > 0) {
    console.log('\n📋 Sample product (first):');
    console.log(`   objectID: ${formattedProducts[0].objectID}`);
    console.log(`   name: ${formattedProducts[0].name}`);
    console.log(`   brand: ${formattedProducts[0].brand}`);
    console.log(`   price: $${formattedProducts[0].price}`);
    console.log(`   availability: ${formattedProducts[0].availability}`);
  }

  return formattedProducts;
}

// ============================================
// 5. Algolia Sync Function
// ============================================

/**
 * Sync formatted products to Algolia with batching and retry logic
 * @param {Array} formattedProducts - Array of Algolia-formatted products
 * @returns {Promise<Object>} Sync statistics
 */
async function syncToAlgolia(formattedProducts) {
  console.log('\n🚀 Starting Algolia sync...');
  
  const BATCH_SIZE = 500;
  const MAX_RETRIES = 2;
  
  const stats = {
    total: formattedProducts.length,
    synced: 0,
    failed: 0,
    batches: Math.ceil(formattedProducts.length / BATCH_SIZE)
  };

  try {
    // Optional: Clear existing records for full sync
    // Uncomment if you want to clear the index before syncing
    // console.log('🗑️  Clearing existing index...');
    // await productsIndex.clearObjects();
    // console.log('✅ Index cleared');

    // Process in batches
    for (let i = 0; i < formattedProducts.length; i += BATCH_SIZE) {
      const batch = formattedProducts.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      let attempts = 0;
      let success = false;

      while (attempts <= MAX_RETRIES && !success) {
        try {
          await productsIndex.saveObjects(batch);
          stats.synced += batch.length;
          success = true;

          // Progress counter
          const progress = Math.floor((stats.synced / stats.total) * 100);
          process.stdout.write(
            `\r📤 Progress: [${stats.synced}/${stats.total}] ${progress}% - Batch ${batchNumber}/${stats.batches} ✓`
          );
        } catch (error) {
          attempts++;
          if (attempts > MAX_RETRIES) {
            console.error(`\n❌ Batch ${batchNumber} failed after ${MAX_RETRIES} retries:`, error.message);
            stats.failed += batch.length;
          } else {
            console.log(`\n⚠️  Batch ${batchNumber} failed (attempt ${attempts}/${MAX_RETRIES}), retrying...`);
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
    }

    console.log('\n');
    return stats;
  } catch (error) {
    console.error('❌ Algolia sync error:', error.message);
    throw error;
  }
}

// ============================================
// 6. Logging and Summary
// ============================================

/**
 * Ensure logs directory exists
 * @returns {Promise<void>}
 */
async function ensureLogsDirectory() {
  const logsDir = join(__dirname, 'logs');
  if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
  }
}

/**
 * Log sync event to file
 * @param {string} message - Log message
 * @returns {Promise<void>}
 */
async function logSyncEvent(message) {
  try {
    await ensureLogsDirectory();
    const logPath = join(__dirname, 'logs/sync.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    await appendFile(logPath, logEntry, 'utf8');
  } catch (error) {
    console.error('⚠️  Failed to write to log file:', error.message);
  }
}

/**
 * Log sync summary with color coding
 * @param {Object} stats - Sync statistics
 * @returns {Promise<void>}
 */
async function logSummary(stats) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalFetched: stats.totalFetched,
    totalSynced: stats.synced,
    totalFailed: stats.failed,
    duration: stats.duration,
    status: stats.failed === 0 ? 'SUCCESS' : stats.synced > 0 ? 'PARTIAL' : 'FAILED'
  };

  // Console output with color coding
  console.log('\n' + '='.repeat(80));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`Total Fetched:  ${summary.totalFetched}`);
  
  if (summary.status === 'SUCCESS') {
    console.log(`✅ Total Synced:   ${summary.totalSynced} (SUCCESS)`);
  } else if (summary.status === 'PARTIAL') {
    console.log(`⚠️  Total Synced:   ${summary.totalSynced} (PARTIAL - ${summary.totalFailed} failed)`);
  } else {
    console.log(`❌ Total Synced:   ${summary.totalSynced} (FAILED - ${summary.totalFailed} failed)`);
  }
  
  console.log(`Duration:       ${summary.duration}`);
  console.log(`Timestamp:      ${summary.timestamp}`);
  console.log('='.repeat(80));

  // Write to log file
  await ensureLogsDirectory();
  const logPath = join(__dirname, 'logs/sync-summary.log');
  await writeFile(logPath, JSON.stringify(summary, null, 2), 'utf8');
  
  await logSyncEvent(`Sync completed: ${summary.status} - ${summary.totalSynced} synced, ${summary.totalFailed} failed`);
}

// ============================================
// 7. Main Runner
// ============================================

/**
 * Main function to run the complete Algolia sync process
 * @returns {Promise<void>}
 */
async function runAlgoliaSync() {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(80));
  console.log('🔄 ALGOLIA SYNC STARTED');
  console.log('='.repeat(80) + '\n');

  let stats = {
    totalFetched: 0,
    synced: 0,
    failed: 0,
    duration: '0s'
  };

  try {
    // Log start event
    await logSyncEvent('Algolia sync started');

    // Step 1: Initialize Algolia
    await initAlgolia();
    
    // Step 2: Fetch products from SQL
    const products = await fetchEnrichedProducts();
    stats.totalFetched = products.length;

    if (products.length === 0) {
      console.log('⚠️  No products found with AIProcessed = 1');
      await logSyncEvent('No products found to sync');
      return;
    }

    // Step 3: Transform products
    const formattedProducts = transformForAlgolia(products);

    // Step 4: Sync to Algolia
    const syncStats = await syncToAlgolia(formattedProducts);
    stats.synced = syncStats.synced;
    stats.failed = syncStats.failed;

    // Calculate duration
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);
    stats.duration = `${durationSec}s`;

    // Step 5: Log summary
    await logSummary(stats);

    // Final message
    if (stats.failed === 0) {
      console.log('\n✨ Algolia Sync Complete\n');
    } else {
      console.log('\n⚠️  Algolia Sync Completed with Errors\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    await logSyncEvent(`Fatal error: ${error.message}`);
    
    // Calculate duration even on error
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);
    stats.duration = `${durationSec}s`;
    
    await logSummary(stats);
    
    process.exit(1);
  }

  process.exit(0);
}

// ============================================
// Run the sync
// ============================================
runAlgoliaSync();
