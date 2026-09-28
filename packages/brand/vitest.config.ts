import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'brand',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../test/setup.ts'],
  },
});
