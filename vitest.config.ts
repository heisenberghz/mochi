import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/{domain,shared,main}/**/*.test.ts'],
    environment: 'node',
  },
});
