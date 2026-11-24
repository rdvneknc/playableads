import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { withDetail } from './Detail.js';

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

let SOLID = null;
export const solid = () => (SOLID ||= withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 })));
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
  const m = new THREE.Mesh(b.build(), withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), { scale: 0.7, strength: 0.7 }));
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
  g.traverse((c) => (c.renderOrder = 1));
  return g;
}

/* ───────────────────────── Son Kazan camp kit ───────────────────────── */

const flat = () => withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), { scale: 0.8, strength: 0.6 });
const mkFlat = (b) => {
  const m = new THREE.Mesh(b.build(), flat());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/* stone ring + crossed logs: the ocak (hearth) */
export function hearth() {
  const b = new Builder();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.add(new THREE.DodecahedronGeometry(0.26, 0), i % 2 ? 0xc4b8a4 : 0xaea290, [Math.cos(a) * 1.0, 0.16, Math.sin(a) * 1.0], [a, i, 0], [1.1, 0.8, 1]);
  }
  for (const a of [0.3, 1.9, 3.4]) b.add(P.cyl(0.08, 0.09, 1.4, 6), 0x5a3a20, [0, 0.12, 0], [Math.PI / 2, a, 0.15]);
  b.add(P.cyl(0.6, 0.6, 0.04, 12), 0x2a2420, [0, 0.03, 0]);
  return mkFlat(b);
}

/* the kazan: a big copper cauldron on three legs over the hearth (stew surface in g.stew) */
export function cauldron() {
  const g = new THREE.Group();
  const b = new Builder();
  const cu = T.bronze;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    b.add(P.box(0.1, 0.62, 0.1), 0x2e2a28, [Math.cos(a) * 0.6, 0.3, Math.sin(a) * 0.6], [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]);
  }
  // body: a squat bowl widening to the rim
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    pts.push(new THREE.Vector2(0.25 + Math.sin(k * Math.PI * 0.55) * 0.75, 0.48 + k * 0.82));
  }
  const body = new THREE.LatheGeometry(pts, 20);
  b.add(body, 0xb8652a, [0, 0, 0]);
  b.add(P.cyl(0.26, 0.2, 0.06, 16), 0x7a3e18, [0, 0.47, 0]);
  b.add(P.torus(0.96, 0.07, 8, 24), 0xd9883a, [0, 1.3, 0], [Math.PI / 2, 0, 0]);
  b.add(P.torus(0.9, 0.035, 6, 24), 0x8a4a1c, [0, 1.06, 0], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) b.add(P.torus(0.18, 0.04, 6, 12, Math.PI), 0x6a3a18, [s * 1.0, 1.26, 0], [0, Math.PI / 2, 0]);
  const pot = new THREE.Mesh(b.build(), withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.55, side: THREE.DoubleSide }), { strength: 0.15, ao: 0.5 }));
  pot.castShadow = pot.receiveShadow = true;
  g.add(pot);
  const stew = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshStandardMaterial({ color: 0xa8521e, roughness: 0.3, emissive: 0x2a0c02 }));
  stew.rotation.x = -Math.PI / 2;
  stew.position.y = 1.0;
  g.add(stew);
  g.stew = stew;
  g.pot = pot;
  return g;
}

