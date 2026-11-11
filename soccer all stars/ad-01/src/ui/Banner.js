import { FONT } from '../config.js';
import { gradText } from './Skin.js';

// Match call-outs: text only (no strip over the pitch) — a gradient headline that
// punches in, an optional small score line under it, then a quick fade up and out.
const STYLES = {
  goal: { text: ['#ffffff', '#fff1a8', '#ffb72e'], stroke: '#2a1300', size: 96, sub: '#ffe9a8' },
  conceded: { text: ['#ffffff', '#ffe1dc', '#ff7a6a'], stroke: '#3a0606', size: 78, sub: '#ffd0c8' },
  ready: { text: ['#ffffff', '#e6fff0', '#9dffc4'], stroke: '#05210f', size: 64 },
  go: { text: ['#ffffff', '#fff6b8', '#ffd23f'], stroke: '#3a2400', size: 92 },
};

export function showBanner(scene, kind, title, sub, holdMs = 1200) {
  const { width, height } = scene.scale;
  const st = STYLES[kind];
  const root = scene.add.container(width / 2, height / 2 - 40).setDepth(200);

  const titleT = gradText(scene, 0, 0, title, st.size, st.text, st.stroke);
  titleT.setStroke(st.stroke, Math.round(st.size * 0.17));
  titleT.setShadow(0, 6, 'rgba(0,0,0,0.55)', 10, true, true);
  root.add(titleT);

  let subT = null;
  if (sub) {
    subT = scene.add
      .text(0, st.size * 0.62 + 6, sub, {
        fontFamily: FONT,
        fontSize: '24px',
        color: st.sub || '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, 'rgba(0,0,0,0.5)', 4, true, true);
    root.add(subT);
  }

  titleT.setScale(2.2).setAlpha(0);
  scene.tweens.add({ targets: titleT, scale: 1, alpha: 1, duration: 300, ease: 'Back.Out' });
  if (kind === 'goal') {
    scene.tweens.add({ targets: titleT, scale: 1.08, duration: 240, delay: 320, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
  }
  if (subT) {
    subT.setAlpha(0).setY(subT.y + 16);
    scene.tweens.add({ targets: subT, y: subT.y - 16, alpha: 1, duration: 260, delay: 180, ease: 'Cubic.Out' });
  }

  scene.tweens.add({
    targets: root,
    alpha: 0,
    y: root.y - 30,
    duration: 260,
    delay: holdMs + 300,
    ease: 'Cubic.In',
    onComplete: () => root.destroy(),
  });
  return root;
}
