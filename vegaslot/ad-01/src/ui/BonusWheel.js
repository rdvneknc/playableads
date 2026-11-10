import Phaser from 'phaser';
import { FONT, FONT_UI, COLORS, GAME_WIDTH as W, GAME_HEIGHT as H } from '../config.js';
import { sfx } from '../audio/Sfx.js';

// Prize wheel mini-game. The player taps SPIN; the wheel always lands on the
// MEGA segment (scripted for the ad), then onWin(prize) fires.
const SEGMENTS = [
  { label: 'MEGA', value: 10000, color: '#ffcf3a', text: '#5a2600' },
  { label: '500', value: 500, color: '#7b1fd1', text: '#ffffff' },
  { label: 'x2', value: 0, color: '#ff2d9b', text: '#ffffff' },
  { label: '1,000', value: 1000, color: '#2b1060', text: '#ffd56a' },
  { label: '250', value: 250, color: '#19b6d6', text: '#ffffff' },
  { label: '2,500', value: 2500, color: '#7b1fd1', text: '#ffffff' },
  { label: 'x5', value: 0, color: '#ff2d9b', text: '#ffffff' },
  { label: '5,000', value: 5000, color: '#2b1060', text: '#ffd56a' },
];
const WIN_INDEX = 0;
const R = 250; // wheel radius in game px

