import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'admin',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // react-admin pages mount many providers; give them the same headroom as the web app.
    testTimeout: 30_000,
  },
});
