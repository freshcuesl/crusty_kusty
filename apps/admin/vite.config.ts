import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { securityHeaders } from '../../scripts/security-headers.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', 'VITE_');
  return {
    envDir: '../..',
    plugins: [
      react(),
      securityHeaders({
        supabaseUrl: env.VITE_SUPABASE_URL,
        sentryDsn: env.VITE_SENTRY_DSN,
        admin: true,
      }),
    ],
    server: { port: 5174, strictPort: true },
    preview: { port: 4174, strictPort: true },
    // Internal tool: one larger bundle is fine.
    build: {
      // No source maps in the published files: they would expose the app's original code.
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
    },
  };
});
