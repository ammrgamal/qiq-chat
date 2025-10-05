// arabicNLP.test.js - Tests for Arabic NLP utilities
import arabicNLP from '../arabicNLP.js';

describe('ArabicNLP', () => {
  describe('containsArabic', () => {
    test('should detect Arabic text', () => {
      expect(arabicNLP.containsArabic('فايروول')).toBe(true);
      expect(arabicNLP.containsArabic('سويتش 24 منفذ')).toBe(true);
      expect(arabicNLP.containsArabic('Firewall فايروول')).toBe(true);
    });

    test('should return false for non-Arabic text', () => {
      expect(arabicNLP.containsArabic('Firewall')).toBe(false);
      expect(arabicNLP.containsArabic('Switch 24 port')).toBe(false);
      expect(arabicNLP.containsArabic('')).toBe(false);
      expect(arabicNLP.containsArabic(null)).toBe(false);
    });
  });

  describe('normalizeArabic', () => {
    test('should remove diacritics', () => {
      const input = 'فَايَرْوُول';
      const expected = 'فايروول';
      expect(arabicNLP.normalizeArabic(input)).toBe(expected);
    });

    test('should normalize elongated letters', () => {
      const input = 'فااااايروول';
      const expected = 'فاايروول'; // Reduces to max 2 consecutive
      expect(arabicNLP.normalizeArabic(input)).toBe(expected);
    });

    test('should unify Alef variants', () => {
      expect(arabicNLP.normalizeArabic('أحمد')).toBe('احمد');
      expect(arabicNLP.normalizeArabic('إبراهيم')).toBe('ابراهيم');
      expect(arabicNLP.normalizeArabic('آمن')).toBe('امن');
    });

    test('should unify Ta Marbuta', () => {
      const input = 'شبكة';
      const expected = 'شبكه';
      expect(arabicNLP.normalizeArabic(input)).toBe(expected);
    });

    test('should convert Arabic numerals to Western', () => {
      const input = 'سويتش ٢٤ منفذ';
      const expected = 'سويتش 24 منفذ';
      expect(arabicNLP.normalizeArabic(input)).toBe(expected);
    });

    test('should handle null/undefined', () => {
      expect(arabicNLP.normalizeArabic(null)).toBe(null);
      expect(arabicNLP.normalizeArabic(undefined)).toBe(undefined);
      expect(arabicNLP.normalizeArabic('')).toBe('');
    });
  });

  describe('preprocessQuery', () => {
    test('should detect and normalize Arabic query', async () => {
      const query = 'عايز فايروول فورتينت';
      const result = await arabicNLP.preprocessQuery(query);
      
      expect(result.isArabic).toBe(true);
      expect(result.original).toBe(query);
      expect(result.normalized).toBeTruthy();
    });

    test('should pass through English query unchanged', async () => {
      const query = 'Fortinet Firewall';
      const result = await arabicNLP.preprocessQuery(query);
      
      expect(result.isArabic).toBe(false);
      expect(result.processed).toBe(query);
    });

    test('should handle empty query', async () => {
      const result = await arabicNLP.preprocessQuery('');
      expect(result.original).toBe('');
    });
  });

  describe('cache', () => {
    test('should clear cache', () => {
      arabicNLP.clearCache();
      const stats = arabicNLP.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('should return cache statistics', () => {
      const stats = arabicNLP.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('generateSynonyms', () => {
    test('should generate empty arrays for null input', async () => {
      const result = await arabicNLP.generateSynonyms(null);
      expect(result.arabic).toEqual([]);
      expect(result.english).toEqual([]);
      expect(result.merged).toEqual([]);
    });

    test('should extract English tokens', async () => {
      const result = await arabicNLP.generateSynonyms('Fortinet Firewall FG-60E');
      expect(result.english.length).toBeGreaterThan(0);
      expect(result.english).toContain('Fortinet');
    });
  });
});
