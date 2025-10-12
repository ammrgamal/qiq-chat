import aiService from '../rules-engine/src/aiService.js';

describe('AI Service key validation', () => {
  test('OpenAI key validator accepts plausible key', () => {
    expect(aiService._validOpenAIKey('sk-aaaaaaaaaaaaaaaaaaaaBBBB')).toBe(true);
  });
  test('OpenAI key validator rejects short key', () => {
    expect(aiService._validOpenAIKey('sk-short')).toBe(false);
  });
  test('Gemini key validator accepts plausible key', () => {
    expect(aiService._validGeminiKey('AIzaSyA1234567890abcdef')).toBe(true);
  });
  test('Gemini key validator rejects wrong prefix', () => {
    expect(aiService._validGeminiKey('BXzaSyA1234567890abcdef')).toBe(false);
  });
});
