import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      // Supplied by vite-plugin-pwa at build time; tests mock it per file.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Full-page form tests fill many fields; under a full coverage run they can take 15s+.
    testTimeout: 30_000,
  },
});
