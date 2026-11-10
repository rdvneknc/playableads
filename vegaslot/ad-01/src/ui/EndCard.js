import Phaser from 'phaser';
import { FONT, FONT_UI, COLORS, GAME_WIDTH as W, GAME_HEIGHT as H, AD } from '../config.js';
import { openStore } from '../ad/cta.js';
import { sfx } from '../audio/Sfx.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function goldText(scene, x, y, str, size, colors = ['#fff6cf', '#ffd24a', '#c47a12']) {
  const t = scene.add
    .text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: '#ffd56a',
      stroke: '#2a1405',
      strokeThickness: Math.round(size * 0.13),
      padding: { x: 8, y: 8 },
    })
    .setOrigin(0.5);
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0.2, colors[0]);
  g.addColorStop(0.55, colors[1]);
  g.addColorStop(0.9, colors[2]);
  t.setFill(g);
  t.setShadow(0, 5, '#000000', 10, true, false);
  return t;
}

export class EndCard {
  constructor(scene, { won = true, total = 0, onReplay } = {}) {
    this.scene = scene;
    const root = (this.root = scene.add.container(0, 0).setDepth(500));
    const cx = W / 2;

    const dim = scene.add.rectangle(cx, H / 2, W, H, 0x05020f, 0.86).setInteractive();
    dim.on('pointerdown', () => openStore());

    const rays = scene.add.image(cx, H * 0.44, 'rays').setScale(2.6).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });

    // Panel
    const pw = 600;
    const ph = 720;
    const px = cx - pw / 2;
    const py = H * 0.44 - ph / 2;
    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(px + 8, py + 14, pw, ph, 34);
    panel.fillStyle(0x24103f, 1);
    panel.fillRoundedRect(px, py, pw, ph, 34);
    panel.fillStyle(0x3a1a66, 0.6);
    panel.fillRoundedRect(px + 10, py + 10, pw - 20, ph * 0.42, 26);
    panel.lineStyle(10, COLORS.goldDeep, 1);
    panel.strokeRoundedRect(px + 3, py + 3, pw - 6, ph - 6, 32);
    panel.lineStyle(3, COLORS.gold, 1);
    panel.strokeRoundedRect(px + 12, py + 12, pw - 24, ph - 24, 26);
    panel.lineStyle(2, COLORS.magenta, 0.55);
    panel.strokeRoundedRect(px + 20, py + 20, pw - 40, ph - 40, 22);

    // Logo plate overlapping the top edge
    const plate = scene.add.graphics();
    plate.fillStyle(0x0a0418, 1);
    plate.fillRoundedRect(cx - 200, py - 44, 400, 88, 22);
    plate.lineStyle(4, COLORS.gold, 1);
    plate.strokeRoundedRect(cx - 200, py - 44, 400, 88, 22);
    plate.lineStyle(1.5, COLORS.cyan, 0.5);
    plate.strokeRoundedRect(cx - 190, py - 34, 380, 68, 16);
    const logo = goldText(scene, cx, py, 'VEGASLOT', 52);

    const title = goldText(scene, cx, py + 120, won ? 'YOU WON BIG!' : 'SPIN & WIN!', 64);
    const label = scene.add
      .text(cx, py + 200, 'YOUR BALANCE', { fontFamily: FONT_UI, fontSize: '22px', color: '#d6c6ff', letterSpacing: 3 })
      .setOrigin(0.5);
    const coin = scene.add.image(0, py + 262, 'coin').setScale(1.05);
    const amount = goldText(scene, 0, py + 262, fmt(total), 64, ['#ffffff', '#ffe58a', '#ffb02e']);
    const gap = 14;
    const totalW = coin.displayWidth + gap + amount.width;
    coin.x = cx - totalW / 2 + coin.displayWidth / 2;
    amount.x = coin.x + coin.displayWidth / 2 + gap + amount.width / 2;

    // Symbol showcase
    const syms = ['sym-fox', 'sym-lion', 'sym-tiger'].map((k, i) => {
      const x = cx + (i - 1) * 150;
      const y = py + 400;
      const frame = scene.add.graphics();
      frame.fillStyle(0x0a0418, 1);
      frame.fillRoundedRect(x - 64, y - 64, 128, 128, 22);
      frame.lineStyle(3, i === 1 ? COLORS.gold : COLORS.goldDeep, 1);
      frame.strokeRoundedRect(x - 64, y - 64, 128, 128, 22);
      const img = scene.add.image(x, y, k).setDisplaySize(118, 118);
      img.baseScale = img.scaleX;
      scene.tweens.add({ targets: img, y: y - 8, duration: 700, delay: i * 140, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      return [frame, img];
    });

    // CTA
    const cta = scene.add.image(cx, py + 555, 'btn-cta');
    cta.baseScale = 480 / cta.width;
    cta.setScale(cta.baseScale).setInteractive({ useHandCursor: true });
    cta.on('pointerdown', () => {
      sfx.click();
      openStore();
    });
    scene.tweens.add({ targets: cta, scale: cta.baseScale * 1.07, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const replay = scene.add
      .text(cx, py + ph - 52, 'SPIN AGAIN', { fontFamily: FONT_UI, fontSize: '22px', color: '#9fdfff', letterSpacing: 2 })
      .setOrigin(0.5)
      .setPadding(18, 10, 18, 10)
      .setInteractive({ useHandCursor: true });
    replay.on('pointerdown', (pointer, x, y, event) => {
      event.stopPropagation();
      sfx.click();
      onReplay?.();
    });

    const disclaimer = scene.add
      .text(cx, H - 40, AD.disclaimer, { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#bfaee0' })
      .setOrigin(0.5)
      .setAlpha(0.75);

    root.add([dim, rays, panel, plate, logo, title, label, coin, amount, ...syms.flat(), cta, replay, disclaimer]);

    // Entrance
    root.setAlpha(0);
    scene.tweens.add({ targets: root, alpha: 1, duration: 300 });
    const pop = [plate, logo, title, label, coin, amount, ...syms.flat(), cta, replay];
    pop.forEach((o, i) => {
      const fy = o.y;
      o.setAlpha(0);
      o.y = fy + 30;
      scene.tweens.add({ targets: o, alpha: 1, y: fy, duration: 380, delay: 120 + i * 35, ease: 'Back.Out' });
    });
    scene.time.delayedCall(700, () => scene.addGlint?.(cta, 2200, 0, 501));

    this.coinShower(rays);
  }

  coinShower(after) {
    const p = this.scene.add
      .particles(0, -40, 'coin', {
        x: { min: 0, max: W },
        speedY: { min: 250, max: 520 },
        rotate: { min: -360, max: 360 },
        scale: { min: 0.45, max: 0.8 },
        lifespan: 2800,
        frequency: 70,
      });
    // Behind the panel, in front of the rays
    this.root.addAt(p, this.root.getIndex(after) + 1);
    this.scene.time.delayedCall(1600, () => p.stop());
  }

  destroy() {
    this.root.destroy(true);
  }
}
