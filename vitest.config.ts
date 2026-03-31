import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 120_000, // OCR + OpenCV can be slow on large images
    include: ['tests/**/*.test.ts'],
  },
});
