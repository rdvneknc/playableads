import { FONT, GAME_WIDTH as W, GAME_HEIGHT as H, L, TEXT } from '../config.js';
import { openStore } from '../ad/cta.js';
import { sfx } from '../audio/Sfx.js';
import { goldText, makeLogo, makeButton } from './Ui.js';

export class EndCard {
  constructor(scene, { won, army = [], onReplay }) {
    const root = scene.add.container(0, 0).setDepth(5000);
    const cx = W / 2;
    const E = L.end;

    const dim = scene.add.rectangle(cx, H / 2, W, H, 0x0d0804, 0.8).setInteractive();
    dim.on('pointerdown', () => openStore());
    const rays = scene.add.image(cx, E.raysY, 'rays').setScale(2.7).setAlpha(won ? 0.4 : 0.12);
    scene.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });

    const logo = makeLogo(scene, cx, E.logoY, E.logoS);

    const title = goldText(scene, cx, E.titleY, won ? TEXT.victory : TEXT.defeat, E.titleSize, won ? {} : { colors: ['#ffffff', '#d9d0c4', '#8a7f72'] });

    // The player's army standing proud
    const units = [];
    const list = [...new Set(army.length ? army : ['yeniceri', 'azap', 'akinci'])];
    const n = Math.min(list.length, 4);
    list.slice(0, n).forEach((art, i) => {
      const x = cx + (i - (n - 1) / 2) * 150 * E.unitH;
      const img = scene.add.image(x, E.unitsY, `${art}-u`).setOrigin(0.5, 1);
      const wide = ['akinci', 'tatar', 'top'].includes(art);
      img.setScale(((wide ? (art === 'top' ? 180 : 250) : 210) * E.unitH) / img.height);
      const sh = scene.add.image(x, E.unitsY, 'shadow').setDisplaySize((wide ? 190 : 120) * E.unitH, 34 * E.unitH);
      units.push(sh, img);
      scene.tweens.add({ targets: img, scaleY: img.scaleY * 1.025, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });

    const line = scene.add
      .text(cx, E.lineY, won ? TEXT.victoryLine : TEXT.defeatLine, { fontFamily: FONT, fontSize: '28px', color: '#f6e7c8', align: 'center', wordWrap: { width: 600 } })
      .setOrigin(0.5);
    line.setShadow(0, 2, '#000', 4, true, false);

    const cta = makeButton(scene, cx, E.ctaY, TEXT.playNow, { w: E.ctaW, size: Math.round(E.ctaW * 0.104), onTap: () => openStore() });
    const retry = scene.add
      .text(E.retry[0], E.retry[1], TEXT.retry, { fontFamily: FONT, fontSize: '28px', color: '#f0c75a', stroke: '#1d1206', strokeThickness: 6 })
      .setOrigin(0.5)
      .setPadding(20, 12, 20, 12)
      .setInteractive({ useHandCursor: true });
    retry.on('pointerdown', (p, x, y, e) => {
      e.stopPropagation();
      sfx.click();
      onReplay?.();
    });

    root.add([dim, rays, ...units, logo, title, line, cta, retry]);

    root.setAlpha(0);
    scene.tweens.add({ targets: root, alpha: 1, duration: 300 });
    scene.tweens.add({ targets: logo, scale: logo.scale, duration: 600, ease: 'Back.Out' });
    logo.setScale(logo.scale * 0.3);
    title.setScale(0.2);
    scene.tweens.add({ targets: title, scale: 1, duration: 500, delay: 200, ease: 'Back.Out' });
    units.forEach((u, i) => {
      const y = u.y;
      u.y += 80;
      u.setAlpha(0);
      scene.tweens.add({ targets: u, y, alpha: 1, duration: 450, delay: 350 + Math.floor(i / 2) * 120, ease: 'Back.Out' });
    });
    cta.setScale(0);
    scene.tweens.add({
      targets: cta,
      scale: 1,
      duration: 450,
      delay: 800,
      ease: 'Back.Out',
      onComplete: () => scene.tweens.add({ targets: cta, scale: 1.06, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
    });
    retry.setAlpha(0);
    scene.tweens.add({ targets: retry, alpha: 1, duration: 300, delay: 1200 });

    if (won) {
      const p = scene.add
        .particles(0, -20, 'spark', {
          x: { min: 0, max: W },
          speedY: { min: 120, max: 300 },
          speedX: { min: -40, max: 40 },
          rotate: { min: 0, max: 360 },
          scale: { min: 0.2, max: 0.5 },
          lifespan: 4000,
          frequency: 50,
          tint: [0xffd36b, 0xffffff, 0xff7a4a],
          blendMode: 'ADD',
        })
        .setDepth(5001);
      scene.time.delayedCall(2500, () => p.stop());
    }
  }
}