/* serving table (long along Z) with a stack of bowls and a ladle */
export function counter() {
  const b = new Builder();
  b.add(P.box(1.1, 0.12, 4.4), T.wood, [0, 0.92, 0]);
  b.add(P.box(1.12, 0.05, 4.42), T.woodDark, [0, 0.85, 0]);
  for (const x of [-0.45, 0.45]) for (const z of [-2.0, 2.0]) b.add(P.box(0.12, 0.86, 0.12), T.woodDark, [x, 0.43, z]);
  b.add(P.box(0.9, 0.08, 4.0), T.woodDark, [0, 0.25, 0]);
  for (let i = 0; i < 4; i++) b.add(P.cyl(0.24, 0.15, 0.1, 12), 0xb8652a, [-0.15, 1.03 + i * 0.07, 2.0]);
  b.add(P.cyl(0.03, 0.03, 0.9, 6), T.woodDark, [0.2, 1.04, -2.0], [Math.PI / 2, 0.3, 0]);
  b.add(P.sph(0.12, 8, 6), 0xb8652a, [0.33, 1.04, -1.6], [0, 0, 0], [1, 0.5, 1]);
  // two jugs and a basket of bread under the table
  b.add(P.cyl(0.14, 0.2, 0.42, 10), 0xb8653a, [0.2, 0.5, 1.2]);
  b.add(P.cyl(0.32, 0.26, 0.3, 10), 0xa0743a, [-0.1, 0.44, -1.0]);
  for (let i = 0; i < 4; i++) b.add(P.sph(0.12, 8, 6), 0xe0a85a, [-0.1 + (i % 2) * 0.16 - 0.08, 0.62, -1.0 + Math.floor(i / 2) * 0.16 - 0.08], [0, 0, 0], [1.2, 0.7, 1]);
  return mk(b);
}

/* the overturned supply cart with sacks still inside */
export function cart() {
  const g = new THREE.Group();
  const b = new Builder();
  // bed tipped on its side
  const bed = new Builder()
    .add(P.box(2.8, 0.12, 1.6), T.wood, [0, 0, 0])
    .add(P.box(2.8, 0.55, 0.1), T.woodDark, [0, 0.3, 0.78])
    .add(P.box(2.8, 0.55, 0.1), T.woodDark, [0, 0.3, -0.78])
    .add(P.box(0.1, 0.55, 1.6), T.woodDark, [1.38, 0.3, 0]);
  const bm = mk(bed);
  bm.position.set(0, 0.95, 0.2);
  bm.rotation.set(-1.15, 0, 0.08);
  g.add(bm);
  // wheels: one on the ground, one up in the air
  b.add(P.cyl(0.62, 0.62, 0.12, 14), T.woodDark, [-0.6, 0.62, 0.95], [Math.PI / 2, 0, 0]);
  b.add(P.torus(0.6, 0.05, 6, 16), T.iron, [-0.6, 0.62, 0.95]);
  for (let i = 0; i < 4; i++) b.add(P.box(0.06, 1.15, 0.06), T.wood, [-0.6, 0.62, 0.95], [0, 0, (i / 4) * Math.PI]);
  b.add(P.cyl(0.62, 0.62, 0.12, 14), T.woodDark, [0.8, 0.07, 0.3], [0, 0, 0]);
  b.add(P.torus(0.6, 0.05, 6, 16), T.iron, [0.8, 0.13, 0.3], [Math.PI / 2, 0, 0]);
  // broken shaft
  b.add(P.box(0.12, 0.12, 2.2), T.wood, [1.8, 0.2, -0.6], [0.1, 0.6, 0.05]);
  // spilled sacks behind the bed
  for (const [x, z, r] of [[-1.0, -0.4, 0.3], [-0.2, -0.6, -0.4], [0.6, -0.5, 0.8], [-0.6, -1.1, 1.2]]) b.add(P.sph(0.36, 10, 8), 0xc4a670, [x, 0.28, z], [0.2, r, 0.1], [1.3, 0.75, 1]);
  g.add(mk(b));
  return g;
}

