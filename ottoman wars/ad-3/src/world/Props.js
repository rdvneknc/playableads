import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { roundRect } from './Environment.js';
import { COLORS as C, FONT_UI, TEXT, MAP } from '../config.js';

const vmat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
const mesh = (geo, shadow = true) => {
  const m = new THREE.Mesh(geo, vmat());
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};

/* ── Items: stone blocks and gold ingots, drawn with two InstancedMeshes ── */
export class Items {
  constructor(scene) {
    const stone = new Builder()
      .add(P.box(0.5, 0.24, 0.38), C.stone, [0, 0, 0])
      .add(P.box(0.44, 0.04, 0.32), 0xf6e2b8, [0, 0.13, 0])
      .build();
    const gold = new Builder()
      .add(P.box(0.46, 0.17, 0.28), C.coin, [0, 0, 0])
      .add(P.box(0.34, 0.05, 0.18), 0xfff0a0, [0, 0.1, 0])
      .build();
    const mk = (geo, metal) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: metal ? 0.3 : 0.8, metalness: metal ? 0.55 : 0 }), 420);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    const wood = new Builder()
      .add(P.cyl(0.13, 0.13, 0.56, 9), C.log, [0, 0, -0.07], [0, 0, Math.PI / 2])
      .add(P.cyl(0.12, 0.12, 0.58, 9), 0x8a5a2c, [0, 0.0, 0.11], [0, 0, Math.PI / 2])
      .add(P.cyl(0.1, 0.1, 0.02, 9), 0xe8c48a, [0.29, 0, -0.07], [0, 0, Math.PI / 2])
      .add(P.cyl(0.09, 0.09, 0.02, 9), 0xe8c48a, [0.3, 0, 0.11], [0, 0, Math.PI / 2])
      .build();
    this.mesh = { stone: mk(stone, false), gold: mk(gold, true), wood: mk(wood, false) };
    this.h = { stone: 0.24, gold: 0.17, wood: 0.26 };
    this.o = new THREE.Object3D();
  }

  begin() {
    this.n = { stone: 0, gold: 0, wood: 0 };
  }

  put(type, x, y, z, ry = 0, s = 1) {
    const m = this.mesh[type];
    if (this.n[type] >= 420) return;
    const o = this.o;
    o.position.set(x, y, z);
    o.rotation.set(0, ry, 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    m.setMatrixAt(this.n[type]++, o.matrix);
  }

  end() {
    for (const t of ['stone', 'gold', 'wood']) {
      this.mesh[t].count = this.n[t];
      this.mesh[t].instanceMatrix.needsUpdate = true;
    }
  }
}

/* ── Build pad: dashed square on the ground with an icon, label and counter ── */
export class Pad {
  constructor(scene, def) {
    this.def = def;
    const need = def.need || {};
    this.type = need.stone ? 'stone' : need.wood ? 'wood' : need.gold ? 'gold' : null;
    this.total = need.stone || need.wood || need.gold || 1;
    this.paid = 0;
    this.done = false;
    this.active = false;
    this.cv = document.createElement('canvas');
    this.cv.width = this.cv.height = 256;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.position.set(def.x, 0.05, def.z);
    this.plane.visible = false;
    scene.add(this.plane);
    this.draw();
  }

