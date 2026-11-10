# VegaSlot art drop zone

Put playable assets here, then run:

```bash
npm run assets
```

Files currently wired in code (`src/scenes/PreloadScene.js`):

- `background.webp` — full portrait background
- `symbol-*.webp` — reel symbols (bull, fox, lion = wild, panda, tiger, wolf)
- `btn-spin.webp` — SPIN button
- `btn-cta.webp` — PLAY FULL GAME button (also used on the end card)
- `btn-minus.webp`, `btn-plus.webp` — bet buttons
- `panel-balance.webp`, `panel-bet.webp` — HUD panels (label baked in, value drawn in code)
- `bar-track.webp`, `bar-fill.webp` — jackpot meter + hold-for-power bar
- `reel-panel.webp`, `spin-button.webp` — older art, not used right now

Prefer **WebP**. Symbols are 76×76 today but shown at ~140 px — 256×256 versions would look much sharper.
Keep the total playable under ~2 MB if you want it to pass Meta's limit (5 MB elsewhere).
