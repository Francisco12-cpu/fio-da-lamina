import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base relativa: funciona em subpasta do GitHub Pages.
// `npm run build` → dist/ (site normal)
// `npm run build:arquivo` → dist-arquivo/index.html (um arquivo só, abre direto do disco)
export default defineConfig(({ mode }) => mode === 'arquivo'
  ? {
    base: './',
    plugins: [viteSingleFile()],
    build: { target: 'es2022', outDir: 'dist-arquivo', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 8000 },
  }
  : {
    base: './',
    build: { target: 'es2022', chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
    server: { port: 5173 },
  });
