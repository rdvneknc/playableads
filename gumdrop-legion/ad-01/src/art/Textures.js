// Every piece of art in Gumdrop Legion is drawn here on canvas — no image files.

const TAU = Math.PI * 2;

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
function shade(color, amt) {
  // amt -1..1 → darker / lighter
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// Seeded random so the sugar speckles are identical on every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gumdropPath(ctx, x, y, w, h) {
  // dome with a soft flat base
  const l = x;
  const r = x + w;
  const b = y + h;
  ctx.beginPath();
  ctx.moveTo(l + w * 0.04, b - h * 0.14);
  ctx.bezierCurveTo(l - w * 0.02, y + h * 0.35, l + w * 0.2, y, x + w / 2, y);
  ctx.bezierCurveTo(r - w * 0.2, y, r + w * 0.02, y + h * 0.35, r - w * 0.04, b - h * 0.14);
  ctx.quadraticCurveTo(r - w * 0.04, b, r - w * 0.18, b);
  ctx.lineTo(l + w * 0.18, b);
  ctx.quadraticCurveTo(l + w * 0.04, b, l + w * 0.04, b - h * 0.14);
  ctx.closePath();
}

// face: null (seen from behind) | 'happy' | 'angry' | 'boss'
function drawGumdrop(ctx, size, color, face, seed = 1) {
  const pad = size * 0.06;
  const w = size - pad * 2;
  const h = w * 0.92;
  const x = pad;
  const y = size - pad - h;

  ctx.save();
  gumdropPath(ctx, x, y, w, h);
  const g = ctx.createRadialGradient(x + w * 0.36, y + h * 0.28, w * 0.05, x + w * 0.5, y + h * 0.55, w * 0.75);
  g.addColorStop(0, shade(color, 0.55));
  g.addColorStop(0.45, hex(color));
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fill();

  // rim light + inner bottom shade
  ctx.clip();
  const bottom = ctx.createLinearGradient(0, y + h * 0.6, 0, y + h);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(40,0,60,0.25)');
  ctx.fillStyle = bottom;
  ctx.fillRect(x, y, w, h);

  // sugar crystals
  const rand = rng(seed);
  for (let i = 0; i < size * 0.9; i++) {
    const px = x + rand() * w;
    const py = y + rand() * h;
    const r = 0.6 + rand() * size * 0.012;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.45})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // gloss
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.33, y + h * 0.22, w * 0.13, h * 0.08, -0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x + w * 0.2, y + h * 0.38, w * 0.035, 0, TAU);
  ctx.fill();
  ctx.restore();

  // outline
  gumdropPath(ctx, x, y, w, h);
  ctx.lineWidth = Math.max(1.5, size * 0.03);
  ctx.strokeStyle = shade(color, -0.55);
  ctx.stroke();

  if (!face) return;
  const cx = x + w / 2;
  const ey = y + h * 0.52;
  const ex = w * 0.17;
  const er = w * (face === 'boss' ? 0.1 : 0.115);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx + s * ex, ey, er, er * 1.18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1b1030';
    ctx.beginPath();
    ctx.arc(cx + s * ex + s * er * 0.12, ey + er * 0.15, er * 0.58, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + s * ex + s * er * 0.12 - er * 0.2, ey - er * 0.15, er * 0.2, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1b1030';
  ctx.lineWidth = Math.max(2, size * 0.035);
  if (face === 'happy') {
    ctx.fillStyle = 'rgba(255,120,170,0.55)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * ex * 1.75, ey + er * 1.3, er * 0.55, er * 0.32, 0, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, ey + er * 1.05, er * 0.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // angry brows + frown
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * ex * 1.65, ey - er * 1.45);
      ctx.lineTo(cx + s * ex * 0.35, ey - er * 0.95);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, ey + er * 2.0, er * 0.6, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    if (face === 'boss') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - er * 0.5, ey + er * 1.45);
      ctx.lineTo(cx - er * 0.2, ey + er * 1.85);
      ctx.lineTo(cx + er * 0.1, ey + er * 1.45);
      ctx.fill();
    }
  }
}

