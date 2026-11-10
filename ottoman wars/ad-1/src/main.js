import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { startWhenReady, onPauseChange, onVolumeChange, notifyGameReady } from './ad/lifecycle.js';
import { sfx } from './audio/Sfx.js';
import titleFontUrl from './assets/title.woff';
import uiFontUrl from './assets/ui.woff';

let game = null;


async function loadFonts() {
  if (!('FontFace' in window)) return;
  const load = async (name, url) => {
    try {
      const face = new FontFace(name, `url(${url}) format('woff')`);
      await Promise.race([face.load(), new Promise((r) => setTimeout(r, 1500))]);
      document.fonts.add(face);
    } catch {
      /* fall back to system fonts */
    }
  };
  await Promise.all([load('OWTitle', titleFontUrl), load('OWUi', uiFontUrl)]);
}

function refreshScale() {
  if (!game) return;
  requestAnimationFrame(() => {
    game.scale.refresh();
    setTimeout(() => game.scale.refresh(), 150);
  });
}

startWhenReady(async () => {
  await loadFonts();

  game = window.__ottoman = new Phaser.Game({
    // ?canvas forces the Canvas renderer (handy for testing low-end devices)
    type: /[?&]canvas\b/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1d140c',
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
    scene: [BootScene, GameScene],
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
