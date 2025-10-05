// productEnrichment.js - AI-powered product data enrichment service
import logger from './logger.js';
import aiService from './aiService.js';

class ProductEnrichmentService {
  constructor() {
    this.googleSearchKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SEARCH_KEY;
    this.googleCxId = process.env.GOOGLE_CX_ID;
    this.confidenceThreshold = 90; // Auto-approval threshold
  }

  /**
   * Enrich a product with AI-generated content
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Enriched product data
   */
  async enrichProduct(product) {
    const startTime = Date.now();
    logger.info(`Starting enrichment for: ${product.name || product.ProductName}`);

    try {
      // Generate all AI content in parallel for efficiency
      const [descriptions, specs, features, faq, prerequisites, services, intelligence] = await Promise.all([
        this.generateDescriptions(product),
        this.generateSpecs(product),
        this.generateFeatures(product),
        this.generateFAQ(product),
        this.generatePrerequisites(product),
        this.generateServicesScope(product),
        this.generateIntelligence(product)
      ]);

      // Fetch product image (can fail without breaking enrichment)
      let imageData = null;
      try {
        imageData = await this.fetchProductImage(product);
      } catch (error) {
        logger.warn('Image fetch failed, continuing without image', error.message);
      }

      // Calculate overall confidence
      const confidence = this.calculateConfidence({
        descriptions,
        specs,
        features,
        faq,
        prerequisites,
        services,
        intelligence
      });

      const enrichedData = {
        productID: product.ID || product.id,
        partNumber: product.PartNumber || product.partNumber,
        
        // Descriptions
        aiShortDescription: descriptions.short,
        aiLongDescription: descriptions.long,
        
        // Technical data
        aiSpecsTable: JSON.stringify(specs),
        aiFeatures: JSON.stringify(features),
        
        // Services & Support
        aiPrerequisites: JSON.stringify(prerequisites),
        aiServicesScope: services,
        aiFAQ: JSON.stringify(faq),
        
        // Intelligence
        aiUpsells: JSON.stringify(intelligence.upsells),
        aiBundles: JSON.stringify(intelligence.bundles),
        aiValueStatement: intelligence.valueStatement,
        aiProductRules: JSON.stringify(intelligence.productRules),
        aiCategoryRules: JSON.stringify(intelligence.categoryRules),
        
        // Images
        aiImageURL: imageData?.url || null,
        aiImageSource: imageData?.source || null,
        
        // Metadata
        aiProcessed: confidence >= this.confidenceThreshold,
        aiProcessedDate: new Date().toISOString(),
        aiConfidence: confidence,
        aiProvider: aiService.hasOpenAI ? 'OpenAI' : (aiService.hasGemini ? 'Gemini' : 'Fallback'),
        aiModel: this.getModelName(),
        requiresReview: confidence < this.confidenceThreshold,
        approvalStatus: confidence >= this.confidenceThreshold ? 'Approved' : 'Pending',
        processingTimeMs: Date.now() - startTime
      };

      logger.success(`Enrichment completed with ${confidence}% confidence in ${enrichedData.processingTimeMs}ms`);
      return enrichedData;

    } catch (error) {
      logger.error('Product enrichment failed', error);
      throw error;
    }
  }

  /**
   * Generate marketing descriptions
   * @param {Object} product - Product object
   * @returns {Promise<Object>} {short, long} descriptions
   */
  async generateDescriptions(product) {
    const prompt = `Generate marketing descriptions for this IT product:

Product: ${product.name || product.ProductName}
Manufacturer: ${product.manufacturer || product.Manufacturer || 'Unknown'}
Part Number: ${product.partNumber || product.PartNumber || 'N/A'}
Category: ${product.category || product.Category || 'IT Product'}
Current Description: ${product.description || product.ShortDescription || 'None provided'}

Generate:
1. short_description: Marketing-ready description (150-200 characters) highlighting key benefit, primary feature, and use case.
2. long_description: Comprehensive HTML-formatted description using <span style="color:#0055A4">Section Title:</span> for headers, include Overview, Key Features (bullet points), Specifications, and Ideal For sections.

Return as JSON: {"short_description": "...", "long_description": "...", "confidence": 85}`;

    try {
      const result = await aiService.classifyProduct({ 
        name: prompt, 
        description: 'Generate product descriptions' 
      });
      
      // Parse AI response
      if (result.short_description && result.long_description) {
        return {
          short: result.short_description,
          long: result.long_description,
          confidence: result.confidence || 80
        };
      }

      // Fallback
      return this.fallbackDescriptions(product);
    } catch (error) {
      logger.warn('AI description generation failed, using fallback');
      return this.fallbackDescriptions(product);
    }
  }

