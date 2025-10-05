// utils/ai-helper.js
// Helper functions for OpenAI requests, prompt caching, and retry logic

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
try {
  const rootEnvPath = join(__dirname, '..', '..', '.env');
  dotenv.config({ path: rootEnvPath });
} catch (error) {
  console.warn('Could not load .env file:', error.message);
}

class AIHelper {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.cache = new Map();
    this.tokenUsage = { total: 0, prompt: 0, completion: 0 };
  }

  /**
   * Check if OpenAI is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.openaiKey;
  }

  /**
   * Generate enriched content for a product
   * @param {Object} product - Product data
   * @returns {Promise<Object>} Enriched product data
   */
  async enrichProduct(product) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    try {
      // Build comprehensive prompt for all fields
      const prompt = this.buildEnrichmentPrompt(product);

      // Call OpenAI API
      const response = await this.callOpenAI(prompt);

      // Parse response
      const enrichedData = this.parseEnrichmentResponse(response, product);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      return {
        ...enrichedData,
        metadata: {
          processingTime,
          tokensUsed: response.usage,
          model: this.openaiModel,
          confidence: this.calculateConfidence(enrichedData, response)
        }
      };
    } catch (error) {
      console.error('AI enrichment failed:', error.message);
      throw error;
    }
  }

  /**
   * Build enrichment prompt for OpenAI
   * @param {Object} product - Product data
   * @returns {string} Formatted prompt
   */
  buildEnrichmentPrompt(product) {
    const brandColor = '#0055A4'; // QuickITQuote Blue

    return `You are a product data enrichment specialist for QuickITQuote, an IT products distributor.

Product Information:
- Part Number: ${product.PartNumber || 'N/A'}
- Manufacturer: ${product.ManufacturerName || 'N/A'}
- Current Description: ${product.Description || 'N/A'}
- Price: $${product.Price || 'N/A'}

Task: Generate comprehensive product enrichment data in JSON format.

Required Fields:

1. shortDescription (max 500 chars) - Concise product summary with key benefits
2. longDescription - Detailed marketing description with value proposition and use cases
3. features - HTML unordered list with 5-8 key features, styled with color: ${brandColor}
4. specifications - HTML table with technical specs (columns: Specification, Value), styled with color: ${brandColor}
5. faq - HTML formatted 3-5 FAQs with questions and answers
6. prerequisites - System requirements, compatibility, installation prerequisites
7. relatedItems - List of complementary products and accessories
8. professionalServices - Installation, setup, training services scope
9. upsellRecommendations - Higher-tier alternatives and bundle opportunities
10. marketingMessage - "Why buy this" value proposition and competitive advantages
11. category - Main product category (e.g., Networking, Storage, Software)
12. subcategory - Product subcategory (e.g., Switches, NAS, Licenses)
13. productType - Specific type (e.g., Managed Switch, Cloud Storage, Annual Subscription)
14. rulesProduct - JSON object with product-level rules: { "autoApprove": boolean, "priceThreshold": number, "leadTimeDays": number }
15. rulesCategory - JSON object with category-level rules: { "requiresReview": boolean, "defaultLeadTime": number }

Output Format: Valid JSON only, no markdown formatting.

Example Structure:
{
  "shortDescription": "...",
  "longDescription": "...",
  "features": "<ul style='color: ${brandColor};'>...</ul>",
  "specifications": "<table style='color: ${brandColor};'>...</table>",
  "faq": "<div>...</div>",
  "prerequisites": "...",
  "relatedItems": "...",
  "professionalServices": "...",
  "upsellRecommendations": "...",
  "marketingMessage": "...",
  "category": "...",
  "subcategory": "...",
  "productType": "...",
  "rulesProduct": { "autoApprove": false, "priceThreshold": 5000, "leadTimeDays": 7 },
  "rulesCategory": { "requiresReview": false, "defaultLeadTime": 7 }
}`;
  }

  /**
   * Call OpenAI API with retry logic
   * @param {string} prompt - The prompt to send
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Object>} API response
   */
  async callOpenAI(prompt, maxRetries = 3) {
    // Check cache
    const cacheKey = this.getCacheKey(prompt);
    if (this.cache.has(cacheKey)) {
      console.log('↻ Using cached response');
      return this.cache.get(cacheKey);
    }

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiKey}`
          },
          body: JSON.stringify({
            model: this.openaiModel,
            messages: [
              { role: 'system', content: 'You are a product data enrichment specialist. Always respond with valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 3000
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();

        // Update token usage
        if (data.usage) {
          this.tokenUsage.total += data.usage.total_tokens || 0;
          this.tokenUsage.prompt += data.usage.prompt_tokens || 0;
          this.tokenUsage.completion += data.usage.completion_tokens || 0;
        }

        // Cache the response
        this.cache.set(cacheKey, data);

        return data;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Parse OpenAI response and extract enriched data
   * @param {Object} response - OpenAI API response
   * @param {Object} product - Original product data
   * @returns {Object} Parsed enriched data
   */
  parseEnrichmentResponse(response, product) {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
      }

      const enrichedData = JSON.parse(jsonStr);

      // Ensure manufacturer is preserved
      enrichedData.manufacturer = product.ManufacturerName;

      return enrichedData;
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error.message);
      console.error('Response content:', response.choices[0]?.message?.content);

      // Return minimal enriched data on parse failure
      return {
        shortDescription: product.Description || 'Product information being updated',
        longDescription: product.Description || 'Product information being updated',
        features: '<ul><li>Features being updated</li></ul>',
        specifications: '<table><tr><td>Specifications being updated</td></tr></table>',
        faq: '<div>FAQ being updated</div>',
        prerequisites: 'Prerequisites being updated',
        relatedItems: 'Related items being updated',
        professionalServices: 'Professional services available',
        upsellRecommendations: 'Upgrade options available',
        marketingMessage: 'High-quality IT product',
        category: 'IT Products',
        subcategory: 'General',
        productType: 'Standard',
        manufacturer: product.ManufacturerName,
        rulesProduct: { autoApprove: false, priceThreshold: 0, leadTimeDays: 7 },
        rulesCategory: { requiresReview: true, defaultLeadTime: 7 }
      };
    }
  }

  /**
   * Calculate confidence score
   * @param {Object} enrichedData - Enriched data
   * @param {Object} response - OpenAI response
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(enrichedData, response) {
    let confidence = 70; // Base confidence

    // Check field completeness
    const requiredFields = [
      'shortDescription', 'longDescription', 'features', 'specifications',
      'category', 'subcategory'
    ];

    const completedFields = requiredFields.filter(field => {
      const value = enrichedData[field];
      return value && value.length > 20;
    }).length;

    confidence += (completedFields / requiredFields.length) * 25;

    // Check for rich content
    if (enrichedData.features?.includes('<li>')) confidence += 2;
    if (enrichedData.specifications?.includes('<table>')) confidence += 2;
    if (enrichedData.faq?.length > 50) confidence += 1;

    return Math.min(Math.round(confidence), 100);
  }

  /**
   * Generate cache key for prompt
   * @param {string} prompt - The prompt
   * @returns {string} Cache key
   */
  getCacheKey(prompt) {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Get total token usage
   * @returns {Object} Token usage statistics
   */
  getTokenUsage() {
    return { ...this.tokenUsage };
  }

  /**
   * Reset token usage counters
   */
  resetTokenUsage() {
    this.tokenUsage = { total: 0, prompt: 0, completion: 0 };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export default new AIHelper();
