import Phaser from 'phaser';
import { BOARD, CASTLE_HP, FONT } from '../config.js';
import { sfx } from '../audio/Sfx.js';

// A side's castle: a wall just outside the board edge that units can attack
// once they stand in the last column (melee) or have it in range (ranged).
export class Castle {
  constructor(scene, side, { x, y, w }) {
    this.scene = scene;
    this.side = side;
    this.isCastle = true;
    this.alive = true;
    this.maxHp = CASTLE_HP;
    this.hp = CASTLE_HP;
    this.col = side === 'p' ? -1 : BOARD.cols; // virtual column just off the board
    this.armor = 30;
    this.img = scene.add.image(x, y, 'kale').setOrigin(0.5, 0.985).setDepth(20);
    this.img.setScale(w / this.img.width);
    if (side === 'p') this.img.setFlipX(true);
    // Team banner on the keep: red for us, blue for the enemy (flies toward the field)
    const k = w / 512;
    this.flag = scene.add
      .image(x + (side === 'p' ? 140 : -140) * k, y - 532 * k, side === 'p' ? 'flag-red' : 'flag-blue')
      .setOrigin(0, 1)
      .setFlipX(side === 'e')
      .setScale(w / 380)
      .setDepth(21);
    if (side === 'e') this.flag.setOrigin(1, 1);
    scene.tweens.add({ targets: this.flag, scaleX: this.flag.scaleX * 0.82, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.pos = { x, y: y - 10, s: 0.62 };
    this.height = this.img.displayHeight * 0.55;
    this.bar = scene.add.graphics().setDepth(2100);
    this.label = scene.add
      .text(x, y - this.img.displayHeight - 4, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#1d1206', strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setDepth(2101);
    this.draw();
  }

  draw() {
    const g = this.bar;
    const w = 150;
    const h = 14;
    const x = this.img.x - w / 2;
    const y = this.img.y - this.img.displayHeight + 4;
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 6);
    g.fillStyle(this.side === 'p' ? 0xe0313f : 0x3d7fe6, 1);
    g.fillRoundedRect(x, y, Math.max(3, w * pct), h, 4);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(x + 3, y + 2, Math.max(0, w * pct - 6), 4);
    this.label.setText(`${Math.ceil(this.hp)} / ${this.maxHp}`).setY(y - 4);
  }

  hit(dmg, fromDir) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.draw();
    this.scene.fx.damage(dmg, this.img.x, this.img.y - this.img.displayHeight * 0.6);
    this.scene.fx.dust(this.img.x + (Math.random() - 0.5) * 80, this.img.y - 30, 1.2, 6);
    this.img.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.img.setTint(0xff9a8a));
    this.scene.time.delayedCall(220, () => this.img.clearTint());
    this.scene.tweens.add({ targets: this.img, x: this.img.x + 5 * fromDir, duration: 50, yoyo: true, repeat: 2 });
    sfx.thunk();
    if (this.hp <= 0) this.alive = false;
  }

  async collapse() {
    const cam = this.scene.cameras.main;
    sfx.collapse();
    cam.shake(900, 0.012);
    this.scene.tweens.add({ targets: this.img, x: this.img.x + 6, duration: 50, yoyo: true, repeat: 8 });
    await new Promise((r) => this.scene.time.delayedCall(450, r));
    this.img.setTexture('kale-yikik');
    if (this.flag) this.scene.tweens.add({ targets: this.flag, angle: -70, y: '+=50', alpha: 0, duration: 700 });
    for (let i = 0; i < 4; i++) {
      this.scene.time.delayedCall(i * 120, () => this.scene.fx.dust(this.img.x + (Math.random() - 0.5) * 160, this.img.y - Math.random() * 100, 2, 12));
    }
    const rubble = this.scene.add
      .particles(this.img.x, this.img.y - 100, 'smoke', {
        speed: { min: 80, max: 300 },
        angle: { min: 200, max: 340 },
        gravityY: 500,
        scale: { start: 0.22, end: 0.04 },
        tint: [0x8a867c, 0x5f5c56, 0xb9a682],
        lifespan: 1100,
        emitting: false,
      })
      .setDepth(70);
    rubble.explode(40);
    this.bar.clear();
    this.label.setText('');
  }
}
