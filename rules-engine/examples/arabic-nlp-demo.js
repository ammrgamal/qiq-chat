// examples/arabic-nlp-demo.js - Demo of Arabic NLP functionality
import dotenv from 'dotenv';
import arabicNLP from '../src/arabicNLP.js';
import logger from '../src/logger.js';

dotenv.config({ path: '../../.env' });

/**
 * Demo: Arabic text detection and normalization
 */
async function demoDetectionAndNormalization() {
  logger.banner('Demo 1: Detection & Normalization');
  
  // Example 1: Detect Arabic
  const texts = [
    'فايروول فورتينت',
    'Fortinet Firewall',
    'سويتش 24 منفذ',
    'Mixed: Firewall فايروول'
  ];
  
  logger.info('Arabic Detection:');
  texts.forEach(text => {
    const isArabic = arabicNLP.containsArabic(text);
    logger.info(`  "${text}" → ${isArabic ? '✓ Arabic' : '✗ No Arabic'}`);
  });
  
  logger.separator('-');
  
  // Example 2: Normalize Arabic
  const arabicTexts = [
    'فَايَرْوُول',           // With diacritics
    'فااااايروول',           // Elongated
    'أحمد إبراهيم',         // Alef variants
    'شبكة',                 // Ta Marbuta
    'سويتش ٢٤ منفذ'         // Arabic numerals
  ];
  
  logger.info('Arabic Normalization:');
  arabicTexts.forEach(text => {
    const normalized = arabicNLP.normalizeArabic(text);
    logger.info(`  "${text}" → "${normalized}"`);
  });
}

/**
 * Demo: Query preprocessing for search
 */
async function demoQueryPreprocessing() {
  logger.banner('Demo 2: Query Preprocessing');
  
  const queries = [
    'عايز كابل فايبر 4 كور',
    'فايروول فورتينت للشركات',
    'Fortinet Firewall FG-60E',
    'سويتش ٢٤ منفذ جيجابيت'
  ];
  
  for (const query of queries) {
    logger.info(`Original Query: "${query}"`);
    
    const result = await arabicNLP.preprocessQuery(query);
    
    if (result.isArabic) {
      logger.success('  → Detected Arabic');
      logger.info(`  → Normalized: "${result.normalized}"`);
      logger.info(`  → Translated: "${result.processed}"`);
      if (result.confidence) {
        logger.info(`  → Confidence: ${result.confidence}%`);
      }
    } else {
      logger.info('  → English query, no preprocessing needed');
      logger.info(`  → Processed: "${result.processed}"`);
    }
    
    logger.separator('-');
  }
}

/**
 * Demo: Synonym generation for products
 */
async function demoSynonymGeneration() {
  logger.banner('Demo 3: Synonym Generation');
  
  const products = [
    'Fortinet FortiGate 60E Firewall',
    'فورتينت فايروول',
    'CommScope Fiber Cable 4 Core'
  ];
  
  for (const product of products) {
    logger.info(`Product: "${product}"`);
    
    const result = await arabicNLP.generateSynonyms(product, 'product');
    
    logger.success(`  → English Synonyms (${result.english.length}):`);
    if (result.english.length > 0) {
      logger.info(`     ${result.english.join(', ')}`);
    } else {
      logger.info('     (none)');
    }
    
    logger.success(`  → Arabic Synonyms (${result.arabic.length}):`);
    if (result.arabic.length > 0) {
      logger.info(`     ${result.arabic.join(', ')}`);
    } else {
      logger.info('     (none)');
    }
    
    logger.info(`  → Total merged: ${result.merged.length} terms`);
    logger.separator('-');
  }
}

/**
 * Demo: Translation with caching
 */
