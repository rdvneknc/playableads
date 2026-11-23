import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { ROWS, COLS } from '../game/Board.js';

// The miniature forest diorama: a wooden tray with the board, mossy ground, mushroom houses,
// big leaves and flower buds that open as the grove wakes up.

const rnd = (a, b) => a + (b - a) * Math.random();
export const CELL = 1;
export const BOARD_Y = 0.32; // top of the tiles

export const cellX = (c) => (c - (COLS - 1) / 2) * CELL;
export const cellZ = (r) => (r - (ROWS - 1) / 2) * CELL;

function roundRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function slab(w, d, r, h, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(roundRect(w, d, r), { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function grassTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#7fbf5e';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const g = 140 + Math.random() * 70;
    ctx.fillStyle = `rgba(${70 + Math.random() * 60},${g},${60 + Math.random() * 40},${0.25 + Math.random() * 0.35})`;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.5 + Math.random() * 4, 1 + Math.random() * 2.5, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const mat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, ...o });
const mesh = (geo, m, shadow = true) => {
  const x = new THREE.Mesh(geo, m);
  x.castShadow = shadow;
  x.receiveShadow = true;
  return x;
};

// a big round leaf lying on the ground (flattened, with a midrib)
function leaf(len, wid, color) {
  const b = new Builder();
  b.add(P.sph(1, 16, 8), color, [0, 0, 0], [0, 0, 0], [wid, 0.08, len]);
  b.add(P.box(0.05, 0.06, len * 1.6), 0xd8f0a8, [0, 0.06, 0]);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.add(P.box(0.03, 0.05, wid * 0.8), 0xc8e898, [s * wid * 0.32, 0.06, -len * 0.5 + i * len * 0.45], [0, s * 0.9, 0]);
  return b.build();
}

function mushroomHouse(capColor = 0xf06a5a) {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(P.cyl(0.9, 1.05, 1.6, 16), 0xfff1d6, [0, 0.8, 0]);
  b.add(P.cyl(0.42, 0.42, 0.06, 12), 0x8a5a30, [0, 0.55, 1.0], [Math.PI / 2, 0, 0], [1, 1, 1.4]);
  b.add(P.box(0.5, 0.8, 0.06), 0x9a6436, [0, 0.42, 1.0]);
  b.add(P.sph(0.05, 6, 4), 0xffd66b, [0.15, 0.45, 1.05]);
  for (let i = 0; i < 5; i++) b.add(P.sph(0.16, 8, 6), 0xb8b0a0, [-0.9 + i * 0.45, 0.06, 1.1 + (i % 2) * 0.12], [0, 0, 0], [1, 0.5, 1]);
  const cap = new THREE.LatheGeometry(
    [1.0, 0.95, 0.75, 0.5, 0.25, 0].map((t) => new THREE.Vector2(Math.sin((t * Math.PI) / 2) * 1.7 + 0.05, 1.5 + Math.cos((t * Math.PI) / 2) * 1.2)),
    20,
  );
  b.add(cap, capColor, [0, 0, 0]);
  b.add(P.cyl(1.75, 1.75, 0.18, 20), 0xffe8c8, [0, 1.48, 0]);
  for (const [a, h, r] of [[0.3, 2.3, 0.22], [2.0, 2.0, 0.28], [3.6, 2.4, 0.18], [4.8, 1.9, 0.24], [1.2, 2.65, 0.16]]) {
    const rr = Math.sin(Math.acos((h - 1.5) / 1.2)) * 1.72;
    b.add(P.sph(r, 10, 6), 0xfff4e0, [Math.cos(a) * rr, h, Math.sin(a) * rr], [0, 0, 0], [1, 0.45, 1]);
  }
  g.add(mesh(b.build(), mat({ roughness: 0.6 })));
  // a round window that lights up when the house wakes
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshStandardMaterial({ color: 0x3a3048, emissive: 0xffc860, emissiveIntensity: 0 }));
  win.position.set(0.45, 1.0, 0.86);
  win.rotation.y = 0.45;
  g.add(win);
  g.window = win;
  return g;
}