/* field cannon on a wooden carriage (barrel pivots in g.barrel, wheels in g.wheels) */
export function fieldCannon() {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(P.box(0.7, 0.3, 2.2), T.woodDark, [0, 0.62, 0.35], [-0.12, 0, 0]);
  b.add(P.box(0.16, 0.5, 1.2), T.wood, [-0.3, 0.9, -0.05]);
  b.add(P.box(0.16, 0.5, 1.2), T.wood, [0.3, 0.9, -0.05]);
  b.add(P.box(0.4, 0.14, 0.9), T.wood, [0, 0.25, 1.45], [-0.3, 0, 0]);
  g.add(mk(b));
  g.wheels = [];
  for (const x of [-0.62, 0.62]) {
    const w = new Builder()
      .add(P.cyl(0.62, 0.62, 0.14, 16), T.woodDark, [0, 0, 0], [0, 0, Math.PI / 2])
      .add(P.torus(0.6, 0.05, 6, 18), T.iron, [0, 0, 0], [0, Math.PI / 2, 0])
      .add(P.cyl(0.14, 0.14, 0.24, 10), T.iron, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 4; i++) w.add(P.box(0.08, 1.12, 0.07), T.wood, [x > 0 ? 0.04 : -0.04, 0, 0], [(i / 4) * Math.PI, 0, 0]);
    const wm = mk(w);
    wm.position.set(x, 0.62, -0.25);
    g.add(wm);
    g.wheels.push(wm);
  }
  const barrel = new THREE.Group();
  barrel.position.set(0, 1.16, -0.1);
  const bb = new Builder()
    .add(P.cyl(0.21, 0.3, 2.3, 14), 0x6a5636, [0, 0, -0.65], [Math.PI / 2, 0, 0])
    .add(P.cyl(0.27, 0.27, 0.16, 14), 0x8a7446, [0, 0, -1.75], [Math.PI / 2, 0, 0])
    .add(P.cyl(0.32, 0.32, 0.1, 14), 0x8a7446, [0, 0, 0.3], [Math.PI / 2, 0, 0])
    .add(P.sph(0.3, 12, 8), 0x6a5636, [0, 0, 0.5])
    .add(P.cyl(0.08, 0.08, 0.8, 8), 0x3a3a40, [0, 0, 0], [0, 0, Math.PI / 2]);
  const bm = new THREE.Mesh(bb.build(), withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }), { strength: 0.1 }));
  bm.castShadow = true;
  barrel.add(bm);
  barrel.rotation.x = 0.12;
  g.add(barrel);
  g.barrel = barrel;
  g.wheelSign = -1;
  g.recoil = (k) => (barrel.position.z = -0.1 + k * 0.45);
  g.muzzleFwd = 2.2;
  g.muzzleY = 1.45;
  return g;
}

/* canvas tarp over the cannon, tied down with ropes */
export function tarp() {
  const b = new Builder();
  b.add(P.sph(1.0, 14, 10), 0xcfc0a0, [0, 0.75, 0], [0, 0, 0], [1.25, 1.0, 1.75]);
  b.add(P.cyl(1.3, 1.45, 0.5, 14), 0xc4b494, [0, 0.25, 0], [0, 0, 0], [1, 1, 1.4]);
  for (const z of [-0.8, 0, 0.8]) b.add(P.torus(1.12, 0.035, 5, 20, Math.PI), 0x7a5a34, [0, 0.2, z], [0, 0, 0], [1.16, 1.4, 1]);
  return mk(b);
}

/* mevzi: a crescent of gabions (wicker baskets of earth) facing the pass */
export function mevzi() {
  const b = new Builder();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.85 + (i / 6) * Math.PI * 0.7 - Math.PI * 0.15;
    const x = Math.cos(a) * 2.4;
    const z = Math.sin(a) * 2.4;
    b.add(P.cyl(0.5, 0.52, 1.1, 10), 0x8a6a3a, [x, 0.55, z]);
    for (const y of [0.25, 0.55, 0.85]) b.add(P.torus(0.51, 0.04, 4, 12), 0x6a4a24, [x, y, z], [Math.PI / 2, 0, 0]);
    b.add(P.cyl(0.46, 0.46, 0.06, 10), 0x6a5a3a, [x, 1.1, z]);
  }
  for (let i = 0; i < 6; i++) b.add(P.box(0.55, 0.22, 0.35), 0xc4b07a, [-1.6 + i * 0.62, 0.11, 0.6 + (i % 2) * 0.1], [0, (i % 3) * 0.2, 0]);
  b.add(P.box(3.6, 0.05, 3.0), 0xb59a6a, [0, 0.02, -0.3]);
  // powder barrels and a few balls
  b.add(P.cyl(0.3, 0.3, 0.6, 10), T.woodDark, [2.0, 0.3, 0.9]);
  b.add(P.cyl(0.3, 0.3, 0.6, 10), T.wood, [2.4, 0.3, 0.4]);
  for (const [x, z] of [[-2.1, 0.8], [-1.85, 1.05], [-2.25, 1.1]]) b.add(P.sph(0.2, 8, 6), 0x2a2a2e, [x, 0.2, z]);
  return mk(b);
}

