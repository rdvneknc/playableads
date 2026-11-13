import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';

// Ottoman town kit in the style of the Ottoman Wars city view:
// plaster & timber houses with terracotta roofs, octagonal stone towers with
// slate-blue roofs, stone/palisade walls, cannon platforms, tents and fields.

export const T = {
  plaster: 0xf6efe0,
  plaster2: 0xefe4cc,
  timber: 0x7f5a3a,
  roof: 0xc98058,
  roofDark: 0xa86240,
  stone: 0xe6dcc6,
  stoneDark: 0xc6b89a,
  slate: 0x9aa8b6,
  slateDark: 0x7a8898,
  wood: 0x8a6440,
  woodDark: 0x5d3f24,
  bronze: 0x5a4a32,
  iron: 0x3a3a40,
  canvas: 0xf2ece0,
  grass: 0x9cb46a,
  dirt: 0xd3bf96,
  leaf: 0x7aa448,
  leaf2: 0x8fb856,
};

export const solid = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
const mk = (b) => {
  const m = new THREE.Mesh(b.build(), solid());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

// gable roof: a triangular prism along X (width w, depth d, height h)
function gable(b, w, d, h, y, color = T.roof, z = 0, x = 0, endColor = T.plaster2) {
  // triangular gable ends (a prism under the roof)
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2 + 0.25, 0), new THREE.Vector2(d / 2 - 0.25, 0), new THREE.Vector2(0, h - 0.12)]);
  const prism = new THREE.ExtrudeGeometry(tri, { depth: w - 0.5, bevelEnabled: false });
  prism.rotateY(Math.PI / 2);
  prism.translate(-(w - 0.5) / 2, 0, 0);
  b.add(prism, endColor, [x, y, z]);
  // two roof slopes meeting at the ridge, with a little overhang
  const half = d / 2;
  const len = Math.hypot(half, h) + 0.15;
  const a = Math.atan2(h, half);
  b.add(P.box(w, 0.14, len), color, [x, y + h / 2, z - half / 2], [-a, 0, 0]);
  b.add(P.box(w, 0.14, len), color, [x, y + h / 2, z + half / 2], [a, 0, 0]);
  // tile courses
  for (let k = 1; k < 4; k++) {
    const f = k / 4;
    b.add(P.box(w + 0.02, 0.05, 0.08), T.roofDark, [x, y + h * (1 - f) + 0.08, z - half * f], [-a, 0, 0]);
    b.add(P.box(w + 0.02, 0.05, 0.08), T.roofDark, [x, y + h * (1 - f) + 0.08, z + half * f], [a, 0, 0]);
  }
  b.add(P.box(w + 0.05, 0.14, 0.2), T.roofDark, [x, y + h + 0.02, z]);
}

/* ── House: plaster walls, timber framing, terracotta gable roof ── */
export function house(seed = 0) {
  const b = new Builder();
  const w = 3.4;
  const d = 2.8;
  const h = 2.1;
  b.add(P.box(w + 0.2, 0.3, d + 0.2), T.stoneDark, [0, 0.15, 0]);
  b.add(P.box(w, h, d), seed % 2 ? T.plaster : T.plaster2, [0, 0.3 + h / 2, 0]);
  // timber frame
  for (const x of [-w / 2, -w / 6, w / 6, w / 2]) b.add(P.box(0.14, h, d + 0.04), T.timber, [x, 0.3 + h / 2, 0], [0, 0, 0], [1, 1, 1]);
  b.add(P.box(w + 0.04, 0.14, d + 0.04), T.timber, [0, 0.3 + h * 0.55, 0]);
  b.add(P.box(w + 0.04, 0.14, d + 0.04), T.timber, [0, 0.3 + h, 0]);
  // door & windows (front = +Z)
  b.add(P.box(0.7, 1.25, 0.08), T.woodDark, [0, 0.95, d / 2 + 0.02]);
  for (const x of [-1.05, 1.05]) b.add(P.box(0.5, 0.45, 0.08), 0x2a2018, [x, 1.4, d / 2 + 0.02]);
  for (const x of [-1.05, 1.05]) b.add(P.box(0.5, 0.45, 0.08), 0x2a2018, [x, 1.9, -d / 2 - 0.02]);
  gable(b, w + 0.5, d + 0.6, 1.3, 0.3 + h);
  // chimney
  b.add(P.box(0.4, 0.9, 0.4), T.stoneDark, [w / 2 - 0.6, 0.3 + h + 0.9, -0.3]);
  return mk(b);
}

