// ai-helper.js - AI enrichment helper using OpenAI API
import dotenv from 'dotenv';

// Load environment variables from root .env
dotenv.config({ path: '../../.env' });

/**
 * AI Helper class for product enrichment using OpenAI
 */
class AIHelper {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.cache = new Map(); // Simple cache for prompts and responses
    this.retryLimit = 2;
    
    if (!this.openaiKey) {
      console.warn('⚠ Warning: OPENAI_API_KEY not configured. AI enrichment will fail.');
    }
  }

  /**
   * Generate cache key for a product
   * @param {Object} product - Product object
   * @returns {string} Cache key
   */
  getCacheKey(product) {
    return `${product.Manufacturer}-${product.MPN}-${product.ProductName}`.toLowerCase();
  }

  /**
   * Check cache for existing enrichment
   * @param {Object} product - Product object
   * @returns {Object|null} Cached enrichment or null
   */
  getFromCache(product) {
    const key = this.getCacheKey(product);
    return this.cache.get(key) || null;
  }

  /**
   * Save enrichment to cache
   * @param {Object} product - Product object
   * @param {Object} enrichment - Enrichment data
   */
  saveToCache(product, enrichment) {
    const key = this.getCacheKey(product);
    this.cache.set(key, enrichment);
  }

  /**
   * Build enrichment prompt for OpenAI
   * @param {Object} product - Product object
   * @returns {string} Prompt string
   */
  buildEnrichmentPrompt(product) {
    return `You are an expert IT product content writer. Analyze this product and generate comprehensive, professional content.

Product Information:
- Name: ${product.ProductName || 'Unknown'}
- Part Number: ${product.MPN || 'N/A'}
- Manufacturer: ${product.Manufacturer || 'Unknown'}
- Current Description: ${product.ShortDescription || product.ExtendedDescription || 'N/A'}
- Category: ${product.Category || 'Unknown'}
- Price: ${product.Price ? `$${product.Price}` : 'N/A'}
- Cost: ${product.Cost ? `$${product.Cost}` : 'N/A'}

Generate the following content as a JSON object:
{
  "shortDescription": "2-3 sentence concise description highlighting key features (max 200 chars)",
  "extendedDescription": "Comprehensive 3-4 paragraph description covering features, benefits, use cases, and technical details (max 4000 chars)",
  "features": "Bullet-point list of key features (one per line, start with •)",
  "specifications": "Technical specifications in key:value format (one per line)",
  "faq": "3-5 common questions and answers about the product (Q: ... A: ... format)",
  "marketingMessage": "Compelling 2-3 sentence marketing pitch emphasizing value proposition",
  "rules": "Business rules, compatibility notes, or important considerations for quotes",
  "bundleSuggestions": "Comma-separated list of 3-5 complementary products that could be bundled",
  "keywords": "Comma-separated list of 10-15 relevant search keywords",
  "confidence": 0-100 (your confidence in this enrichment quality, consider completeness and accuracy)
}

Guidelines:
- Be factual and professional
- Focus on IT business buyers
- Include technical specifications where available
- Highlight business value and ROI
- Use industry-standard terminology
- Ensure all content is accurate and relevant
- Return ONLY valid JSON, no markdown or extra text`;
  }

  /**
   * Call OpenAI API with retry logic
   * @param {string} prompt - Prompt text
   * @param {number} attempt - Current attempt number
   * @returns {Promise<Object>} AI response
   */
  async callOpenAI(prompt, attempt = 0) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.openaiModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert IT product content writer. Generate comprehensive, accurate product content in valid JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const enrichment = JSON.parse(content);

      return {
        enrichment,
        model: data.model,
        tokensUsed: data.usage?.total_tokens || 0,
        provider: 'OpenAI',
        status: 'Success'
      };
    } catch (error) {
      // Retry logic
      if (attempt < this.retryLimit) {
        console.log(`⟳ Retrying OpenAI call (attempt ${attempt + 1}/${this.retryLimit})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        return this.callOpenAI(prompt, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Enrich a product with AI-generated content
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Enrichment result
   */
  async enrichProduct(product) {
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = this.getFromCache(product);
      if (cached) {
        console.log(`📦 Using cached enrichment for ${product.ProductName}`);
        return {
          ...cached,
          fromCache: true,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Build prompt and call OpenAI
      const prompt = this.buildEnrichmentPrompt(product);
      const result = await this.callOpenAI(prompt);

      const enrichmentData = {
        shortDescription: result.enrichment.shortDescription,
        extendedDescription: result.enrichment.extendedDescription,
        features: result.enrichment.features,
        specifications: result.enrichment.specifications,
        faq: result.enrichment.faq,
        marketingMessage: result.enrichment.marketingMessage,
        rules: result.enrichment.rules,
        bundleSuggestions: result.enrichment.bundleSuggestions,
        keywords: result.enrichment.keywords,
        confidence: result.enrichment.confidence || 85,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        processingTimeMs: Date.now() - startTime,
        status: 'Success'
      };

      // Save to cache
      this.saveToCache(product, enrichmentData);

      return enrichmentData;
    } catch (error) {
      console.error(`✗ Failed to enrich product ${product.ProductName}:`, error.message);
      return {
        shortDescription: null,
        extendedDescription: null,
        features: null,
        specifications: null,
        faq: null,
        marketingMessage: null,
        rules: null,
        bundleSuggestions: null,
        keywords: null,
        confidence: 0,
        provider: 'OpenAI',
        model: this.openaiModel,
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        status: 'Error',
        error: error.message
      };
    }
  }

  /**
   * Enrich multiple products with concurrency limit
   * @param {Array} products - Array of product objects
   * @param {Function} progressCallback - Progress callback function
   * @param {number} concurrencyLimit - Max concurrent requests (default: 3)
   * @returns {Promise<Array>} Array of enrichment results
   */
  async enrichProducts(products, progressCallback = null, concurrencyLimit = 3) {
    const results = [];
    const total = products.length;
    let completed = 0;

    // Process products in batches with concurrency limit
    for (let i = 0; i < total; i += concurrencyLimit) {
      const batch = products.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (product) => {
        try {
          const enrichment = await this.enrichProduct(product);
          completed++;
          
          if (progressCallback) {
            progressCallback(completed, total, product.ProductName);
          }

          return {
            product,
            enrichment,
            success: true
          };
        } catch (error) {
          completed++;
          
          if (progressCallback) {
            progressCallback(completed, total, product.ProductName);
          }

          return {
            product,
            enrichment: null,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + concurrencyLimit < total) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
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
