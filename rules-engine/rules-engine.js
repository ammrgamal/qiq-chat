#!/usr/bin/env node
// rules-engine.js - Main rules engine for QuoteWerks product enrichment
// Uses OpenAI + Google APIs to generate product content and fetch images
// Syncs processed data to SQL database

import 'dotenv/config';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { generateProductContent, calculateConfidence } from './utils/ai-helper.js';
import { searchProductImage, analyzeImageBackground } from './utils/google-helper.js';
import { connectDatabase, getUnprocessedProducts, updateProduct, logAIProcess, disconnectDatabase } from './utils/sql-helper.js';

// ============================================
// Configuration Constants
// ============================================
const TEST_LIMIT = 20; // Set to null to process all products
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // milliseconds
const IMAGE_WHITE_THRESHOLD = 78; // percentage
const IMAGE_CHECK_LIMIT = 8; // first N images to check

// ============================================
// Statistics & Tracking
// ============================================
const stats = {
  total: 0,
  success: 0,
  errors: 0,
  imagesProcessed: 0,
  apiCalls: { openai: 0, google: 0 },
  startTime: Date.now(),
  confidenceScores: []
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
  
  // TODO: Also write to logs/rules-engine.log file
}

// ============================================
// Retry Helper Function
// ============================================
async function retryOperation(operation, operationName, maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
      log(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, 'warn');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ============================================
// Process Single Product
// ============================================
async function processProduct(product) {
  const startTime = Date.now();
  
  try {
    log(`Processing: ${product.ProductName} (${product.PartNumber})`, 'info');
    
    // Step 1: Generate AI content
    const aiContent = await retryOperation(
      async () => {
        stats.apiCalls.openai++;
        return await generateProductContent(product);
      },
      'AI content generation'
    );
    
    // Step 2: Fetch product image if needed
    let imageUrl = product.ImageFile;
    if (!imageUrl || imageUrl.trim() === '') {
      try {
        log(`Fetching image for ${product.ProductName}...`, 'info');
        const searchResults = await retryOperation(
          async () => {
            stats.apiCalls.google++;
            return await searchProductImage(product.ProductName, product.Manufacturer);
          },
          'Image search'
        );
        
        // Try first N images to find one with white background
        for (let i = 0; i < Math.min(searchResults.length, IMAGE_CHECK_LIMIT); i++) {
          const imageCandidate = searchResults[i];
          const whitePercentage = await analyzeImageBackground(imageCandidate);
          
          if (whitePercentage >= IMAGE_WHITE_THRESHOLD) {
            imageUrl = imageCandidate;
            stats.imagesProcessed++;
            log(`Found suitable image (${whitePercentage.toFixed(1)}% white background)`, 'success');
            break;
          }
        }
        
        // Fallback to manufacturer logo
        if (!imageUrl && product.Manufacturer) {
          imageUrl = `${product.Manufacturer}.jpg`;
          log(`Using fallback image: ${imageUrl}`, 'info');
        }
      } catch (error) {
        log(`Image fetch failed: ${error.message}`, 'warn');
        // Continue without image
      }
    }
    
    // Step 3: Calculate confidence score
    const confidence = calculateConfidence(product, aiContent);
    stats.confidenceScores.push(confidence);
    
    // Step 4: Prepare update data
    const updateData = {
      CustomMemo01: aiContent.shortDescription,
      CustomText01: aiContent.category,
      CustomText02: aiContent.subcategory,
      CustomText03: aiContent.prerequisites || '',
      CustomText04: aiContent.relatedItems || '',
      CustomText05: aiContent.servicesScope || '',
      CustomText06: aiContent.faq,
      CustomText07: aiContent.features,
      CustomText08: aiContent.specifications,
      CustomText09: aiContent.aiRuleProduct || '',
      CustomText10: aiContent.aiRuleCategory || '',
      CustomNumber01: confidence,
      CustomNumber02: 1, // AIProcessed flag
      CustomMemo09: aiContent.upsellSuggestions,
      CustomMemo10: aiContent.marketingMessage,
      ImageFile: imageUrl
    };
    
    // Step 5: Update database
    await updateProduct(product.PartNumber, updateData);
    
    // Step 6: Log to AI_Log table
    const processingTime = Date.now() - startTime;
    await logAIProcess({
      InputText: JSON.stringify(product),
      OutputText: JSON.stringify(aiContent),
      AIProvider: aiContent.provider || 'OpenAI',
      Model: aiContent.model || 'gpt-4o-mini',
      TokensUsed: aiContent.tokensUsed || 0,
      ProcessingTimeMs: processingTime,
      Status: 'Success',
      Metadata: JSON.stringify({
        confidence,
        imageProcessed: !!imageUrl,
        partNumber: product.PartNumber
      })
    });
    
    stats.success++;
    log(`✓ Successfully processed ${product.ProductName} (${(processingTime / 1000).toFixed(2)}s)`, 'success');
    
    return { success: true, product: product.ProductName };
    
  } catch (error) {
    stats.errors++;
    log(`✗ Error processing ${product.ProductName}: ${error.message}`, 'error');
    
    // Log error to database
    try {
      await logAIProcess({
        InputText: JSON.stringify(product),
        OutputText: null,
        AIProvider: 'OpenAI',
        Model: 'gpt-4o-mini',
        TokensUsed: 0,
        ProcessingTimeMs: Date.now() - startTime,
        Status: 'Error',
        ErrorMessage: error.message,
        Metadata: JSON.stringify({ partNumber: product.PartNumber })
      });
    } catch (logError) {
      log(`Failed to log error: ${logError.message}`, 'error');
    }
    
    return { success: false, product: product.ProductName, error: error.message };
  }
}

// ============================================
// Display Summary Report
// ============================================
function displaySummary() {
  const totalTime = (Date.now() - stats.startTime) / 1000;
  const avgTime = stats.total > 0 ? (totalTime / stats.total).toFixed(2) : 0;
  
  console.log('\n' + '='.repeat(60));
  console.log(chalk.bold.cyan('PROCESSING SUMMARY'));
  console.log('='.repeat(60));
  console.log(chalk.white(`Total Products:        ${stats.total}`));
  console.log(chalk.green(`✓ Successfully:        ${stats.success}`));
  console.log(chalk.red(`✗ Errors:              ${stats.errors}`));
  console.log(chalk.blue(`Images Processed:      ${stats.imagesProcessed}`));
  console.log(chalk.yellow(`OpenAI API Calls:      ${stats.apiCalls.openai}`));
  console.log(chalk.yellow(`Google API Calls:      ${stats.apiCalls.google}`));
  console.log(chalk.white(`Total Time:            ${totalTime.toFixed(2)}s`));
  console.log(chalk.white(`Average per Product:   ${avgTime}s`));
  
  if (stats.confidenceScores.length > 0) {
    const avgConfidence = (stats.confidenceScores.reduce((a, b) => a + b, 0) / stats.confidenceScores.length).toFixed(2);
    const minConfidence = Math.min(...stats.confidenceScores).toFixed(2);
    const maxConfidence = Math.max(...stats.confidenceScores).toFixed(2);
    console.log(chalk.white(`Confidence (avg/min/max): ${avgConfidence}% / ${minConfidence}% / ${maxConfidence}%`));
  }
  
  console.log('='.repeat(60) + '\n');
}

// ============================================
// Main Execution
// ============================================
async function main() {
  console.log(chalk.bold.blue('\n🚀 QuoteWerks Rules Engine - Product Enrichment\n'));
  
  try {
    // Connect to database
    log('Connecting to SQL Server database...', 'info');
    await connectDatabase();
    log('✓ Database connected successfully', 'success');
    
    // Get products to process
    const mode = TEST_LIMIT ? `TEST MODE (${TEST_LIMIT} products)` : 'PRODUCTION MODE (all products)';
    log(`Running in ${mode}`, 'info');
    
    const products = await getUnprocessedProducts(TEST_LIMIT);
    stats.total = products.length;
    
    if (products.length === 0) {
      log('No unprocessed products found', 'warn');
      return;
    }
    
    log(`Found ${products.length} products to process`, 'success');
    
    // Initialize progress bar
    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% | {value}/{total} Products | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    
    progressBar.start(products.length, 0);
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
      await processProduct(products[i]);
      progressBar.update(i + 1);
    }
    
    progressBar.stop();
    
    // Display summary
    displaySummary();
    
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

export { processProduct, main };
