# Gumdrop Legion — Playable Ad 01

Sample crowd-runner playable. Every visual and sound is generated in code (no image files),
and the "3D" road is a pseudo-3D projection in Phaser (`src/world/World.js`).

```bash
npm install
npm run dev          # http://localhost:5175
npm run dev:mobile   # reachable from a phone on the same Wi-Fi
npm run build        # → dist/index.html
```

Tuning lives in `src/config.js`: gate values, enemy army size, boss HP, speed, camera.
