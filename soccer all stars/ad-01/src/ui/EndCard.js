import { FONT, COLORS } from '../config.js';
import { openStore } from '../ad/cta.js';
import { panelTexture, pillButton, gradText } from './Skin.js';

// Final screen: stadium spotlight, result ribbon, scoreboard and a big pulsing install CTA (landscape).
export class EndCard {
  constructor(scene, { score, onReplay }) {
    const { width, height } = scene.scale;
    const won = score.player > score.bot;
    const draw = score.player === score.bot;
    const title = won ? 'YOU WIN!' : draw ? 'DRAW!' : 'YOU LOSE!';
    const palette = won
      ? { text: ['#ffffff', '#fff1a8', '#ffb72e'], stroke: '#3a1d00', rim: '#ffd23f', ray: 0xffd23f }
      : draw
        ? { text: ['#ffffff', '#e6f1ff', '#9cc4ff'], stroke: '#0b2347', rim: '#7fc4ff', ray: 0x7fc4ff }
        : { text: ['#ffffff', '#ffd0c8', '#ff6b5a'], stroke: '#3a0606', rim: '#ff6b5a', ray: 0xff6b5a };

    const cx = width / 2;
    const cy = height / 2;
    this.root = scene.add.container(0, 0).setDepth(400);

    const dim = scene.add.rectangle(cx, cy, width, height, 0x040a18, 0.86).setInteractive();
    dim.on('pointerdown', () => openStore());

    // rotating light rays behind the panel
    const rays = scene.add.graphics({ x: cx, y: cy - 30 });
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + Math.PI / n / 1.6;
      rays.fillStyle(palette.ray, 0.07);
      rays.beginPath();
      rays.moveTo(0, 0);
      rays.lineTo(Math.cos(a0) * 900, Math.sin(a0) * 900);
      rays.lineTo(Math.cos(a1) * 900, Math.sin(a1) * 900);
      rays.closePath();
      rays.fillPath();
    }
    scene.tweens.add({ targets: rays, angle: 360, duration: 30000, repeat: -1 });

    const panelW = Math.min(700, width - 120);
    const panelH = Math.min(330, height - 120);
    const py = cy - panelH / 2 + 10;
    panelTexture(scene, `end-panel-${palette.rim}`, panelW, panelH, { rim: palette.rim, header: 0 });
    const panel = scene.add.image(cx, cy + 14, `end-panel-${palette.rim}`);

    // "FULL TIME" tab on top
    const tab = scene.add.graphics();
    tab.fillStyle(0x000000, 0.35);
    tab.fillRoundedRect(cx - 86, py - 18, 172, 34, 17);
    tab.fillStyle(0x0b1730, 1);
    tab.fillRoundedRect(cx - 88, py - 21, 176, 34, 17);
    tab.lineStyle(2, Number(`0x${palette.rim.slice(1)}`), 1);
    tab.strokeRoundedRect(cx - 88, py - 21, 176, 34, 17);
    const tabText = scene.add
      .text(cx, py - 4, 'FULL TIME', { fontFamily: FONT, fontSize: '17px', color: '#ffffff', letterSpacing: 3 })
      .setOrigin(0.5);

    const titleText = gradText(scene, cx, py - 74, title, 70, palette.text, palette.stroke);

    // scoreboard: [badge player] 2 : 1 [badge bot]
    const sy = py + 92;
    const board = scene.add.graphics();
    board.fillStyle(0x000000, 0.35);
    board.fillRoundedRect(cx - 120, sy - 44, 240, 92, 18);
    board.fillStyle(0x061024, 1);
    board.fillRoundedRect(cx - 118, sy - 46, 236, 88, 18);
    board.lineStyle(2, 0xffffff, 0.15);
    board.strokeRoundedRect(cx - 118, sy - 46, 236, 88, 18);
    board.fillStyle(COLORS.goalBlue, 1);
    board.fillRoundedRect(cx - 118, sy - 46, 10, 88, { tl: 18, bl: 18, tr: 0, br: 0 });
    board.fillStyle(COLORS.goalRed, 1);
    board.fillRoundedRect(cx + 108, sy - 46, 10, 88, { tl: 0, bl: 0, tr: 18, br: 18 });

