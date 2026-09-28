import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*', 'scripts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: ['**/*.test.*', '**/*.d.ts', '**/main.tsx', '**/test/**'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
