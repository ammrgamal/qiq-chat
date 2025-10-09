const { validateBusinessEmail } = require('../api/_lib/email-validation.cjs');

describe('validateBusinessEmail (CJS)', () => {
  it('rejects personal gmail domain', () => {
    const r = validateBusinessEmail('user@gmail.com');
    expect(r.valid).toBe(false);
  });
  it('accepts business domain', () => {
    const r = validateBusinessEmail('employee@company-example.com');
    expect(r.valid).toBe(true);
  });
  it('allow list domain overrides', () => {
    process.env.ALLOW_EMAIL_DOMAINS = 'gmail.com';
    const r = validateBusinessEmail('someone@gmail.com');
    expect(r.valid).toBe(true);
    delete process.env.ALLOW_EMAIL_DOMAINS;
  });
});