  draw() {
    const ctx = this.cv.getContext('2d');
    const k = this.paid / this.total;
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(30,18,8,0.55)';
    roundRect(ctx, 8, 8, 240, 240, 34);
    // progress fill from the bottom
    ctx.save();
    ctx.beginPath();
    ctx.rect(8, 248 - 240 * k, 240, 240 * k);
    ctx.clip();
    ctx.fillStyle = { stone: 'rgba(120,200,90,0.75)', wood: 'rgba(200,140,70,0.8)', gold: 'rgba(255,200,60,0.8)' }[this.type] || 'rgba(220,40,50,0.8)';
    roundRect(ctx, 8, 8, 240, 240, 34);
    ctx.restore();
    // dashed border
    ctx.setLineDash([22, 14]);
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(40, 12);
    ctx.arcTo(244, 12, 244, 244, 30);
    ctx.arcTo(244, 244, 12, 244, 30);
    ctx.arcTo(12, 244, 12, 12, 30);
    ctx.arcTo(12, 12, 244, 12, 30);
    ctx.stroke();
    ctx.setLineDash([]);
    // label + icon + count
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `40px ${FONT_UI}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(40,20,6,0.9)';
    if (!this.type) return this.drawBattle(ctx);
    const label = TEXT.pads[this.def.kind];
    ctx.strokeText(label, 128, 62);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(label, 128, 62);
    // icon
    if (this.type === 'stone') {
      ctx.fillStyle = '#e6cfa0';
      ctx.strokeStyle = '#6a4a22';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.rect(60, 104, 52, 34);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(84, 80, 52, 30);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'wood') {
      ctx.fillStyle = '#c08a4a';
      ctx.strokeStyle = '#5a3412';
      ctx.lineWidth = 5;
      for (const [x, y] of [[60, 118], [84, 92], [72, 102]].slice(0, 3)) {
        ctx.beginPath();
        ctx.rect(x, y, 66, 20);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#ffcf3a';
      ctx.strokeStyle = '#7a4a06';
      ctx.lineWidth = 5;
      for (const [x, y] of [[62, 112], [88, 92], [74, 132]]) {
        ctx.beginPath();
        ctx.ellipse(x + 22, y + 8, 24, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    const left = this.total - this.paid;
    ctx.font = `64px ${FONT_UI}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(40,20,6,0.95)';
    ctx.strokeText(String(left), 178, 118);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(left), 178, 118);
    ctx.font = `30px ${FONT_UI}`;
    ctx.lineWidth = 6;
    const word = { stone: 'STONE', wood: 'WOOD', gold: 'AKÇE' }[this.type];
    ctx.strokeText(word, 128, 196);
    ctx.fillStyle = { stone: '#f6e2b8', wood: '#f0c890', gold: '#ffd84a' }[this.type];
    ctx.fillText(word, 128, 196);
    this.tex.needsUpdate = true;
  }

  // "BATTLE!" banner pad: fills while the Pasha stands on it
  drawBattle(ctx) {
    ctx.fillStyle = '#ffffff';
    // crossed swords
    ctx.save();
    ctx.translate(128, 104);
    for (const a of [-0.7, 0.7]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = '#e8eef4';
      ctx.strokeStyle = '#3a1a08';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.rect(-7, -62, 14, 92);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8b33a';
      ctx.beginPath();
      ctx.rect(-24, 28, 48, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.font = `46px ${FONT_UI}`;
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(60,8,8,0.95)';
    ctx.strokeText(TEXT.pads.battle, 128, 196);
    ctx.fillStyle = '#ffe2a0';
    ctx.fillText(TEXT.pads.battle, 128, 196);
    this.tex.needsUpdate = true;
  }

  show() {
    this.active = true;
    this.plane.visible = true;
    this.plane.scale.setScalar(0.01);
  }

  update(t, dt) {
    if (!this.plane.visible) return;
    const target = this.done ? 0.01 : 1 + Math.sin(t * 4) * 0.03;
    const s = this.plane.scale.x + (target - this.plane.scale.x) * Math.min(1, dt * 10);
    this.plane.scale.setScalar(s);
    if (this.done && s < 0.05) this.plane.visible = false;
  }

  pay() {
    this.paid++;
    this.draw();
    if (this.paid >= this.total) this.done = true;
    return this.done;
  }
}

/* ── Buildings ── */
function stoneMat() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c7a26e';
  ctx.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++)
    for (let x = -32 + (r % 2) * 16; x < 128; x += 32) {
      ctx.fillStyle = `hsl(${34 + Math.random() * 6}, ${38 + Math.random() * 10}%, ${68 + Math.random() * 10}%)`;
      ctx.fillRect(x + 2, r * 32 + 2, 28, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 3, r * 32 + 3, 26, 5);
    }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const STONE_TEX = { t: null };
