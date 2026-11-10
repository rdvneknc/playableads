// Copies WebP art from assets-src/ into src/assets/.
// Run: npm run assets
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'assets-src');
const outDir = path.join(root, 'src', 'assets');

await mkdir(outDir, { recursive: true });

let files = [];
try {
  files = (await readdir(srcDir)).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
} catch {
  console.log('No assets-src yet — drop art there when ready.');
  process.exit(0);
}

if (!files.length) {
  console.log('assets-src is empty — waiting for VegaSlot art.');
  process.exit(0);
}

for (const file of files) {
  const from = path.join(srcDir, file);
  const to = path.join(outDir, file.replace(/\s+/g, '-').toLowerCase());
  await copyFile(from, to);
  const size = (await stat(to)).size;
  console.log(`${file} → ${path.basename(to)} (${(size / 1024).toFixed(1)} KB)`);
}
