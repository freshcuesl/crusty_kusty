import { defineProject } from 'vitest/config';

// Unit tests for Edge Function logic. The Deno entry files (index.ts) are
// type-checked separately with `deno check`.
export default defineProject({
  test: {
    name: 'functions',
    environment: 'node',
    include: ['_shared/**/*.test.ts'],
  },
});