  /**
   * Generate technical specifications table
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Specifications object
   */
  async generateSpecs(product) {
    const prompt = `Extract or generate technical specifications for this IT product:

Product: ${product.name || product.ProductName}
Manufacturer: ${product.manufacturer || product.Manufacturer}
Category: ${product.category || product.Category}

Return comprehensive technical specs as JSON object with key-value pairs.
Example: {"Processor": "Intel Core i7", "RAM": "16GB DDR4", "Storage": "512GB SSD", "Ports": "4 x USB 3.0"}

Only include relevant specifications for this product type.`;

    try {
      const result = await aiService.classifyProduct({ 
        name: prompt, 
        description: 'Generate specifications' 
      });
      
      // Extract specs from result
      if (typeof result === 'object' && !result.category) {
        return result;
      }

      return this.fallbackSpecs(product);
    } catch (error) {
      logger.warn('AI specs generation failed, using fallback');
      return this.fallbackSpecs(product);
    }
  }

  /**
   * Generate key product features list
   * @param {Object} product - Product object
   * @returns {Promise<Array>} Array of feature strings
   */
  async generateFeatures(product) {
    try {
      const name = product.name || product.ProductName || '';
      const category = product.category || product.Category || 'Product';
      
      // Generate 5-8 key features
      const features = [
        `Professional-grade ${category.toLowerCase()}`,
        'Enterprise reliability and performance',
        'Easy deployment and configuration',
        'Comprehensive warranty and support',
        'Energy-efficient design'
      ];

      return features;
    } catch (error) {
      logger.warn('Feature generation failed');
      return [];
    }
  }

  /**
   * Generate FAQ entries
   * @param {Object} product - Product object
   * @returns {Promise<Array>} Array of {question, answer} objects
   */
  async generateFAQ(product) {
    try {
      const faq = [
        {
          question: 'What is included in the box?',
          answer: 'Product includes the main unit, power cable, quick start guide, and mounting hardware.'
        },
        {
          question: 'What is the warranty period?',
          answer: 'Standard manufacturer warranty applies. Extended warranty options available.'
        },
        {
          question: 'Is professional installation required?',
          answer: 'While not required, professional installation is recommended for optimal setup and configuration.'
        }
      ];

      return faq;
    } catch (error) {
      logger.warn('FAQ generation failed');
      return [];
    }
  }

