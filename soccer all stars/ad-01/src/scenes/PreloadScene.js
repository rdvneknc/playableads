import Phaser from 'phaser';
import playerBlueUrl from '../assets/player-blue.webp';
import playerRedUrl from '../assets/player-red.webp';
import ballUrl from '../assets/ball.webp';
import scoreboardUrl from '../assets/scoreboard-ui.webp';
import grassUrl from '../assets/grass-background.webp';
import btnShootUrl from '../assets/button-shoot.webp';
import btnDashUrl from '../assets/button-dash.webp';
import btnShoulderUrl from '../assets/button-shoulder.webp';

// Loads bitmap assets (inlined by Vite) and generates small FX textures.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width, height } = this.scale;
    const barBg = this.add.rectangle(width / 2, height / 2, 320, 24, 0x0d2818, 0.9);
    const bar = this.add.rectangle(barBg.x - 150, barBg.y, 0, 16, 0x5cff9a).setOrigin(0, 0.5);
    this.load.on('progress', (value) => {
      bar.width = 300 * value;
    });

    this.load.image('player', playerBlueUrl);
    this.load.image('opponent', playerRedUrl);
    this.load.image('ball', ballUrl);
    this.load.image('scoreboard', scoreboardUrl);
    this.load.image('grass', grassUrl);
    this.load.image('btn-shoot', btnShootUrl);
    this.load.image('btn-super', btnDashUrl);
    this.load.image('btn-shoulder', btnShoulderUrl);
  }

  create() {
    this.createFlameTexture();
    this.createGlowTexture();
    this.createConfettiTexture();
    this.scene.start('Intro');
  }

  createFlameTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 5);
    g.generateTexture('flame', 16, 16);
    g.destroy();
  }

  createGlowTexture() {
    const size = 96;
    const tex = this.textures.createCanvas('glow', size, size);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,230,120,0.95)');
    grad.addColorStop(0.35, 'rgba(255,140,30,0.6)');
    grad.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  createConfettiTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 10, 6);
    g.generateTexture('confetti', 10, 6);
    g.destroy();
  }
}
