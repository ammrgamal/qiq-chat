#!/usr/bin/env node
// algolia-sync.js - Sync processed products from SQL Server to Algolia
// Reads products where AIProcessed = 1 and uploads to Algolia index

import 'dotenv/config';
import algoliasearch from 'algoliasearch';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { connectDatabase, getProcessedProducts, disconnectDatabase } from './utils/sql-helper.js';

// ============================================
// Configuration
// ============================================
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'woocommerce_products';
const BATCH_SIZE = 100; // Number of records to sync at once

// ============================================
// Statistics
// ============================================
const stats = {
  total: 0,
  synced: 0,
  errors: 0,
  startTime: Date.now()
};

// ============================================
// Logging Utility
// ============================================
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warn: chalk.yellow
  };
  const color = colors[type] || chalk.white;
  console.log(color(`[${timestamp}] ${message}`));
  
  // TODO: Also write to logs/sync.log file
}

// ============================================
// Map SQL Product to Algolia Record
// ============================================
function mapProductToAlgolia(product) {
  return {
    objectID: product.PartNumber, // Use PartNumber as unique ID
    partNumber: product.PartNumber,
    productName: product.ProductName,
    manufacturer: product.Manufacturer,
    description: product.Description,
    shortDescription: product.CustomMemo01,
    
    // Classification
    category: product.CustomText01,
    subcategory: product.CustomText02,
    
    // AI-Enhanced Content
    features: product.CustomText07,
    specifications: product.CustomText08,
    faq: product.CustomText06,
    marketingMessage: product.CustomMemo10,
    upsellSuggestions: product.CustomMemo09,
    
    // Related Information
    prerequisites: product.CustomText03,
    relatedItems: product.CustomText04,
    servicesScope: product.CustomText05,
    
    // AI Metadata
    aiConfidence: product.CustomNumber01,
    aiProcessed: product.CustomNumber02 === 1,
    aiRuleProduct: product.CustomText09,
    aiRuleCategory: product.CustomText10,
    
    // Pricing & Media
    price: product.Price,
    imageUrl: product.ImageFile,
    
    // Timestamps
    processedDate: product.AIProcessedDate,
    lastModified: product.ModifiedDate || product.AIProcessedDate,
    
    // Searchable text (for Algolia full-text search)
    _tags: [
      product.Category,
      product.Manufacturer,
      product.CustomText01, // category
      product.CustomText02  // subcategory
    ].filter(Boolean)
  };
}

// ============================================
// Sync Products to Algolia
// ============================================
async function syncToAlgolia(products, index) {
  const batches = [];
  
  // Split products into batches
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    batches.push(products.slice(i, i + BATCH_SIZE));
  }
  
  log(`Syncing ${products.length} products in ${batches.length} batches...`, 'info');
  
  const progressBar = new cliProgress.SingleBar({
    format: 'Syncing |{bar}| {percentage}% | {value}/{total} Batches',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(batches.length, 0);
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const algoliaRecords = batch.map(mapProductToAlgolia);
    
    try {
      await index.saveObjects(algoliaRecords);
      stats.synced += batch.length;
      progressBar.update(i + 1);
    } catch (error) {
      stats.errors += batch.length;
      log(`Error syncing batch ${i + 1}: ${error.message}`, 'error');
      progressBar.update(i + 1);
    }
  }
  
  progressBar.stop();
}

// ============================================
// Display Summary
// ============================================
function displaySummary() {
  const totalTime = (Date.now() - stats.startTime) / 1000;
  
  console.log('\n' + '='.repeat(60));
  console.log(chalk.bold.cyan('SYNC SUMMARY'));
  console.log('='.repeat(60));
  console.log(chalk.white(`Total Products:        ${stats.total}`));
  console.log(chalk.green(`✓ Synced:              ${stats.synced}`));
  console.log(chalk.red(`✗ Errors:              ${stats.errors}`));
  console.log(chalk.white(`Total Time:            ${totalTime.toFixed(2)}s`));
  console.log(chalk.white(`Records/sec:           ${(stats.synced / totalTime).toFixed(2)}`));
  console.log('='.repeat(60) + '\n');
}

// ============================================
// Main Execution
// ============================================
async function main() {
  console.log(chalk.bold.blue('\n🔄 Algolia Sync - QuoteWerks to Algolia\n'));
  
  // Validate Algolia credentials
  if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
    log('Missing Algolia credentials. Please set ALGOLIA_APP_ID and ALGOLIA_API_KEY in .env', 'error');
    process.exit(1);
  }
  
  try {
    // Initialize Algolia client
    log('Initializing Algolia client...', 'info');
    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
    const index = client.initIndex(ALGOLIA_INDEX_NAME);
    log(`✓ Connected to Algolia index: ${ALGOLIA_INDEX_NAME}`, 'success');
    
    // Connect to database
    log('Connecting to SQL Server database...', 'info');
    await connectDatabase();
    log('✓ Database connected successfully', 'success');
    
    // Get processed products
    log('Fetching processed products...', 'info');
    const products = await getProcessedProducts();
    stats.total = products.length;
    
    if (products.length === 0) {
      log('No processed products found to sync', 'warn');
      return;
    }
    
    log(`Found ${products.length} processed products`, 'success');
    
    // Sync to Algolia
    await syncToAlgolia(products, index);
    
    // Display summary
    displaySummary();
    
    if (stats.synced > 0) {
      log(`✓ Successfully synced ${stats.synced} products to Algolia`, 'success');
    }
    
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    await disconnectDatabase();
    log('Database connection closed', 'info');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('Unhandled error:'), error);
    process.exit(1);
  });
}

export { syncToAlgolia, mapProductToAlgolia, main };