    const digit = (x, v, win) =>
      scene.add
        .text(x, sy - 2, `${v}`, { fontFamily: FONT, fontSize: '62px', color: win ? '#ffe566' : '#ffffff', stroke: '#000000', strokeThickness: 6 })
        .setOrigin(0.5);
    const pScore = digit(cx - 52, score.player, score.player > score.bot);
    const bScore = digit(cx + 52, score.bot, score.bot > score.player);
    const colon = scene.add.text(cx, sy - 6, ':', { fontFamily: FONT, fontSize: '48px', color: '#8fa6c8' }).setOrigin(0.5);

    const badge = (x, key, color, name) => {
      const c = scene.add.container(x, sy);
      const ring = scene.add.graphics();
      ring.fillStyle(0x000000, 0.35);
      ring.fillCircle(3, 5, 52);
      ring.fillStyle(color, 1);
      ring.fillCircle(0, 0, 52);
      ring.fillStyle(0x0a1530, 1);
      ring.fillCircle(0, 0, 44);
      ring.fillStyle(0xffffff, 0.12);
      ring.fillEllipse(0, -24, 70, 26);
      const img = scene.add.image(0, 2, key);
      img.setScale(78 / Math.max(img.width, img.height));
      const label = scene.add
        .text(0, 70, name, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5);
      c.add([ring, img, label]);
      return c;
    };
    const pBadge = badge(cx - 222, 'player', COLORS.goalBlue, 'YOU');
    const bBadge = badge(cx + 222, 'opponent', COLORS.goalRed, 'BOT');

    const sub = scene.add
      .text(cx, py + 198, won ? 'Champion form! Real matches are waiting.' : 'Rematch the world — real matches are waiting!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#d6e9ff',
      })
      .setOrigin(0.5);

    const cta = pillButton(scene, cx, py + 266, 'PLAY NOW', {
      w: 340,
      h: 78,
      size: 38,
      colors: { from: '#ffe35a', to: '#ff9a1f', edge: '#9a4a00' },
      onTap: () => openStore(),
    });

    const replay = scene.add
      .text(cx, Math.min(height - 26, py + panelH + 20), '↻  Play Again', { fontFamily: FONT, fontSize: '20px', color: '#9fc6ff' })
      .setOrigin(0.5)
      .setPadding(14, 8, 14, 8)
      .setInteractive({ useHandCursor: true });
    replay.on('pointerdown', (pointer, x, y, event) => {
      event.stopPropagation();
      onReplay();
    });

    this.root.add([dim, rays, panel, titleText, tab, tabText, board, pScore, colon, bScore, pBadge, bBadge, sub, cta, replay]);

    // entrance choreography
    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 280 });
    titleText.setScale(0.2);
    scene.tweens.add({ targets: titleText, scale: 1, duration: 560, ease: 'Back.Out', delay: 120 });
    pBadge.x -= 160;
    bBadge.x += 160;
    scene.tweens.add({ targets: pBadge, x: cx - 222, duration: 480, ease: 'Back.Out', delay: 220 });
    scene.tweens.add({ targets: bBadge, x: cx + 222, duration: 480, ease: 'Back.Out', delay: 220 });
    [pScore, bScore].forEach((d, i) => {
      d.setScale(0);
      scene.tweens.add({ targets: d, scale: 1, duration: 380, ease: 'Back.Out', delay: 420 + i * 120 });
    });
    cta.setScale(0);
    scene.tweens.add({
      targets: cta,
      scale: 1,
      duration: 420,
      ease: 'Back.Out',
      delay: 650,
      onComplete: () => {
        scene.tweens.add({ targets: cta, scale: 1.07, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        cta.sweep();
        scene.time.addEvent({ delay: 1800, loop: true, callback: () => cta.sweep() });
      },
    });

    if (won && scene.textures.exists('confetti')) {
      const conf = scene.add
        .particles(0, -20, 'confetti', {
          x: { min: 0, max: width },
          speedY: { min: 120, max: 260 },
          speedX: { min: -60, max: 60 },
          rotate: { min: 0, max: 360 },
          scale: { min: 0.6, max: 1.1 },
          tint: [0xffd23f, 0x5cff9a, 0x4de0ff, 0xff6b9a, 0xffffff],
          lifespan: 3200,
          frequency: 70,
          quantity: 2,
        })
        .setDepth(401);
      scene.time.delayedCall(2600, () => conf.stop());
    }
  }
}
