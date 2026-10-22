import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: true,
    assetsInlineLimit: 4096,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Keep the HMR socket on the same port as the page. The host is derived
    // from the current page URL so localhost and LAN preview URLs both work.
    hmr: {
      clientPort: 5173,
    },
  },
});