async function demoTranslationWithCaching() {
  logger.banner('Demo 4: Translation & Caching');
  
  const terms = [
    { text: 'فورتينت', context: 'brand' },
    { text: 'فايروول', context: 'product' },
    { text: 'سويتش', context: 'product' },
    { text: 'فورتينت', context: 'brand' } // Duplicate to test cache
  ];
  
  for (const { text, context } of terms) {
    logger.info(`Translating: "${text}" (${context})`);
    
    const result = await arabicNLP.translateToEnglish(text, context);
    
    logger.success(`  → Translated: "${result.translated}"`);
    logger.info(`  → Transliterated: "${result.transliterated}"`);
    logger.info(`  → Confidence: ${result.confidence || 'N/A'}`);
    logger.info(`  → Provider: ${result.provider || 'none'}`);
    logger.info(`  → From Cache: ${result.cached ? 'YES' : 'NO'}`);
    
    logger.separator('-');
  }
  
  // Show cache statistics
  const stats = arabicNLP.getCacheStats();
  logger.info(`Cache Statistics: ${stats.size} entries`);
  if (stats.size > 0) {
    logger.info(`Cache Keys: ${stats.keys.join(', ')}`);
  }
}

/**
 * Demo: Complete search flow simulation
 */
async function demoSearchFlow() {
  logger.banner('Demo 5: Complete Search Flow');
  
  const userQuery = 'عايز فايروول فورتينت للشركات الصغيرة';
  
  logger.info(`User Query: "${userQuery}"`);
  logger.separator('-');
  
  // Step 1: Detect Arabic
  logger.step(1, 'Detect Arabic');
  const isArabic = arabicNLP.containsArabic(userQuery);
  logger.success(`  → Arabic detected: ${isArabic}`);
  
  // Step 2: Normalize
  logger.step(2, 'Normalize Arabic text');
  const normalized = arabicNLP.normalizeArabic(userQuery);
  logger.success(`  → Normalized: "${normalized}"`);
  
  // Step 3: Translate
  logger.step(3, 'Translate to English');
  const translation = await arabicNLP.translateToEnglish(normalized, 'query');
  logger.success(`  → Translated: "${translation.translated}"`);
  logger.info(`  → Confidence: ${translation.confidence || 'N/A'}`);
  
  // Step 4: Generate search terms
  logger.step(4, 'Generate search synonyms');
  const synonyms = await arabicNLP.generateSynonyms(userQuery, 'query');
  logger.success(`  → Search Terms (${synonyms.merged.length}):`);
  logger.info(`     ${synonyms.merged.join(', ')}`);
  
  // Step 5: Simulate search (placeholder)
  logger.step(5, 'Search Algolia');
  logger.info(`  → Search query: "${translation.translated}"`);
  logger.info('  → [Simulated] Found 5 Fortinet Firewall products');
  
  logger.separator('-');
  logger.success('Search flow completed successfully!');
}

/**
 * Main demo runner
 */
async function main() {
  try {
    logger.banner('Arabic NLP Demo Suite');
    
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('1')) {
      await demoDetectionAndNormalization();
      logger.separator('=');
    }
    
    if (args.length === 0 || args.includes('2')) {
      await demoQueryPreprocessing();
      logger.separator('=');
    }
    
    if (args.length === 0 || args.includes('3')) {
      await demoSynonymGeneration();
      logger.separator('=');
    }
    
    if (args.length === 0 || args.includes('4')) {
      await demoTranslationWithCaching();
      logger.separator('=');
    }
    
    if (args.length === 0 || args.includes('5')) {
      await demoSearchFlow();
      logger.separator('=');
    }
    
    logger.success('All demos completed successfully!');
    
  } catch (error) {
    logger.error('Demo failed', error);
    process.exit(1);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`
Arabic NLP Demo Suite
=====================

Usage:
  node arabic-nlp-demo.js [demo-number]

Demo Options:
  1 - Detection & Normalization
  2 - Query Preprocessing
  3 - Synonym Generation
  4 - Translation & Caching (requires API keys)
  5 - Complete Search Flow (requires API keys)
  
  (no arguments) - Run all demos

Examples:
  node arabic-nlp-demo.js          # Run all demos
  node arabic-nlp-demo.js 1 2      # Run demos 1 and 2
  node arabic-nlp-demo.js 5        # Run complete search flow demo

Note: Demos 4 and 5 require OpenAI or Gemini API keys in .env
`);
  
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
