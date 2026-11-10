import { GAME_WIDTH as W, GAME_HEIGHT as H, BOARD } from '../config.js';

// Scenery, effects and derived unit textures are painted here on canvas.
const TAU = Math.PI * 2;

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
  return tex;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Tight bounding box of the non-transparent pixels.
function alphaBox(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width;
  let y0 = c.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      if (data[(y * c.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 };
}

// Trimmed copy of a unit (feet at the bottom edge) + a steel-blue enemy version.
function makeUnitTextures(scene, key) {
  const img = scene.textures.get(key).getSourceImage();
  const b = alphaBox(img);
  canvasTex(scene, `${key}-u`, b.w, b.h, (ctx) => ctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h));
  canvasTex(scene, `${key}-e`, b.w, b.h, (ctx) => {
    ctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    const id = ctx.getImageData(0, 0, b.w, b.h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i];
      const g = d[i + 1];
      const bl = d[i + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * bl;
      // warm saturated cloth → cold steel blue; skin/metal keep some of their colour
      const sat = Math.max(r, g, bl) - Math.min(r, g, bl);
      const k = Math.min(1, sat / 90) * 0.85;
      d[i] = Math.min(255, r * (1 - k) + lum * 0.62 * k);
      d[i + 1] = Math.min(255, g * (1 - k) + lum * 0.78 * k);
      d[i + 2] = Math.min(255, bl * (1 - k) + Math.min(255, lum * 1.35 + 20) * k);
    }
    ctx.putImageData(id, 0, 0);
  });
  // Card portrait: head + shoulders on a warm backdrop
  canvasTex(scene, `${key}-p`, 200, 200, (ctx) => {
    const g = ctx.createRadialGradient(100, 80, 10, 100, 100, 140);
    g.addColorStop(0, '#f6dca0');
    g.addColorStop(1, '#a3542a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 200, 200);
    const size = Math.min(b.w, b.h * 0.62);
    const sx = b.x + (b.w - size) / 2 + (key === 'akinci' ? b.w * 0.06 : 0);
    ctx.drawImage(img, sx, b.y - size * 0.02, size, size, 0, 6, 200, 200);
  });
}

export function makeTextures(scene) {
  ['yeniceri', 'azap', 'akinci'].forEach((k) => makeUnitTextures(scene, k));

  // ── Background ──
  canvasTex(scene, 'bg', W, H, (ctx) => {
    const hz = 470; // horizon
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#4f6fa3');
    sky.addColorStop(0.55, '#a9a7b8');
    sky.addColorStop(1, '#f1c98e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);

    // sun haze
    const sun = ctx.createRadialGradient(470, hz - 70, 10, 470, hz - 70, 330);
    sun.addColorStop(0, 'rgba(255,236,190,0.95)');
    sun.addColorStop(0.25, 'rgba(255,214,150,0.45)');
    sun.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, hz + 40);

    // clouds (soft streaks)
    const rand = rng(7);
    ctx.fillStyle = 'rgba(255,240,220,0.35)';
    for (let i = 0; i < 9; i++) {
      const x = rand() * W;
      const y = 90 + rand() * 230;
      ctx.beginPath();
      ctx.ellipse(x, y, 90 + rand() * 120, 10 + rand() * 12, 0, 0, TAU);
      ctx.fill();
    }

    const ridge = (color, base, amp, freq, phase, step = 6) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, hz + 10);
      for (let x = 0; x <= W; x += step) {
        const y = base - amp * (0.55 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.7 + phase * 2) + 0.15 * Math.sin(x * freq * 6.1));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, hz + 10);
      ctx.closePath();
      ctx.fill();
    };
    ridge('#8f93ad', hz - 80, 70, 0.006, 1.2);
    ridge('#7b7f8f', hz - 40, 45, 0.011, 3.0);
    ridge('#6a6a52', hz - 8, 22, 0.02, 5.0, 4);

    // ground
    const ground = ctx.createLinearGradient(0, hz, 0, H);
    ground.addColorStop(0, '#9d9a5a');
    ground.addColorStop(0.18, '#7f8a3e');
    ground.addColorStop(0.6, '#5d6a2a');
    ground.addColorStop(1, '#2b3014');
    ctx.fillStyle = ground;
    ctx.fillRect(0, hz - 4, W, H - hz + 4);

    // haze at the horizon
    const haze = ctx.createLinearGradient(0, hz - 30, 0, hz + 60);
    haze.addColorStop(0, 'rgba(241,201,142,0)');
    haze.addColorStop(0.5, 'rgba(241,201,142,0.55)');
    haze.addColorStop(1, 'rgba(241,201,142,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, hz - 30, W, 90);

    // grass strokes, denser + bigger towards the viewer
    for (let i = 0; i < 2600; i++) {
      const t = Math.pow(rand(), 0.8);
      const y = hz + 10 + t * (H - hz);
      const x = rand() * W;
      const len = 2 + t * 12;
      ctx.strokeStyle = rand() < 0.5 ? `rgba(40,55,10,${0.25 + t * 0.3})` : `rgba(190,190,110,${0.15 + t * 0.2})`;
      ctx.lineWidth = 0.6 + t * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * len * 0.6, y - len);
      ctx.stroke();
    }

    // trodden dirt under the battle area
    const top = BOARD.rowY[0] - 60;
    const bottom = BOARD.rowY[2] + 70;
    const dirt = ctx.createRadialGradient(W / 2, (top + bottom) / 2, 40, W / 2, (top + bottom) / 2, 420);
    dirt.addColorStop(0, 'rgba(150,120,70,0.55)');
    dirt.addColorStop(1, 'rgba(150,120,70,0)');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, top - 80, W, bottom - top + 160);

    // foreground vignette for the card tray
    const fg = ctx.createLinearGradient(0, 960, 0, H);
    fg.addColorStop(0, 'rgba(20,15,5,0)');
    fg.addColorStop(1, 'rgba(20,15,5,0.85)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, 960, W, H - 960);
  });

  // ── Ottoman tent ──
  canvasTex(scene, 'tent', 240, 230, (ctx) => {
    ctx.translate(120, 0);
    // pole + banner
    ctx.fillStyle = '#5b3a1a';
    ctx.fillRect(-3, 0, 6, 90);
    ctx.fillStyle = '#c3122b';
    ctx.beginPath();
    ctx.moveTo(3, 6);
    ctx.quadraticCurveTo(40, 0, 70, 12);
    ctx.lineTo(62, 26);
    ctx.lineTo(70, 40);
    ctx.quadraticCurveTo(40, 30, 3, 40);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, 23, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c3122b';
    ctx.beginPath();
    ctx.arc(36, 22, 7.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9a62e';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TAU);
    ctx.fill();
    // canopy
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.quadraticCurveTo(-60, 120, -110, 150);
      ctx.lineTo(-100, 225);
      ctx.lineTo(100, 225);
      ctx.lineTo(110, 150);
      ctx.quadraticCurveTo(60, 120, 0, 60);
      ctx.closePath();
    };
    body();
    const g = ctx.createLinearGradient(-110, 0, 110, 0);
    g.addColorStop(0, '#f6efe0');
    g.addColorStop(0.6, '#e9dcc0');
    g.addColorStop(1, '#b9a682');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = 'rgba(176,24,40,0.85)';
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(i * 22 - 8, 230);
      ctx.lineTo(i * 22 + 4, 230);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#b01828';
    ctx.fillRect(-110, 146, 220, 16);
    ctx.fillStyle = '#d9a62e';
    for (let x = -104; x < 110; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 162);
      ctx.lineTo(x + 7, 172);
      ctx.lineTo(x + 14, 162);
      ctx.fill();
    }
    // door
    ctx.fillStyle = 'rgba(40,20,10,0.75)';
    ctx.beginPath();
    ctx.moveTo(-22, 225);
    ctx.quadraticCurveTo(0, 170, 22, 225);
    ctx.fill();
    ctx.restore();
  });

  // ── Enemy castle (whole + ruined) ──
  const castle = (ctx, broken) => {
    const stone = (x, y, w, h, shadeL) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, shadeL ? '#a8a49a' : '#8f8b82');
      g.addColorStop(1, shadeL ? '#77736b' : '#5f5c56');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(40,36,30,0.35)';
      ctx.lineWidth = 1;
      for (let yy = y + 14; yy < y + h; yy += 14) {
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + w, yy);
        ctx.stroke();
        for (let xx = x + ((yy / 14) % 2 ? 10 : 22); xx < x + w; xx += 24) {
          ctx.beginPath();
          ctx.moveTo(xx, yy - 14);
          ctx.lineTo(xx, yy);
          ctx.stroke();
        }
      }
    };
    const crenel = (x, y, w, n) => {
      const cw = w / (n * 2 - 1);
      for (let i = 0; i < n; i++) stone(x + i * cw * 2, y - 16, cw, 16, true);
    };
    // walls
    stone(20, 170, 280, 150, false);
    if (!broken) crenel(20, 170, 280, 9);
    // towers
    stone(0, 90, 80, 230, true);
    stone(240, 70, 90, 250, true);
    if (!broken) {
      crenel(0, 90, 80, 3);
      // roofs
      ctx.fillStyle = '#3c5d8f';
      ctx.beginPath();
      ctx.moveTo(-6, 74);
      ctx.lineTo(40, 6);
      ctx.lineTo(86, 74);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(234, 54);
      ctx.lineTo(285, -20 + 20);
      ctx.lineTo(336, 54);
      ctx.fill();
      // flag
      ctx.fillStyle = '#3b3b3b';
      ctx.fillRect(284, -10 + 20, 3, 40 - 20);
    } else {
      // jagged broken tops
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(80, 60);
      ctx.lineTo(80, 150);
      ctx.lineTo(55, 128);
      ctx.lineTo(38, 160);
      ctx.lineTo(18, 120);
      ctx.lineTo(0, 140);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(230, 40);
      ctx.lineTo(340, 40);
      ctx.lineTo(340, 170);
      ctx.lineTo(310, 130);
      ctx.lineTo(288, 175);
      ctx.lineTo(262, 120);
      ctx.lineTo(240, 150);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(60, 150);
      ctx.lineTo(260, 150);
      ctx.lineTo(240, 215);
      ctx.lineTo(190, 190);
      ctx.lineTo(150, 230);
      ctx.lineTo(110, 195);
      ctx.lineTo(70, 210);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // rubble + soot
      ctx.fillStyle = 'rgba(30,25,20,0.35)';
      ctx.fillRect(0, 160, 340, 160);
      const rand = rng(3);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = rand() < 0.5 ? '#8a867c' : '#6b675f';
        const x = rand() * 340;
        const s = 6 + rand() * 16;
        ctx.fillRect(x, 300 + rand() * 20 - s / 2, s, s * 0.7);
      }
    }
    // gate
    ctx.fillStyle = '#2b1d12';
    ctx.beginPath();
    ctx.moveTo(130, 320);
    ctx.lineTo(130, 260);
    ctx.quadraticCurveTo(160, 220, 190, 260);
    ctx.lineTo(190, 320);
    ctx.fill();
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 3;
    for (let x = 138; x < 190; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 248);
      ctx.lineTo(x, 320);
      ctx.stroke();
    }
    // windows
    ctx.fillStyle = '#2b2218';
    [
      [30, 140],
      [270, 110],
      [270, 180],
    ].forEach(([x, y]) => {
      if (broken && y < 160) return;
      ctx.fillRect(x, y, 14, 24);
    });
  };
  canvasTex(scene, 'castle', 340, 330, (ctx) => {
    ctx.translate(0, 10);
    castle(ctx, false);
  });
  canvasTex(scene, 'castle-broken', 340, 330, (ctx) => {
    ctx.translate(0, 10);
    castle(ctx, true);
  });
  canvasTex(scene, 'flag-blue', 60, 40, (ctx) => {
    ctx.fillStyle = '#2f5fae';
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(30, -4, 58, 6);
    ctx.lineTo(50, 20);
    ctx.lineTo(58, 34);
    ctx.quadraticCurveTo(30, 26, 0, 34);
    ctx.fill();
    ctx.fillStyle = '#f2d36b';
    ctx.fillRect(14, 12, 18, 10);
  });

  // ── FX ──
  canvasTex(scene, 'shadow', 128, 40, (ctx) => {
    const g = ctx.createRadialGradient(64, 20, 4, 64, 20, 64);
    g.addColorStop(0, 'rgba(20,15,5,0.55)');
    g.addColorStop(1, 'rgba(20,15,5,0)');
    ctx.fillStyle = g;
    ctx.scale(1, 40 / 128);
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, TAU);
    ctx.fill();
  });
  canvasTex(scene, 'dot', 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  canvasTex(scene, 'smoke', 96, 96, (ctx) => {
    const rand = rng(11);
    for (let i = 0; i < 7; i++) {
      const x = 30 + rand() * 36;
      const y = 30 + rand() * 36;
      const r = 18 + rand() * 14;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  });
  canvasTex(scene, 'spark', 48, 48, (ctx) => {
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
  canvasTex(scene, 'arrow', 110, 16, (ctx) => {
    ctx.strokeStyle = '#6b4a22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(96, 8);
    ctx.stroke();
    ctx.fillStyle = '#c9ccd2';
    ctx.beginPath();
    ctx.moveTo(110, 8);
    ctx.lineTo(94, 2);
    ctx.lineTo(97, 8);
    ctx.lineTo(94, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e0cf';
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(20, 8);
    ctx.lineTo(0, 14);
    ctx.lineTo(6, 8);
    ctx.closePath();
    ctx.fill();
  });
  // sword slash crescent
  canvasTex(scene, 'slash', 220, 220, (ctx) => {
    ctx.translate(110, 110);
    const g = ctx.createLinearGradient(-100, -100, 100, 100);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,250,230,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 100, -1.9, 1.2);
    ctx.arc(18, -6, 82, 1.2, -1.9, true);
    ctx.closePath();
    ctx.fill();
  });
  canvasTex(scene, 'rays', 512, 512, (ctx) => {
    ctx.translate(256, 256);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,230,160,0.8)');
      g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 256, a, a + Math.PI / 18);
      ctx.closePath();
      ctx.fill();
    }
  });
  canvasTex(scene, 'coin', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(26, 22, 4, 32, 32, 30);
    g.addColorStop(0, '#fff3b8');
    g.addColorStop(0.5, '#f0bf3c');
    g.addColorStop(1, '#9a6510');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#7a4c08';
    ctx.stroke();
    // crescent stamp
    ctx.fillStyle = '#8a5a0c';
    ctx.beginPath();
    ctx.arc(30, 32, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e6b23a';
    ctx.beginPath();
    ctx.arc(35, 31, 11, 0, TAU);
    ctx.fill();
  });
  canvasTex(scene, 'hand', 140, 170, (ctx) => {
    ctx.translate(10, 6);
    ctx.lineJoin = 'round';
    const hand = () => {
      ctx.beginPath();
      ctx.moveTo(38, 70);
      ctx.lineTo(38, 18);
      ctx.arc(52, 18, 14, Math.PI, 0);
      ctx.lineTo(66, 62);
      ctx.arc(78, 66, 12, Math.PI, 0);
      ctx.arc(102, 72, 12, Math.PI, 0);
      ctx.lineTo(114, 120);
      ctx.quadraticCurveTo(112, 158, 74, 158);
      ctx.lineTo(56, 158);
      ctx.quadraticCurveTo(30, 156, 20, 128);
      ctx.lineTo(4, 92);
      ctx.quadraticCurveTo(0, 76, 14, 74);
      ctx.quadraticCurveTo(26, 74, 38, 96);
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.save();
    ctx.translate(6, 8);
    hand();
    ctx.fill();
    ctx.restore();
    hand();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2a1a0c';
    ctx.stroke();
  });
}
