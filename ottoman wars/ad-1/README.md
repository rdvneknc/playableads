# Ottoman Wars — Playable Ad 1

Turn-based placement battle: pick soldiers with a 100-gold budget, place them on your side, then fight round by round
until the enemy castle falls.

```bash
npm install
npm run dev          # http://localhost:5176
npm run dev:mobile   # reachable from a phone on the same Wi-Fi
npm run build        # → dist/index.html
```

- Unit art: `src/assets/*.webp` (one image per soldier, facing right). The enemy version is generated in code.
- Stats, prices, budget, enemy line-up and all texts (Turkish): `src/config.js`.
- To add a soldier: drop its image in `src/assets`, load it in `src/scenes/BootScene.js`, add it to `UNITS` in
  `config.js` and to the card list in `src/scenes/GameScene.js` / `src/art/Textures.js`.
