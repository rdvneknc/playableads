import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { roundRect } from './Environment.js';
import { COLORS as C, ROAD, FONT_UI, TEXT } from '../config.js';

const vcol = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });

export function opLabel(o) {
  const sym = { '+': '+', '-': '−', x: '×', '/': '÷' }[o.op];
  return `${sym}${o.n}`;
}
export const isGood = (o) => o.op === '+' || o.op === 'x';

/* ── Carried war banner (sancak): tall pole with a waving flag ── */
export class WarBanner {
  constructor(scene, color, { height = 5.2, w = 1.9, h = 1.25 } = {}) {
    this.group = new THREE.Group();
    const pole = new Builder()
      .add(P.cyl(0.05, 0.06, height, 6), 0x5a3c22, [0, height / 2, 0])
      .add(P.sph(0.13, 8, 6), C.gold, [0, height + 0.08, 0])
      .add(P.cone(0.08, 0.36, 6), C.gold, [0, height + 0.36, 0])
      .build();
    const pm = new THREE.Mesh(pole, vcol());
    pm.castShadow = true;
    this.group.add(pm);
    this.geo = new THREE.PlaneGeometry(w, h, 10, 2);
    this.geo.translate(w / 2, 0, 0);
    this.base = Float32Array.from(this.geo.attributes.position.array);
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(this.geo, this.mat);
    flag.position.y = height - h / 2 - 0.1;
    flag.castShadow = true;
    this.group.add(flag);
    // gold fringe stripe along the pole edge
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.04), new THREE.MeshStandardMaterial({ color: C.gold, roughness: 0.4 }));
    trim.position.set(0.04, height - h / 2 - 0.1, 0);
    this.group.add(trim);
    this.ph = Math.random() * 6;
    scene.add(this.group);
  }

  update(t, speed = 1) {
    const pos = this.geo.attributes.position;
    const b = this.base;
    for (let i = 0; i < pos.count; i++) {
      const x = b[i * 3];
      pos.setZ(i, Math.sin(t * (5 + speed * 3) - x * 2.6 + this.ph) * 0.2 * x + x * 0.35 * speed);
      pos.setY(i, b[i * 3 + 1] - x * 0.06 * (1 - speed));
    }
    pos.needsUpdate = true;
  }
}

