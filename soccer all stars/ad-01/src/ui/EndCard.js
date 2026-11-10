import { FONT } from '../config.js';
import { openStore } from '../ad/cta.js';

// Final screen: result + big pulsing install CTA (landscape).
export class EndCard {
  constructor(scene, { score, onReplay }) {
    const { width, height } = scene.scale;
    const won = score.player > score.bot;
    const draw = score.player === score.bot;
    const title = won ? 'YOU WIN!' : draw ? 'DRAW!' : 'YOU LOSE!';
    const titleColor = won ? '#ffe566' : draw ? '#ffffff' : '#ff8a80';

    this.root = scene.add.container(0, 0).setDepth(400);

    const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x061226, 0.82).setInteractive();
    dim.on('pointerdown', () => openStore());

    const panelW = Math.min(720, width - 120);
    const panelH = Math.min(520, height - 80);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.3);
    panel.fillRoundedRect(px + 8, py + 10, panelW, panelH, 28);
    panel.fillStyle(0x12305e, 1);
    panel.fillRoundedRect(px, py, panelW, panelH, 28);
    panel.lineStyle(5, 0x3da9ff, 1);
    panel.strokeRoundedRect(px, py, panelW, panelH, 28);

    const cx = width / 2;
    const titleText = scene.add
      .text(cx, py + 70, title, { fontFamily: FONT, fontSize: '56px', color: titleColor, stroke: '#000000', strokeThickness: 10 })
      .setOrigin(0.5);

    const playerIcon = scene.add.image(cx - 150, py + 180, 'player').setDisplaySize(96, 96);
    const botIcon = scene.add.image(cx + 150, py + 180, 'opponent').setDisplaySize(96, 96);
    const scoreText = scene.add
      .text(cx, py + 180, `${score.player} - ${score.bot}`, { fontFamily: FONT, fontSize: '60px', color: '#ffffff', stroke: '#000000', strokeThickness: 8 })
      .setOrigin(0.5);

    const sub = scene.add
      .text(cx, py + 270, 'Real matches are waiting!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#d6e9ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const cta = scene.add.container(cx, py + 360);
    const ctaBg = scene.add.graphics();
    ctaBg.fillStyle(0x0a7a2f, 1);
    ctaBg.fillRoundedRect(-180, -36 + 5, 360, 72, 36);
    ctaBg.fillStyle(0x2fd35f, 1);
    ctaBg.fillRoundedRect(-180, -36, 360, 72, 36);
    ctaBg.fillStyle(0xffffff, 0.22);
    ctaBg.fillRoundedRect(-166, -30, 332, 26, 16);
    const ctaText = scene.add
      .text(0, 0, 'PLAY NOW', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a5a22', strokeThickness: 6 })
      .setOrigin(0.5);
    cta.add([ctaBg, ctaText]);
    cta.setSize(360, 72).setInteractive();
    cta.on('pointerdown', () => openStore());

    const replay = scene.add
      .text(cx, py + panelH - 42, '↻ Play Again', { fontFamily: FONT, fontSize: '22px', color: '#9fc6ff' })
      .setOrigin(0.5)
      .setPadding(14, 8, 14, 8)
      .setInteractive({ useHandCursor: true });
    replay.on('pointerdown', (pointer, x, y, event) => {
      event.stopPropagation();
      onReplay();
    });

    this.root.add([dim, panel, titleText, playerIcon, botIcon, scoreText, sub, cta, replay]);

    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 300 });
    titleText.setScale(0.3);
    scene.tweens.add({ targets: titleText, scale: 1, duration: 500, ease: 'Back.Out', delay: 150 });
    scene.tweens.add({ targets: cta, scale: 1.08, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
}
