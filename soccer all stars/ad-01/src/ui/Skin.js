import { FONT } from '../config.js';

// Canvas-painted UI pieces shared by the pause menu and the end card.

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
  return key;
}

// Glassy stadium panel: deep navy gradient, diagonal pitch stripes, neon rim.
export function panelTexture(scene, key, w, h, { rim = '#4de0ff', top = '#16305c', bottom = '#0a1630', header = 0 } = {}) {
  return canvasTex(scene, key, w + 24, h + 28, (ctx) => {
    const x = 12;
    const y = 8;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    rr(ctx, x, y, w, h, 30);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    ctx.save();
    rr(ctx, x, y, w, h, 30);
    ctx.clip();
    // diagonal mown-grass stripes, very faint
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = -h; i < w + h; i += 46) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + 23, y);
      ctx.lineTo(x + i + 23 - h, y + h);
      ctx.lineTo(x + i - h, y + h);
      ctx.fill();
    }
    if (header) {
      const hg = ctx.createLinearGradient(0, y, 0, y + header);
      hg.addColorStop(0, 'rgba(255,255,255,0.16)');
      hg.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = hg;
      ctx.fillRect(x, y, w, header);
      ctx.fillStyle = rim;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, y + header, w, 2);
      ctx.globalAlpha = 1;
    }
    // top sheen
    const s = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    s.addColorStop(0, 'rgba(255,255,255,0.10)');
    s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s;
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.restore();

    // neon rim (double)
    ctx.lineWidth = 4;
    ctx.strokeStyle = rim;
    ctx.shadowColor = rim;
    ctx.shadowBlur = 14;
    rr(ctx, x + 2, y + 2, w - 4, h - 4, 28);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    rr(ctx, x + 9, y + 9, w - 18, h - 18, 22);
    ctx.stroke();
  });
}

// Glossy pill button (no text — labels are drawn on top in code).
export function pillTexture(scene, key, w, h, { from = '#5dff8e', to = '#14a64a', edge = '#0b6a2c' } = {}) {
  return canvasTex(scene, key, w + 16, h + 20, (ctx) => {
    const x = 8;
    const y = 4;
    const r = h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = edge;
    rr(ctx, x, y + 5, w, h, r);
    ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    // gloss
    const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
    gl.addColorStop(0, 'rgba(255,255,255,0.55)');
    gl.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = gl;
    rr(ctx, x + 10, y + 4, w - 20, h * 0.45, h * 0.22);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
    ctx.stroke();
  });
}

export function gradText(scene, x, y, str, size, colors = ['#ffffff', '#fff1a8', '#ffb72e'], stroke = '#2a1300') {
  const t = scene.add
    .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', stroke, strokeThickness: Math.round(size * 0.14), padding: { x: 8, y: 8 } })
    .setOrigin(0.5);
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0.2, colors[0]);
  g.addColorStop(0.55, colors[1]);
  g.addColorStop(0.9, colors[2]);
  t.setFill(g);
  t.setShadow(0, Math.round(size * 0.08), 'rgba(0,0,0,0.5)', 4, true, false);
  return t;
}

// Button = pill texture + label, with a light sweep clipped to the pill.
export function pillButton(scene, x, y, label, { w = 300, h = 76, size = 34, colors, onTap, depth = 0 } = {}) {
  const key = `pill-${w}x${h}-${colors ? colors.from : 'g'}`;
  pillTexture(scene, key, w, h, colors);
  const c = scene.add.container(x, y);
  const img = scene.add.image(0, 2, key);
  const t = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', stroke: colors?.edge || '#0b6a2c', strokeThickness: Math.round(size * 0.18) })
    .setOrigin(0.5);
  c.add([img, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    scene.tweens.add({ targets: c, scaleX: c.scaleX * 0.93, scaleY: c.scaleY * 0.93, duration: 70, yoyo: true });
    onTap?.();
  });
  const shine = scene.add.rectangle(0, 0, 34, h * 1.8, 0xffffff, 0.35).setAngle(20).setVisible(false);
  c.add(shine);
  const mask = scene.make.graphics({ add: false });
  c.sweep = () => {
    const m = c.getWorldTransformMatrix();
    mask.clear().fillStyle(0xffffff).fillRoundedRect(m.tx - w / 2, m.ty - h / 2, w, h, h / 2);
    shine.setMask(mask.createGeometryMask());
    shine.setVisible(true).setX(-w / 2 - 40);
    scene.tweens.add({ targets: shine, x: w / 2 + 40, duration: 650, ease: 'Sine.InOut', onComplete: () => shine.setVisible(false) });
  };
  c.setDepth(depth);
  return c;
}