function makeWheelTexture(scene) {
  if (scene.textures.exists('bonus-wheel')) return;
  const size = R * 2 + 8;
  const tex = scene.textures.createCanvas('bonus-wheel', size, size);
  const ctx = tex.getContext();
  const c = size / 2;
  const n = SEGMENTS.length;
  const seg = (Math.PI * 2) / n;
  ctx.translate(c, c);
  SEGMENTS.forEach((s, i) => {
    // segment i is centred on angle i*seg, with 0 pointing up
    const a0 = -Math.PI / 2 + i * seg - seg / 2;
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.08, s.color);
    g.addColorStop(1, s.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, a0, a0 + seg);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,106,0.9)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.rotate(i * seg);
    ctx.fillStyle = s.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const big = s.label === 'MEGA';
    ctx.font = `${big ? 46 : 40}px VSDisplay, "Arial Black", Arial, sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeText(s.label, 0, -R * 0.66);
    ctx.fillText(s.label, 0, -R * 0.66);
    ctx.restore();
  });
  // inner shading ring
  const shade = ctx.createRadialGradient(0, 0, R * 0.75, 0, 0, R);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

export class BonusWheel {
  constructor(scene, { onWin, autoSpinMs = 4500 } = {}) {
    this.scene = scene;
    this.onWin = onWin;
    this.spun = false;
    makeWheelTexture(scene);

    const cx = W / 2;
    const cy = H * 0.5;
    this.root = scene.add.container(0, 0).setDepth(450);

    const dim = scene.add.rectangle(cx, H / 2, W, H, 0x05020f, 0.82).setInteractive();
    dim.on('pointerdown', () => this.spin());
    const rays = scene.add.image(cx, cy, 'rays').setScale(2.6).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });

    const title = scene.add
      .text(cx, cy - R - 150, 'BONUS WHEEL', {
        fontFamily: FONT,
        fontSize: '72px',
        color: '#ffd56a',
        stroke: '#2a1405',
        strokeThickness: 10,
        padding: { x: 8, y: 8 },
      })
      .setOrigin(0.5);
    const grd = title.context.createLinearGradient(0, 0, 0, title.height);
    grd.addColorStop(0.2, '#fff6cf');
    grd.addColorStop(0.55, '#ffd24a');
    grd.addColorStop(0.9, '#c47a12');
    title.setFill(grd);
    title.setShadow(0, 6, '#000', 10, true, false);
    const sub = scene.add
      .text(cx, cy - R - 88, 'Jackpot meter full — spin for a MEGA prize!', {
        fontFamily: FONT_UI,
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#1a0a2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // Rim + bulbs
    const rim = scene.add.graphics();
    rim.fillStyle(0x000000, 0.5);
    rim.fillCircle(cx + 6, cy + 12, R + 34);
    rim.fillStyle(COLORS.goldDeep, 1);
    rim.fillCircle(cx, cy, R + 34);
    rim.fillStyle(0x3a1a66, 1);
    rim.fillCircle(cx, cy, R + 22);
    rim.lineStyle(4, COLORS.gold, 1);
    rim.strokeCircle(cx, cy, R + 32);
    rim.strokeCircle(cx, cy, R + 4);

    this.wheel = scene.add.image(cx, cy, 'bonus-wheel');
    this.bulbs = scene.add.graphics();
    this.bulbPhase = 0;
    this.drawBulbs = (lit) => {
      this.bulbs.clear();
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const on = (i + lit) % 2 === 0;
        const x = cx + Math.cos(a) * (R + 18);
        const y = cy + Math.sin(a) * (R + 18);
        this.bulbs.fillStyle(on ? 0xfff3b0 : 0x8a5a10, 1);
        this.bulbs.fillCircle(x, y, 6);
        if (on) {
          this.bulbs.fillStyle(0xffffff, 0.35);
          this.bulbs.fillCircle(x, y, 10);
        }
      }
    };
    this.drawBulbs(0);
    this.bulbTimer = scene.time.addEvent({ delay: 240, loop: true, callback: () => this.drawBulbs(++this.bulbPhase) });

    // Pointer at the top
    this.pointer = scene.add.container(cx, cy - R - 26);
    const pg = scene.add.graphics();
    pg.fillStyle(0x000000, 0.45);
    pg.fillTriangle(-26 + 3, -14 + 5, 26 + 3, -14 + 5, 3, 46 + 5);
    pg.fillStyle(COLORS.goldDeep, 1);
    pg.fillTriangle(-26, -14, 26, -14, 0, 46);
    pg.fillStyle(COLORS.gold, 1);
    pg.fillTriangle(-17, -9, 17, -9, 0, 34);
    pg.fillStyle(COLORS.magenta, 1);
    pg.fillCircle(0, -10, 12);
    pg.lineStyle(3, COLORS.gold, 1);
    pg.strokeCircle(0, -10, 12);
    this.pointer.add(pg);

    // Hub = SPIN button
    this.hub = scene.add.container(cx, cy);
    const hg = scene.add.graphics();
    hg.fillStyle(0x000000, 0.4);
    hg.fillCircle(3, 6, 70);
    hg.fillStyle(COLORS.goldDeep, 1);
    hg.fillCircle(0, 0, 70);
    hg.fillStyle(0x1f9a45, 1);
    hg.fillCircle(0, 0, 60);
    hg.fillStyle(0xffffff, 0.18);
    hg.fillEllipse(0, -24, 84, 34);
    const ht = scene.add
      .text(0, 2, 'SPIN', { fontFamily: FONT, fontSize: '36px', color: '#ffffff', stroke: '#0a4a1c', strokeThickness: 6 })
      .setOrigin(0.5);
    this.hub.add([hg, ht]);
    this.hub.setSize(140, 140).setInteractive({ useHandCursor: true });
    this.hub.on('pointerdown', (p, x, y, e) => {
      e.stopPropagation();
      this.spin();
    });

    // Tap ring on the hub
    this.ring = scene.add.circle(cx, cy, 70).setStrokeStyle(6, 0xffffff, 0.9);
    this.ringTween = scene.tweens.add({ targets: this.ring, scale: { from: 1, to: 1.6 }, alpha: { from: 0.9, to: 0 }, duration: 900, repeat: -1 });

    this.root.add([dim, rays, title, sub, rim, this.wheel, this.bulbs, this.pointer, this.hub, this.ring]);

    // Entrance
    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 250 });
    [this.wheel, this.hub].forEach((o) => {
      o.setScale(0.2);
      scene.tweens.add({ targets: o, scale: 1, duration: 520, ease: 'Back.Out' });
    });
    [rim, this.bulbs, this.pointer].forEach((o) => {
      o.setAlpha(0);
      scene.tweens.add({ targets: o, alpha: 1, duration: 400, delay: 150 });
    });
    this.hubPulse = scene.tweens.add({ targets: this.hub, scale: 1.08, duration: 480, delay: 560, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    title.setScale(0.3);
    scene.tweens.add({ targets: title, scale: 1, duration: 520, delay: 120, ease: 'Back.Out' });
    // Slow idle drift so it looks alive
    this.idle = scene.tweens.add({ targets: this.wheel, angle: { from: -8, to: 8 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    sfx.bonus();

    this.autoTimer = scene.time.delayedCall(autoSpinMs, () => this.spin());
  }

  spin() {
    if (this.spun) return;
    this.spun = true;
    const { scene } = this;
    sfx.unlock();
    sfx.click();
    this.autoTimer?.remove();
    this.idle.remove();
    this.hubPulse.remove();
    this.ringTween.remove();
    this.ring.setVisible(false);
    scene.tweens.add({ targets: this.hub, scale: 0.9, duration: 90, yoyo: true });

    const seg = 360 / SEGMENTS.length;
    // Segment i sits at angle i*seg (clockwise from top); bring WIN_INDEX to the top.
    // A small offset inside the segment makes the stop feel less "perfect".
    const start = this.wheel.angle;
    const target = 360 * 6 - WIN_INDEX * seg + Phaser.Math.Between(-10, 10);
    let lastSeg = Math.floor((start + seg / 2) / seg);
    this.bulbTimer.timeScale = 3;

    const rot = { a: start };
    const end = start + (target - (((start % 360) + 360) % 360));
    scene.tweens.add({
      targets: rot,
      a: end,
      duration: 4600,
      ease: 'Cubic.Out',
      onUpdate: () => {
        this.wheel.angle = rot.a;
        const cur = Math.floor((rot.a + seg / 2) / seg);
        if (cur !== lastSeg) {
          lastSeg = cur;
          sfx.wheelTick();
          this.pointer.angle = -14;
          scene.tweens.add({ targets: this.pointer, angle: 0, duration: 120, ease: 'Back.Out' });
        }
      },
      onComplete: () => this.land(),
    });
  }

  land() {
    const { scene } = this;
    this.bulbTimer.timeScale = 1;
    const cx = W / 2;
    const cy = H * 0.5;
    // Highlight the winning segment
    const hl = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const seg = (Math.PI * 2) / SEGMENTS.length;
    hl.fillStyle(0xffffff, 0.4);
    hl.slice(cx, cy, R, -Math.PI / 2 - seg / 2, -Math.PI / 2 + seg / 2);
    hl.fillPath();
    this.root.add(hl);
    scene.tweens.add({ targets: hl, alpha: 0.1, duration: 160, yoyo: true, repeat: 5 });
    scene.cameras.main.shake(250, 0.006);
    scene.time.delayedCall(1200, () => {
      scene.tweens.add({
        targets: this.root,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.bulbTimer.remove();
          this.root.destroy(true);
          this.onWin?.(SEGMENTS[WIN_INDEX].value);
        },
      });
    });
  }
}
