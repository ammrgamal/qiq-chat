// index.js - Main entry point for enrichment engine
import logger from './logger.js';
import enrichmentEngine from './enrichmentEngine.js';
import algoliaService from './algoliaService.js';
import dbService from './dbService.js';

/**
 * Main execution function
 */
async function main() {
  try {
    // Display banner
    logger.banner('QuickITQuote Enrichment Engine');
    
    console.log(`
🚀 AI-Powered Product Enrichment System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This system automatically enriches QuoteWerks products with AI-generated
content and syncs them to Algolia for fast search capabilities.

Features:
  • AI-powered content generation (descriptions, features, specs, FAQ)
  • Automatic image fetching with white background detection
  • Smart categorization and tagging
  • Self-learning rules engine
  • Algolia mirror synchronization
  • Comprehensive logging and batch tracking

Environment Configuration:
  • Database: ${process.env.DATABASE || 'config/dbConfig.json'}
  • OpenAI API: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Not configured'}
  • Gemini API: ${process.env.GOOGLE_API_KEY ? '✓ Configured' : '✗ Not configured'}
  • Google Search: ${process.env.GOOGLE_CX_ID ? '✓ Configured' : '✗ Not configured'}
  • Algolia: ${process.env.ALGOLIA_APP_ID ? '✓ Configured' : '✗ Not configured'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    
    // Check for specific commands
    if (command === '--sync') {
      await runAlgoliaSync();
    } else if (command === '--stats') {
      await showStats();
    } else if (command === '--configure-algolia') {
      await configureAlgolia();
    } else {
      // Default: Run enrichment batch
      const batchSize = parseInt(args[1]) || 20;
      await runEnrichment(batchSize);
    }

    // Success
    logger.success('\n✅ Operation completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

/**
 * Run product enrichment
 * @param {number} batchSize - Number of products to process
 */
async function runEnrichment(batchSize) {
  try {
    logger.info(`Starting enrichment batch (${batchSize} products)...\n`);
    
    // Initialize engine
    await enrichmentEngine.initialize();
    
    // Process batch
    const result = await enrichmentEngine.processBatch(batchSize);
    
    // Shutdown
    await enrichmentEngine.shutdown();
    
    logger.info('\nResults saved to database tables:');
    logger.info('  • Enrichment_Log: Processing logs and details');
    logger.info('  • Enrichment_Batch: Batch statistics');
    logger.info('  • Products: Updated with enriched content');
    logger.info('  • Algolia: Synchronized (if configured)\n');
  } catch (error) {
    logger.error('Enrichment failed', error);
    await enrichmentEngine.shutdown();
    throw error;
  }
}

/**
 * Run Algolia synchronization only
 */
async function runAlgoliaSync() {
  try {
    logger.section('Algolia Synchronization Mode');
    
    await dbService.connect();
    
    if (!algoliaService.isConfigured()) {
      logger.error('Algolia is not configured. Please set environment variables:');
      logger.info('  • ALGOLIA_APP_ID');
      logger.info('  • ALGOLIA_ADMIN_API_KEY');
      logger.info('  • ALGOLIA_INDEX_NAME (optional)');
      return;
    }

    logger.info('Fetching enriched products from database...');
    const products = await dbService.getProductsForAlgoliaSync();
    
    if (products.length === 0) {
      logger.warn('No enriched products found to sync');
      return;
    }

    logger.info(`Found ${products.length} enriched products`);
    const result = await algoliaService.syncProducts(products);
    
    if (result.success) {
      logger.success(`\n✓ Successfully synced ${result.synced} products to Algolia`);
    } else {
      logger.error(`Sync failed: ${result.reason}`);
    }

    await dbService.disconnect();
  } catch (error) {
    logger.error('Algolia sync failed', error);
    await dbService.disconnect();
    throw error;
  }
}

/**
 * Show system statistics
 */
async function showStats() {
  try {
    logger.section('System Statistics');
    
    await dbService.connect();
    
    // Get recent batch statistics
    const batchStats = await dbService.pool.request().query(`
      SELECT TOP 10
        BatchID,
        StartTime,
        TotalProducts,
        ProcessedCount,
        SuccessRate,
        Status
      FROM Enrichment_Batch
      ORDER BY StartTime DESC
    `);
    
    console.log('\n📊 Recent Batches:');
    console.table(batchStats.recordset);
    
    // Get enrichment stats by provider
    const providerStats = await dbService.pool.request().query(`
      SELECT 
        AIProvider,
        COUNT(*) as Count,
        AVG(AIConfidence) as AvgConfidence,
        AVG(TimeTaken) as AvgTime
      FROM Enrichment_Log
      WHERE Status = 'Success'
      GROUP BY AIProvider
    `);
    
    console.log('\n🤖 AI Provider Statistics:');
    console.table(providerStats.recordset);
    
    // Get Algolia stats
    if (algoliaService.isConfigured()) {
      const algoliaStats = await algoliaService.getIndexStats();
      console.log('\n🔍 Algolia Index:');
      console.log(`  Index Name: ${algoliaStats.indexName || 'N/A'}`);
      console.log(`  Total Products: ${algoliaStats.nbHits || 'N/A'}`);
    }
    
    await dbService.disconnect();
  } catch (error) {
    logger.error('Failed to get statistics', error);
    await dbService.disconnect();
    throw error;
  }
}

/**
 * Configure Algolia index settings
 */
async function configureAlgolia() {
  try {
    logger.section('Algolia Index Configuration');
    
    if (!algoliaService.isConfigured()) {
      logger.error('Algolia is not configured');
      return;
    }

    await algoliaService.configureIndex();
    logger.success('Algolia index configured successfully');
  } catch (error) {
    logger.error('Failed to configure Algolia', error);
    throw error;
  }
}

// Run main function
main().catch(error => {
  logger.error('Unhandled error', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.warn('\nReceived SIGINT, shutting down gracefully...');
  await enrichmentEngine.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.warn('\nReceived SIGTERM, shutting down gracefully...');
  await enrichmentEngine.shutdown();
  process.exit(0);
});
