import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'admin',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