/* tall camp banner (sancak) with a red flag; flag mesh in g.flag for waving */
export function banner() {
  const g = new THREE.Group();
  const b = new Builder()
    .add(P.cyl(0.07, 0.09, 6.2, 8), T.woodDark, [0, 3.1, 0])
    .add(P.sph(0.16, 10, 8), 0xd9a63a, [0, 6.3, 0])
    .add(P.cone(0.12, 0.4, 8), 0xd9a63a, [0, 6.6, 0])
    .add(P.cyl(0.5, 0.6, 0.3, 10), 0x847a70, [0, 0.15, 0]);
  g.add(mk(b));
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c8202a';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#e8b33a';
  ctx.fillRect(0, 0, 18, 160);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(118, 80, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8202a';
  ctx.beginPath();
  ctx.arc(132, 80, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 9 : 22;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(176 + Math.cos(a) * r, 80 + Math.sin(a) * r);
  }
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(2.4, 1.5, 12, 4);
  geo.translate(1.2, 0, 0);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(0.08, 5.35, 0);
  flag.castShadow = true;
  flag.base = geo.attributes.position.array.slice();
  g.add(flag);
  g.flag = flag;
  return g;
}

export function waveFlag(flag, t, amp = 0.16) {
  const p = flag.geometry.attributes.position;
  const b = flag.base;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3];
    p.array[i * 3 + 2] = Math.sin(x * 2.4 - t * 6) * amp * x * 0.6;
    p.array[i * 3 + 1] = b[i * 3 + 1] - x * 0.05;
  }
  p.needsUpdate = true;
  flag.geometry.computeVertexNormals();
}

/* enemy watchtower in the pass, built of slices that tumble when hit (g.parts) */
export function enemyTower() {
  const g = new THREE.Group();
  g.parts = [];
  const add = (b, y) => {
    const m = mk(b);
    m.position.y = y;
    g.add(m);
    g.parts.push(m);
  };
  const H = 2.2;
  for (let i = 0; i < 4; i++) {
    const b = new Builder();
    const r = 2.0 - i * 0.12;
    b.add(P.cyl(r - 0.12, r, H, 8), i % 2 ? 0xbfb49e : 0xb2a690, [0, H / 2, 0], [0, Math.PI / 8, 0]);
    b.add(P.cyl(r + 0.02, r + 0.02, 0.14, 8), 0x8f8470, [0, 0.08, 0], [0, Math.PI / 8, 0]);
    if (i === 1 || i === 2) b.add(P.box(0.3, 0.7, 0.2), 0x2a2018, [0, H * 0.55, r - 0.08]);
    add(b, i * H);
  }
  const top = new Builder();
  top.add(P.cyl(2.2, 1.7, 0.5, 8), 0x8f8470, [0, 0.25, 0], [0, Math.PI / 8, 0]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    top.add(P.box(0.6, 0.7, 0.4), 0xbfb49e, [Math.cos(a) * 1.95, 0.85, Math.sin(a) * 1.95], [0, -a, 0]);
  }
  top.add(P.cyl(0.06, 0.06, 2.6, 6), T.woodDark, [0, 1.8, 0]);
  top.add(P.box(1.3, 0.8, 0.04), 0x2f6fd6, [0.68, 2.6, 0]);
  add(top, 4 * H);
  g.topY = 4 * H + 0.5;
  return g;
}

