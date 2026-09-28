import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '../..',
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  // Internal tool: one larger bundle is fine.
  build: { sourcemap: 'hidden', chunkSizeWarningLimit: 2000 },
});
