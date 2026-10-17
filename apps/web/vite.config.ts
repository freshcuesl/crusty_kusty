import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { securityHeaders } from '../../scripts/security-headers.mjs';

const brand = { midnight: '#0B2545', mist: '#F4F7FB' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', 'VITE_');
  return {
    envDir: '../..',
    plugins: [
      react(),
      securityHeaders({
        supabaseUrl: env.VITE_SUPABASE_URL,
        sentryDsn: env.VITE_SENTRY_DSN,
        webAnalytics: Boolean(env.VITE_CF_ANALYTICS_TOKEN),
      }),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          id: '/',
          name: 'ClientShield',
          short_name: 'ClientShield',
          description: 'Verified service dispute alerts for contractors.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: brand.mist,
          theme_color: brand.midnight,
          categories: ['business', 'productivity'],
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          // Never cache API or auth traffic: incident data must always be fresh and private.
          navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    // Hidden maps: generated for error tracking uploads, never linked from public bundles.
    build: { sourcemap: 'hidden' },
  };
});
