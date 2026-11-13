import * as THREE from './vendor/three.module.min.js';
import { Game } from './game/Game.js';
import { Hud } from './ui/Hud.js';
import { sfx } from './audio/Sfx.js';
import { openStore, notifyGameEnd } from './ad/cta.js';
import { startWhenReady, onPauseChange, onVolumeChange, notifyGameReady, allowRotation } from './ad/lifecycle.js';
import titleFontUrl from './assets/title.woff';
import uiFontUrl from './assets/ui.woff';

let renderer = null;
let game = null;
let hud = null;
let paused = false;
let last = 0;

async function loadFonts() {
  if (!('FontFace' in window)) return;
  const load = async (name, url) => {
    try {
      const f = new FontFace(name, `url(${url}) format('woff')`);
      await Promise.race([f.load(), new Promise((r) => setTimeout(r, 1500))]);
      document.fonts.add(f);
    } catch {
      /* system fallback */
    }
  };
  await Promise.all([load('OWTitle', titleFontUrl), load('OWUi', uiFontUrl)]);
}

function size() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  // cap the backbuffer so big phones/tablets stay smooth
  const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2400000 / (w * h)));
  renderer.setPixelRatio(Math.max(1, dpr));
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = `${w}px`;
  renderer.domElement.style.height = `${h}px`;
  game?.resize(w, h);
}

function refresh() {
  if (!renderer) return;
  size();
  requestAnimationFrame(size);
  setTimeout(size, 150);
  setTimeout(size, 450);
}

function loop(t) {
  requestAnimationFrame(loop);
  if (paused) {
    last = t;
    return;
  }
  const dt = last ? (t - last) / 1000 : 1 / 60;
  last = t;
  game.update(dt);
  game.render();
}

// Floating joystick: touch anywhere, drag to walk.
function setupInput(el) {
  const R = 58;
  let id = null;
  let ox = 0;
  let oy = 0;
  const move = (x, y) => {
    let dx = x - ox;
    let dy = y - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    const m = Math.min(1, d / R);
    game.setInput(m > 0.12 ? (dx / R) : 0, m > 0.12 ? (dy / R) : 0);
    hud.joystick(true, ox, oy, dx, dy);
  };
  el.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    game.press();
    if (id !== null) return;
    id = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    move(ox, oy);
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId === id) move(e.clientX, e.clientY);
  });
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    game.setInput(0, 0);
    hud.joystick(false);
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

startWhenReady(async () => {
  await loadFonts();
  const canvas = document.getElementById('scene');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  hud = new Hud(document.getElementById('hud'), { onCta: () => openStore() });
  game = new Game(renderer, hud, {
    onEnd: (win) => {
      notifyGameEnd();
      hud.endCard(win, () => game.reset());
    },
  });
  if (import.meta.env.DEV) window.__game = game;
  size();
  setupInput(canvas);
  requestAnimationFrame(loop);
  notifyGameReady();
  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
  window.visualViewport?.addEventListener('resize', refresh);
  allowRotation(refresh);
  document.getElementById('boot')?.remove();
});

onPauseChange((p) => {
  paused = p;
  if (p) sfx.suspend();
  else sfx.resume();
});

onVolumeChange((muted) => sfx.setMuted(muted));
