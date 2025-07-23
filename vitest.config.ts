import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'], // Only include test files from src folder
    exclude: [
      '.trunk/**',
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/types.ts',
        '**/__mocks__/**',
        '**/test/**',
      ],
    },
    testTimeout: 10000,
  },
});
