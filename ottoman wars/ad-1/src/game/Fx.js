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
}
