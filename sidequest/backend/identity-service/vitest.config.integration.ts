import { defineConfig } from 'vitest/config';

// Integration tests: real AppModule and a real PostgreSQL (Testcontainers, or TEST_DATABASE_URL).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.int-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
