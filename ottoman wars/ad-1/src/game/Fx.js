import Phaser from 'phaser';
import { FONT } from '../config.js';

// Small reusable effects. Everything cleans itself up.
export class Fx {
  constructor(scene) {
    this.scene = scene;
  }

  dust(x, y, s = 1, n = 8) {
    for (let i = 0; i < n; i++) {
      const p = this.scene.add
        .image(x + (Math.random() - 0.5) * 60 * s, y - 4, 'smoke')
        .setTint(0xc9b58a)
        .setAlpha(0.65)
        .setScale((0.25 + Math.random() * 0.25) * s)
        .setDepth(y + 101);
      this.scene.tweens.add({
        targets: p,
        x: p.x + (Math.random() - 0.5) * 90 * s,
        y: p.y - (10 + Math.random() * 30) * s,
        scale: p.scale * 2.2,
        alpha: 0,
        duration: 600 + Math.random() * 300,
        ease: 'Cubic.Out',
        onComplete: () => p.destroy(),
      });
    }
  }

  slash(x, y, s, dir) {
    const sl = this.scene.add
      .image(x, y, 'slash')
      .setScale(0.6 * s, 0.75 * s)
      .setFlipX(dir < 0)
      .setAngle(dir > 0 ? -20 : 20)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3000);
    this.scene.tweens.add({ targets: sl, angle: dir > 0 ? 40 : -40, alpha: 0, scaleX: 1.1 * s, duration: 260, ease: 'Cubic.Out', onComplete: () => sl.destroy() });
  }

  sparks(x, y, s) {
    const p = this.scene.add
      .particles(x, y, 'spark', {
        speed: { min: 120, max: 360 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.45 * s, end: 0 },
        lifespan: 320,
        tint: [0xfff1b8, 0xffb43c, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(3001);
    p.explode(12);
    this.scene.time.delayedCall(450, () => p.destroy());
  }

  // Arrow on a ballistic arc; resolves on impact.
  arrow(sx, sy, tx, ty, delay, s) {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(delay, () => {
        const a = this.scene.add.image(sx, sy, 'arrow').setScale(0.8 * s).setDepth(2900);
        const dist = Math.abs(tx - sx);
        const arc = 60 + dist * 0.35;
        const o = { t: 0 };
        let px = sx;
        let py = sy;
        this.scene.tweens.add({
          targets: o,
          t: 1,
          duration: 380 + dist * 0.35,
          ease: 'Linear',
          onUpdate: () => {
            const x = sx + (tx - sx) * o.t;
            const y = sy + (ty - sy) * o.t - Math.sin(o.t * Math.PI) * arc;
            a.setPosition(x, y).setRotation(Math.atan2(y - py, x - px));
            px = x;
            py = y;
          },
          onComplete: () => {
            this.scene.tweens.add({ targets: a, alpha: 0, duration: 200, delay: 150, onComplete: () => a.destroy() });
            resolve();
          },
        });
      });
    });
  }

  damage(n, x, y) {
    const t = this.scene.add
      .text(x, y, `-${n}`, { fontFamily: FONT, fontSize: '34px', color: '#ff4a4a', stroke: '#2a0606', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(3100)
      .setScale(0.4);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 350, duration: 500, onComplete: () => t.destroy() });
  }

  floatText(str, x, y, color = '#ffd36b', size = 34) {
    const t = this.scene.add
      .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1d1206', strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(3100)
      .setScale(0.4);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 600, duration: 450, onComplete: () => t.destroy() });
  }

  muzzle(x, y, s, dir) {
    const f = this.scene.add.image(x, y, 'flash').setOrigin(0, 0.5).setScale(0.9 * s).setFlipX(dir < 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(3050);
    if (dir < 0) f.setOrigin(1, 0.5);
    this.scene.tweens.add({ targets: f, alpha: 0, scaleX: 1.3 * s, duration: 140, onComplete: () => f.destroy() });
    for (let i = 0; i < 6; i++) {
      const p = this.scene.add
        .image(x + dir * i * 10 * s, y, 'smoke')
        .setTint(0xdedad0)
        .setAlpha(0.8)
        .setScale(0.3 * s)
        .setDepth(3040);
      this.scene.tweens.add({
        targets: p,
        x: p.x + dir * (40 + Math.random() * 60) * s,
        y: p.y - (20 + Math.random() * 40) * s,
        scale: (0.9 + Math.random() * 0.6) * s,
        alpha: 0,
        duration: 900 + Math.random() * 500,
        ease: 'Cubic.Out',
        onComplete: () => p.destroy(),
      });
    }
  }

  tracer(sx, sy, tx, ty) {
    return new Promise((resolve) => {
      const g = this.scene.add.graphics().setDepth(3060).setBlendMode(Phaser.BlendModes.ADD);
      const o = { t: 0 };
      this.scene.tweens.add({
        targets: o,
        t: 1,
        duration: 110,
        onUpdate: () => {
          const x = sx + (tx - sx) * o.t;
          const y = sy + (ty - sy) * o.t;
          const bx = sx + (tx - sx) * Math.max(0, o.t - 0.25);
          const by = sy + (ty - sy) * Math.max(0, o.t - 0.25);
          g.clear();
          g.lineStyle(3, 0xfff1b8, 0.9);
          g.lineBetween(bx, by, x, y);
        },
        onComplete: () => {
          g.destroy();
          resolve();
        },
      });
    });
  }

  ball(sx, sy, tx, ty, s) {
    return new Promise((resolve) => {
      const b = this.scene.add.image(sx, sy, 'ball').setScale(0.9 * s).setDepth(3055);
      const dist = Math.abs(tx - sx);
      const arc = 90 + dist * 0.3;
      const o = { t: 0 };
      this.scene.tweens.add({
        targets: o,
        t: 1,
        duration: 520 + dist * 0.4,
        onUpdate: () => {
          b.setPosition(sx + (tx - sx) * o.t, sy + (ty - sy) * o.t - Math.sin(o.t * Math.PI) * arc);
          b.setScale((0.9 + Math.sin(o.t * Math.PI) * 0.35) * s);
        },
        onComplete: () => {
          b.destroy();
          resolve();
        },
      });
    });
  }

  explosion(x, y, s) {
    const fire = this.scene.add.image(x, y - 30 * s, 'dot').setTint(0xffb03c).setScale(2 * s).setBlendMode(Phaser.BlendModes.ADD).setDepth(3058);
    this.scene.tweens.add({ targets: fire, scale: 6 * s, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => fire.destroy() });
    const p = this.scene.add
      .particles(x, y - 20 * s, 'spark', {
        speed: { min: 200, max: 520 },
        angle: { min: 200, max: 340 },
        gravityY: 900,
        scale: { start: 0.5 * s, end: 0 },
        lifespan: 600,
        tint: [0xffd36b, 0xff7a2a, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(3057);
    p.explode(22);
    this.scene.time.delayedCall(700, () => p.destroy());
    this.dust(x, y, s * 1.6, 14);
    this.scene.cameras.main.shake(260, 0.01);
  }
}
