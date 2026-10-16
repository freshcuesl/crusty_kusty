import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*', 'scripts', 'supabase/functions'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**', 'supabase/functions/_shared/**'],
      exclude: ['**/*.test.*', '**/*.d.ts', '**/main.tsx', '**/test/**'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
