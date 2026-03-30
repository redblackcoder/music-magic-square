import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60_000, // OCR can be slow
    include: ['tests/**/*.test.ts'],
  },
});
