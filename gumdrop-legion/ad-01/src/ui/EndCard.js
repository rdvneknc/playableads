import Phaser from 'phaser';
import { FONT, GAME_WIDTH as W, GAME_HEIGHT as H } from '../config.js';
import { openStore } from '../ad/cta.js';
import { sfx } from '../audio/Sfx.js';
import { candyText, makeLogo, makeButton } from './Ui.js';

export class EndCard {
  constructor(scene, { won, legion = 0, onReplay }) {
    this.scene = scene;
    const root = (this.root = scene.add.container(0, 0).setDepth(2000));
    const cx = W / 2;

    const dim = scene.add.rectangle(cx, H / 2, W, H, 0x2a0f4a, 0.72).setInteractive();
    dim.on('pointerdown', () => openStore());

    const rays = scene.add.image(cx, 560, 'rays').setScale(2.8).setAlpha(won ? 0.35 : 0.15).setTint(won ? 0xffe9a8 : 0xd9c8ff);
    scene.tweens.add({ targets: rays, angle: 360, duration: 20000, repeat: -1 });

    const logo = makeLogo(scene, cx, 200, 0.95);

    // Card
    const card = scene.add.graphics();
    const cw = 580;
    const ch = 560;
    const cy = 330;
    card.fillStyle(0x000000, 0.2);
    card.fillRoundedRect(cx - cw / 2 + 6, cy + 14, cw, ch, 44);
    card.fillStyle(0xffffff, 1);
    card.fillRoundedRect(cx - cw / 2, cy, cw, ch, 44);
    card.fillStyle(0xffe9f4, 1);
    card.fillRoundedRect(cx - cw / 2 + 14, cy + 14, cw - 28, 190, 32);
    card.lineStyle(6, 0xff8cc6, 1);
    card.strokeRoundedRect(cx - cw / 2, cy, cw, ch, 44);

    const title = candyText(scene, cx, cy + 72, won ? 'VICTORY!' : 'SO CLOSE!', 78, won ? {} : { colors: ['#ffffff', '#ffb3d6', '#ff5fa2'] });

    // Stars
    const stars = [-1, 0, 1].map((i) => {
      const s = scene.add.image(cx + i * 92, cy + 165 + (i === 0 ? -14 : 0), 'star').setScale(i === 0 ? 1.45 : 1.15);
      if (!won && i !== -1) s.setTint(0xd6c9e6);
      return s;
    });

    const mascot = scene.add.image(cx, cy + 340, 'p-face').setScale(0.78);
    const mascotShadow = scene.add.image(cx, cy + 430, 'shadow').setScale(3.2, 2.2);
    scene.tweens.add({ targets: mascot, y: mascot.y - 26, scaleY: 0.82, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    scene.tweens.add({ targets: mascotShadow, scaleX: 2.6, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const line = scene.add
      .text(cx, cy + 500, won ? `Your legion of ${legion} crushed the Sour King!` : 'The Sour King got away… lead a bigger legion!', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#5a1d7a',
        align: 'center',
        wordWrap: { width: cw - 60 },
      })
      .setOrigin(0.5);

    const cta = makeButton(scene, cx, 1010, 'PLAY NOW', { w: 460, h: 116, size: 58, onTap: () => openStore() });
    cta.shineDepth = 2001;
    scene.time.addEvent({ delay: 1800, startAt: 900, loop: true, callback: () => cta.sweep() });

    const replay = scene.add
      .text(cx, 1130, 'TRY AGAIN', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#5a1d7a', strokeThickness: 6 })
      .setOrigin(0.5)
      .setPadding(20, 12, 20, 12)
      .setInteractive({ useHandCursor: true });
    replay.on('pointerdown', (p, x, y, e) => {
      e.stopPropagation();
      sfx.click();
      onReplay?.();
    });

    root.add([dim, rays, card, title, ...stars, mascotShadow, mascot, line, logo, cta, replay]);

    // Entrance choreography
    root.setAlpha(0);
    scene.tweens.add({ targets: root, alpha: 1, duration: 250 });
    [card, title, mascot, mascotShadow, line].forEach((o, i) => {
      const fy = o.y;
      o.y += 60;
      o.setAlpha(0);
      scene.tweens.add({ targets: o, y: fy, alpha: 1, duration: 420, delay: 120 + i * 50, ease: 'Back.Out' });
    });
    logo.setScale(0.3);
    scene.tweens.add({ targets: logo, scale: 0.95, duration: 600, delay: 80, ease: 'Back.Out' });
    stars.forEach((s, i) => {
      const sc = s.scale;
      s.setScale(0);
      scene.tweens.add({
        targets: s,
        scale: sc,
        angle: { from: -40, to: 0 },
        duration: 420,
        delay: 450 + i * 160,
        ease: 'Back.Out',
        onStart: () => (won || i === 0) && sfx.pop(1.4 + i * 0.25),
      });
    });
    cta.setScale(0);
    scene.tweens.add({
      targets: cta,
      scale: 1,
      duration: 480,
      delay: 700,
      ease: 'Back.Out',
      onComplete: () => scene.tweens.add({ targets: cta, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
    });
    replay.setAlpha(0);
    scene.tweens.add({ targets: replay, alpha: 0.9, duration: 300, delay: 1100 });

    if (won) this.confetti();
  }

  confetti() {
    const p = this.scene.add
      .particles(0, -30, 'confetti', {
        x: { min: 0, max: W },
        speedY: { min: 180, max: 380 },
        speedX: { min: -80, max: 80 },
        rotate: { min: 0, max: 360 },
        scaleX: { min: 0.6, max: 1.1 },
        scaleY: { min: 0.5, max: 1 },
        lifespan: 4200,
        frequency: 45,
        tint: [0xff5fa2, 0xffd34d, 0x3d9bff, 0x8fe8c1, 0xb48de8],
      })
      .setDepth(2002);
    this.scene.time.delayedCall(2600, () => p.stop());
  }
}
