import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#4db352',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    expandParent: true,
    resizeInterval: 250,
  },
  input: { activePointers: 4 },
  render: { antialias: true, roundPixels: false },
  fps: { smoothStep: true },
  scene: [PreloadScene, IntroScene, GameScene, UIScene],
});

function refreshScale() {
  // iOS/Android need a beat after orientationchange before sizes settle
  requestAnimationFrame(() => {
    game.scale.refresh();
    setTimeout(() => game.scale.refresh(), 120);
    setTimeout(() => game.scale.refresh(), 400);
  });
}

window.addEventListener('orientationchange', refreshScale);
window.addEventListener('resize', refreshScale);
window.visualViewport?.addEventListener('resize', refreshScale);
window.visualViewport?.addEventListener('scroll', refreshScale);

if (import.meta.env.DEV) window.__game = game;