export function makeTextures(scene) {
  // Units
  const players = [0x3d9bff, 0x4fb8ff, 0x6a8cff];
  players.forEach((c, i) => canvasTex(scene, `p${i}`, 96, 96, (ctx) => drawGumdrop(ctx, 96, c, null, 11 + i)));
  canvasTex(scene, 'p-face', 256, 256, (ctx) => drawGumdrop(ctx, 256, 0x3d9bff, 'happy', 7));
  const enemies = [0x9be22e, 0xb8e83a, 0x7fd63b];
  enemies.forEach((c, i) => canvasTex(scene, `e${i}`, 96, 96, (ctx) => drawGumdrop(ctx, 96, c, 'angry', 31 + i)));
  canvasTex(scene, 'boss', 360, 360, (ctx) => drawGumdrop(ctx, 360, 0x8ad61f, 'boss', 99));

  canvasTex(scene, 'shadow', 64, 24, (ctx) => {
    const g = ctx.createRadialGradient(32, 12, 2, 32, 12, 32);
    g.addColorStop(0, 'rgba(60,20,80,0.45)');
    g.addColorStop(1, 'rgba(60,20,80,0)');
    ctx.fillStyle = g;
    ctx.scale(1, 0.375);
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, TAU);
    ctx.fill();
  });

  // Crown for the boss
  canvasTex(scene, 'crown', 200, 130, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(14, 118);
    ctx.lineTo(8, 34);
    ctx.lineTo(56, 74);
    ctx.lineTo(100, 10);
    ctx.lineTo(144, 74);
    ctx.lineTo(192, 34);
    ctx.lineTo(186, 118);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 10, 0, 118);
    g.addColorStop(0, '#fff3a6');
    g.addColorStop(0.5, '#ffc928');
    g.addColorStop(1, '#d98a00');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#8a4a00';
    ctx.lineJoin = 'round';
    ctx.stroke();
    [
      [100, 92, '#ff4f7b'],
      [50, 98, '#2fb4ff'],
      [150, 98, '#2fb4ff'],
    ].forEach(([x, y, c]) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, 4, 0, TAU);
      ctx.fill();
    });
  });

  // Scenery
  canvasTex(scene, 'cloud', 320, 150, (ctx) => {
    const blobs = [
      [80, 95, 52],
      [140, 70, 64],
      [210, 82, 56],
      [255, 105, 40],
      [45, 112, 34],
    ];
    ctx.fillStyle = 'rgba(160,140,220,0.25)';
    blobs.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x + 4, y + 10, r, 0, TAU);
      ctx.fill();
    });
    blobs.forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#f1ecff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    });
  });

  canvasTex(scene, 'hills', 720, 220, (ctx, w, h) => {
    const layer = (color, base, amp, freq, phase) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const y = base - amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.3 + phase * 1.7));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    };
    layer('#f7b9df', 120, 40, 0.012, 0.5);
    layer('#e99bd4', 150, 32, 0.017, 2.1);
    layer('#b48de8', 185, 22, 0.022, 4.0);
    // little lollipops on the far hills
    const rand = rng(5);
    for (let i = 0; i < 14; i++) {
      const x = rand() * w;
      const y = 150 + rand() * 40;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 18, 2, 18);
      ctx.fillStyle = ['#ff6fa8', '#ffd34d', '#6fd6ff'][i % 3];
      ctx.beginPath();
      ctx.arc(x, y - 22, 7, 0, TAU);
      ctx.fill();
    }
  });

  // Lollipop tree
  canvasTex(scene, 'lolli', 160, 300, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(74, 130, 12, 165);
    ctx.fillStyle = 'rgba(200,170,220,0.6)';
    ctx.fillRect(82, 130, 4, 165);
    const cx = 80;
    const cy = 82;
    const R = 74;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#ff5f9e';
    ctx.fillRect(0, 0, 160, 170);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 16;
    ctx.beginPath();
    for (let a = 0; a < 6 * Math.PI; a += 0.1) {
      const r = (a / (6 * Math.PI)) * R;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    const g = ctx.createRadialGradient(cx - 30, cy - 30, 5, cx, cy, R);
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(120,0,60,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 160, 170);
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c2246a';
    ctx.beginPath();
    ctx.arc(cx, cy, R - 2, 0, TAU);
    ctx.stroke();
  });

  // Candy cane
  canvasTex(scene, 'cane', 110, 300, (ctx) => {
    ctx.lineCap = 'round';
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(40, 290);
      ctx.lineTo(40, 70);
      ctx.arc(66, 70, 26, Math.PI, 0);
      ctx.lineTo(92, 96);
    };
    ctx.lineWidth = 26;
    ctx.strokeStyle = '#b0133f';
    path();
    ctx.stroke();
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#ffffff';
    path();
    ctx.stroke();
    ctx.setLineDash([16, 16]);
    ctx.strokeStyle = '#ff3d6e';
    path();
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Gumdrop bush (cluster of big drops)
  canvasTex(scene, 'bush', 220, 150, (ctx) => {
    [
      [10, 40, 110, 0xff7eb6],
      [100, 30, 110, 0xffc94d],
      [55, 55, 100, 0x7fd6ff],
    ].forEach(([x, y, s, c], i) => {
      ctx.save();
      ctx.translate(x, y);
      drawGumdrop(ctx, s, c, null, 60 + i);
      ctx.restore();
    });
  });

  // FX
  canvasTex(scene, 'dot', 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  canvasTex(scene, 'puff', 64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    [
      [32, 32, 20],
      [18, 36, 14],
      [46, 36, 14],
      [32, 20, 14],
    ].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    });
  });
  canvasTex(scene, 'star', 64, 64, (ctx) => {
    ctx.translate(32, 32);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 12 : 30;
      const a = (i / 10) * TAU - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -30, 0, 30);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(1, '#ffb300');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#b86b00';
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
  canvasTex(scene, 'confetti', 14, 22, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 14, 22);
  });
  canvasTex(scene, 'sparkle', 48, 48, (ctx) => {
    ctx.translate(24, 24);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.quadraticCurveTo(3, -3, 24, 0);
    ctx.quadraticCurveTo(3, 3, 0, 24);
    ctx.quadraticCurveTo(-3, 3, -24, 0);
    ctx.quadraticCurveTo(-3, -3, 0, -24);
    ctx.fill();
  });
  canvasTex(scene, 'rays', 512, 512, (ctx) => {
    ctx.translate(256, 256);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 256, a, a + Math.PI / 16);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Pointing hand for the tutorial
  canvasTex(scene, 'hand', 140, 170, (ctx) => {
    ctx.translate(10, 6);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const hand = () => {
      ctx.beginPath();
      // index finger
      ctx.moveTo(38, 70);
      ctx.lineTo(38, 18);
      ctx.arc(52, 18, 14, Math.PI, 0);
      ctx.lineTo(66, 62);
      // knuckles
      ctx.arc(78, 66, 12, Math.PI, 0);
      ctx.arc(102, 72, 12, Math.PI, 0);
      ctx.lineTo(114, 120);
      ctx.quadraticCurveTo(112, 158, 74, 158);
      ctx.lineTo(56, 158);
      ctx.quadraticCurveTo(30, 156, 20, 128);
      // thumb
      ctx.lineTo(4, 92);
      ctx.quadraticCurveTo(0, 76, 14, 74);
      ctx.quadraticCurveTo(26, 74, 38, 96);
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(40,10,60,0.3)';
    ctx.save();
    ctx.translate(6, 8);
    hand();
    ctx.fill();
    ctx.restore();
    hand();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2a1745';
    ctx.stroke();
  });
}

export { drawGumdrop };
