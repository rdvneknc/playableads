import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Playable networks expect one self-contained index.html (assets inlined).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: {
    port: 5175,
    open: true,
    allowedHosts: true,
  },
  preview: {
    port: 4175,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2019',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5000,
    reportCompressedSize: true,
  },
});