const stone = (rx, ry) => {
  STONE_TEX.t ||= stoneMat();
  const t = STONE_TEX.t.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
};

export function makeWall(len) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 3.2, 1.4), stone(len / 2.2, 1.4));
  body.position.y = 1.6;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const mat = stone(0.4, 0.4);
  for (let x = -len / 2 + 0.45; x <= len / 2 - 0.4; x += 1.05) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), mat);
    m.position.set(x, 3.5, -0.4);
    m.castShadow = true;
    g.add(m);
  }
  const trim = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.2, 1.5), new THREE.MeshStandardMaterial({ color: 0xe9cf9c, roughness: 0.9 }));
  trim.position.y = 3.15;
  g.add(trim);
  return g;
}

// Lv2: a taller parapet with red banners on top of an existing wall
export function upgradeWall(g, len) {
  const add = new THREE.Group();
  const tier = new THREE.Mesh(new THREE.BoxGeometry(len, 1.3, 1.5), stone(len / 2.2, 0.6));
  tier.position.y = 3.85;
  tier.castShadow = tier.receiveShadow = true;
  add.add(tier);
  const mat = stone(0.4, 0.4);
  for (let x = -len / 2 + 0.45; x <= len / 2 - 0.4; x += 1.05) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.55), mat);
    m.position.set(x, 4.85, -0.45);
    m.castShadow = true;
    add.add(m);
  }
  const bmat = new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.7, side: THREE.DoubleSide });
  const gmat = new THREE.MeshStandardMaterial({ color: C.gold, roughness: 0.4, metalness: 0.3 });
  for (let x = -len / 2 + 1.5; x < len / 2; x += 3.2) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), bmat);
    flag.position.set(x, 3.5, -0.78);
    add.add(flag);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), gmat);
    bar.position.set(x, 4.35, -0.78);
    add.add(bar);
  }
  // existing merlons are replaced by the higher ones
  g.children.forEach((c, i) => {
    if (i > 0 && c.position.y > 3.3) c.visible = false;
  });
  g.add(add);
  g.lv2 = add;
  return add;
}

export function makeMarket() {
  const g = new THREE.Group();
  const b = new Builder();
  for (const [x, z] of [[-2.2, -1.1], [2.2, -1.1], [-2.2, 1.1], [2.2, 1.1]]) b.add(P.cyl(0.09, 0.1, 2.9, 7), C.woodDark, [x, 1.45, z]);
  for (let i = 0; i < 9; i++) b.add(P.box(0.5, 0.06, 2.7), i % 2 ? 0xf4ecda : C.red, [-2.0 + i * 0.5, 3.05 - Math.abs(i - 4) * 0.05, 0], [0.18, 0, 0]);
  for (let i = 0; i < 9; i++) b.add(P.cone(0.25, 0.32, 3), i % 2 ? 0xf4ecda : C.red, [-2.0 + i * 0.5, 2.62, -1.42], [Math.PI, 0, 0]);
  b.add(P.box(4.2, 0.18, 1.3), 0x9a6232, [0, 1.0, -0.6]);
  b.add(P.box(4.0, 0.9, 1.1), 0x7a4a24, [0, 0.5, -0.6]);
  // goods on the counter
  b.add(P.box(0.5, 0.24, 0.38), C.stone, [-1.4, 1.22, -0.6]);
  b.add(P.box(0.5, 0.24, 0.38), C.stone, [-1.35, 1.46, -0.55], [0, 0.3, 0]);
  b.add(P.cyl(0.12, 0.12, 0.6, 8), C.log, [-0.5, 1.22, -0.6], [0, 0, Math.PI / 2]);
  b.add(P.cyl(0.25, 0.3, 0.35, 10), 0xd98a3a, [0.5, 1.27, -0.65]);
  b.add(P.sph(0.12, 8, 6), 0xe8463a, [1.3, 1.2, -0.6]);
  b.add(P.sph(0.12, 8, 6), 0xf2c23a, [1.5, 1.2, -0.45]);
  b.add(P.sph(0.12, 8, 6), 0x7ab83a, [1.45, 1.22, -0.75]);
  // sacks & scales
  b.add(P.sph(0.45, 8, 6), 0xd8c49a, [-2.9, 0.38, 0.2], [0, 0, 0], [1, 0.85, 1]);
  b.add(P.sph(0.4, 8, 6), 0xcdb68a, [2.9, 0.34, 0.4], [0, 0, 0], [1, 0.85, 1]);
  const m = mesh(b.build());
  g.add(m);
  return g;
}

