import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL is read lazily: `prisma generate` (run on install) must work without it,
// while migrate/seed commands fail with a clear connection error when it is missing.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