/* palisade + gate closing the pass */
export function passGate(w) {
  const g = new THREE.Group();
  const side = (len, x) => {
    const p = wallSegment(len, 'palisade');
    p.position.x = x;
    g.add(p);
  };
  const half = w / 2;
  side(half - 2, -(half + 2) / 2 - 0.0);
  side(half - 2, (half + 2) / 2);
  const b = new Builder();
  for (const x of [-2.2, 2.2]) b.add(P.box(0.5, 3.6, 0.5), T.woodDark, [x, 1.8, 0]);
  b.add(P.box(5.0, 0.4, 0.6), T.woodDark, [0, 3.4, 0]);
  for (let i = 0; i < 8; i++) b.add(P.box(0.48, 2.8, 0.18), i % 2 ? 0x7a5636 : T.wood, [-1.7 + i * 0.49, 1.4, 0.05]);
  b.add(P.box(4.0, 0.18, 0.24), T.iron, [0, 2.2, -0.1]);
  b.add(P.box(4.0, 0.18, 0.24), T.iron, [0, 0.7, -0.1]);
  const gate = mk(b);
  g.add(gate);
  g.gate = gate;
  return g;
}

/* baruthane: a small stone powder magazine with a lead dome; g.base shows first, g.house when bought */
export function baruthane() {
  const g = new THREE.Group();
  const base = new Builder()
    .add(P.box(3.6, 0.3, 3.2), T.stoneDark, [0, 0.15, 0])
    .add(P.box(3.0, 0.5, 0.3), T.stone, [0, 0.4, -1.3])
    .add(P.box(0.3, 0.5, 2.6), T.stone, [-1.35, 0.4, 0])
    .add(P.box(0.3, 0.5, 2.6), T.stone, [1.35, 0.4, 0]);
  g.base = mk(base);
  g.add(g.base);
  const b = new Builder();
  b.add(P.box(2.9, 2.1, 2.7), T.stone, [0, 1.2, 0]);
  for (const y of [0.7, 1.4]) b.add(P.box(2.92, 0.05, 2.72), T.stoneDark, [0, y, 0]);
  b.add(P.cyl(1.25, 1.35, 0.4, 12), T.stoneDark, [0, 2.45, 0]);
  b.add(P.halfSph(1.3), T.slate, [0, 2.6, 0], [0, 0, 0], [1, 0.85, 1]);
  b.add(P.cyl(0.05, 0.05, 0.5, 6), 0xd9a63a, [0, 3.85, 0]);
  b.add(P.sph(0.1, 8, 6), 0xd9a63a, [0, 4.1, 0]);
  b.add(P.box(0.9, 1.4, 0.1), T.woodDark, [0, 0.95, 1.36]);
  b.add(P.box(0.3, 0.3, 0.06), T.iron, [0, 1.95, 1.38]);
  for (const [x, z] of [[-1.9, 1.2], [-1.6, 1.8], [1.8, 1.5], [2.2, 0.8]]) {
    b.add(P.cyl(0.32, 0.32, 0.7, 12), T.wood, [x, 0.35, z]);
    b.add(P.torus(0.33, 0.035, 5, 12), T.iron, [x, 0.15, z], [Math.PI / 2, 0, 0]);
    b.add(P.torus(0.33, 0.035, 5, 12), T.iron, [x, 0.55, z], [Math.PI / 2, 0, 0]);
  }
  g.house = mk(b);
  g.add(g.house);
  return g;
}

