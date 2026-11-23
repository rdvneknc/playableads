import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Playable networks expect one self-contained index.html (assets inlined).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  // 3D unit models (.glb) are imported as inline data URLs
  assetsInclude: ['**/*.glb', '**/*.mp3'],
  server: {
    port: 5178,
    open: true,
    allowedHosts: true,
  },
  preview: {
    port: 4178,
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
