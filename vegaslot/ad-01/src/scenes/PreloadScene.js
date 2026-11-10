import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH, GAME_HEIGHT, SLOT } from '../config.js';
import bgUrl from '../assets/background.webp';
import bullUrl from '../assets/symbol-bull.webp';
import foxUrl from '../assets/symbol-fox.webp';
import lionUrl from '../assets/symbol-lion.webp';
import pandaUrl from '../assets/symbol-panda.webp';
import tigerUrl from '../assets/symbol-tiger.webp';
import wolfUrl from '../assets/symbol-wolf.webp';
import spinUrl from '../assets/btn-spin.webp';
import ctaUrl from '../assets/btn-cta.webp';
import minusUrl from '../assets/btn-minus.webp';
import plusUrl from '../assets/btn-plus.webp';
import panelBalanceUrl from '../assets/panel-balance.webp';
import panelBetUrl from '../assets/panel-bet.webp';
import barTrackUrl from '../assets/bar-track.webp';
import barFillUrl from '../assets/bar-fill.webp';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add
      .text(cx, cy - 30, 'VEGASLOT', { fontFamily: FONT, fontSize: '54px', color: '#ffd56a', stroke: '#2a1405', strokeThickness: 8 })
      .setOrigin(0.5);
    this.add.rectangle(cx, cy + 40, 320, 14, 0x1a0f33, 1).setStrokeStyle(2, COLORS.goldDeep, 0.9);
    const bar = this.add.rectangle(cx - 156, cy + 40, 0, 8, COLORS.gold).setOrigin(0, 0.5);
    this.load.on('progress', (v) => (bar.width = 312 * v));

    const images = {
      bg: bgUrl,
      'sym-bull': bullUrl,
      'sym-fox': foxUrl,
      'sym-lion': lionUrl,
      'sym-panda': pandaUrl,
      'sym-tiger': tigerUrl,
      'sym-wolf': wolfUrl,
      'btn-spin': spinUrl,
      'btn-cta': ctaUrl,
      'btn-minus': minusUrl,
      'btn-plus': plusUrl,
      'panel-balance': panelBalanceUrl,
      'panel-bet': panelBetUrl,
      'bar-track': barTrackUrl,
      'bar-fill': barFillUrl,
    };
    Object.entries(images).forEach(([k, url]) => this.load.image(k, url));
  }

  create() {
    this.makeFxTextures();
    SLOT.symbolKeys.forEach((k) => this.makeMotionBlur(k));
    ['btn-spin', 'btn-cta'].forEach((k) => this.makeShine(k));
    this.scene.start('Game');
  }

  canvasTex(key, w, h, draw) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
  }

  // Vertical motion-blurred copy of each symbol, swapped in while reels run fast.
  makeMotionBlur(key) {
    const src = this.textures.get(key).getSourceImage();
    const w = src.width;
    const h = src.height;
    this.canvasTex(`${key}_blur`, w, h, (ctx) => {
      const taps = 9;
      const spread = h * 0.22;
      for (let i = 0; i < taps; i++) {
        const o = (i / (taps - 1) - 0.5) * spread;
        ctx.globalAlpha = 1 / (i + 1.6);
        ctx.drawImage(src, 0, o, w, h);
      }
      ctx.globalAlpha = 1;
    });
  }

  // Pre-rendered light sweep frames, clipped to the button's own alpha.
  // (Much cheaper at runtime than a WebGL bitmap mask.)
  makeShine(key, frames = 16) {
    const src = this.textures.get(key).getSourceImage();
    const w = src.width;
    const h = src.height;
    const tex = this.textures.createCanvas(`${key}_shine`, w * frames, h);
    const ctx = tex.getContext();
    for (let f = 0; f < frames; f++) {
      const ox = f * w;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, 0, w, h);
      ctx.clip();
      const bandX = ox - w * 0.25 + (w * 1.5 * f) / (frames - 1);
      const g = ctx.createLinearGradient(bandX - h * 0.6, 0, bandX + h * 0.6, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.setTransform(1, 0, -0.35, 1, h * 0.35 * 0.5, 0);
      ctx.fillRect(bandX - h * 0.6, 0, h * 1.2, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(src, ox, 0, w, h);
      ctx.restore();
      tex.add(f, 0, ox, 0, w, h);
    }
    tex.refresh();
  }

  makeFxTextures() {
    this.canvasTex('particle', 16, 16, (ctx) => {
      const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 16);
    });

    this.canvasTex('glow', 128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });

    this.canvasTex('sparkle', 48, 48, (ctx) => {
      ctx.translate(24, 24);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(3, -3, 24, 0);
        ctx.quadraticCurveTo(3, 3, 0, 24);
        ctx.quadraticCurveTo(-3, 3, -24, 0);
        ctx.quadraticCurveTo(-3, -3, 0, -24);
        ctx.fill();
        ctx.rotate(Math.PI / 4);
        ctx.scale(0.55, 0.55);
      }
    });

    this.canvasTex('coin', 56, 56, (ctx) => {
      const g = ctx.createRadialGradient(22, 18, 4, 28, 28, 28);
      g.addColorStop(0, '#fff6c2');
      g.addColorStop(0.45, '#ffd24a');
      g.addColorStop(1, '#b77712');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(28, 28, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#8a5508';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(28, 28, 18, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(138,85,8,0.65)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(138,85,8,0.8)';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('V', 28, 29);
    });

    // Casino chip for the BET panel
    this.canvasTex('chip', 64, 64, (ctx) => {
      ctx.translate(32, 32);
      ctx.fillStyle = '#0d6f86';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i / 8) * Math.PI * 2);
        ctx.fillRect(-5, -30, 10, 10);
        ctx.restore();
      }
      const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 20);
      g.addColorStop(0, '#8ff6ff');
      g.addColorStop(1, '#16a9c7');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    });

    this.canvasTex('rays', 512, 512, (ctx) => {
      ctx.translate(256, 256);
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 256);
        g.addColorStop(0, 'rgba(255,230,140,0.55)');
        g.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 256, a, a + Math.PI / n);
        ctx.closePath();
        ctx.fill();
      }
    });
  }
}
