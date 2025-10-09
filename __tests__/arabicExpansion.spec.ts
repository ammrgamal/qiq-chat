const { loadArabicNLP } = require('./adapters/arabicNLP.adapter.cjs');
let arabicNLP;
beforeAll(async () => { arabicNLP = await loadArabicNLP(); });

describe('Arabic NLP preprocess', () => {
  test('detects and normalizes Arabic firewall phrase', async () => {
    const phrase = 'جدار حماية فايروال متقدم';
    const pre = await arabicNLP.preprocessQuery(phrase);
    expect(pre.isArabic).toBe(true);
    expect(pre.processed).toBeTruthy();
  });
});
