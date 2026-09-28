import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate icons with: npm run icons -w @ck/web
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#FBF5EA' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#FBF5EA' } },
  },
  images: ['public/favicon.svg'],
});
