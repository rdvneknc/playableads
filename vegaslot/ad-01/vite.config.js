import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Playable networks expect one self-contained index.html (assets inlined).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: {
    port: 5174,
    open: true,
    allowedHosts: true,
    watch: { ignored: ['**/assets-src/**'] },
  },
  preview: {
    port: 4174,
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
