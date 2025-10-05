// aiService.js - AI service for product classification using OpenAI or Google Gemini
import dotenv from 'dotenv';
import logger from './logger.js';

// Load environment variables from root .env
dotenv.config({ path: '../.env' });

class AIService {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.googleKey = process.env.GOOGLE_API_KEY || process.env.Gemini_API;
    this.googleCxId = process.env.GOOGLE_CX_ID;
    
    // Check which AI providers are available
    this.hasOpenAI = !!this.openaiKey;
    this.hasGemini = !!this.googleKey;
    
    if (!this.hasOpenAI && !this.hasGemini) {
      logger.warn('No AI API keys configured. AI features will use fallback mode.');
    } else {
      const providers = [];
      if (this.hasOpenAI) providers.push('OpenAI');
      if (this.hasGemini) providers.push('Gemini');
      logger.info(`AI providers available: ${providers.join(', ')}`);
    }
  }

  /**
   * Classify a product using AI
   * @param {Object} product - Product object with name, description, etc.
   * @returns {Promise<Object>} Classification result
   */
  async classifyProduct(product) {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildClassificationPrompt(product);
      
      // Try Gemini first if available (cheaper and faster for classification)
      if (this.hasGemini) {
        try {
          const result = await this.callGemini(prompt);
          const processingTime = Date.now() - startTime;
          logger.debug(`Gemini classification completed in ${processingTime}ms`);
          return {
            ...result,
            provider: 'gemini',
            processingTimeMs: processingTime
          };
        } catch (error) {
          logger.warn('Gemini failed, falling back to OpenAI', error);
        }
      }

      // Try OpenAI if available
      if (this.hasOpenAI) {
        const result = await this.callOpenAI(prompt);
        const processingTime = Date.now() - startTime;
        logger.debug(`OpenAI classification completed in ${processingTime}ms`);
        return {
          ...result,
          provider: 'openai',
          processingTimeMs: processingTime
        };
      }

      // Fallback: rule-based classification
      logger.warn('No AI provider available, using fallback classification');
      return this.fallbackClassification(product);
    } catch (error) {
      logger.error('AI classification failed', error);
      return this.fallbackClassification(product);
    }
  }

  /**
   * Build classification prompt for AI
   * @param {Object} product - Product object
   * @returns {string} Prompt string
   */
  buildClassificationPrompt(product) {
    return `Classify this IT product and provide structured information.

Product Details:
- Name: ${product.name || 'Unknown'}
- Part Number: ${product.partNumber || 'Unknown'}
- Manufacturer: ${product.manufacturer || 'Unknown'}
- Description: ${product.description || 'N/A'}
- Price: ${product.price ? `$${product.price}` : 'N/A'}

Please analyze and return a JSON object with:
{
  "category": "Main category (e.g., Networking, Servers, Storage, Software, Accessories)",
  "subCategory": "Specific subcategory (e.g., Switches, Routers, NAS)",
  "classification": "Standard, Custom, or Special Order",
  "autoApprove": true/false (based on product type and price),
  "confidence": 0-100 (your confidence in this classification),
  "keywords": ["keyword1", "keyword2", ...],
  "leadTimeDays": estimated lead time in days,
  "reasoning": "Brief explanation of classification"
}

Rules for auto-approval:
- Standard networking products under $5,000: auto-approve
- Standard software licenses under $3,000: auto-approve
- Servers and storage: require review regardless of price
- Custom or special order items: never auto-approve

Return ONLY valid JSON, no markdown or extra text.`;
  }

  /**
   * Call OpenAI API
   * @param {string} prompt - Prompt text
   * @returns {Promise<Object>} Classification result
   */
  async callOpenAI(prompt) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an IT product classification expert. Analyze products and return structured JSON data.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const classification = JSON.parse(content);

      return {
        ...classification,
        model: data.model,
        tokensUsed: data.usage?.total_tokens || 0,
        status: 'Success'
      };
    } catch (error) {
      logger.error('OpenAI API call failed', error);
      throw error;
    }
  }

  /**
   * Call Google Gemini API
   * @param {string} prompt - Prompt text
   * @returns {Promise<Object>} Classification result
   */
  async callGemini(prompt) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const classification = JSON.parse(text);

      return {
        ...classification,
        model: model,
        tokensUsed: 0, // Gemini doesn't return token count in this format
        status: 'Success'
      };
    } catch (error) {
      logger.error('Gemini API call failed', error);
      throw error;
    }
  }

  /**
   * Fallback classification using rules
   * @param {Object} product - Product object
   * @returns {Object} Classification result
   */
  fallbackClassification(product) {
    const name = (product.name || '').toLowerCase();
    const manufacturer = (product.manufacturer || '').toLowerCase();
    const price = product.price || 0;

    let category = 'Accessories';
    let subCategory = 'General';
    let autoApprove = false;
    let leadTimeDays = 7;

    // Simple rule-based classification
    if (name.includes('switch') || name.includes('router')) {
      category = 'Networking';
      subCategory = name.includes('switch') ? 'Switches' : 'Routers';
      autoApprove = price < 5000;
      leadTimeDays = 7;
    } else if (name.includes('server') || manufacturer.includes('dell') || manufacturer.includes('hp')) {
      category = 'Servers';
      subCategory = 'Rack Servers';
      autoApprove = false; // Servers always need review
      leadTimeDays = 14;
    } else if (name.includes('storage') || name.includes('nas') || name.includes('san')) {
      category = 'Storage';
      subCategory = name.includes('nas') ? 'NAS' : 'General Storage';
      autoApprove = false;
      leadTimeDays = 10;
    } else if (name.includes('license') || name.includes('software')) {
      category = 'Software';
      subCategory = 'Licenses';
      autoApprove = price < 3000;
      leadTimeDays = 1;
    }

    return {
      category,
      subCategory,
      classification: 'Standard',
      autoApprove,
      confidence: 60, // Lower confidence for fallback
      keywords: name.split(' ').filter(w => w.length > 3),
      leadTimeDays,
      reasoning: 'Fallback rule-based classification (no AI available)',
      provider: 'fallback',
      status: 'Success'
    };
  }

  /**
   * Batch classify multiple products
   * @param {Array} products - Array of product objects
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Array>} Array of classification results
   */
  async batchClassify(products, progressCallback = null) {
    const results = [];
    const total = products.length;

    for (let i = 0; i < total; i++) {
      try {
        const result = await this.classifyProduct(products[i]);
        results.push({
          product: products[i],
          classification: result,
          success: true
        });

        if (progressCallback) {
          progressCallback(i + 1, total, products[i].name);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          product: products[i],
          classification: null,
          success: false,
          error: error.message
        });
        logger.error(`Failed to classify: ${products[i].name}`, error);
      }
    }

    return results;
  }

  /**
   * Generate comprehensive product enrichment data
   * @param {string} prompt - Enrichment prompt
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Enrichment data
   */
  async generateEnrichment(prompt, product) {
    const startTime = Date.now();
    
    try {
      // Try Gemini first (cheaper for longer content generation)
      if (this.hasGemini) {
        try {
          const result = await this.callGemini(prompt);
          const processingTime = Date.now() - startTime;
          logger.debug(`Gemini enrichment completed in ${processingTime}ms`);
          return result;
        } catch (error) {
          logger.warn('Gemini enrichment failed, falling back to OpenAI', error);
        }
      }

      // Try OpenAI
      if (this.hasOpenAI) {
        const result = await this.callOpenAI(prompt);
        const processingTime = Date.now() - startTime;
        logger.debug(`OpenAI enrichment completed in ${processingTime}ms`);
        return result;
      }

      // Fallback: return minimal enrichment
      logger.warn('No AI provider available for enrichment, using fallback');
      return this.fallbackEnrichment(product);
    } catch (error) {
      logger.error('AI enrichment failed', error);
      return this.fallbackEnrichment(product);
    }
  }

  /**
   * Fallback enrichment when AI is unavailable
   * @param {Object} product - Product object
   * @returns {Object} Basic enrichment data
   */
  fallbackEnrichment(product) {
    const name = product.ProductName || product.name || 'Product';
    const manufacturer = product.Manufacturer || product.manufacturer || '';
    const category = product.Category || product.category || '';
    
    return {
      shortDescription: `${manufacturer} ${name} - ${category} solution for enterprise needs.`,
      longDescription: `The ${manufacturer} ${name} is a professional-grade ${category} product designed for business environments. This product delivers reliable performance and comprehensive features to meet enterprise requirements.`,
      technicalSpecs: {
        'Category': category,
        'Manufacturer': manufacturer,
        'Type': 'Enterprise Grade'
      },
      keyFeatures: [
        'Enterprise-grade reliability',
        'Professional support available',
        'Industry-standard compatibility',
        'Scalable solution'
      ],
      faq: [
        {
          question: 'What is included with this product?',
          answer: 'Please contact our sales team for detailed information about included components and services.'
        },
        {
          question: 'What is the warranty period?',
          answer: 'Warranty terms vary by manufacturer. Please check with our sales team for specific warranty details.'
        }
      ],
      prerequisites: [
        'Compatible infrastructure required',
        'Professional installation recommended'
      ],
      professionalServices: {
        scope: 'Installation and configuration',
        description: 'Professional installation and configuration services available upon request',
        estimatedHours: 4,
        recommendedTier: 'Standard'
      },
      upsellSuggestions: [
        'Extended warranty coverage',
        'Professional installation service',
        'Premium technical support'
      ],
      bundleSuggestions: [
        'Compatible accessories',
        'Backup and recovery solutions',
        'Monitoring and management tools'
      ],
      customerValue: `Choose ${manufacturer} ${name} for reliable enterprise-grade performance backed by professional support and comprehensive features.`,
      provider: 'fallback',
      status: 'Partial'
    };
  }
}

// Export singleton instance
export default new AIService();
