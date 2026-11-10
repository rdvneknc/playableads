import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { GameScene } from './scenes/GameScene.js';
import { startWhenReady, onPauseChange, onVolumeChange, notifyGameReady } from './ad/lifecycle.js';
import { sfx } from './audio/Sfx.js';
import fontUrl from './assets/font-display.woff';
import bgUrl from './assets/background.webp';

let game = null;

// Blurred backdrop fills the letterbox on tablets / landscape instead of flat black.
function paintBackdrop() {
  const el = document.getElementById('backdrop');
  if (el) el.style.backgroundImage = `url(${bgUrl})`;
}

async function loadFont() {
  if (!('FontFace' in window)) return;
  try {
    const face = new FontFace('VSDisplay', `url(${fontUrl}) format('woff')`);
    await Promise.race([face.load(), new Promise((r) => setTimeout(r, 1500))]);
    document.fonts.add(face);
  } catch {
    /* fall back to system fonts */
  }
}

function refreshScale() {
  if (!game) return;
  requestAnimationFrame(() => {
    game.scale.refresh();
    setTimeout(() => game.scale.refresh(), 150);
  });
}

startWhenReady(async () => {
  paintBackdrop();
  await loadFont();

  game = window.__vegaslot = new Phaser.Game({
    // ?canvas forces the Canvas renderer (handy for testing low-end devices)
    type: /[?&]canvas\b/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: COLORS.bg,
    transparent: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      expandParent: true,
    },
    audio: { noAudio: true }, // all SFX are our own WebAudio
    input: { activePointers: 2 },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    fps: { smoothStep: true },
    banner: false,
    scene: [BootScene, PreloadScene, GameScene],
  });

  notifyGameReady();
  window.addEventListener('orientationchange', refreshScale);
  window.addEventListener('resize', refreshScale);
  window.visualViewport?.addEventListener('resize', refreshScale);
});

onPauseChange((paused) => {
  if (!game) return;
  if (paused) {
    game.loop.sleep();
    sfx.suspend();
  } else {
    game.loop.wake();
    sfx.resume();
  }
});

onVolumeChange((muted) => sfx.setMuted(muted));
