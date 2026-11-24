import { defineConfig } from 'vitest/config';

// Unit tests: fast, no network, no database.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