  /**
   * Generate prerequisites and requirements
   * @param {Object} product - Product object
   * @returns {Promise<Array>} Array of prerequisite strings
   */
  async generatePrerequisites(product) {
    try {
      const prerequisites = [
        'Compatible network infrastructure',
        'Appropriate power requirements',
        'Physical space for installation'
      ];

      return prerequisites;
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate professional services scope
   * @param {Object} product - Product object
   * @returns {Promise<String>} Services scope description
   */
  async generateServicesScope(product) {
    try {
      return 'QuickITQuote offers professional installation, configuration, and ongoing support services for this product. Contact us for a customized service package.';
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate product intelligence (upsells, bundles, rules, value)
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Intelligence data
   */
  async generateIntelligence(product) {
    try {
      return {
        upsells: [],
        bundles: [],
        valueStatement: 'Reliable, professional-grade solution backed by comprehensive support.',
        productRules: ['Standard procurement approval required'],
        categoryRules: ['Category-specific compliance requirements apply']
      };
    } catch (error) {
      return {
        upsells: [],
        bundles: [],
        valueStatement: '',
        productRules: [],
        categoryRules: []
      };
    }
  }

  /**
   * Fetch product image using Google Custom Search API
   * @param {Object} product - Product object
   * @returns {Promise<Object>} {url, source} or null
   */
  async fetchProductImage(product) {
    if (!this.googleSearchKey || !this.googleCxId) {
      logger.debug('Google Custom Search not configured, skipping image fetch');
      return null;
    }

    try {
      const brand = product.manufacturer || product.Manufacturer || '';
      const name = product.name || product.ProductName || '';
      const query = `${brand} ${name} product white background`;

      const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleSearchKey}&cx=${this.googleCxId}&q=${encodeURIComponent(query)}&searchType=image&num=1&imgColorType=color&imgType=photo`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          url: item.link,
          source: item.image.contextLink || item.displayLink
        };
      }

      return null;
    } catch (error) {
      logger.warn('Image fetch failed', error.message);
      return null;
    }
  }

  /**
   * Calculate overall confidence score
   * @param {Object} components - All enrichment components
   * @returns {Number} Confidence score (0-100)
   */
  calculateConfidence(components) {
    let totalConfidence = 0;
    let count = 0;

    // Weight different components
    if (components.descriptions?.confidence) {
      totalConfidence += components.descriptions.confidence * 0.3; // 30% weight
      count += 0.3;
    }

    if (components.specs && Object.keys(components.specs).length > 0) {
      totalConfidence += 85 * 0.2; // 20% weight
      count += 0.2;
    }

    if (components.features && components.features.length > 0) {
      totalConfidence += 80 * 0.2; // 20% weight
      count += 0.2;
    }

    if (components.faq && components.faq.length > 0) {
      totalConfidence += 75 * 0.15; // 15% weight
      count += 0.15;
    }

    if (components.intelligence?.valueStatement) {
      totalConfidence += 70 * 0.15; // 15% weight
      count += 0.15;
    }

    // Calculate weighted average
    const confidence = count > 0 ? Math.round(totalConfidence / count) : 0;
    return Math.min(Math.max(confidence, 0), 100);
  }

  /**
   * Get current AI model name
   * @returns {String} Model name
   */
  getModelName() {
    if (aiService.hasOpenAI) {
      return process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }
    if (aiService.hasGemini) {
      return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    }
    return 'fallback';
  }

  /**
   * Fallback descriptions when AI fails
   */
  fallbackDescriptions(product) {
    const name = product.name || product.ProductName || 'Product';
    const category = product.category || product.Category || 'IT Product';
    
    return {
      short: `${name} - Professional ${category} solution for enterprise environments.`,
      long: `<span style="color:#0055A4">Overview:</span> ${name} provides reliable ${category} functionality.<br><br><span style="color:#0055A4">Key Features:</span><br>• Professional-grade quality<br>• Enterprise reliability<br>• Comprehensive support<br><br><span style="color:#0055A4">Ideal For:</span> Business and enterprise environments.`,
      confidence: 50
    };
  }

  /**
   * Fallback specifications when AI fails
   */
  fallbackSpecs(product) {
    return {
      'Product Type': product.category || product.Category || 'IT Product',
      'Manufacturer': product.manufacturer || product.Manufacturer || 'Various',
      'Part Number': product.partNumber || product.PartNumber || 'N/A'
    };
  }

  /**
   * Batch enrich multiple products
   * @param {Array} products - Array of product objects
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<Array>} Array of enriched data
   */
  async enrichProductBatch(products, progressCallback) {
    const results = [];
    let processed = 0;

    for (const product of products) {
      try {
        const enriched = await this.enrichProduct(product);
        results.push(enriched);
        processed++;
        
        if (progressCallback) {
          progressCallback(processed, products.length, enriched);
        }
      } catch (error) {
        logger.error(`Failed to enrich product ${product.name || product.ProductName}`, error);
        results.push({
          productID: product.ID || product.id,
          error: error.message,
          aiProcessed: false,
          requiresReview: true
        });
      }

      // Rate limiting delay (avoid API throttling)
      await this.delay(1000);
    }

    return results;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export default new ProductEnrichmentService();
