import Phaser from 'phaser';
import { FONT } from '../config.js';
import { sfx } from '../audio/Sfx.js';

// Round action button with a radial cooldown sweep, countdown digits,
// press/deny feedback and an optional "use me" highlight pulse.
export class SkillButton {
  constructor(scene, x, y, {
    texture,
    size,
    label,
    labelColor = '#ffffff',
    labelStroke = '#0b2f7a',
    labelAngle = 0,
    onPress,
    isBlocked = () => false,
  }) {
    this.scene = scene;
    this.size = size;
    this.onPress = onPress;
    this.isBlocked = isBlocked;
    this.wasReady = true;
    this.highlighted = false;

    this.container = scene.add.container(x, y).setDepth(100);

    this.glow = scene.add.circle(0, 0, size * 0.56, 0xffffff, 0).setStrokeStyle(6, 0xfff27a, 0.9).setVisible(false);
    this.img = scene.add.image(0, 0, texture).setDisplaySize(size, size);
    this.cooldownGfx = scene.add.graphics();
    this.countText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: `${Math.round(size * 0.32)}px`, color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5);
    this.label = scene.add
      .text(0, size * 0.58, label, { fontFamily: FONT, fontSize: size > 105 ? '22px' : '18px', color: labelColor, stroke: labelStroke, strokeThickness: 5 })
      .setOrigin(0.5)
      .setAngle(labelAngle);

    this.container.add([this.glow, this.img, this.cooldownGfx, this.countText, this.label]);

    const tw = this.img.width;
    this.img.setInteractive(new Phaser.Geom.Circle(tw / 2, tw / 2, tw * 0.48), Phaser.Geom.Circle.Contains);
    this.img.on('pointerdown', this.press, this);
  }

  press() {
    if (this.isBlocked()) return;
    const result = this.onPress();
    this.scene.tweens.killTweensOf(this.container);
    this.container.setScale(0.88);
    this.scene.tweens.add({ targets: this.container, scale: 1, duration: 180, ease: 'Back.Out' });
    if (result && !result.ok) this.deny(result.reason);
  }

  deny(reason) {
    sfx.deny();
    this.scene.tweens.add({
      targets: this.img,
      x: { from: -6, to: 6 },
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.img.setX(0),
    });
    const msg = { far: 'Too far!', noball: 'No ball!', nobot: 'No rival', cooldown: 'Wait!' }[reason];
    if (msg) this.floatText(msg);
  }

  floatText(msg) {
    const t = this.scene.add
      .text(this.container.x, this.container.y - this.size * 0.75, msg, {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(120);
    this.scene.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  }

  // progress: 0..1 cooldown progress, remainingMs for the digits, usable: context allows use now
  setState(progress, remainingMs, usable) {
    const ready = progress >= 1;
    const g = this.cooldownGfx;
    g.clear();

    if (!ready) {
      const r = this.size * 0.46;
      const start = -Math.PI / 2;
      g.fillStyle(0x000000, 0.55);
      g.slice(0, 0, r, start + progress * Math.PI * 2, start + Math.PI * 2, false);
      g.fillPath();
      g.lineStyle(5, 0xffffff, 0.9);
      g.beginPath();
      g.arc(0, 0, r + 2, start, start + progress * Math.PI * 2, false);
      g.strokePath();
      this.countText.setText(String(Math.ceil(remainingMs / 1000)));
    } else {
      this.countText.setText('');
    }

    if (ready && !this.wasReady) this.readyPulse();
    this.wasReady = ready;

    this.img.setAlpha(ready && usable ? 1 : 0.7);
  }

  readyPulse() {
    const ring = this.scene.add.circle(this.container.x, this.container.y, this.size * 0.5, 0xffffff, 0)
      .setStrokeStyle(6, 0xffffff, 1)
      .setDepth(99);
    this.scene.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
  }

  setHighlight(on) {
    if (on === this.highlighted) return;
    this.highlighted = on;
    this.scene.tweens.killTweensOf(this.glow);
    this.glow.setVisible(on).setScale(1).setAlpha(1);
    if (on) {
      this.scene.tweens.add({ targets: this.glow, scale: 1.18, alpha: 0.25, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
  }
}