/* ── Konak (town hall): colonnade, hip roof, corner pavilions ── */
export function townHall() {
  const b = new Builder();
  b.add(P.box(8.4, 0.5, 6.4), T.stoneDark, [0, 0.25, 0]);
  b.add(P.box(7.2, 3.0, 4.8), T.plaster, [0, 2.0, -0.2]);
  for (let i = 0; i < 6; i++) b.add(P.cyl(0.16, 0.18, 2.6, 10), T.plaster2, [-3.0 + i * 1.2, 1.8, 2.7]);
  b.add(P.box(7.6, 0.3, 1.4), T.timber, [0, 3.2, 2.5]);
  b.add(P.box(1.0, 1.7, 0.1), T.woodDark, [0, 1.35, 2.22]);
  for (const x of [-2.2, -1.1, 1.1, 2.2]) b.add(P.box(0.55, 0.8, 0.1), 0x2a2018, [x, 2.2, 2.22]);
  // hip roof
  const roof = new THREE.ConeGeometry(1, 1, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale(5.8, 2.2, 4.4);
  b.add(roof, T.roof, [0, 4.6, 0.2]);
  for (const [x, z] of [[-3.9, -2.4], [3.9, -2.4], [-3.9, 2.6], [3.9, 2.6]]) {
    b.add(P.box(1.5, 4.2, 1.5), T.plaster2, [x, 2.1, z]);
    const r = new THREE.ConeGeometry(1, 1, 4, 1);
    r.rotateY(Math.PI / 4);
    r.scale(1.25, 1.3, 1.25);
    b.add(r, T.roof, [x, 4.85, z]);
  }
  b.add(P.cyl(0.04, 0.04, 2, 5), T.woodDark, [0, 6.4, 0.2]);
  b.add(P.box(1.2, 0.75, 0.04), 0xc8202a, [0.6, 7.0, 0.2]);
  return mk(b);
}

/* ── Octagonal stone tower with slate roof (wall tower) ── */
export function tower(h = 6.2) {
  const b = new Builder();
  b.add(P.cyl(1.35, 1.55, h, 8), T.stone, [0, h / 2, 0], [0, Math.PI / 8, 0]);
  for (let i = 0; i < 3; i++) b.add(P.cyl(1.4 + i * 0.01, 1.4, 0.12, 8), T.stoneDark, [0, 1.6 + i * 1.6, 0], [0, Math.PI / 8, 0]);
  b.add(P.cyl(1.7, 1.45, 0.5, 8), T.stoneDark, [0, h + 0.2, 0], [0, Math.PI / 8, 0]);
  // open gallery: 8 posts
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(P.box(0.18, 1.3, 0.18), T.stone, [Math.cos(a) * 1.45, h + 1.1, Math.sin(a) * 1.45]);
  }
  b.add(P.cone(2.05, 2.4, 8), T.slate, [0, h + 2.95, 0], [0, Math.PI / 8, 0]);
  b.add(P.cyl(2.08, 2.08, 0.12, 8), T.slateDark, [0, h + 1.78, 0], [0, Math.PI / 8, 0]);
  b.add(P.sph(0.14, 8, 6), 0xd9a63a, [0, h + 4.25, 0]);
  for (const a of [0.3, 2.4, 4.4]) b.add(P.box(0.22, 0.6, 0.1), 0x2a2018, [Math.cos(a) * 1.5, h * 0.6, Math.sin(a) * 1.5], [0, -a + Math.PI / 2, 0]);
  return mk(b);
}

/* ── Wall segment along X, centred at origin. kind: 'palisade' | 'stone' ── */
export function wallSegment(len, kind) {
  const b = new Builder();
  if (kind === 'palisade') {
    for (let x = -len / 2 + 0.2; x <= len / 2; x += 0.42) {
      const h = 2.3 + ((x * 7.3) % 0.3);
      b.add(P.cyl(0.19, 0.21, h, 6), x % 0.84 < 0.42 ? T.wood : 0x7a5636, [x, h / 2, 0]);
      b.add(P.cone(0.2, 0.4, 6), T.woodDark, [x, h + 0.2, 0]);
    }
    b.add(P.box(len, 0.16, 0.16), T.woodDark, [0, 0.8, 0.2]);
    b.add(P.box(len, 0.16, 0.16), T.woodDark, [0, 1.7, 0.2]);
  } else {
    b.add(P.box(len, 3.4, 1.5), T.stone, [0, 1.7, 0]);
    b.add(P.box(len + 0.02, 0.25, 1.6), T.stoneDark, [0, 0.12, 0]);
    b.add(P.box(len + 0.02, 0.18, 1.62), T.stoneDark, [0, 3.35, 0]);
    for (let x = -len / 2 + 0.4; x <= len / 2 - 0.3; x += 0.95) b.add(P.box(0.55, 0.6, 0.45), T.stone, [x, 3.75, -0.55]);
    // block courses
    for (const y of [1.0, 2.0, 2.8]) b.add(P.box(len + 0.01, 0.05, 1.52), T.stoneDark, [0, y, 0]);
  }
  return mk(b);
}

