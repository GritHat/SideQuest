import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_PRIVATE_KEY_FILE: z.string().min(1).default('keys/private.pem'),
  JWT_KEY_ID: z.string().min(1),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  TRUSTED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((origin) => origin.trim())),
  // Page that receives ?token=… and POSTs it to /api/identity/email/verify (the SPA route).
  EMAIL_VERIFICATION_URL: z
    .string()
    .url()
    .default('http://localhost:5173/verify-email'),
  // Page that receives ?token=… and POSTs it to /api/identity/password/reset (the SPA route).
  PASSWORD_RESET_URL: z
    .string()
    .url()
    .default('http://localhost:5173/reset-password'),
  // Without SMTP_URL, emails are written to the log: the demo needs no external service.
  SMTP_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  MAIL_FROM: z.string().min(1).default('SideQuest <no-reply@sidequest.local>'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((val) => {
      const trimmed = val.trim().toLowerCase();
      if (trimmed === '' || trimmed === 'false') return false;
      if (trimmed === 'true') return true;
      return val
        .split(',')
        .map((proxy) => proxy.trim())
        .filter(Boolean);
    }),
});
