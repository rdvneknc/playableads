import { FONT } from '../config.js';
import { gradText } from './Skin.js';

// Broadcast-style match banners: a slanted ribbon sweeps across the pitch,
// the headline punches in, a sub line slides under it, then everything wipes out.
const STYLES = {
  goal: { ribbon: [0x1f6dff, 0x0a2f86], edge: 0x7fd0ff, text: ['#ffffff', '#fff1a8', '#ffb72e'], stroke: '#2a1300', size: 92 },
  conceded: { ribbon: [0xe2313f, 0x7a0d18], edge: 0xff9a8a, text: ['#ffffff', '#ffe1dc', '#ff8a7a'], stroke: '#3a0606', size: 74 },
  ready: { ribbon: [0x10241a, 0x06120c], edge: 0x5cff9a, text: ['#ffffff', '#e6fff0', '#9dffc4'], stroke: '#05210f', size: 60 },
  go: { ribbon: [0x2fd35f, 0x0b6a2c], edge: 0xd9ffe6, text: ['#ffffff', '#fff6b8', '#ffd23f'], stroke: '#3a2400', size: 84 },
};

export function showBanner(scene, kind, title, sub, holdMs = 1200) {
  const { width, height } = scene.scale;
  const st = STYLES[kind];
  const cy = height / 2 - 30;
  const h = sub ? 150 : 116;
  const root = scene.add.container(width / 2, cy).setDepth(200);

  // ribbon: two-tone gradient strip, slanted ends, bright edges
  const rib = scene.add.graphics();
  const w = width + 200;
  const skew = 40;
  const poly = (y0, y1, color, alpha) => {
    rib.fillStyle(color, alpha);
    rib.beginPath();
    rib.moveTo(-w / 2 + skew, y0);
    rib.lineTo(w / 2, y0);
    rib.lineTo(w / 2 - skew, y1);
    rib.lineTo(-w / 2, y1);
    rib.closePath();
    rib.fillPath();
  };
  poly(-h / 2 + 8, h / 2 + 8, 0x000000, 0.35);
  poly(-h / 2, h / 2, st.ribbon[1], 0.94);
  poly(-h / 2, -h / 2 + h * 0.55, st.ribbon[0], 0.94);
  poly(-h / 2, -h / 2 + 4, st.edge, 1);
  poly(h / 2 - 4, h / 2, st.edge, 1);
  // speed streaks
  for (let i = 0; i < 9; i++) {
    const y = -h / 2 + 14 + Math.random() * (h - 28);
    const x = -w / 2 + Math.random() * w;
    rib.fillStyle(0xffffff, 0.06 + Math.random() * 0.06);
    rib.fillRect(x, y, 80 + Math.random() * 220, 2 + Math.random() * 3);
  }

  const titleT = gradText(scene, 0, sub ? -18 : 0, title, st.size, st.text, st.stroke);
  root.add([rib, titleT]);
  let subT = null;
  if (sub) {
    subT = scene.add
      .text(0, h / 2 - 28, sub, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', letterSpacing: 4 })
      .setOrigin(0.5)
      .setShadow(0, 2, 'rgba(0,0,0,0.6)', 3, false, true);
    root.add(subT);
  }

  // in: ribbon wipes from the left, title punches, sub slides
  rib.x = -width - 200;
  scene.tweens.add({ targets: rib, x: 0, duration: 260, ease: 'Cubic.Out' });
  titleT.setScale(2.2).setAlpha(0);
  scene.tweens.add({ targets: titleT, scale: 1, alpha: 1, duration: 300, delay: 140, ease: 'Back.Out' });
  if (kind === 'goal') {
    scene.tweens.add({ targets: titleT, scale: 1.06, duration: 260, delay: 460, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
  }
  if (subT) {
    subT.setAlpha(0).setX(60);
    scene.tweens.add({ targets: subT, x: 0, alpha: 1, duration: 260, delay: 260, ease: 'Cubic.Out' });
  }

  // out: everything exits to the right
  scene.tweens.add({
    targets: root,
    x: width * 1.6,
    duration: 280,
    delay: holdMs + 300,
    ease: 'Cubic.In',
    onComplete: () => root.destroy(),
  });
  return root;
}