/* ── Gate pair: two glowing panels in an ornate frame, one per half of the road ── */
export class GatePair {
  constructor(scene, ev) {
    this.ev = ev;
    this.group = new THREE.Group();
    this.group.position.z = -ev.d;
    scene.add(this.group);
    const w = ROAD.half - 0.25;
    this.panels = [];
    for (const [side, o] of [
      [-1, ev.left],
      [1, ev.right],
    ]) {
      const tex = this.labelTexture(o);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.6), mat);
      panel.position.set((side * ROAD.half) / 2, 2.1, 0);
      this.group.add(panel);
      // floor glow strip
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 1.6),
        new THREE.MeshBasicMaterial({ color: isGood(o) ? C.good : C.bad, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set((side * ROAD.half) / 2, 0.03, 0);
      this.group.add(glow);
      this.panels.push({ side, o, panel, glow, mat });
    }
    this.frame();
    this.passed = false;
  }

  labelTexture(o) {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 316;
    const ctx = cv.getContext('2d');
    const good = isGood(o);
    const g = ctx.createLinearGradient(0, 0, 0, 316);
    if (good) {
      g.addColorStop(0, 'rgba(120,210,255,0.45)');
      g.addColorStop(1, 'rgba(20,110,240,0.78)');
    } else {
      g.addColorStop(0, 'rgba(255,140,140,0.45)');
      g.addColorStop(1, 'rgba(220,20,40,0.78)');
    }
    ctx.fillStyle = g;
    roundRect(ctx, 6, 6, 500, 304, 26);
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = good ? 'rgba(180,235,255,0.9)' : 'rgba(255,200,200,0.9)';
    ctx.beginPath();
    ctx.moveTo(30, 30);
    ctx.lineTo(482, 30);
    ctx.stroke();
    // sheen
    const s = ctx.createLinearGradient(0, 0, 0, 160);
    s.addColorStop(0, 'rgba(255,255,255,0.35)');
    s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s;
    roundRect(ctx, 16, 14, 480, 140, 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rider = o.kind === 'rider';
    const size = rider ? 132 : 170;
    const y = rider ? 128 : 166;
    // symbol in a font that surely has ×, ÷, − ; number in the game font
    const sym = { '+': '+', '-': '−', x: '×', '/': '÷' }[o.op];
    const symFont = `900 ${size * 0.9}px "Arial Black", Arial, sans-serif`;
    const numFont = `${size}px ${FONT_UI}`;
    ctx.font = symFont;
    const ws = ctx.measureText(sym).width;
    ctx.font = numFont;
    const wn = ctx.measureText(String(o.n)).width;
    const x0 = 256 - (ws + wn + 6) / 2;
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = good ? '#0b3a8a' : '#7a0812';
    ctx.fillStyle = '#ffffff';
    ctx.font = symFont;
    ctx.strokeText(sym, x0, y);
    ctx.fillText(sym, x0, y);
    ctx.font = numFont;
    ctx.strokeText(String(o.n), x0 + ws + 6, y);
    ctx.fillText(String(o.n), x0 + ws + 6, y);
    ctx.textAlign = 'center';
    if (rider) {
      ctx.font = `64px ${FONT_UI}`;
      ctx.lineWidth = 12;
      ctx.strokeText(TEXT.akinci, 256, 236);
      ctx.fillStyle = '#ffe28a';
      ctx.fillText(TEXT.akinci, 256, 236);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  frame() {
    const b = new Builder();
    for (const x of [-ROAD.half, 0, ROAD.half]) {
      b.add(P.cyl(0.36, 0.42, 0.4, 10), 0xd9c7a3, [x, 0.2, 0]);
      b.add(P.cyl(0.22, 0.24, 4.2, 10), 0x7a1018, [x, 2.3, 0]);
      b.add(P.cyl(0.27, 0.27, 0.16, 10), C.gold, [x, 1.0, 0]);
      b.add(P.cyl(0.27, 0.27, 0.16, 10), C.gold, [x, 3.3, 0]);
      b.add(P.sph(0.36, 12, 10), C.gold, [x, 4.6, 0]);
      b.add(P.cone(0.16, 0.5, 10), C.gold, [x, 5.08, 0]);
    }
    for (const s of [-1, 1]) {
      const cx = (s * ROAD.half) / 2;
      b.add(P.box(ROAD.half, 0.42, 0.42), 0x7a1018, [cx, 4.2, 0]);
      b.add(P.box(ROAD.half, 0.1, 0.46), C.gold, [cx, 4.0, 0]);
      b.add(P.box(ROAD.half, 0.1, 0.46), C.gold, [cx, 4.42, 0]);
      b.add(P.sph(0.2, 8, 6), C.gold, [cx, 4.2, -0.22], [0, 0, 0], [1, 1, 0.4]);
    }
    const m = new THREE.Mesh(b.build(), vcol());
    m.castShadow = true;
    this.group.add(m);
    this.frameMesh = m;
  }

  update(t) {
    if (this.passed) return;
    for (const p of this.panels) {
      p.glow.material.opacity = 0.28 + Math.sin(t * 5 + p.side) * 0.1;
    }
  }

  // chosen panel bursts, the other fades
  pass(side, tweenFn) {
    this.passed = true;
    for (const p of this.panels) {
      const chosen = p.side === side;
      tweenFn(chosen ? 0.35 : 0.5, (k) => {
        p.mat.opacity = 1 - k;
        p.glow.material.opacity = 0.35 * (1 - k);
        if (chosen) p.panel.scale.set(1 + k * 0.5, 1 + k * 0.5, 1);
      });
    }
  }
}

/* ── Cheval de frise: sharpened stakes blocking one half of the road ── */
export class Spikes {
  constructor(scene, ev) {
    this.ev = ev;
    const sx = ev.side === 'right' ? 1 : -1;
    this.sx = sx;
    const b = new Builder();
    const x0 = 0.9;
    const len = ROAD.half + 0.35 - x0;
    const cx = sx * (x0 + len / 2);
    b.add(P.cyl(0.26, 0.26, len, 12), 0x6b4424, [cx, 1.0, 0], [0, 0, Math.PI / 2]);
    b.add(P.cyl(0.27, 0.27, 0.12, 12), 0x3a3a40, [sx * (x0 + 0.2), 1.0, 0], [0, 0, Math.PI / 2]);
    b.add(P.cyl(0.27, 0.27, 0.12, 12), 0x3a3a40, [sx * (x0 + len - 0.2), 1.0, 0], [0, 0, Math.PI / 2]);
    for (let x = x0 + 0.35; x < x0 + len; x += 0.75) {
      for (const a of [-0.75, 0.75]) {
        b.add(P.cyl(0.09, 0.11, 2.4, 6), 0x8a5a30, [sx * x, 1.0, 0], [a, 0, 0]);
        b.add(P.cone(0.105, 0.42, 6), 0xe8d6b4, [sx * x, 1.0 + Math.cos(a) * 1.4, Math.sin(a) * -1.4], [a, 0, 0]);
      }
    }
    // red warning cloth
    b.add(P.box(0.06, 0.6, 0.6), C.bad, [sx * (x0 + len - 0.2), 1.5, 0]);
    b.add(P.box(0.06, 0.6, 0.6), C.bad, [sx * (x0 + 0.1), 1.5, 0]);
    const m = new THREE.Mesh(b.build(), vcol());
    m.position.z = -ev.d;
    m.castShadow = true;
    scene.add(m);
    this.mesh = m;
    // hazard glow on the ground
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 3),
      new THREE.MeshBasicMaterial({ color: C.bad, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(cx, 0.03, -ev.d);
    scene.add(g);
    this.glow = g;
  }

  blocks(x, z) {
    return Math.abs(z + this.ev.d) < 1.2 && x * this.sx > 0.9;
  }

  update(t) {
    this.glow.material.opacity = 0.18 + Math.sin(t * 6) * 0.08;
  }
}

/* ── Enemy fortress ── */
function stoneTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#8f8270';
  ctx.fillRect(0, 0, 256, 256);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const h = 32;
    const off = (r % 2) * 24;
    for (let x = -48 + off; x < 256; x += 48) {
      const l = 58 + Math.random() * 16;
      ctx.fillStyle = `hsl(${32 + Math.random() * 8}, ${14 + Math.random() * 8}%, ${l}%)`;
      ctx.fillRect(x + 2, r * h + 2, 44, h - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 4, r * h + 3, 40, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 4, r * h + h - 9, 40, 5);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class Castle {
  constructor(scene, z) {
    this.z = z; // gate line (world z)
    const group = new THREE.Group();
    group.position.z = z;
    scene.add(group);
    this.group = group;
    const tex = stoneTexture();
    const stone = (rx, ry) => {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(rx, ry);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, color: 0xf3eadc });
    };
    const add = (geo, mat, x, y, zz, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, zz);
      m.castShadow = shadow;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };
    const WH = 8.5;
    // curtain wall (gap for the gate)
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(22, WH, 3.4), stone(5.5, 2.2), s * 15.2, WH / 2, -1.7);
    }
    // wall over the gate
    add(new THREE.BoxGeometry(8.6, 2.6, 3.4), stone(2.2, 0.7), 0, WH - 1.3, -1.7);
    // battlements + walk
    const merlonGeo = new THREE.BoxGeometry(1.0, 1.2, 0.8);
    const merlonMat = stone(0.3, 0.3);
    this.merlons = [];
    for (let x = -26; x <= 26; x += 1.9) {
      if (Math.abs(Math.abs(x) - 5.6) < 1.8) continue;
      this.merlons.push(add(merlonGeo, merlonMat, x, WH + 0.6, -0.4));
    }
    // gate towers & corner towers with blue conical roofs
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c5fb8, roughness: 0.6 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xe8b33a, roughness: 0.4, metalness: 0.3 });
    this.bannerMat = new THREE.MeshStandardMaterial({ color: C.enemyCoat, roughness: 0.7, side: THREE.DoubleSide });
    this.banners = [];
    const tower = (x, zz, r, h) => {
      add(new THREE.CylinderGeometry(r, r * 1.08, h, 20), stone(4, 2.6), x, h / 2, zz);
      add(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.9, 20), stone(4.5, 0.3), x, h + 0.3, zz);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        add(new THREE.BoxGeometry(0.8, 1.0, 0.6), merlonMat, x + Math.cos(a) * r * 1.1, h + 1.2, zz + Math.sin(a) * r * 1.1, false);
      }
      add(new THREE.ConeGeometry(r * 1.25, r * 1.9, 20), roofMat, x, h + 1.0 + r * 0.95, zz);
      add(new THREE.SphereGeometry(0.3, 10, 8), trimMat, x, h + 1.1 + r * 1.9, zz);
      // banner
      const pole = add(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), trimMat, x, h + 2.2 + r * 1.9, zz, false);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 6, 1), this.bannerMat);
      flag.position.set(x + 0.9, h + 3.0 + r * 1.9, zz);
      flag.castShadow = true;
      group.add(flag);
      this.banners.push({ flag, pole, base: flag.position.clone(), ph: Math.random() * 6 });
    };
    tower(-5.6, -1.7, 2.6, 12);
    tower(5.6, -1.7, 2.6, 12);
    tower(-26.5, -1.7, 3.2, 11);
    tower(26.5, -1.7, 3.2, 11);
    // keep
    add(new THREE.BoxGeometry(13, 17, 11), stone(3.2, 4), 0, 8.5, -14);
    for (let x = -6; x <= 6; x += 1.7) {
      add(merlonGeo, merlonMat, x, 17.6, -8.7, false);
      add(merlonGeo, merlonMat, x, 17.6, -19.3, false);
    }
    tower(-6.5, -14, 2.2, 22);
    tower(6.5, -14, 2.2, 22);
    // arrow-slit windows
    const dark = new THREE.MeshBasicMaterial({ color: 0x1c140c });
    for (const x of [-12, -18, 12, 18]) add(new THREE.BoxGeometry(0.5, 1.6, 0.1), dark, x, 4.6, 0.02, false);
    for (const x of [-3.5, 0, 3.5]) add(new THREE.BoxGeometry(0.8, 2.2, 0.1), dark, x, 12, -8.48, false);

    // the gate: arched dark opening + heavy wooden door with iron bands
    add(new THREE.BoxGeometry(6.0, 6.6, 0.2), dark, 0, 3.3, -3.0, false);
    const door = new Builder();
    for (let i = 0; i < 6; i++) door.add(P.box(0.94, 6.2, 0.45), i % 2 ? 0x6b4424 : 0x5d3a1e, [-2.4 + i * 0.96, 3.1, 0]);
    for (const y of [1.0, 3.1, 5.2]) door.add(P.box(5.9, 0.28, 0.5), 0x3a3a40, [0, y, 0.02]);
    for (let i = 0; i < 6; i++) for (const y of [1.0, 3.1, 5.2]) door.add(P.sph(0.09, 6, 4), 0x9aa0a8, [-2.4 + i * 0.96, y, 0.28]);
    door.add(P.torus(0.3, 0.06, 6, 12), 0x9aa0a8, [-0.7, 2.8, 0.3]);
    door.add(P.torus(0.3, 0.06, 6, 12), 0x9aa0a8, [0.7, 2.8, 0.3]);
    this.door = new THREE.Mesh(door.build(), vcol());
    this.door.position.set(0, 0, -0.6);
    this.door.castShadow = true;
    group.add(this.door);
    // portcullis frame (gold trim)
    add(new THREE.BoxGeometry(7.0, 0.4, 0.6), trimMat, 0, 6.6, -0.2);

    // archers on the battlements
    this.archerSpots = [];
    for (const x of [-21, -16, -11, 11, 16, 21, -2.6, 2.6]) this.archerSpots.push(new THREE.Vector3(x, WH, z - 1.2));
  }

  update(t, dt) {
    for (const b of this.banners) {
      const pos = b.flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + 0.9;
        pos.setZ(i, Math.sin(t * 6 + x * 2.2 + b.ph) * 0.22 * x);
      }
      pos.needsUpdate = true;
    }
  }

  // victory: swap banner colours to ours
  claim() {
    this.bannerMat.color.setHex(C.coat);
  }
}
