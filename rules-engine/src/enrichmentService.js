// enrichmentService.js - Product enrichment orchestrator
import dotenv from 'dotenv';
import logger from './logger.js';
import aiService from './aiService.js';
import arabicNLP from './arabicNLP.js';

// Load environment variables
dotenv.config({ path: '../.env' });

class EnrichmentService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_API_KEY || process.env.Gemini_API;
    this.googleCxId = process.env.GOOGLE_CX_ID;
    this.hasImageSearch = !!(this.googleApiKey && this.googleCxId);
    
    if (!this.hasImageSearch) {
      logger.warn('Google Custom Search not configured. Image enrichment will be skipped.');
    }
  }

  /**
   * Check if product needs enrichment
   * @param {Object} product - Product object from database
   * @returns {boolean} True if product needs enrichment
   */
  needsEnrichment(product) {
    // Check if already processed
    if (product.AIProcessed === true || product.AIProcessed === 1) {
      return false;
    }

    // Check for missing essential fields
    const missingFields = [];
    if (!product.ShortDescription) missingFields.push('ShortDescription');
    if (!product.LongDescription) missingFields.push('LongDescription');
    if (!product.TechnicalSpecs) missingFields.push('TechnicalSpecs');
    if (!product.KeyFeatures) missingFields.push('KeyFeatures');

    return missingFields.length > 0;
  }

  /**
   * Enrich a single product with AI-generated content
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Enrichment result
   */
  async enrichProduct(product) {
    const startTime = Date.now();
    
    try {
      logger.info(`Enriching product: ${product.ProductName || product.name}`);

      // Build enrichment prompt
      const prompt = this.buildEnrichmentPrompt(product);
      
      // Get AI enrichment data
      const enrichmentData = await aiService.generateEnrichment(prompt, product);
      
      // Fetch product image if Google Search is configured
      let productImage = null;
      if (this.hasImageSearch) {
        try {
          productImage = await this.fetchProductImage(product);
        } catch (error) {
          logger.warn(`Failed to fetch product image: ${error.message}`);
        }
      }

      // Generate Arabic synonyms for product
      const synonymsResult = await this.generateArabicSynonyms(product, enrichmentData);

      // Calculate enrichment confidence
      const confidence = this.calculateEnrichmentConfidence(enrichmentData, productImage);

      // Build enriched product data
      const enrichedData = {
        ShortDescription: enrichmentData.shortDescription || null,
        LongDescription: enrichmentData.longDescription || null,
        TechnicalSpecs: enrichmentData.technicalSpecs ? JSON.stringify(enrichmentData.technicalSpecs) : null,
        KeyFeatures: enrichmentData.keyFeatures ? JSON.stringify(enrichmentData.keyFeatures) : null,
        FAQ: enrichmentData.faq ? JSON.stringify(enrichmentData.faq) : null,
        Prerequisites: enrichmentData.prerequisites ? JSON.stringify(enrichmentData.prerequisites) : null,
        ProfessionalServices: enrichmentData.professionalServices ? JSON.stringify(enrichmentData.professionalServices) : null,
        ProductImage: productImage,
        UpsellSuggestions: enrichmentData.upsellSuggestions ? JSON.stringify(enrichmentData.upsellSuggestions) : null,
        BundleSuggestions: enrichmentData.bundleSuggestions ? JSON.stringify(enrichmentData.bundleSuggestions) : null,
        CustomerValue: enrichmentData.customerValue || null,
        EnrichmentConfidence: confidence,
        AIProcessed: confidence >= 90, // Auto-approve if confidence >= 90%
        AIProcessedDate: new Date().toISOString(),
        // Arabic synonyms (CustomMemo07 = English, CustomMemo08 = Arabic)
        CustomMemo07: synonymsResult.english.length > 0 ? JSON.stringify(synonymsResult.english) : null,
        CustomMemo08: synonymsResult.arabic.length > 0 ? JSON.stringify(synonymsResult.arabic) : null
      };

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        enrichedData,
        confidence,
        requiresReview: confidence < 90,
        processingTimeMs: processingTime,
        fieldsEnriched: Object.keys(enrichedData).filter(k => enrichedData[k] !== null)
      };

    } catch (error) {
      logger.error('Product enrichment failed', error);
      return {
        success: false,
        error: error.message,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Build enrichment prompt for AI
   * @param {Object} product - Product object
   * @returns {string} Enrichment prompt
   */
  buildEnrichmentPrompt(product) {
    const productName = product.ProductName || product.name || 'Unknown Product';
    const partNumber = product.PartNumber || product.partNumber || 'N/A';
    const manufacturer = product.Manufacturer || product.manufacturer || 'N/A';
    const category = product.Category || product.category || 'N/A';
    const existingDesc = product.description || '';

    return `You are a professional IT product copywriter and technical writer. Generate comprehensive marketing and technical content for this product.

Product Information:
- Name: ${productName}
- Part Number: ${partNumber}
- Manufacturer: ${manufacturer}
- Category: ${category}
- Existing Description: ${existingDesc}

Generate the following content in JSON format:

1. **shortDescription** (string, 100-500 characters): 
   Marketing-ready description highlighting key benefits. Professional, compelling, action-oriented.

2. **longDescription** (string, 500-4000 characters):
   Detailed product description including:
   - Product overview and purpose
   - Key capabilities and benefits
   - Ideal use cases and applications
   - What makes this product stand out
   Use HTML formatting with <span style="color:#0055A4"> for QuickITQuote brand highlights.

3. **technicalSpecs** (object):
   Key technical specifications as key-value pairs. 5-10 most important specs.
   Example: {"Processor": "Intel Xeon", "RAM": "64GB DDR4"}

4. **keyFeatures** (array of strings):
   5-10 bullet points of key product features and benefits.

5. **faq** (array of objects):
   3-5 frequently asked questions with answers.
   Format: [{"question": "...", "answer": "..."}]

6. **prerequisites** (array of strings):
   3-5 prerequisites or requirements (hardware, software, licenses, etc.)

7. **professionalServices** (object):
   Recommended professional services for this product.
   Format: {"scope": "brief scope", "description": "detailed description", "estimatedHours": number, "recommendedTier": "Basic|Standard|Advanced"}

8. **upsellSuggestions** (array of strings):
   3-5 related upsell products or services (warranties, support, training)

9. **bundleSuggestions** (array of strings):
   3-5 complementary products that work well with this (cables, accessories, compatible hardware)

10. **customerValue** (string):
    2-3 sentence value proposition explaining why customers should choose this product.

Return ONLY valid JSON with all fields. Be specific to the product category and manufacturer.`;
  }

  /**
   * Fetch product image using Google Custom Search
   * @param {Object} product - Product object
   * @returns {Promise<string|null>} Image URL or null
   */
  async fetchProductImage(product) {
    if (!this.hasImageSearch) {
      return null;
    }

    try {
      const productName = product.ProductName || product.name || '';
      const partNumber = product.PartNumber || product.partNumber || '';
      const manufacturer = product.Manufacturer || product.manufacturer || '';
      
      // Build search query
      const searchQuery = `${manufacturer} ${productName} ${partNumber}`.trim();
      
      if (!searchQuery) {
        return null;
      }

      // Call Google Custom Search API
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleCxId}&q=${encodeURIComponent(searchQuery)}&searchType=image&imgType=photo&imgColorType=color&num=5`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        logger.debug(`No images found for: ${searchQuery}`);
        return null;
      }

      // Find image with white/light background (heuristic: check URL and metadata)
      for (const item of data.items) {
        const imageUrl = item.link;
        
        // Simple filter: prefer images from official sites, product databases
        const preferredDomains = ['cdn', 'product', 'image', 'media', 'static'];
        const isPreferred = preferredDomains.some(domain => imageUrl.toLowerCase().includes(domain));
        
        if (isPreferred && await this.verifyImageUrl(imageUrl)) {
          logger.debug(`Found product image: ${imageUrl}`);
          return imageUrl;
        }
      }

      // Fallback: return first valid image
      const firstImage = data.items[0].link;
      if (await this.verifyImageUrl(firstImage)) {
        return firstImage;
      }

      return null;

    } catch (error) {
      logger.error('Failed to fetch product image', error);
      return null;
    }
  }

  /**
   * Verify image URL is accessible
   * @param {string} url - Image URL
   * @returns {Promise<boolean>} True if accessible
   */
  async verifyImageUrl(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate enrichment confidence score
   * @param {Object} enrichmentData - Enrichment data
   * @param {string|null} productImage - Product image URL
   * @returns {number} Confidence score 0-100
   */
  calculateEnrichmentConfidence(enrichmentData, productImage) {
    let score = 0;
    let totalChecks = 0;

    // Check required fields
    const requiredFields = [
      'shortDescription',
      'longDescription',
      'technicalSpecs',
      'keyFeatures',
      'faq',
      'prerequisites',
      'professionalServices',
      'upsellSuggestions',
      'bundleSuggestions',
      'customerValue'
    ];

    for (const field of requiredFields) {
      totalChecks++;
      if (enrichmentData[field]) {
        score++;
        
        // Bonus for quality content
        if (typeof enrichmentData[field] === 'string' && enrichmentData[field].length > 100) {
          score += 0.5;
          totalChecks += 0.5;
        }
        if (Array.isArray(enrichmentData[field]) && enrichmentData[field].length >= 3) {
          score += 0.5;
          totalChecks += 0.5;
        }
      }
    }

    // Bonus for product image
    if (productImage) {
      score += 1;
      totalChecks += 1;
    }

    // Calculate percentage
    const confidence = Math.round((score / totalChecks) * 100);
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Generate Arabic synonyms for product name and key terms
   * @param {Object} product - Product object
   * @param {Object} enrichmentData - Enrichment data from AI
   * @returns {Promise<Object>} Synonyms object
   */
  async generateArabicSynonyms(product, enrichmentData) {
    try {
      const productName = product.ProductName || product.name || '';
      const manufacturer = product.Manufacturer || product.manufacturer || '';
      const category = product.Category || product.category || '';
      
      // Combine key terms
      const keyTerms = [
        productName,
        manufacturer,
        category
      ].filter(Boolean).join(' ');
      
      // Generate synonyms
      const synonyms = await arabicNLP.generateSynonyms(keyTerms, 'product');
      
      logger.debug(`Generated synonyms for ${productName}: ${synonyms.merged.length} terms`);
      
      return synonyms;
    } catch (error) {
      logger.warn('Failed to generate Arabic synonyms', error);
      return { arabic: [], english: [], merged: [] };
    }
  }

  /**
   * Batch enrich multiple products
   * @param {Array} products - Array of product objects
   * @returns {Promise<Object>} Batch enrichment results
   */
  async enrichProducts(products) {
    const results = {
      total: products.length,
      enriched: 0,
      failed: 0,
      skipped: 0,
      requiresReview: 0,
      details: []
    };

    for (const product of products) {
      // Check if needs enrichment
      if (!this.needsEnrichment(product)) {
        results.skipped++;
        logger.debug(`Skipping already processed product: ${product.ProductName || product.name}`);
        continue;
      }

      // Enrich product
      const result = await this.enrichProduct(product);
      
      if (result.success) {
        results.enriched++;
        if (result.requiresReview) {
          results.requiresReview++;
        }
      } else {
        results.failed++;
      }

      results.details.push({
        product: product.ProductName || product.name,
        partNumber: product.PartNumber || product.partNumber,
        ...result
      });
    }

    return results;
  }
}

// Export singleton instance
export default new EnrichmentService();
