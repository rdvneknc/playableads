import Phaser from 'phaser';
import rotateBgUrl from '../assets/rotate-background.webp';
import rotatePhoneUrl from '../assets/rotate-phone.webp';

// Shown before the match. Asks the player to turn the phone left into landscape.
export class RotateScene extends Phaser.Scene {
  constructor() {
    super('Rotate');
  }

  preload() {
    this.load.image('rotate-bg', rotateBgUrl);
    this.load.image('rotate-phone', rotatePhoneUrl);
  }

  create() {
    const { width, height } = this.scale;
    this.leaving = false;

    const bg = this.add.image(width / 2, height / 2, 'rotate-bg').setDepth(0);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.setScale(cover);

    const phone = this.add.image(width / 2, height * 0.52, 'rotate-phone').setDepth(2);
    const phoneScale = Math.min((width * 0.5) / phone.width, (height * 0.28) / phone.height);
    phone.setScale(phoneScale);
    phone.setAngle(-90);

    this.tweens.add({
      targets: phone,
      angle: 0,
      duration: 950,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      hold: 380,
    });
    this.tweens.add({
      targets: phone,
      scale: phoneScale * 1.06,
      duration: 950,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      hold: 380,
    });

    // Brief hint — auto-advance; tap skips sooner
    this.input.once('pointerdown', () => this.go());
    this.time.delayedCall(2000, () => this.go());
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('Preload');
  }
}
