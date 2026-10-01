import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate icons with: npm run icons -w @cs/web
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#F4F7FB' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#F4F7FB' } },
  },
  images: ['public/favicon.svg'],
});
