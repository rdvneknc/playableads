// Builds every playable in this repo and generates the showcase site in public/.
//
//   <game folder>/<ad folder>/package.json   → one playable (Vite, single-file build)
//   <game folder>/game.json                  → optional { "title": "...", "tag": "..." }
//
// Output:
//   public/index.html                 all games
//   public/<game>/index.html          that game's ads
//   public/<game>/<ad>/index.html     the playable itself (also downloadable)
//
// Usage: npm run build            (everything)
//        npm run build -- vegaslot  (only folders whose name matches)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public');
const filter = (process.argv[2] || '').toLowerCase();
const SKIP = new Set(['node_modules', 'public', 'scripts', '.git', '.github', '.vercel']);

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

process.on('uncaughtException', (err) => {
  console.error(`\n✗ build failed: ${err.message}`);
  process.exit(err.status || 1);
});

// ── discover ──
const games = readdirSync(root)
  .filter((d) => !d.startsWith('.') && !SKIP.has(d) && isDir(path.join(root, d)))
  .filter((d) => !filter || d.toLowerCase().includes(filter))
  .map((dir) => {
    const gdir = path.join(root, dir);
    let meta = {};
    try {
      meta = JSON.parse(readFileSync(path.join(gdir, 'game.json'), 'utf8'));
    } catch {
      /* optional */
    }
    const ads = readdirSync(gdir)
      .filter((a) => existsSync(path.join(gdir, a, 'package.json')))
      .sort();
    return { dir, slug: slug(dir), title: meta.title || titleCase(dir), tag: meta.tag || '', land: meta.orientation === 'landscape', ads };
  })
  .filter((g) => g.ads.length)
  .sort((a, b) => a.title.localeCompare(b.title));

console.log(`node ${process.version}`);
games.forEach((g) => console.log(`  ${g.title}: ${g.ads.join(', ')}`));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// ── build each ad ──
for (const g of games) {
  g.built = [];
  for (const ad of g.ads) {
    const dir = path.join(root, g.dir, ad);
    console.log(`\n▶ ${g.dir}/${ad}`);
    const PATH = [path.join(dir, 'node_modules', '.bin'), process.env.PATH].join(path.delimiter);
    const run = (cmd, env) => {
      console.log(`$ ${cmd}`);
      execSync(cmd, { cwd: dir, stdio: 'inherit', env: { ...process.env, PATH, ...env } });
    };
    if (!existsSync(path.join(dir, 'node_modules', '.bin', 'vite'))) {
      // build tools are devDependencies; Vercel's NODE_ENV=production would skip them
      const flags = '--include=dev --no-audit --no-fund';
      const dev = { NODE_ENV: 'development' };
      try {
        run(existsSync(path.join(dir, 'package-lock.json')) ? `npm ci ${flags}` : `npm install ${flags}`, dev);
      } catch {
        console.warn('npm ci failed (lockfile from another OS?) — retrying with npm install');
        run(`npm install ${flags}`, dev);
      }
    }
    run('npm run build', { NODE_ENV: 'production' });

    const html = path.join(dir, 'dist', 'index.html');
    if (!existsSync(html)) throw new Error(`${g.dir}/${ad}: dist/index.html not found`);
    const dest = path.join(outDir, g.slug, slug(ad));
    cpSync(path.join(dir, 'dist'), dest, { recursive: true });
    const title = (readFileSync(html, 'utf8').match(/<title>([^<]*)<\/title>/) || [])[1] || `${g.title} — ${ad}`;
    g.built.push({ ad, slug: slug(ad), title, kb: Math.round(statSync(html).size / 1024) });
  }
}