function tree(scale = 1) {
  const b = new Builder();
  b.add(P.cyl(0.22, 0.32, 1.6, 8), 0x8a5a38, [0, 0.8, 0]);
  for (const [x, y, z, r, c] of [[0, 2.2, 0, 1.1, 0x5fae5a], [0.7, 1.8, 0.2, 0.8, 0x6dbb62], [-0.7, 1.9, 0.1, 0.85, 0x58a454], [0.1, 2.9, -0.1, 0.75, 0x79c66a]]) b.add(P.sph(r, 12, 9), c, [x, y, z]);
  const m = mesh(b.build(), mat({ roughness: 0.85 }));
  m.scale.setScalar(scale);
  return m;
}

// a flower that starts as a closed bud and opens when bloom() is called
function flower(color) {
  const g = new THREE.Group();
  const stem = new Builder()
    .add(P.cyl(0.035, 0.045, 0.7, 6), 0x5aa850, [0, 0.35, 0])
    .add(P.sph(0.16, 8, 5), 0x6abb5a, [0.12, 0.25, 0], [0, 0, 0.6], [1, 0.25, 0.6])
    .build();
  g.add(mesh(stem, mat()));
  const head = new THREE.Group();
  head.position.y = 0.72;
  g.add(head);
  const petals = new Builder();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    petals.add(P.sph(0.16, 10, 6), color, [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17], [0, -a, 0], [1, 0.32, 0.62]);
  }
  petals.add(P.sph(0.09, 10, 6), 0xffd66b, [0, 0.04, 0]);
  const open = mesh(petals.build(), mat({ roughness: 0.5 }), false);
  open.scale.setScalar(0.01);
  head.add(open);
  const bud = mesh(new Builder().add(P.sph(0.11, 10, 8), color, [0, 0.06, 0], [0, 0, 0], [1, 1.5, 1]).add(P.cone(0.12, 0.12, 8), 0x6abb5a, [0, -0.04, 0], [Math.PI, 0, 0]).build(), mat({ roughness: 0.5 }), false);
  head.add(bud);
  g.open = open;
  g.bud = bud;
  g.k = 0;
  return g;
}