/* rocky ridge: a row of big flat-shaded boulders between x0 and x1 */
export function ridge(x0, x1, z, depth, hMin, hMax, seed = 1) {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const b = new Builder();
  const cols = [0xc2b49a, 0xb0a28a, 0xcdbfa4, 0xa69880];
  const dir = Math.sign(x1 - x0);
  for (let x = x0; dir * (x1 - x) > 0; x += dir * (2.2 + r() * 2.2)) {
    const near = 1 - Math.min(1, Math.abs(x - x0) / 30);
    for (let k = 0; k < 3; k++) {
      const h = hMin + (hMax - hMin) * (r() * 0.6 + (1 - near) * 0.4);
      const zz = z - k * depth * 0.4 - r() * 2;
      b.add(new THREE.DodecahedronGeometry(1, 0), cols[(k + Math.floor(x)) & 3], [x, h * 0.35, zz], [r(), r() * 3, r()], [2.2 + r() * 2, h * 0.75, 2.4 + r() * 2]);
    }
  }
  return mkFlat(b);
}

/* ───────────────────────── Av ve Sefer kit ───────────────────────── */

/* wooden archer tower of the enemy: four legs, a platform with a railing, a little roof (archer stands at g.topY) */
export function archerTower(color = 0x2f6fd6) {
  const b = new Builder();
  const h = 3.4;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(P.box(0.22, h + 0.2, 0.22), T.woodDark, [x * 0.95, h / 2, z * 0.95], [z * 0.06, 0, -x * 0.06]);
  for (const y of [1.1, 2.3]) {
    b.add(P.box(2.1, 0.12, 0.12), T.wood, [0, y, 0.95]);
    b.add(P.box(2.1, 0.12, 0.12), T.wood, [0, y, -0.95]);
    b.add(P.box(0.12, 0.12, 2.1), T.wood, [0.95, y, 0]);
    b.add(P.box(0.12, 0.12, 2.1), T.wood, [-0.95, y, 0]);
  }
  b.add(P.box(2.6, 0.2, 2.6), T.wood, [0, h, 0]);
  for (const s of [-1, 1]) {
    b.add(P.box(2.6, 0.7, 0.1), 0x7a5636, [0, h + 0.45, s * 1.25]);
    b.add(P.box(0.1, 0.7, 2.6), 0x7a5636, [s * 1.25, h + 0.45, 0]);
  }
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) b.add(P.box(0.12, 1.9, 0.12), T.woodDark, [x, h + 1.0, z]);
  const r = new THREE.ConeGeometry(1, 1, 4, 1);
  r.rotateY(Math.PI / 4);
  r.scale(2.3, 1.0, 2.3);
  b.add(r, T.woodDark, [0, h + 2.3, 0]);
  b.add(P.cyl(0.04, 0.04, 1.2, 5), T.woodDark, [0, h + 3.2, 0]);
  b.add(P.box(0.8, 0.5, 0.04), color, [0.42, h + 3.5, 0]);
  const g = new THREE.Group();
  g.add(mk(b));
  g.topY = h + 0.1;
  return g;
}

/* dökümhane: a stone foundry with a tall chimney and a glowing furnace mouth */
export function forge() {
  const b = new Builder();
  b.add(P.box(3.4, 2.4, 2.8), T.stone, [0, 1.2, 0]);
  b.add(P.box(3.5, 0.2, 2.9), T.stoneDark, [0, 2.45, 0]);
  gable(b, 3.6, 3.0, 1.2, 2.5, T.roof, 0, 0, T.stone);
  b.add(P.box(0.9, 3.8, 0.9), T.stoneDark, [1.0, 3.0, -0.6]);
  b.add(P.box(1.0, 0.2, 1.0), T.stone, [1.0, 4.95, -0.6]);
  b.add(P.box(1.2, 1.0, 0.1), 0x1a1210, [0, 0.6, 1.42]);
  b.add(P.box(0.9, 0.5, 0.06), 0xff8a2a, [0, 0.45, 1.46]);
  for (let i = 0; i < 3; i++) b.add(P.sph(0.26, 8, 6), 0x2a2a2e, [-1.9 + i * 0.3, 0.26, 1.5 + (i % 2) * 0.3]);
  return mk(b);
}