// ── pages ──
const css = `
  :root { --bg:#0c0a14; --panel:#16121f; --line:#2b2340; --text:#f1ecff; --muted:#9a90b5; --accent:#ffcf4a; --accent2:#ff5fa2; }
  * { box-sizing: border-box; margin: 0; }
  body { background: radial-gradient(1200px 600px at 50% -200px, #2a1846 0%, var(--bg) 60%); color: var(--text); min-height: 100vh;
         font: 15px/1.5 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 40px 16px 72px; }
  a { color: inherit; }
  .wrap { max-width: 1120px; margin: 0 auto; }
  header { margin-bottom: 32px; }
  .crumb { color: var(--muted); font-size: 14px; text-decoration: none; display: inline-block; margin-bottom: 14px; }
  .crumb:hover { color: var(--text); }
  h1 { font-size: clamp(28px, 5vw, 44px); line-height: 1.1; letter-spacing: -0.5px; }
  h1 span { background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  header p { color: var(--muted); margin-top: 8px; }
  .grid { display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .card { display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 18px; overflow: hidden;
          text-decoration: none; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
  .card:hover { transform: translateY(-4px); border-color: #4a3b6e; box-shadow: 0 16px 40px rgba(0,0,0,.45); }
  .shot { aspect-ratio: 9 / 16; background: #000; position: relative; overflow: hidden; }
  .shot.land { aspect-ratio: 16 / 9; }
  .shot iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none; }
  .meta { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 4px; }
  .meta strong { font-size: 17px; }
  .meta span { color: var(--muted); font-size: 13px; }
  .tag { position: absolute; top: 10px; left: 10px; background: rgba(12,10,20,.75); backdrop-filter: blur(6px); border: 1px solid var(--line);
         color: var(--accent); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; letter-spacing: .4px; z-index: 1; }
  .actions { display: flex; gap: 8px; margin-top: 10px; }
  .btn { flex: 1; text-align: center; text-decoration: none; padding: 9px 10px; border-radius: 10px; font-weight: 600; font-size: 14px;
         background: #241d35; border: 1px solid var(--line); }
  .btn.primary { background: linear-gradient(90deg, var(--accent), var(--accent2)); color: #1b0f22; border: 0; }
  .btn:hover { filter: brightness(1.1); }
  footer { margin-top: 56px; color: var(--muted); font-size: 13px; text-align: center; }
  @media (max-width: 520px) { .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } .meta { padding: 10px 12px 12px; } .actions { flex-direction: column; } }
`;

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body><div class="wrap">${body}
<footer>Playable ads · tap any card to play it full screen</footer>
</div></body>
</html>
`;

const total = games.reduce((n, g) => n + g.built.length, 0);

// home
writeFileSync(
  path.join(outDir, 'index.html'),
  page(
    'Playable Ads',
    `
<header>
  <h1><span>Playable</span> Ads</h1>
  <p>${games.length} game${games.length === 1 ? '' : 's'} · ${total} playable${total === 1 ? '' : 's'}</p>
</header>
<main class="grid">${games
      .map(
        (g) => `
  <a class="card" href="./${g.slug}/index.html">
    <div class="shot${g.land ? ' land' : ''}">${g.tag ? `<div class="tag">${esc(g.tag)}</div>` : ''}<iframe src="./${g.slug}/${g.built[0].slug}/index.html" loading="lazy" tabindex="-1" title="${esc(g.title)}"></iframe></div>
    <div class="meta"><strong>${esc(g.title)}</strong><span>${g.built.length} playable${g.built.length === 1 ? '' : 's'}</span></div>
  </a>`,
      )
      .join('')}
</main>`,
  ),
);

// one page per game
for (const g of games) {
  writeFileSync(
    path.join(outDir, g.slug, 'index.html'),
    page(
      `${g.title} — Playable Ads`,
      `
<header>
  <a class="crumb" href="../index.html">← All games</a>
  <h1>${esc(g.title)}</h1>
  <p>${g.built.length} playable${g.built.length === 1 ? '' : 's'}</p>
</header>
<main class="grid">${g.built
        .map(
          (a) => `
  <div class="card">
    <a class="shot${g.land ? ' land' : ''}" href="./${a.slug}/index.html"><iframe src="./${a.slug}/index.html" loading="lazy" tabindex="-1" title="${esc(a.title)}"></iframe></a>
    <div class="meta">
      <strong>${esc(a.ad.toUpperCase())}</strong>
      <span>${esc(a.title)} · ${a.kb} KB</span>
      <div class="actions">
        <a class="btn primary" href="./${a.slug}/index.html">Play</a>
        <a class="btn" href="./${a.slug}/index.html" download="${g.slug}-${a.slug}.html">Download</a>
      </div>
    </div>
  </div>`,
        )
        .join('')}
</main>`,
    ),
  );
}

console.log(`\n✓ ${total} playable(s) from ${games.length} game(s) → public/`);
