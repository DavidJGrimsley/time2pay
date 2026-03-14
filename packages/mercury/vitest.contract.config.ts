import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/contract/**/*.contract.test.ts'],
  },
});
