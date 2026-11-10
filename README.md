# Playable Ads

All playable ads, one folder per game and one sub-folder per ad (Phaser 3 + Vite, built to a single `index.html`).

```
vegaslot/ad-01
soccer all stars/ad-01
gumdrop-legion/ad-01      ← sample game, all art generated in code
```

## Work on an ad

```bash
cd vegaslot/ad-01
npm install
npm run dev          # local dev server
npm run dev:mobile   # reachable from a phone on the same Wi-Fi
npm run build        # → dist/index.html (upload this to ad networks)
```

## Showcase site

```bash
npm run build              # builds every ad + pages into public/
npm run build -- vegaslot  # only folders matching "vegaslot"
```

- `/` — all games
- `/<game>/` — that game's ads (play or download each one)
- `/<game>/<ad>/` — the playable full screen

Folder names become URLs (`soccer all stars` → `/soccer-all-stars/`). A `game.json` in a game folder can set a display
title and tag: `{ "title": "VegaSlot", "tag": "New" }`.

**Add an ad:** copy an ad folder (e.g. `vegaslot/ad-01` → `vegaslot/ad-02`) and push. **Add a game:** new top-level folder
with an `ad-01` inside. Both show up on the site automatically.

## Deploy

Import the repo in Vercel and leave every setting at its default — `vercel.json` sets the build and output.
Root Directory must stay empty (repo root).
