const { loadArabicNLP } = require('./adapters/arabicNLP.adapter.cjs');
let arabicNLP;
beforeAll(async () => {
  process.env.ARABIC_TRANSLATION_DISABLED = '1';
  arabicNLP = await loadArabicNLP();
});

describe('Arabic NLP preprocess (CJS)', () => {
  test('detects Arabic phrase', async () => {
    const phrase = 'جدار حماية فايروال متقدم';
    const pre = await arabicNLP.preprocessQuery(phrase);
    expect(pre.isArabic).toBe(true);
    expect(pre.processed).toBeTruthy();
    // Should use disabled provider path (no external API call noise)
    // provider may be 'disabled' OR undefined if only normalization; accept either but reject 'openai'/'gemini'
    expect(['disabled', undefined, null]).toContain(pre.provider);
  });
});
