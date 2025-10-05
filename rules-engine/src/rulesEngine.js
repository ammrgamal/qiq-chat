// rulesEngine.js - Main rules engine orchestrator
import logger from './logger.js';
import dbService from './dbService.js';
import aiService from './aiService.js';
import autoApproval from './autoApproval.js';
import cliProgress from 'cli-progress';

class RulesEngine {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the rules engine
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Rules engine already initialized');
      return;
    }

    try {
      logger.banner('Rules Engine Initialization');
      
      // Connect to database
      await dbService.connect();
      
      // Load categories
      const categories = await dbService.getCategories();
      logger.success(`Loaded ${categories.length} product categories`);
      
      this.isInitialized = true;
      logger.success('Rules engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize rules engine', error);
      throw error;
    }
  }

  /**
   * Process a single product
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Processing result
   */
  async processProduct(product) {
    try {
      const startTime = Date.now();

      // Classify product using AI
      const classification = await aiService.classifyProduct(product);

      // Check auto-approval
      const approval = await autoApproval.checkAutoApproval(product, classification);

      // Save rule to database
      const ruleData = {
        productName: product.name,
        partNumber: product.partNumber,
        manufacturer: product.manufacturer,
        category: classification.category,
        subCategory: classification.subCategory,
        classification: classification.classification,
        autoApprove: approval.approved,
        minPrice: product.price ? product.price * 0.9 : null,
        maxPrice: product.price ? product.price * 1.1 : null,
        leadTimeDays: classification.leadTimeDays,
        keywords: Array.isArray(classification.keywords) 
          ? classification.keywords.join(',') 
          : null,
        aiGenerated: true,
        confidence: classification.confidence,
        notes: `AI: ${classification.reasoning || 'N/A'} | Approval: ${approval.reason}`
      };

      const ruleId = await dbService.saveProductRule(ruleData);

      // Log to AI_Log table
      const processingTime = Date.now() - startTime;
      await dbService.logAIProcess({
        inputText: JSON.stringify(product),
        outputText: JSON.stringify({ classification, approval }),
        aiProvider: classification.provider,
        model: classification.model,
        tokensUsed: classification.tokensUsed || 0,
        processingTimeMs: processingTime,
        status: 'Success',
        metadata: { ruleId, approved: approval.approved }
      });

      return {
        success: true,
        product,
        classification,
        approval,
        ruleId,
        processingTime
      };
    } catch (error) {
      logger.error(`Failed to process product: ${product.name}`, error);
      
      // Log error to database
      try {
        await dbService.logAIProcess({
          inputText: JSON.stringify(product),
          status: 'Error',
          errorMessage: error.message
        });
      } catch (logError) {
        logger.error('Failed to log error', logError);
      }

      return {
        success: false,
        product,
        error: error.message
      };
    }
  }

  /**
   * Process multiple products with progress tracking
   * @param {Array} products - Array of product objects
   * @returns {Promise<Object>} Processing results
   */
  async processProducts(products) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.banner(`Processing ${products.length} Products`);

      // Create progress bar
      const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% | {value}/{total} Products | {product}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });

      progressBar.start(products.length, 0, { product: 'Starting...' });

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        progressBar.update(i + 1, { product: product.name.substring(0, 40) });

        const result = await this.processProduct(product);
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }

        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      progressBar.stop();

      // Generate summary
      const summary = this.generateSummary(results);
      
      logger.separator('=');
      logger.success(`Processing completed: ${successCount} successful, ${errorCount} failed`);
      this.displaySummary(summary);

      return {
        success: true,
        results,
        summary,
        successCount,
        errorCount,
        total: products.length
      };
    } catch (error) {
      logger.error('Batch processing failed', error);
      throw error;
    }
  }

  /**
   * Generate processing summary
   * @param {Array} results - Array of processing results
   * @returns {Object} Summary object
   */
  generateSummary(results) {
    const summary = {
      total: results.length,
      successful: 0,
      failed: 0,
      autoApproved: 0,
      requiresReview: 0,
      categories: {},
      providers: {},
      avgProcessingTime: 0,
      totalProcessingTime: 0
    };

    let totalTime = 0;

    for (const result of results) {
      if (result.success) {
        summary.successful++;
        
        if (result.approval.approved) {
          summary.autoApproved++;
        } else {
          summary.requiresReview++;
        }

        // Category stats
        const category = result.classification.category || 'Unknown';
        if (!summary.categories[category]) {
          summary.categories[category] = 0;
        }
        summary.categories[category]++;

        // Provider stats
        const provider = result.classification.provider || 'unknown';
        if (!summary.providers[provider]) {
          summary.providers[provider] = 0;
        }
        summary.providers[provider]++;

        totalTime += result.processingTime || 0;
      } else {
        summary.failed++;
      }
    }

    summary.totalProcessingTime = totalTime;
    summary.avgProcessingTime = summary.successful > 0 
      ? Math.round(totalTime / summary.successful) 
      : 0;

    summary.approvalRate = summary.successful > 0
      ? Math.round((summary.autoApproved / summary.successful) * 100)
      : 0;

    return summary;
  }

  /**
   * Display summary in console
   * @param {Object} summary - Summary object
   */
  displaySummary(summary) {
    logger.separator('=');
    console.log(`
📊 Processing Summary
${'─'.repeat(60)}
Total Products:        ${summary.total}
Successful:            ${summary.successful} (${Math.round(summary.successful/summary.total*100)}%)
Failed:                ${summary.failed}

✓ Auto-Approved:       ${summary.autoApproved} (${summary.approvalRate}%)
⚠ Requires Review:     ${summary.requiresReview}

⏱ Processing Time:
  Total:               ${Math.round(summary.totalProcessingTime/1000)}s
  Average per product: ${summary.avgProcessingTime}ms

📦 Categories:
${Object.entries(summary.categories).map(([cat, count]) => `  • ${cat}: ${count}`).join('\n')}

🤖 AI Providers:
${Object.entries(summary.providers).map(([prov, count]) => `  • ${prov}: ${count}`).join('\n')}
    `);
    logger.separator('=');
  }

  /**
   * Shutdown the rules engine
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      logger.info('Shutting down rules engine...');
      await dbService.disconnect();
      this.isInitialized = false;
      logger.success('Rules engine shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown', error);
    }
  }
}

// Export singleton instance
export default new RulesEngine();

// Export function for external use
export async function processInput(input) {
  const engine = new RulesEngine();
  
  try {
    await engine.initialize();
    const result = await engine.processProduct(input);
    await engine.shutdown();
    return result;
  } catch (error) {
    logger.error('processInput failed', error);
    throw error;
  }
}