export function makeGrove() {
  const g = new THREE.Group();
  const palm = (x, z, s, lean) => {
    const b = new Builder();
    for (let k = 0; k < 6; k++) b.add(P.cyl(0.17 - k * 0.012, 0.19 - k * 0.012, 0.75, 7), k % 2 ? 0x8a6238 : 0x7a5530, [k * lean, 0.37 + k * 0.72, 0], [0, 0, -lean]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.add(P.box(0.5, 0.06, 2.4), k % 2 ? 0x4f8a2e : 0x3f7a26, [6 * lean + Math.cos(a) * 1.0, 4.35, Math.sin(a) * 1.0], [0.45, -a + Math.PI / 2, 0]);
    }
    b.add(P.sph(0.22, 8, 6), 0x8a4a1c, [6 * lean, 4.25, 0]);
    const m = mesh(b.build());
    m.position.set(x, 0, z);
    m.scale.setScalar(s);
    m.rotation.y = x * 1.7;
    g.add(m);
  };
  palm(0, -2.2, 1.1, 0.07);
  palm(2.4, -0.5, 0.95, 0.05);
  palm(-0.6, 1.6, 1.0, 0.08);
  palm(2.2, 2.6, 0.9, 0.06);
  palm(3.6, -2.6, 1.05, 0.04);
  // chopped stumps
  const b = new Builder();
  b.add(P.cyl(0.22, 0.26, 0.4, 8), 0x8a6238, [-1.6, 0.2, -0.4]);
  b.add(P.cyl(0.21, 0.21, 0.02, 8), 0xe8c48a, [-1.6, 0.41, -0.4]);
  b.add(P.cyl(0.13, 0.13, 1.4, 8), C.log, [0.8, 0.13, 1.0], [0, 0.6, Math.PI / 2]);
  g.add(mesh(b.build()));
  return g;
}

export function makeGate() {
  const g = new THREE.Group();
  const tower = (x) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 4.8, 14), stone(2.4, 2));
    t.position.set(x, 2.4, 0);
    t.castShadow = t.receiveShadow = true;
    g.add(t);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.8, 14), new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.6 }));
    roof.position.set(x, 5.7, 0);
    roof.castShadow = true;
    g.add(roof);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.4, roughness: 0.4 }));
    tip.position.set(x, 6.7, 0);
    g.add(tip);
  };
  tower(-2.6);
  tower(2.6);
  const door = new Builder();
  for (let i = 0; i < 5; i++) door.add(P.box(0.78, 3.0, 0.3), i % 2 ? 0x7a4a24 : 0x6a3f1e, [-1.56 + i * 0.78, 1.5, 0]);
  for (const y of [0.6, 2.4]) door.add(P.box(3.9, 0.2, 0.34), 0x3a3a40, [0, y, 0.01]);
  const d = mesh(door.build());
  g.add(d);
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 1.4), stone(2, 0.5));
  top.position.set(0, 3.45, 0);
  top.castShadow = true;
  g.add(top);
  g.door = d;
  return g;
}

