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
    // Full-page form tests type into several fields; CI machines are slower than laptops.
    testTimeout: 15_000,
  },
});
