// ai-helper.js - AI content generation helper for product enrichment
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Generate comprehensive product content using OpenAI
 * @param {Object} product - Product object from database
 * @returns {Promise<Object>} Generated content object
 */
export async function generateProductContent(product) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = buildProductPrompt(product);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert IT product content writer. Generate professional, accurate product content in structured JSON format.'
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
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    return {
      ...content,
      provider: 'OpenAI',
      model: data.model,
      tokensUsed: data.usage?.total_tokens || 0
    };
  } catch (error) {
    console.error('AI content generation failed:', error);
    throw error;
  }
}

/**
 * Build comprehensive prompt for product content generation
 * @param {Object} product - Product object
 * @returns {string} Prompt string
 */
function buildProductPrompt(product) {
  return `Generate comprehensive product content for this IT product:

Product Details:
- Name: ${product.ProductName || 'Unknown'}
- Part Number: ${product.PartNumber || 'Unknown'}
- Manufacturer: ${product.Manufacturer || 'Unknown'}
- Description: ${product.Description || 'N/A'}
- Price: ${product.Price ? `$${product.Price}` : 'N/A'}

Generate a JSON object with these fields:

{
  "shortDescription": "Brief 150-200 character product summary",
  "category": "Main category (Networking, Servers, Storage, Software, etc.)",
  "subcategory": "Specific subcategory",
  "features": "5-7 key features as a bulleted list (use \\n• for bullets)",
  "specifications": "Technical specifications in table format (use \\n for rows)",
  "faq": "3-5 common questions with answers (Q: ... A: ... format)",
  "marketingMessage": "Value proposition and benefits (2-3 sentences)",
  "upsellSuggestions": "Related products or bundles to suggest",
  "prerequisites": "Any requirements or dependencies",
  "relatedItems": "Compatible accessories or related products",
  "servicesScope": "Professional services available or required",
  "aiRuleProduct": "Product-specific classification rule",
  "aiRuleCategory": "Category-level classification rule"
}

Return ONLY valid JSON, no markdown or extra text.`;
}

/**
 * Calculate AI confidence score based on product data and AI response
 * @param {Object} product - Original product object
 * @param {Object} aiContent - Generated AI content
 * @returns {number} Confidence score (0-100)
 */
export function calculateConfidence(product, aiContent) {
  let confidence = 50; // Base confidence
  
  // Increase confidence based on available input data
  if (product.Description && product.Description.length > 50) confidence += 15;
  if (product.PartNumber) confidence += 10;
  if (product.Manufacturer) confidence += 10;
  if (product.Price > 0) confidence += 5;
  
  // Increase confidence based on AI output quality
  if (aiContent.features && aiContent.features.length > 100) confidence += 5;
  if (aiContent.specifications && aiContent.specifications.length > 50) confidence += 5;
  if (aiContent.category && aiContent.subcategory) confidence += 10;
  
  // Cap at 100
  return Math.min(confidence, 100);
}

export default {
  generateProductContent,
  calculateConfidence
};
