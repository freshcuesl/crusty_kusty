import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each worker runs a full jsdom + MUI app; one per core starves a laptop that's
    // also running Docker and dev servers, and slow tests then hit their timeouts.
    maxWorkers: '50%',
    projects: ['packages/*', 'apps/*', 'scripts', 'supabase/functions'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**', 'supabase/functions/_shared/**'],
      exclude: ['**/*.test.*', '**/*.d.ts', '**/main.tsx', '**/test/**'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
