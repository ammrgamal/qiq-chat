// autoApproval.js - Auto-approval logic for product quotes
import logger from './logger.js';
import dbService from './dbService.js';

class AutoApprovalService {
  constructor() {
    this.rules = {
      // Default price limits by category
      networking: 5000,
      software: 3000,
      accessories: 1000,
      storage: 10000,
      servers: 0 // Servers never auto-approve
    };
  }

  /**
   * Check if a product should be auto-approved
   * @param {Object} product - Product object
   * @param {Object} classification - Classification result from AI
   * @returns {Object} Approval decision with reasoning
   */
  async checkAutoApproval(product, classification) {
    try {
      const decision = {
        approved: false,
        reason: '',
        requiresReview: false,
        category: classification.category,
        confidence: classification.confidence || 0
      };

      // Rule 1: Low confidence classifications require review
      if (classification.confidence < 70) {
        decision.requiresReview = true;
        decision.reason = `Low confidence (${classification.confidence}%) - requires manual review`;
        logger.debug(`Auto-approval denied: ${decision.reason}`, { product: product.name });
        return decision;
      }

      // Rule 2: Custom or special order items never auto-approve
      if (classification.classification !== 'Standard') {
        decision.requiresReview = true;
        decision.reason = `Non-standard item (${classification.classification}) - requires manual review`;
        logger.debug(`Auto-approval denied: ${decision.reason}`, { product: product.name });
        return decision;
      }

      // Rule 3: Check category-specific rules
      const category = (classification.category || '').toLowerCase();
      
      if (category === 'servers') {
        decision.requiresReview = true;
        decision.reason = 'Server products always require review';
        logger.debug(`Auto-approval denied: ${decision.reason}`, { product: product.name });
        return decision;
      }

      // Rule 4: Check price limits
      const price = parseFloat(product.price) || 0;
      const priceLimit = this.rules[category] || 1000;

      if (price > priceLimit) {
        decision.requiresReview = true;
        decision.reason = `Price $${price} exceeds category limit $${priceLimit}`;
        logger.debug(`Auto-approval denied: ${decision.reason}`, { product: product.name });
        return decision;
      }

      // Rule 5: Check database for existing rules that override
      const existingRule = await dbService.getProductRule(product.partNumber);
      if (existingRule) {
        if (!existingRule.AutoApprove) {
          decision.requiresReview = true;
          decision.reason = 'Database rule overrides - requires review';
          logger.debug(`Auto-approval denied: ${decision.reason}`, { product: product.name });
          return decision;
        }
      }

      // All checks passed - approve
      decision.approved = true;
      decision.reason = `Auto-approved: Standard ${category} item under $${priceLimit} with ${classification.confidence}% confidence`;
      logger.success(`Auto-approved: ${product.name}`, { price, category });
      return decision;

    } catch (error) {
      logger.error('Auto-approval check failed', error);
      return {
        approved: false,
        requiresReview: true,
        reason: 'Error during approval check - requires manual review',
        error: error.message
      };
    }
  }

  /**
   * Batch check auto-approval for multiple products
   * @param {Array} products - Array of products with classifications
   * @returns {Promise<Array>} Array of approval decisions
   */
  async batchCheckApproval(products) {
    const decisions = [];

    for (const item of products) {
      const decision = await this.checkAutoApproval(item.product, item.classification);
      decisions.push({
        product: item.product,
        classification: item.classification,
        approval: decision
      });

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return decisions;
  }

  /**
   * Get approval statistics
   * @param {Array} decisions - Array of approval decisions
   * @returns {Object} Statistics summary
   */
  getStatistics(decisions) {
    const stats = {
      total: decisions.length,
      approved: 0,
      requiresReview: 0,
      categories: {},
      totalValue: 0,
      approvedValue: 0
    };

    for (const decision of decisions) {
      const price = parseFloat(decision.product.price) || 0;
      stats.totalValue += price;

      if (decision.approval.approved) {
        stats.approved++;
        stats.approvedValue += price;
      } else {
        stats.requiresReview++;
      }

      // Category statistics
      const category = decision.classification.category || 'Unknown';
      if (!stats.categories[category]) {
        stats.categories[category] = {
          total: 0,
          approved: 0,
          requiresReview: 0
        };
      }
      stats.categories[category].total++;
      if (decision.approval.approved) {
        stats.categories[category].approved++;
      } else {
        stats.categories[category].requiresReview++;
      }
    }

    stats.approvalRate = stats.total > 0 
      ? Math.round((stats.approved / stats.total) * 100) 
      : 0;

    return stats;
  }

  /**
   * Update approval rules
   * @param {Object} newRules - New rules object
   */
  updateRules(newRules) {
    this.rules = { ...this.rules, ...newRules };
    logger.info('Auto-approval rules updated', this.rules);
  }

  /**
   * Get current rules
   * @returns {Object} Current rules
   */
  getRules() {
    return { ...this.rules };
  }
}

// Export singleton instance
export default new AutoApprovalService();