export function makeTower() {
  const g = new THREE.Group();
  const b = new Builder();
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(P.cyl(0.14, 0.17, 4.2, 7), C.woodDark, [x, 2.1, z]);
  b.add(P.box(2.2, 0.06, 0.12), C.wood, [0, 1.4, -1], [0, 0, 0.9]);
  b.add(P.box(2.2, 0.06, 0.12), C.wood, [0, 1.4, 1], [0, 0, -0.9]);
  b.add(P.box(2.9, 0.25, 2.9), C.wood, [0, 4.2, 0]);
  for (const s of [-1, 1]) {
    b.add(P.box(2.9, 0.8, 0.12), 0x9a6a38, [0, 4.75, s * 1.4]);
    b.add(P.box(0.12, 0.8, 2.9), 0x9a6a38, [s * 1.4, 4.75, 0]);
  }
  b.add(P.cyl(0.05, 0.05, 2.2, 6), C.woodDark, [1.3, 5.6, 1.3]);
  b.add(P.box(1.1, 0.7, 0.04), C.red, [1.85, 6.3, 1.3]);
  b.add(P.cone(2.2, 1.4, 4), C.red, [0, 6.6, 0], [0, Math.PI / 4, 0]);
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) b.add(P.cyl(0.07, 0.07, 1.6, 6), C.woodDark, [x, 5.8, z]);
  g.add(mesh(b.build()));
  g.archerSpots = [new THREE.Vector3(-0.55, 4.33, -0.5), new THREE.Vector3(0.55, 4.33, -0.5)];
  return g;
}

// Catapult: frame + wheels + an arm that swings about its axle
export function makeCatapult() {
  const g = new THREE.Group();
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.add(P.box(0.25, 0.3, 3.6), C.wood, [s * 0.9, 0.75, 0]);
    b.add(P.box(0.22, 2.4, 0.22), C.wood, [s * 0.9, 1.9, 0.2], [-0.15, 0, 0]);
    b.add(P.box(0.2, 0.2, 1.8), C.wood, [s * 0.9, 1.6, 0.85], [0.75, 0, 0]);
    for (const z of [-1.2, 1.2]) {
      b.add(P.cyl(0.62, 0.62, 0.16, 16), C.woodDark, [s * 1.12, 0.62, z], [0, 0, Math.PI / 2]);
      b.add(P.torus(0.6, 0.05, 6, 18), 0x9aa0a8, [s * 1.2, 0.62, z], [0, Math.PI / 2, 0]);
      b.add(P.box(0.06, 1.1, 0.12), 0x9aa0a8, [s * 1.2, 0.62, z]);
      b.add(P.box(0.06, 0.12, 1.1), 0x9aa0a8, [s * 1.2, 0.62, z]);
    }
  }
  b.add(P.box(2.0, 0.25, 0.25), C.wood, [0, 0.75, -1.5]);
  b.add(P.box(2.0, 0.25, 0.25), C.wood, [0, 0.75, 1.5]);
  b.add(P.box(2.0, 0.25, 0.3), C.wood, [0, 3.0, 0.4]);
  b.add(P.cyl(0.08, 0.08, 2.0, 8), 0x3a3a40, [0, 2.0, -0.1], [0, 0, Math.PI / 2]);
  b.add(P.cyl(0.22, 0.22, 1.4, 12), 0xa07a50, [0, 1.0, 0.9], [0, 0, Math.PI / 2]);
  g.add(mesh(b.build()));
  const arm = new THREE.Group();
  arm.position.set(0, 2.0, -0.1);
  const ab = new Builder()
    .add(P.box(0.24, 0.24, 3.4), C.wood, [0, 0, 1.2])
    .add(P.cyl(0.42, 0.32, 0.3, 12), C.woodDark, [0, 0.12, 2.75])
    .add(P.box(0.6, 0.5, 0.6), 0x5a5a60, [0, -0.1, -0.6]);
  arm.add(mesh(ab.build()));
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1, flatShading: true }));
  rock.position.set(0, 0.45, 2.75);
  rock.castShadow = true;
  arm.add(rock);
  arm.rotation.x = -0.35; // loaded (cup down-back)
  g.add(arm);
  g.arm = arm;
  g.rockMesh = rock;
  return g;
}

