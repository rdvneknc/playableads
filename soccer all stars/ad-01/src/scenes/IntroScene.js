import Phaser from 'phaser';
import { FONT, COLORS } from '../config.js';
import { gradText, pillButton } from '../ui/Skin.js';
import { sfx } from '../audio/Sfx.js';

// Playable-ad intro: who you play, what wins, and the four controls — then one big PLAY.
// Starts by itself after a few seconds so the ad never stalls.
const AUTO_START_MS = 9000;

const CONTROLS = [
  { key: null, title: 'MOVE', line: 'Drag on the left\nto run', color: 0x5cff9a },
  { key: 'btn-shoot', title: 'SHOOT', line: 'Fire at the\ngoal', color: 0x4de0ff },
  { key: 'btn-super', title: 'DASH', line: 'Quick burst\nof speed', color: 0x7adfff },
  { key: 'btn-shoulder', title: 'BUMP', line: 'Shoulder the bot,\nsteal the ball', color: 0xffd23f },
];

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.leaving = false;

    this.add.image(cx, height / 2, 'grass').setDisplaySize(width, height);
    this.add.rectangle(cx, height / 2, width, height, 0x050b1c, 0.72);
    const glow = this.add.graphics();
    for (let i = 6; i > 0; i--) {
      glow.fillStyle(0x2a7bff, 0.03);
      glow.fillEllipse(cx, height / 2, 600 + i * 130, 300 + i * 70);
    }

    // ── title + match-up ──
    const title = gradText(this, cx, 78, 'SOCCER ALL STARS', 58);
    const tag = this.add
      .text(cx, 128, '1 vs 1  ·  30 SECONDS  ·  MOST GOALS WINS', { fontFamily: FONT, fontSize: '19px', color: '#bfe3ff', letterSpacing: 2 })
      .setOrigin(0.5);

    const badge = (x, key, color, name) => {
      const c = this.add.container(x, 222);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35);
      g.fillCircle(3, 5, 48);
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, 48);
      g.fillStyle(0x0a1530, 1);
      g.fillCircle(0, 0, 40);
      const img = this.add.image(0, 2, key);
      img.setScale(72 / Math.max(img.width, img.height));
      const label = this.add
        .text(0, 64, name, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5);
      c.add([g, img, label]);
      return c;
    };
    const you = badge(cx - 150, 'player', COLORS.goalBlue, 'YOU');
    const bot = badge(cx + 150, 'opponent', COLORS.goalRed, 'BOT');
    const vs = gradText(this, cx, 222, 'VS', 46, ['#ffffff', '#ffe1dc', '#ff8a7a'], '#3a0606');

    // ── control cards ──
    const cardW = 210;
    const cardH = 200;
    const gap = 22;
    const y = 446;
    const x0 = cx - ((cardW + gap) * CONTROLS.length - gap) / 2 + cardW / 2;
    const cards = CONTROLS.map((c, i) => this.card(x0 + i * (cardW + gap), y, cardW, cardH, c));

    const cta = pillButton(this, cx, 640, 'TAP TO PLAY', {
      w: 330,
      h: 74,
      size: 34,
      colors: { from: '#ffe35a', to: '#ff9a1f', edge: '#9a4a00' },
      onTap: () => this.go(),
    });

    // ── entrance ──
    title.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: 'Back.Out' });
    tag.setAlpha(0);
    this.tweens.add({ targets: tag, alpha: 1, duration: 400, delay: 250 });
    you.x -= 220;
    bot.x += 220;
    you.setAlpha(0);
    bot.setAlpha(0);
    this.tweens.add({ targets: you, x: cx - 150, alpha: 1, duration: 450, ease: 'Back.Out', delay: 300 });
    this.tweens.add({ targets: bot, x: cx + 150, alpha: 1, duration: 450, ease: 'Back.Out', delay: 300 });
    vs.setScale(0);
    this.tweens.add({ targets: vs, scale: 1, duration: 380, ease: 'Back.Out', delay: 620 });
    cards.forEach((c, i) => {
      c.y += 60;
      c.setAlpha(0);
      this.tweens.add({ targets: c, y: y, alpha: 1, duration: 420, ease: 'Back.Out', delay: 800 + i * 160 });
    });
    cta.setScale(0);
    this.tweens.add({
      targets: cta,
      scale: 1,
      duration: 420,
      ease: 'Back.Out',
      delay: 1500,
      onComplete: () => {
        this.tweens.add({ targets: cta, scale: 1.07, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        cta.sweep();
        this.time.addEvent({ delay: 1800, loop: true, callback: () => cta.sweep() });
      },
    });

    // tapping anywhere (after the cards are in) starts too
    this.time.delayedCall(1200, () => this.input.once('pointerdown', () => this.go()));
    this.time.delayedCall(AUTO_START_MS, () => this.go());
  }

  card(x, y, w, h, c) {
    const root = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 7, w, h, 22);
    bg.fillStyle(0x0d1d3a, 0.96);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.fillStyle(0xffffff, 0.06);
    bg.fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h * 0.42, 16);
    bg.lineStyle(3, c.color, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    root.add(bg);

    const iy = -h / 2 + 62;
    if (c.key) {
      const icon = this.add.image(0, iy, c.key);
      icon.setScale(84 / Math.max(icon.width, icon.height));
      root.add(icon);
      // a finger tapping the button
      const tap = this.add.circle(0, iy, 46, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 0.9);
      root.add(tap);
      this.tweens.add({ targets: tap, scale: { from: 0.7, to: 1.25 }, alpha: { from: 1, to: 0 }, duration: 900, repeat: -1, delay: Math.random() * 600 });
    } else {
      // mini joystick with a knob that wanders
      const base = this.add.circle(0, iy, 40, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.6);
      const knob = this.add.circle(0, iy, 18, 0xff8a3d, 1).setStrokeStyle(3, 0xffffff, 0.9);
      root.add([base, knob]);
      this.tweens.add({ targets: knob, x: { from: -20, to: 20 }, y: { from: iy + 12, to: iy - 14 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    const hex = `#${c.color.toString(16).padStart(6, '0')}`;
    const t = this.add
      .text(0, 22, c.title, { fontFamily: FONT, fontSize: '26px', color: hex, stroke: '#061024', strokeThickness: 6 })
      .setOrigin(0.5);
    const l = this.add
      .text(0, 66, c.line, { fontFamily: 'Arial, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#d6e9ff', align: 'center', lineSpacing: 2 })
      .setOrigin(0.5);
    root.add([t, l]);
    return root;
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    sfx.unlock();
    this.cameras.main.fadeOut(260, 5, 11, 28);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }
}