export class Grove {
  constructor(scene) {
    this.scene = scene;
    this.flowers = [];
    this.houses = [];
    this.blooming = [];
    const W = COLS * CELL;
    const D = ROWS * CELL;

    // ground
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // the wooden tray
    const tray = mesh(slab(W + 1.0, D + 1.0, 0.7, 0.14), new THREE.MeshStandardMaterial({ color: 0xb87a46, roughness: 0.55 }));
    tray.position.y = 0.0;
    scene.add(tray);
    const rimShape = roundRect(W + 1.0, D + 1.0, 0.7);
    rimShape.holes.push(roundRect(W + 0.16, D + 0.16, 0.36));
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 4, curveSegments: 10 });
    rimGeo.rotateX(-Math.PI / 2);
    const rim = mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0xd99a5c, roughness: 0.45 }));
    rim.position.y = 0.16;
    scene.add(rim);

    // tiles: two soft greens, slightly rounded
    const tileGeo = slab(CELL * 0.94, CELL * 0.94, 0.16, 0.06, 0.03);
    const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), ROWS * COLS);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        m4.makeTranslation(cellX(c), 0.2, cellZ(r));
        tiles.setMatrixAt(i, m4);
        tiles.setColorAt(i, col.set((r + c) % 2 ? 0xc7e6a0 : 0xb3da8a));
      }
    tiles.receiveShadow = true;
    scene.add(tiles);
    this.tiles = tiles;

    // big leaves tucked under the tray
    const leafMat = mat({ roughness: 0.55 });
    const leaves = [
      [-5.4, 3.6, 2.2, 1.1, 0.5, 0x6fbe5c],
      [5.5, 3.0, 2.0, 1.0, -0.6, 0x5aae52],
      [-5.2, -2.8, 1.9, 0.95, 2.6, 0x62b457],
      [5.3, -3.6, 2.1, 1.0, -2.5, 0x74c262],
      [-2.6, 5.6, 2.2, 1.2, 1.4, 0x6abb5a],
      [2.8, 5.4, 2.0, 1.1, -1.5, 0x5fb154],
      [0.4, 6.4, 1.6, 0.9, 1.65, 0x78c766],
    ];
    for (const [x, z, l, w, ry, c] of leaves) {
      const lf = mesh(leaf(l, w, c), leafMat);
      lf.position.set(x, 0.05, z);
      lf.rotation.set(0.08, ry, 0);
      scene.add(lf);
    }

    // mushroom houses and trees beyond the far edge
    const houses = [
      [-4.2, -6.6, 0x2, 0xf06a5a, 0.85],
      [4.4, -6.9, 0x2, 0xffa24a, 0.95],
      [0.2, -9.4, 0x2, 0xe86aa0, 0.8],
    ];
    for (const [x, z, , c, s] of houses) {
      const h = mushroomHouse(c);
      h.position.set(x, 0, z);
      h.scale.setScalar(s);
      h.rotation.y = -x * 0.06;
      scene.add(h);
      this.houses.push(h);
    }
    for (const [x, z, s] of [[-7.5, -9, 1.3], [7.8, -9.5, 1.4], [-10, -4, 1.2], [10.5, -3.5, 1.3], [-3.5, -12, 1.5], [4, -13, 1.6], [-9, 4, 1.1], [9.5, 5, 1.2]]) {
      const t = tree(s);
      t.position.set(x, 0, z);
      t.rotation.y = rnd(0, 6);
      scene.add(t);
    }
    // pebbles & grass tufts
    const deco = new Builder();
    for (let i = 0; i < 80; i++) {
      const a = rnd(0, Math.PI * 2);
      const r = rnd(6.2, 13);
      const x = Math.cos(a) * r * 0.85;
      const z = Math.sin(a) * r;
      if (Math.random() < 0.4) deco.add(P.sph(rnd(0.1, 0.25), 7, 5), Math.random() < 0.5 ? 0xc8c0b0 : 0xb0a898, [x, 0.05, z], [0, 0, 0], [1, 0.55, 1]);
      else for (let k = 0; k < 4; k++) deco.add(P.cone(0.05, rnd(0.3, 0.55), 4), Math.random() < 0.5 ? 0x5aa850 : 0x74c062, [x + rnd(-0.15, 0.15), 0.2, z + rnd(-0.15, 0.15)], [rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)]);
    }
    scene.add(mesh(deco.build(), mat(), false));

    // flower buds in three zones (left, right, front) that bloom as cocoons open
    const colors = [0xff8fb5, 0xffd05a, 0xb898ff, 0x8ed8ff, 0xff9e6a];
    const zones = [
      [[-5.6, -1.0], [-5.9, 0.5], [-5.3, 1.8], [-6.2, -2.2], [-4.9, -4.4], [-6.5, 2.6]],
      [[5.6, -1.2], [5.9, 0.4], [5.4, 1.9], [6.2, -2.4], [5.0, -4.8], [6.4, 2.8]],
      [[-3.6, 5.2], [-1.4, 5.5], [1.3, 5.4], [3.5, 5.0], [-0.1, 6.2], [2.3, 6.5], [-2.4, 6.4]],
    ];
    this.zones = zones.map((pts) =>
      pts.map(([x, z], i) => {
        const f = flower(colors[(((i + Math.floor(x)) % colors.length) + colors.length) % colors.length]);
        f.position.set(x, 0.03, z);
        f.scale.setScalar(rnd(1.5, 2.0));
        scene.add(f);
        this.flowers.push(f);
        return f;
      }),
    );
  }

  // open the buds of one zone (or all of them) and light a house
  bloom(zone) {
    const list = zone == null ? this.flowers : this.zones[zone] || [];
    list.forEach((f, i) => {
      if (f.target) return;
      f.target = 1;
      f.delay = i * 0.08 + Math.random() * 0.1;
    });
    const h = zone == null ? this.houses : [this.houses[zone]].filter(Boolean);
    h.forEach((x) => (x.lit = true));
  }

  update(dt, t) {
    for (const f of this.flowers) {
      f.rotation.z = Math.sin(t * 1.3 + f.position.x) * 0.04;
      if (!f.target) continue;
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.k = Math.min(1, f.k + dt * 2.2);
      const e = 1 + 2.70158 * (f.k - 1) ** 3 + 1.70158 * (f.k - 1) ** 2;
      f.open.scale.setScalar(Math.max(0.01, e * 1.3));
      f.bud.scale.setScalar(Math.max(0.01, 1 - f.k));
    }
    for (const h of this.houses) {
      const want = h.lit ? 1.6 + Math.sin(t * 3 + h.position.x) * 0.15 : 0;
      h.window.material.emissiveIntensity += (want - h.window.material.emissiveIntensity) * Math.min(1, dt * 3);
    }
  }
}
