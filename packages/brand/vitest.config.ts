import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'brand',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../test/setup.ts'],
    // Same as the apps: user-event typing is slow while coverage is measured.
    testTimeout: 30_000,
  },
});
