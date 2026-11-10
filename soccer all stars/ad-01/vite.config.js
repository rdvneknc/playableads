import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Playable ad networks expect a single self-contained index.html,
// so every script and asset is inlined into the build output.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: {
    port: 5173,
    open: true,
    allowedHosts: true,
    // assets-src is often locked while exporting art; watching it crashes Vite on Windows
    watch: { ignored: ['**/assets-src/**'] },
  },
  preview: {
    port: 4173,
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
