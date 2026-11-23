import { z } from 'zod';

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    JWT_PRIVATE_KEY_FILE: z.string().min(1).default('keys/private.pem'),
    JWT_KEY_ID: z.string().min(1),
    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z.string().min(1),
    TRUSTED_ORIGINS: z.string().default('http://localhost:3000').transform((val) => val.split(',').map((origin) => origin.trim())),
    TRUST_PROXY: z.string().default('false').transform((val) => {
        const trimmed = val.trim().toLowerCase();
        if (trimmed === '' || trimmed === 'false') return false;
        if (trimmed === 'true') return true;
        return val.split(',').map((proxy) => proxy.trim()).filter(Boolean);
    }),
})