export function gatehouse() {
  const b = new Builder();
  b.add(P.box(6.4, 4.4, 2.4), T.stone, [0, 2.2, 0]);
  b.add(P.box(3.0, 3.2, 2.5), 0x2a2018, [0, 1.6, 0]);
  for (let i = 0; i < 4; i++) b.add(P.box(0.7, 3.0, 0.2), i % 2 ? 0x7a4a24 : 0x6a3f1e, [-1.05 + i * 0.7, 1.5, -1.0]);
  b.add(P.box(3.1, 0.18, 0.25), T.iron, [0, 2.4, -1.12]);
  b.add(P.box(3.1, 0.18, 0.25), T.iron, [0, 0.8, -1.12]);
  for (let x = -3.0; x <= 3.0; x += 0.95) b.add(P.box(0.55, 0.6, 0.5), T.stone, [x, 4.7, -0.9]);
  const r = new THREE.ConeGeometry(1, 1, 4, 1);
  r.rotateY(Math.PI / 4);
  r.scale(3.0, 1.6, 1.5);
  b.add(r, T.roof, [0, 5.6, 0.4]);
  b.add(P.box(1.0, 0.7, 0.05), 0xc8202a, [0, 3.6, -1.22]);
  return mk(b);
}

/* ── Cannon on an octagonal platform (barrel pivots in g.barrel) ── */
export function cannon() {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(P.cyl(1.55, 1.75, 0.9, 8), T.stone, [0, 0.45, 0], [0, Math.PI / 8, 0]);
  b.add(P.cyl(1.6, 1.6, 0.12, 8), T.stoneDark, [0, 0.92, 0], [0, Math.PI / 8, 0]);
  for (const x of [-0.45, 0.45]) {
    b.add(P.box(0.14, 0.45, 1.2), T.woodDark, [x, 1.25, 0.1]);
    b.add(P.cyl(0.38, 0.38, 0.12, 12), T.woodDark, [x * 1.35, 1.35, 0.35], [0, 0, Math.PI / 2]);
    b.add(P.torus(0.36, 0.04, 6, 14), T.iron, [x * 1.4, 1.35, 0.35], [0, Math.PI / 2, 0]);
  }
  g.add(mk(b));
  const barrel = new THREE.Group();
  barrel.position.set(0, 1.55, 0.1);
  const bb = new Builder()
    .add(P.cyl(0.2, 0.28, 2.0, 12), T.bronze, [0, 0, -0.6], [Math.PI / 2, 0, 0])
    .add(P.cyl(0.25, 0.25, 0.14, 12), 0x7a6640, [0, 0, -1.55], [Math.PI / 2, 0, 0])
    .add(P.sph(0.28, 10, 8), T.bronze, [0, 0, 0.42]);
  barrel.add(mk(bb));
  barrel.rotation.x = 0.25;
  g.add(barrel);
  g.barrel = barrel;
  return g;
}

/* ── Woodcutter's hut with log piles ── */
export function woodHut() {
  const b = new Builder();
  b.add(P.box(2.6, 1.6, 2.2), T.wood, [0, 0.8, 0]);
  for (let y = 0.2; y < 1.6; y += 0.3) b.add(P.box(2.62, 0.04, 2.22), T.woodDark, [0, y, 0]);
  gable(b, 3.0, 2.8, 1.0, 1.6, T.roof);
  b.add(P.box(0.6, 1.0, 0.06), T.woodDark, [0, 0.5, 1.12]);
  for (let i = 0; i < 6; i++) b.add(P.cyl(0.18, 0.18, 1.6, 8), i % 2 ? 0x9a6a3a : 0x8a5a2c, [-2.0 + (i % 3) * 0.38, 0.2 + Math.floor(i / 3) * 0.34, -0.2], [Math.PI / 2, 0, 0]);
  b.add(P.cyl(0.35, 0.4, 0.5, 10), 0x8a6238, [1.9, 0.25, 0.9]);
  b.add(P.box(0.06, 0.5, 0.06), T.woodDark, [1.9, 0.75, 0.9], [0, 0, 0.4]);
  return mk(b);
}

