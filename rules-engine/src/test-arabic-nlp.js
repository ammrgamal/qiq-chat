#!/usr/bin/env node
// test-arabic-nlp.js - CLI tool for testing Arabic NLP functionality
import dotenv from 'dotenv';
import arabicNLP from './arabicNLP.js';
import logger from './logger.js';

dotenv.config({ path: '../.env' });

async function testArabicDetection() {
  logger.banner('Arabic Detection Tests');
  
  const testCases = [
    'فايروول فورتينت',
    'سويتش ٢٤ منفذ',
    'Firewall Fortinet',
    'كابل فايبر 4 كور من كومسكوب',
    'Router راوتر WiFi'
  ];

  for (const text of testCases) {
    const isArabic = arabicNLP.containsArabic(text);
    logger.info(`"${text}" → ${isArabic ? 'Contains Arabic' : 'No Arabic'}`);
  }
}

async function testNormalization() {
  logger.banner('Arabic Normalization Tests');
  
  const testCases = [
    'فَايَرْوُول',
    'فااااايروول',
    'أحمد',
    'إبراهيم',
    'شبكة',
    'سويتش ٢٤ منفذ'
  ];

  for (const text of testCases) {
    const normalized = arabicNLP.normalizeArabic(text);
    logger.info(`"${text}" → "${normalized}"`);
  }
}

async function testTranslation() {
  logger.banner('Arabic Translation Tests');
  
  const testCases = [
    { text: 'فورتينت', context: 'brand' },
    { text: 'فايروول', context: 'product' },
    { text: 'سويتش', context: 'product' },
    { text: 'كومسكوب', context: 'brand' },
    { text: 'كابل فايبر', context: 'product' }
  ];

  for (const { text, context } of testCases) {
    try {
      const result = await arabicNLP.translateToEnglish(text, context);
      logger.success(`"${text}" (${context}):`);
      logger.info(`  → Translated: ${result.translated}`);
      logger.info(`  → Transliterated: ${result.transliterated}`);
      logger.info(`  → Confidence: ${result.confidence || 'N/A'}`);
      logger.info(`  → Provider: ${result.provider || 'N/A'}`);
      logger.info(`  → Cached: ${result.cached}`);
    } catch (error) {
      logger.error(`Failed to translate "${text}": ${error.message}`);
    }
  }
}

async function testQueryPreprocessing() {
  logger.banner('Query Preprocessing Tests');
  
  const testCases = [
    'عايز كابل فايبر 4 كور من كومسكوب',
    'فايروول فورتينت للشركات',
    'Fortinet Firewall FG-60E',
    'سويتش ٢٤ منفذ جيجابيت'
  ];

  for (const query of testCases) {
    try {
      const result = await arabicNLP.preprocessQuery(query);
      logger.success(`Query: "${query}"`);
      logger.info(`  → Is Arabic: ${result.isArabic}`);
      logger.info(`  → Normalized: ${result.normalized || 'N/A'}`);
      logger.info(`  → Processed: ${result.processed}`);
      logger.info(`  → Transliterated: ${result.transliterated || 'N/A'}`);
    } catch (error) {
      logger.error(`Failed to preprocess "${query}": ${error.message}`);
    }
  }
}

async function testSynonymGeneration() {
  logger.banner('Synonym Generation Tests');
  
  const testCases = [
    'Fortinet Firewall FG-60E',
    'فورتينت فايروول',
    'CommScope Fiber Cable 4 Core'
  ];

  for (const text of testCases) {
    try {
      const result = await arabicNLP.generateSynonyms(text, 'product');
      logger.success(`Text: "${text}"`);
      logger.info(`  → English: [${result.english.join(', ')}]`);
      logger.info(`  → Arabic: [${result.arabic.join(', ')}]`);
      logger.info(`  → Merged: ${result.merged.length} terms`);
    } catch (error) {
      logger.error(`Failed to generate synonyms for "${text}": ${error.message}`);
    }
  }
}

async function testCacheStats() {
  logger.banner('Cache Statistics');
  
  const stats = arabicNLP.getCacheStats();
  logger.info(`Cache size: ${stats.size} entries`);
  if (stats.size > 0) {
    logger.info(`Cache keys: ${stats.keys.slice(0, 5).join(', ')}${stats.size > 5 ? '...' : ''}`);
  }
}

async function main() {
  try {
    logger.banner('Arabic NLP Testing Suite');
    
    const args = process.argv.slice(2);
    const testAll = args.length === 0 || args.includes('--all');
    
    if (testAll || args.includes('--detect')) {
      await testArabicDetection();
      logger.separator();
    }
    
    if (testAll || args.includes('--normalize')) {
      await testNormalization();
      logger.separator();
    }
    
    if (testAll || args.includes('--translate')) {
      await testTranslation();
      logger.separator();
    }
    
    if (testAll || args.includes('--preprocess')) {
      await testQueryPreprocessing();
      logger.separator();
    }
    
    if (testAll || args.includes('--synonyms')) {
      await testSynonymGeneration();
      logger.separator();
    }
    
    if (testAll || args.includes('--cache')) {
      await testCacheStats();
      logger.separator();
    }
    
    logger.success('All tests completed!');
    
    // Show cache stats at the end
    if (!args.includes('--cache')) {
      logger.separator();
      await testCacheStats();
    }
    
  } catch (error) {
    logger.error('Test suite failed', error);
    process.exit(1);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`
Arabic NLP Testing Suite
========================

Usage:
  node test-arabic-nlp.js [options]

Options:
  --all           Run all tests (default)
  --detect        Test Arabic detection
  --normalize     Test Arabic normalization
  --translate     Test Arabic translation (requires API keys)
  --preprocess    Test query preprocessing
  --synonyms      Test synonym generation (requires API keys)
  --cache         Show cache statistics

Examples:
  node test-arabic-nlp.js
  node test-arabic-nlp.js --detect --normalize
  node test-arabic-nlp.js --translate
`);
  
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
