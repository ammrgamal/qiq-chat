// rulesEngine.js - Main rules engine orchestrator
import logger from './logger.js';
import dbService from './dbService.js';
import aiService from './aiService.js';
import autoApproval from './autoApproval.js';
import arabicNLP from './arabicNLP.js';
import cliProgress from 'cli-progress';

class RulesEngine {
  constructor() {
    this.isInitialized = false;
    this.aiVersion = process.env.AI_VERSION || 'v1.0.0';
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
      const skipDb = process.env.SKIP_DB === '1';
      if (skipDb){
        this.isInitialized = true;
        logger.warn('SKIP_DB=1 -> initialization without any DB load/connect');
        logger.success('Rules engine initialized (offline)');
        return; // hard short-circuit before any dbService usage
      }
      {
        // Connect to database (optional fallback)
        try {
          await dbService.connect();
          if (!process.env.ALLOW_NO_DB){
            const categories = await dbService.getCategories();
            logger.success(`Loaded ${categories.length} product categories`);
          }
        } catch (e) {
          if (process.env.ALLOW_NO_DB === '1') {
            logger.warn('DB connection failed but ALLOW_NO_DB=1 set -> continuing in memory-only mode');
          } else {
            throw e;
          }
        }
      }
      
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
      // Attempt skip: fetch existing rule by part number
      let existingRule = null;
      const partNumber = product.partNumber || product.PartNumber;
  const dbEnabled = !(process.env.SKIP_DB==='1' || process.env.ALLOW_NO_DB==='1');
      if (dbEnabled && partNumber){
        try { existingRule = await dbService.getProductRule(partNumber); } catch {}
      }
      const stableSig = JSON.stringify({
        n: product.name || product.ProductName || '',
        m: product.manufacturer || product.Manufacturer || '',
        p: product.price || 0
      });
      const now = Date.now();
      const sevenDaysMs = 1000*60*60*24*7;
      if (existingRule && existingRule.AIGenerated && existingRule.Confidence && existingRule.ModifiedDate){
        const modTime = new Date(existingRule.ModifiedDate).getTime();
        const sameName = (existingRule.ProductName||'') === (product.name||product.ProductName||'');
        // If we have AIVersion column and matches, stronger skip
        const sameVersion = existingRule.AIVersion ? existingRule.AIVersion === this.aiVersion : false;
        if (sameName && (now - modTime) < sevenDaysMs && (existingRule.Confidence >= 50)){
          if (sameVersion){
            logger.debug(`Skip processing (unchanged + same aiVersion) for ${partNumber}`);
            return { success:true, skipped:true, ruleId: existingRule.RuleID, product, classification: { category: existingRule.Category, subCategory: existingRule.SubCategory, classification: existingRule.Classification }, approval: { approved: !!existingRule.AutoApprove, reason: 'Cached aiVersion' }, processingTime: 0 };
          } else {
            logger.info(`Reprocess due to aiVersion change (${existingRule.AIVersion||'none'} -> ${this.aiVersion}) for ${partNumber}`);
          }
        }
      }

      // Arabic NLP preprocessing: normalize and translate if needed
      const productName = product.name || product.ProductName || '';
      if (arabicNLP.containsArabic(productName)) {
        logger.debug(`Detected Arabic in product name: ${productName}`);
        const preprocessed = await arabicNLP.preprocessQuery(productName);
        product.preprocessedName = preprocessed.processed;
        product.originalArabicName = preprocessed.original;
      }

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
  notes: `AI(${this.aiVersion}): ${classification.reasoning || 'N/A'} | Approval: ${approval.reason}${existingRule && existingRule.AIVersion && existingRule.AIVersion !== this.aiVersion ? ' | Reprocessed(aiVersion bump)' : ''}`,
        aiVersion: this.aiVersion
      };

      let ruleId = null;
      if (dbEnabled){
        try {
          ruleId = await dbService.saveProductRule(ruleData);
        } catch(e){ logger.warn('saveProductRule failed (continuing in memory mode)', e.message); }
      }

      // Log to AI_Log table
      const processingTime = Date.now() - startTime;
      if (dbEnabled){
        try {
          await dbService.logAIProcess({
            inputText: JSON.stringify(product),
              outputText: JSON.stringify({ classification, approval }),
              aiProvider: classification.provider,
              model: classification.model,
              tokensUsed: classification.tokensUsed || 0,
              processingTimeMs: processingTime,
              status: 'Success',
              metadata: { ruleId, approved: approval.approved, aiVersion: this.aiVersion }
          });
        } catch(e){ logger.warn('logAIProcess failed (continuing)', e.message); }
      }

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
      const dbEnabled = !(process.env.SKIP_DB==='1' || process.env.ALLOW_NO_DB==='1');
      if (dbEnabled){
        try {
          await dbService.logAIProcess({
            inputText: JSON.stringify(product),
            status: 'Error',
            errorMessage: error.message
          });
        } catch (logError) {
          logger.error('Failed to log error', logError);
        }
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