/* ── Quarry: pale rock outcrop, a stone-cutter's shed and cut blocks ── */
export function quarry() {
  const b = new Builder();
  const rocks = [[0, 1.4, -0.6, 2.8, 2.6], [-1.8, 0.9, 0.2, 2.0, 1.8], [1.9, 1.1, -0.2, 2.2, 2.2], [0.6, 0.5, 1.2, 1.4, 1.0]];
  for (const [x, y, z, w, h] of rocks) b.add(new THREE.DodecahedronGeometry(1, 0), 0xb9ad96, [x, y, z], [0.3, x, 0.2], [w * 0.6, h * 0.6, w * 0.55]);
  b.add(new THREE.DodecahedronGeometry(1, 0), 0xa3977e, [0.8, 2.4, -1.0], [0.5, 1, 0], [1.0, 0.8, 0.9]);
  b.add(P.box(0.6, 0.35, 0.5), 0xe6d8b8, [1.8, 0.18, 1.6], [0, 0.4, 0]);
  b.add(P.box(0.6, 0.35, 0.5), 0xe6d8b8, [-1.4, 0.18, 1.9], [0, -0.3, 0]);
  const m = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function tent() {
  const b = new Builder();
  b.add(P.cyl(1.3, 1.45, 1.2, 12), T.canvas, [0, 0.6, 0]);
  b.add(P.cone(1.7, 1.9, 12), T.canvas, [0, 2.15, 0]);
  b.add(P.cyl(1.72, 1.72, 0.1, 12), 0xc8202a, [0, 1.25, 0]);
  b.add(P.sph(0.12, 8, 6), 0xd9a63a, [0, 3.15, 0]);
  b.add(P.box(0.7, 0.95, 0.05), 0x5a4a38, [0, 0.48, 1.44]);
  return mk(b);
}

export function tree(s = 1) {
  const b = new Builder();
  b.add(P.cyl(0.16, 0.22, 1.6, 7), 0x6a4a2c, [0, 0.8, 0]);
  b.add(P.sph(1.25, 9, 7), T.leaf, [0, 2.3, 0]);
  b.add(P.sph(0.9, 9, 7), T.leaf2, [0.6, 2.7, 0.2]);
  b.add(P.sph(0.85, 9, 7), 0x55803a, [-0.5, 2.6, -0.3]);
  const m = mk(b);
  m.scale.setScalar(s);
  return m;
}

export function field(w, d) {
  const b = new Builder();
  b.add(P.box(w, 0.06, d), 0x8a7a4a, [0, 0.03, 0]);
  for (let x = -w / 2 + 0.35; x < w / 2; x += 0.7) b.add(P.box(0.32, 0.25, d - 0.3), 0x8fb04a, [x, 0.16, 0]);
  const m = mk(b);
  m.castShadow = false;
  return m;
}

/* ── Scaffolding shown while a building rises ── */
export function scaffold(w, h, d) {
  const b = new Builder();
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) b.add(P.box(0.1, h, 0.1), 0x9a7448, [x, h / 2, z]);
  for (let y = 0.9; y < h; y += 1.0) {
    b.add(P.box(w, 0.08, 0.08), 0x9a7448, [0, y, -d / 2]);
    b.add(P.box(w, 0.08, 0.08), 0x9a7448, [0, y, d / 2]);
    b.add(P.box(0.08, 0.08, d), 0x9a7448, [-w / 2, y, 0]);
    b.add(P.box(0.08, 0.08, d), 0x9a7448, [w / 2, y, 0]);
    b.add(P.box(w, 0.05, 0.5), 0xb08a58, [0, y + 0.06, d / 2 + 0.2]);
  }
  b.add(P.box(0.06, Math.hypot(w, h) * 0.9, 0.06), 0x9a7448, [0, h / 2, d / 2 + 0.05], [0, 0, Math.atan2(w, h)]);
  const m = mk(b);
  m.castShadow = false;
  return m;
}

// translucent "blueprint" copy of a building mesh/group
export function ghostOf(obj) {
  const g = obj.clone(true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.28, depthWrite: false });
  g.traverse((c) => {
    if (c.isMesh) {
      c.material = mat;
      c.castShadow = false;
      c.receiveShadow = false;
    }
  });
  g.ghostMat = mat;
  return g;
}
