// Copies (or re-encodes) WebP art from assets-src/ into src/assets/.
// Run with: npm run assets
import sharp from 'sharp';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'assets-src');
const outDir = path.join(root, 'src', 'assets');

const jobs = [
  { input: 'player-blue.webp', output: 'player-blue.webp', size: 192 },
  { input: 'player-red.webp', output: 'player-red.webp', size: 192 },
  { input: 'ball.webp', output: 'ball.webp', size: 96 },
  { input: 'scoreboard-ui.webp', output: 'scoreboard-ui.webp', copyOnly: true },
  { input: 'grass-background.webp', output: 'grass-background.webp', copyOnly: true },
  { input: 'button-shoot.webp', output: 'button-shoot.webp', copyOnly: true },
  { input: 'button-dash.webp', output: 'button-dash.webp', copyOnly: true },
  { input: 'button-shoulder.webp', output: 'button-shoulder.webp', copyOnly: true },
  { input: 'rotate-background.webp', output: 'rotate-background.webp', copyOnly: true },
  { input: 'rotate-phone.webp', output: 'rotate-phone.webp', copyOnly: true },
];

await mkdir(outDir, { recursive: true });

for (const job of jobs) {
  const inPath = path.join(srcDir, job.input);
  const outPath = path.join(outDir, job.output);
  const meta = await sharp(inPath).metadata();

  if (job.copyOnly || (meta.width >= job.size * 0.9 && meta.width <= job.size * 1.5)) {
    await copyFile(inPath, outPath);
  } else {
    await sharp(inPath)
      .resize(job.size, job.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, alphaQuality: 100, effort: 6 })
      .toFile(outPath);
  }

  const before = (await stat(inPath)).size;
  const after = (await stat(outPath)).size;
  console.log(
    `${job.input} → ${job.output}: ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB (${meta.width}x${meta.height})`,
  );
}
