// Import CommonJS wrapper to keep ts-jest simple
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateBusinessEmail } = require('../api/_lib/email-validation.cjs');

describe('validateBusinessEmail', () => {

  it('rejects personal gmail domain', () => {
    const r = validateBusinessEmail('user@gmail.com');
    expect(r.valid).toBe(false);
  });
  it('accepts business domain', () => {
    const r = validateBusinessEmail('employee@company-example.com');
    expect(r.valid).toBe(true);
  });
  it('accepts allow list domain even if blocked', () => {
    process.env.ALLOW_EMAIL_DOMAINS = 'gmail.com';
    const r = validateBusinessEmail('someone@gmail.com');
    expect(r.valid).toBe(true);
    delete process.env.ALLOW_EMAIL_DOMAINS;
  });
});
