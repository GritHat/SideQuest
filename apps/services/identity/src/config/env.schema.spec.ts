import { envSchema } from './env.schema.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  JWT_KEY_ID: 'k',
  JWT_ISSUER: 'i',
  JWT_AUDIENCE: 'a',
};

describe('envSchema', () => {
  it('applies the documented defaults', () => {
    expect(envSchema.parse(base)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      EMAIL_VERIFICATION_URL: 'http://localhost:5173/verify-email',
      PASSWORD_RESET_URL: 'http://localhost:5173/reset-password',
      TRUST_PROXY: false,
    });
  });

  it.each([['absent', {}], ['empty, as in .env.example', { SMTP_URL: '' }]])('treats SMTP_URL %s as not configured', (_, extra) => {
    expect(envSchema.parse({ ...base, ...extra }).SMTP_URL).toBeUndefined();
  });

  it('rejects a malformed SMTP_URL and missing token settings', () => {
    expect(envSchema.safeParse({ ...base, SMTP_URL: 'not a url' }).success).toBe(false);
    expect(envSchema.safeParse({ DATABASE_URL: base.DATABASE_URL }).success).toBe(false);
  });

  it('parses TRUSTED_ORIGINS and TRUST_PROXY lists', () => {
    const env = envSchema.parse({ ...base, TRUSTED_ORIGINS: 'http://a.test, http://b.test', TRUST_PROXY: '10.0.0.1, 10.0.0.2' });
    expect(env.TRUSTED_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.TRUST_PROXY).toEqual(['10.0.0.1', '10.0.0.2']);
  });
});
