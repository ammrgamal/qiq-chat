// enrichmentService.js - AI-powered product enrichment
import dotenv from 'dotenv';
import OpenAI from 'openai';
import logger from './logger.js';

// Load environment variables from .env at current working directory
dotenv.config();

class EnrichmentService {
  constructor() {
    this.openaiClient = null;
    this.geminiApiKey = null;
    
    // Initialize OpenAI if available
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      logger.info('OpenAI client initialized');
    }
    
    // Check for Gemini API
    if (process.env.GOOGLE_API_KEY || process.env.Gemini_API) {
      this.geminiApiKey = process.env.GOOGLE_API_KEY || process.env.Gemini_API;
      logger.info('Gemini API key configured');
    }
    
    if (!this.openaiClient && !this.geminiApiKey) {
      logger.warn('No AI provider configured - enrichment will use basic rules');
    }
  }

  /**
   * Enrich a product with AI-generated content
   * @param {Object} product - Product object from database
   * @returns {Promise<Object>} Enriched product data
   */
  async enrichProduct(product) {
    const startTime = Date.now();
    
    try {
      logger.debug(`Enriching product: ${product.Description}`);

      // Build enrichment prompt
      const prompt = this.buildEnrichmentPrompt(product);
      
      // Try OpenAI first, then Gemini, then fallback
      let enrichedData;
      let provider;
      
      if (this.openaiClient) {
        enrichedData = await this.enrichWithOpenAI(prompt);
        provider = 'openai';
      } else if (this.geminiApiKey) {
        enrichedData = await this.enrichWithGemini(prompt);
        provider = 'gemini';
      } else {
        enrichedData = this.fallbackEnrichment(product);
        provider = 'fallback';
      }

      // Add metadata
      enrichedData.provider = provider;
      enrichedData.processingTime = Date.now() - startTime;
      enrichedData.confidence = enrichedData.confidence || 75;

      logger.success(`Enriched ${product.ManufacturerPartNo} using ${provider} (${enrichedData.processingTime}ms)`);
      
      return enrichedData;
    } catch (error) {
      logger.error(`Failed to enrich product ${product.ManufacturerPartNo}`, error);
      
      // Return fallback enrichment on error
      const fallbackData = this.fallbackEnrichment(product);
      fallbackData.provider = 'fallback';
      fallbackData.processingTime = Date.now() - startTime;
      fallbackData.error = error.message;
      
      return fallbackData;
    }
  }

  /**
   * Build enrichment prompt for AI
   * @param {Object} product - Product object
   * @returns {string} Prompt text
   */
  buildEnrichmentPrompt(product) {
    return `You are an expert IT product content writer. Analyze the following product and generate comprehensive, professional content in English.

Product Information:
- Name: ${product.Description}
- Part Number: ${product.ManufacturerPartNo}
- Manufacturer: ${product.Manufacturer || 'Unknown'}
- Price: $${product.UnitPrice || 0}

Generate the following content in JSON format:

1. shortDescription: A concise 2-3 sentence summary of the product (max 250 characters)
2. features: A bulleted list of 5-7 key features (format: "• Feature\\n• Feature...")
3. specs: Technical specifications as a formatted table (format: "Specification | Value\\n---|---\\nSpec1 | Value1...")
4. faq: 3-5 frequently asked questions with answers (format: "Q: Question?\\nA: Answer\\n\\nQ: Question?...")
5. whyBuy: A compelling value proposition paragraph (2-3 sentences)
6. prerequisites: Required items or conditions for this product (if any)
7. related: Recommended related products or bundles (3-5 items, comma-separated)
8. category: Product category (e.g., "Networking", "Storage", "Servers", "Software", "Accessories")
9. tags: 5-10 relevant keywords/tags (comma-separated)
10. seoKeywords: SEO-optimized keywords (comma-separated)
11. productRule: Smart rule for this product (e.g., "If firewall model, ask about subscription duration and suggest bundle with support")
12. categoryRule: General rule for this category (e.g., "Networking devices typically require configuration services")
13. scopeOfWork: Professional services that might be needed (e.g., "Installation, Configuration, Training")
14. confidence: Your confidence score for this enrichment (0-100)

Respond ONLY with valid JSON. No markdown, no explanations, just the JSON object.`;
  }

  /**
   * Enrich using OpenAI API
   * @param {string} prompt - Enrichment prompt
   * @returns {Promise<Object>} Enriched data
   */
  async enrichWithOpenAI(prompt) {
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      
      const completion = await this.openaiClient.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert IT product content writer. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0].message.content;
      const enrichedData = JSON.parse(content);
      
      // Add token usage
      enrichedData.tokensUsed = completion.usage?.total_tokens || 0;
      enrichedData.model = model;
      
      return enrichedData;
    } catch (error) {
      logger.error('OpenAI enrichment failed', error);
      throw error;
    }
  }

  /**
   * Enrich using Google Gemini API
   * @param {string} prompt - Enrichment prompt
   * @returns {Promise<Object>} Enriched data
   */
  async enrichWithGemini(prompt) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates[0].content.parts[0].text;
      const enrichedData = JSON.parse(content);
      
      enrichedData.model = model;
      
      return enrichedData;
    } catch (error) {
      logger.error('Gemini enrichment failed', error);
      throw error;
    }
  }

  /**
   * Fallback enrichment using basic rules
   * @param {Object} product - Product object
   * @returns {Object} Basic enriched data
   */
  fallbackEnrichment(product) {
    const name = product.Description || '';
    const manufacturer = product.Manufacturer || '';
    
    // Determine category based on product name
    let category = 'Accessories';
    if (name.match(/switch|router|firewall|gateway|access point/i)) category = 'Networking';
    else if (name.match(/server|blade|rack/i)) category = 'Servers';
    else if (name.match(/storage|disk|ssd|nas|san/i)) category = 'Storage';
    else if (name.match(/license|software|subscription/i)) category = 'Software';
    
    return {
      shortDescription: `${manufacturer} ${name}`,
      features: `• Professional grade equipment\n• Industry standard\n• Reliable performance`,
      specs: `Specification | Value\n---|---\nManufacturer | ${manufacturer}\nPart Number | ${product.ManufacturerPartNo}`,
      faq: `Q: What is included in the package?\nA: Please contact sales for detailed specifications.\n\nQ: What is the warranty?\nA: Standard manufacturer warranty applies.`,
      whyBuy: `Quality ${category.toLowerCase()} solution from ${manufacturer}. Professional grade equipment for business environments.`,
      prerequisites: 'Please verify compatibility with your existing infrastructure.',
      related: 'Contact sales for recommended accessories and related products',
      category: category,
      tags: `${manufacturer},${category},IT equipment`.toLowerCase(),
      seoKeywords: `${manufacturer},${name},${category}`.toLowerCase(),
      productRule: `Standard ${category} product. Verify specifications with customer requirements.`,
      categoryRule: `${category} products typically require professional installation and configuration.`,
      scopeOfWork: 'Installation, Configuration, Integration',
      confidence: 60
    };
  }

  /**
   * Batch enrich multiple products
   * @param {Array} products - Array of products
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array>} Array of enriched products
   */
  async batchEnrich(products, onProgress) {
    const results = [];
    let processed = 0;
    
    for (const product of products) {
      try {
        const enriched = await this.enrichProduct(product);
        results.push({
          product,
          enriched,
          success: true
        });
        
        // Rate limiting - wait 1 second between requests to avoid API limits
        await this.delay(1000);
      } catch (error) {
        results.push({
          product,
          error: error.message,
          success: false
        });
      }
      
      processed++;
      if (onProgress) {
        onProgress(processed, products.length);
      }
    }
    
    return results;
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export default new EnrichmentService();
