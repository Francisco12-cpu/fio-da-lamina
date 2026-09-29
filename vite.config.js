import { defineConfig } from 'vite';

// base relativa: o build abre direto do disco e funciona em subpasta do GitHub Pages
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
  server: { port: 5173 },
});
