// arabicNLP.js - Arabic text processing and NLP utilities
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config({ path: '../.env' });

class ArabicNLP {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.googleKey = process.env.GOOGLE_API_KEY || process.env.Gemini_API;
    
    // In-memory cache for translations (will be persistent in production via Redis/SQLite)
    this.translationCache = new Map();
    
    // Arabic Unicode range
    this.arabicRegex = /[\u0600-\u06FF]/;
    
    // Diacritics (تشكيل) range
    this.diacriticsRegex = /[\u064B-\u065F\u0670]/g;
    
    // Arabic numerals mapping
    this.arabicNumeralsMap = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
  }

  /**
   * Detect if text contains Arabic characters
   * @param {string} text - Text to check
   * @returns {boolean} True if contains Arabic
   */
  containsArabic(text) {
    if (!text || typeof text !== 'string') return false;
    return this.arabicRegex.test(text);
  }

  /**
   * Normalize Arabic text
   * - Remove diacritics (تشكيل)
   * - Remove elongated letters (e.g., "فااايروول" → "فايروول")
   * - Unify common variants (أ/إ/آ → ا, ة → ه)
   * - Convert Arabic numerals to Western numerals
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeArabic(text) {
    if (!text || typeof text !== 'string') return text;
    
    let normalized = text;
    
    // Remove diacritics
    normalized = normalized.replace(this.diacriticsRegex, '');
    
    // Remove elongated letters (multiple consecutive same letters → single)
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');
    
    // Unify Alef variants: أ, إ, آ → ا
    normalized = normalized.replace(/[أإآ]/g, 'ا');
    
    // Unify Ta Marbuta: ة → ه
    normalized = normalized.replace(/ة/g, 'ه');
    
    // Convert Arabic numerals to Western numerals
    for (const [arabic, western] of Object.entries(this.arabicNumeralsMap)) {
      normalized = normalized.replace(new RegExp(arabic, 'g'), western);
    }
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }

  /**
   * Translate or transliterate Arabic text to English
   * Uses OpenAI API with caching
   * @param {string} text - Arabic text to translate
   * @param {string} context - Context hint (e.g., 'brand', 'product', 'category')
   * @returns {Promise<Object>} Translation result
   */
  async translateToEnglish(text, context = 'product') {
    if (!text || typeof text !== 'string') {
      return { original: text, translated: text, transliterated: text, cached: false };
    }
    
    // Check cache first
    const cacheKey = `${context}:${text.toLowerCase()}`;
    if (this.translationCache.has(cacheKey)) {
      logger.debug(`Using cached translation for: ${text}`);
      return { ...this.translationCache.get(cacheKey), cached: true };
    }
    
    // Normalize before translation
    const normalized = this.normalizeArabic(text);
    
    try {
      // Try OpenAI first
      if (this.openaiKey) {
        const result = await this.translateWithOpenAI(normalized, context);
        this.translationCache.set(cacheKey, result);
        return { ...result, cached: false };
      }
      
      // Try Gemini as fallback
      if (this.googleKey) {
        const result = await this.translateWithGemini(normalized, context);
        this.translationCache.set(cacheKey, result);
        return { ...result, cached: false };
      }
      
      // No AI available, return normalized text
      logger.warn('No AI provider available for translation');
      return {
        original: text,
        translated: normalized,
        transliterated: normalized,
        cached: false,
        provider: 'none'
      };
    } catch (error) {
      logger.error(`Translation failed for: ${text}`, error);
      return {
        original: text,
        translated: normalized,
        transliterated: normalized,
        cached: false,
        error: error.message
      };
    }
  }

  /**
   * Translate Arabic text using OpenAI
   * @param {string} text - Normalized Arabic text
   * @param {string} context - Context hint
   * @returns {Promise<Object>} Translation result
   */
  async translateWithOpenAI(text, context) {
    const prompt = `You are a bilingual Arabic-English technical translator specializing in IT products.

Task: Translate the following Arabic ${context} term to English.

Arabic Text: "${text}"

Requirements:
1. If it's a known brand/product name, provide the exact English name (e.g., "فورتينت" → "Fortinet")
2. If it's a technical term, translate it accurately (e.g., "فايروول" → "Firewall")
3. If uncertain, provide a phonetic transliteration
4. Keep acronyms and model numbers as-is

Return ONLY a JSON object:
{
  "original": "${text}",
  "translated": "English translation or exact brand name",
  "transliterated": "Phonetic transliteration",
  "confidence": 0-100,
  "isKnownBrand": true/false
}`;

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
            { role: 'system', content: 'You are an IT product translation expert. Return only valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);
      
      return {
        ...result,
        provider: 'openai',
        model: data.model,
        tokensUsed: data.usage?.total_tokens || 0
      };
    } catch (error) {
      logger.error('OpenAI translation failed', error);
      throw error;
    }
  }

  /**
   * Translate Arabic text using Google Gemini
   * @param {string} text - Normalized Arabic text
   * @param {string} context - Context hint
   * @returns {Promise<Object>} Translation result
   */
  async translateWithGemini(text, context) {
    const prompt = `You are a bilingual Arabic-English technical translator specializing in IT products.

Task: Translate the following Arabic ${context} term to English.

Arabic Text: "${text}"

Requirements:
1. If it's a known brand/product name, provide the exact English name (e.g., "فورتينت" → "Fortinet")
2. If it's a technical term, translate it accurately (e.g., "فايروول" → "Firewall")
3. If uncertain, provide a phonetic transliteration

Return ONLY a JSON object:
{
  "original": "${text}",
  "translated": "English translation or exact brand name",
  "transliterated": "Phonetic transliteration",
  "confidence": 0-100,
  "isKnownBrand": true/false
}`;

    try {
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const result = JSON.parse(text);
      
      return {
        ...result,
        provider: 'gemini',
        model: model
      };
    } catch (error) {
      logger.error('Gemini translation failed', error);
      throw error;
    }
  }

  /**
   * Generate bilingual synonyms (Arabic + English)
   * @param {string} text - Product name or description
   * @param {string} context - Context hint
   * @returns {Promise<Object>} Synonyms object with Arabic and English arrays
   */
  async generateSynonyms(text, context = 'product') {
    if (!text || typeof text !== 'string') {
      return { arabic: [], english: [], merged: [] };
    }
    
    const arabicSynonyms = [];
    const englishSynonyms = [];
    
    // Split text into tokens
    const tokens = text.split(/\s+/).filter(t => t.length > 2);
    
    // Process each token
    for (const token of tokens) {
      if (this.containsArabic(token)) {
        // Arabic token
        const normalized = this.normalizeArabic(token);
        arabicSynonyms.push(normalized);
        
        // Translate to English
        const translation = await this.translateToEnglish(token, context);
        if (translation.translated && translation.translated !== token) {
          englishSynonyms.push(translation.translated);
        }
        if (translation.transliterated && translation.transliterated !== translation.translated) {
          englishSynonyms.push(translation.transliterated);
        }
      } else {
        // English token
        englishSynonyms.push(token);
      }
    }
    
    // Deduplicate
    const uniqueArabic = [...new Set(arabicSynonyms)];
    const uniqueEnglish = [...new Set(englishSynonyms)];
    const merged = [...uniqueEnglish, ...uniqueArabic];
    
    return {
      arabic: uniqueArabic,
      english: uniqueEnglish,
      merged: merged
    };
  }

  /**
   * Preprocess Arabic query for Rules Engine
   * Detects Arabic, normalizes, translates, and returns English equivalent
   * @param {string} query - User query (may be in Arabic)
   * @returns {Promise<Object>} Preprocessed query result
   */
  async preprocessQuery(query) {
    if (!query || typeof query !== 'string') {
      return { original: query, processed: query, isArabic: false };
    }
    
    const isArabic = this.containsArabic(query);
    
    if (!isArabic) {
      return {
        original: query,
        processed: query,
        isArabic: false
      };
    }
    
    // Normalize Arabic
    const normalized = this.normalizeArabic(query);
    
    // Translate to English
    const translation = await this.translateToEnglish(normalized, 'query');
    
    return {
      original: query,
      normalized: normalized,
      processed: translation.translated || normalized,
      transliterated: translation.transliterated,
      isArabic: true,
      confidence: translation.confidence || 0,
      provider: translation.provider
    };
  }

  /**
   * Batch translate multiple terms (for optimization)
   * Groups terms by context to minimize API calls
   * @param {Array<{text: string, context: string}>} terms - Terms to translate
   * @returns {Promise<Array>} Translation results
   */
  async batchTranslate(terms) {
    const results = [];
    
    // Group by context
    const grouped = {};
    for (const term of terms) {
      const ctx = term.context || 'product';
      if (!grouped[ctx]) grouped[ctx] = [];
      grouped[ctx].push(term.text);
    }
    
    // Process each context group
    for (const [context, texts] of Object.entries(grouped)) {
      // Process in parallel but with rate limiting
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const promises = batch.map(text => this.translateToEnglish(text, context));
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        
        // Small delay to avoid rate limits
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
    
    return results;
  }

  /**
   * Clear translation cache
   */
  clearCache() {
    this.translationCache.clear();
    logger.info('Translation cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.translationCache.size,
      keys: Array.from(this.translationCache.keys())
    };
  }
}

// Export singleton instance
export default new ArabicNLP();