export function makeQuarry() {
  const g = new THREE.Group();
  const b = new Builder();
  const blocks = [
    [0, 1.6, -1.5, 3.2, 3.2], [-1.8, 1.0, -0.4, 2.2, 2.0], [1.8, 1.3, -0.8, 2.4, 2.6], [0.4, 0.5, 0.8, 1.5, 1.0], [-2.6, 0.5, 1.2, 1.2, 0.9],
  ];
  for (const [x, y, z, w, h] of blocks) b.add(new THREE.DodecahedronGeometry(1, 0), C.rock, [x, y, z], [0.3, x, 0.2], [w * 0.6, h * 0.6, w * 0.55]);
  b.add(new THREE.DodecahedronGeometry(1, 0), C.rockDark, [0.8, 2.6, -1.8], [0.5, 1, 0], [1.1, 0.9, 1]);
  // cut-stone blocks lying around
  b.add(P.box(0.6, 0.35, 0.5), C.stone, [1.6, 0.18, 1.4], [0, 0.4, 0]);
  b.add(P.box(0.6, 0.35, 0.5), C.stone, [-1.2, 0.18, 1.9], [0, -0.3, 0]);
  b.add(P.cyl(0.04, 0.04, 1.1, 5), C.wood, [2.4, 0.4, 1.0], [0.4, 0, 1.1]);
  b.add(P.box(0.32, 0.12, 0.08), C.steel, [2.85, 0.68, 1.0], [0, 0, 1.1]);
  const m = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return g;
}

export function makeTreasury() {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(P.cyl(2.3, 2.3, 2.0, 18), 0xf6eedc, [0, 1.0, 0]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.add(P.box(0.5, 2.02, 0.06), 0x2f7a3e, [Math.cos(a) * 2.31, 1.01, Math.sin(a) * 2.31], [0, -a + Math.PI / 2, 0]);
  }
  b.add(P.cone(2.8, 2.6, 18), 0x2f7a3e, [0, 3.3, 0]);
  b.add(P.cyl(2.82, 2.82, 0.2, 18), C.gold, [0, 2.05, 0]);
  b.add(P.sph(0.22, 10, 8), C.gold, [0, 4.75, 0]);
  b.add(P.box(1.6, 1.7, 0.06), 0x3a1a10, [0, 0.85, 2.31]);
  // treasure chest in front
  b.add(P.box(1.2, 0.6, 0.75), 0x8a4a1c, [0, 0.3, 3.3]);
  b.add(P.cyl(0.375, 0.375, 1.2, 12, 1), 0x9a5a24, [0, 0.6, 3.3], [0, 0, Math.PI / 2], [1, 1, 1]);
  b.add(P.box(1.24, 0.08, 0.8), C.gold, [0, 0.55, 3.3]);
  b.add(P.box(0.18, 0.22, 0.06), C.gold, [0, 0.5, 3.69]);
  for (let i = 0; i < 6; i++) b.add(P.cyl(0.12, 0.12, 0.04, 10), C.coin, [-0.4 + i * 0.16, 0.95 + (i % 2) * 0.04, 3.2], [0.3, 0, 0]);
  const m = mesh(b.build());
  g.add(m);
  return g;
}

/* ── Bouncing guide arrow over the next target ── */
export class Guide {
  constructor(scene) {
    const b = new Builder()
      .add(P.cone(0.55, 0.9, 4), 0xffd23f, [0, 0.45, 0], [Math.PI, Math.PI / 4, 0])
      .add(P.box(0.45, 0.8, 0.45), 0xffd23f, [0, 1.25, 0], [0, Math.PI / 4, 0]);
    this.mesh = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.target = null;
  }

  set(x, z) {
    this.target = x == null ? null : new THREE.Vector3(x, 0, z);
    this.mesh.visible = !!this.target;
  }

  update(t) {
    if (!this.target) return;
    this.mesh.position.set(this.target.x, 3.2 + Math.abs(Math.sin(t * 4)) * 0.9, this.target.z);
    this.mesh.rotation.y = t * 2;
  }
}

export { MAP };
