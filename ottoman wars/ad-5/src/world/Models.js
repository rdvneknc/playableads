import { Builder, P } from './geom.js';
import { COLORS as C } from '../config.js';

// Stylised low-poly characters (facing -Z, feet at y = 0).
// anim(phase, mode) modes:
//   0 walk · 1 hold forward (bowl) · 2 idle · 3 cheer · 4 sit · 5 sit + bowl · 6 walk with a load on the back

const DARK = 0x2a1a10;
export const SIT_DROP = 0.44; // how far the body sinks when sitting

const isWalk = (m) => m === 0 || m === 6;
const isSit = (m) => m === 4 || m === 5;
const legAnim = (amp, off = 0) => (ph, mode) => (isWalk(mode) ? Math.sin(ph + off) * amp : isSit(mode) ? 1.45 : 0);

// arm: side -1 left / +1 right
const armAnim = (side, amp = 0.4) => (ph, mode) => {
  switch (mode) {
    case 0:
      return Math.sin(ph + (side < 0 ? Math.PI : 0)) * amp;
    case 1:
    case 5:
      return 1.15 + Math.sin(ph * 0.5) * 0.04;
    case 3:
      return -2.6 + Math.sin(ph * 2 + side) * 0.2;
    case 4:
      return 0.55;
    case 6:
      return -2.75; // hands up behind the head, steadying the load
    default:
      return Math.sin(ph * 0.6 + side) * 0.04;
  }
};

function face(b, y, z = 0, { beard = DARK, beardLong = 0, skin = C.skin, moustache = true } = {}) {
  b.add(P.cyl(0.07, 0.08, 0.1), skin, [0, y - 0.13, z]);
  b.add(P.sph(0.17), skin, [0, y, z]);
  b.add(P.sph(0.042, 8, 6), skin, [0, y - 0.01, z - 0.17], [0, 0, 0], 1, 0.92);
  b.add(P.sph(0.024, 6, 5), 0x111111, [-0.062, y + 0.035, z - 0.148]);
  b.add(P.sph(0.024, 6, 5), 0x111111, [0.062, y + 0.035, z - 0.148]);
  b.add(P.box(0.08, 0.025, 0.03), beard, [-0.065, y + 0.085, z - 0.15], [0, 0, -0.15]);
  b.add(P.box(0.08, 0.025, 0.03), beard, [0.065, y + 0.085, z - 0.15], [0, 0, 0.15]);
  if (moustache) {
    b.add(P.box(0.15, 0.045, 0.05), beard, [-0.07, y - 0.065, z - 0.15], [0, 0, 0.35]);
    b.add(P.box(0.15, 0.045, 0.05), beard, [0.07, y - 0.065, z - 0.15], [0, 0, -0.35]);
  }
  if (beardLong >= 0) b.add(P.sph(0.15, 10, 8), beard, [0, y - 0.12 - beardLong * 0.3, z - 0.07], [0.2, 0, 0], [1, 0.75 + beardLong, 0.8]);
}

function leg(x, pants, boot, len = 0.44) {
  return new Builder()
    .add(P.cyl(0.088, 0.075, len, 10), pants, [x, 0.62 - len / 2, 0])
    .add(P.box(0.13, 0.15, 0.25), boot, [x, 0.08, -0.04])
    .add(P.box(0.11, 0.06, 0.1), boot, [x, 0.06, -0.19], [0.5, 0, 0])
    .build();
}

function sleeve(x, coat, extra, cuff) {
  const b = new Builder()
    .add(P.cyl(0.08, 0.07, 0.48, 10), coat, [x, 1.17, 0])
    .add(P.sph(0.066, 10, 8), C.skin, [x, 0.89, 0]);
  if (cuff) b.add(P.cyl(0.078, 0.078, 0.07, 10), cuff, [x, 0.96, 0]);
  extra?.(b);
  return b.build();
}

const limbs = (pants, boot, coat, legLen, { cuff, rightExtra, leftExtra, armY = 1.42, armX = 0.27 } = {}) => [
  { geo: leg(-0.1, pants, boot, legLen), pivot: [-0.1, 0.62, 0], anim: legAnim(0.65) },
  { geo: leg(0.1, pants, boot, legLen), pivot: [0.1, 0.62, 0], anim: legAnim(0.65, Math.PI) },
  { geo: sleeve(-armX, coat, leftExtra, cuff), pivot: [-armX, armY, 0], anim: armAnim(-1) },
  { geo: sleeve(armX, coat, rightExtra, cuff), pivot: [armX, armY, 0], anim: armAnim(1) },
];

/* ── Aşçı (the player): cream kaftan, leather apron, red sash, tall white cook's börk ── */
function cook() {
  const b = new Builder();
  b.add(P.cyl(0.23, 0.38, 0.9, 16), C.cookRobe, [0, 0.82, 0]);
  b.add(P.box(0.42, 0.78, 0.05), C.apron, [0, 0.74, -0.3], [0.16, 0, 0]);
  b.add(P.box(0.3, 0.05, 0.06), 0x5a3a20, [0, 1.1, -0.27]);
  b.add(P.cyl(0.26, 0.27, 0.15, 16), C.sash, [0, 1.12, 0]);
  b.add(P.cyl(0.2, 0.24, 0.34, 14), C.cookRobe, [0, 1.36, 0]);
  b.add(P.box(0.05, 0.3, 0.03), 0xd9a63a, [0, 1.36, -0.22]);
  b.add(P.sph(0.11, 10, 8), C.cookRobe, [-0.25, 1.45, 0]);
  b.add(P.sph(0.11, 10, 8), C.cookRobe, [0.25, 1.45, 0]);
  face(b, 1.7, 0, { beard: C.beard, beardLong: 0.15 });
  // tall börk with a gold band and a ladle (kaşık) in front
  b.add(P.cyl(0.17, 0.2, 0.46, 14), C.bork, [0, 2.07, 0.02]);
  b.add(P.sph(0.17, 12, 8), C.bork, [0, 2.3, 0.02], [0, 0, 0], [1, 0.45, 1]);
  b.add(P.cyl(0.205, 0.205, 0.08, 14), 0xd9a63a, [0, 1.88, 0.02]);
  b.add(P.box(0.06, 0.3, 0.03), 0xd9a63a, [0, 2.02, -0.2]);
  b.add(P.sph(0.05, 8, 6), 0xd9a63a, [0, 2.2, -0.2], [0, 0, 0], [1, 1.2, 0.5]);
  return { rigid: b.build(), limbs: limbs(0x6a4a30, C.boot, C.cookRobe, 0.34, { cuff: 0xd9a63a }) };
}

/* ── Yeniçeri: red kaftan over a blue entari, yellow sash, white börk with the cloth flap and spoon holder, musket ── */
function janissary() {
  const b = new Builder();
  b.add(P.cyl(0.22, 0.4, 0.92, 16), C.janCoat, [0, 0.82, 0]);
  b.add(P.box(0.22, 0.86, 0.04), C.janUnder, [0, 0.78, -0.31], [0.18, 0, 0]);
  b.add(P.cyl(0.255, 0.265, 0.16, 16), C.janSash, [0, 1.12, 0]);
  b.add(P.cyl(0.2, 0.235, 0.34, 14), C.janCoat, [0, 1.36, 0]);
  b.add(P.box(0.18, 0.3, 0.03), C.janUnder, [0, 1.36, -0.205]);
  for (let i = 0; i < 4; i++) b.add(P.sph(0.022, 6, 4), 0xe8c060, [0, 1.25 + i * 0.07, -0.225]);
  b.add(P.sph(0.11, 10, 8), C.janCoat, [-0.25, 1.45, 0]);
  b.add(P.sph(0.11, 10, 8), C.janCoat, [0.25, 1.45, 0]);
  face(b, 1.7, 0, { beard: DARK, beardLong: -1 });
  // börk: tall felt cap, gold band, spoon holder in front, the long flap down the back
  b.add(P.cyl(0.16, 0.19, 0.5, 14), C.bork, [0, 2.08, 0.03], [-0.12, 0, 0]);
  b.add(P.cyl(0.2, 0.2, 0.1, 14), 0xd9a63a, [0, 1.86, 0.02]);
  b.add(P.box(0.07, 0.34, 0.03), 0xd9a63a, [0, 2.02, -0.19]);
  b.add(P.sph(0.045, 8, 6), 0xe8e0d0, [0, 2.21, -0.2], [0, 0, 0], [1, 1.3, 0.4]);
  b.add(P.box(0.28, 0.06, 0.6), C.bork, [0, 2.3, 0.3], [-0.5, 0, 0]);
  b.add(P.box(0.3, 0.8, 0.05), C.bork, [0, 1.85, 0.5], [0.12, 0, 0]);
  // musket slung across the back
  b.add(P.cyl(0.025, 0.035, 1.5, 6), 0x5a3a20, [0.05, 1.3, 0.3], [0, 0, 0.42]);
  b.add(P.cyl(0.018, 0.018, 0.9, 6), 0x3a3a40, [0.25, 1.75, 0.3], [0, 0, 0.42]);
  return { rigid: b.build(), limbs: limbs(C.janUnder, 0xb88a2a, C.janCoat, 0.34, { cuff: C.janUnder }) };
}

/* ── Hamal: rolled-up shirt, leather vest, red semer (load saddle) on the back, fez ── */
function hamal() {
  const b = new Builder();
  b.add(P.cyl(0.21, 0.3, 0.62, 14), C.hamalShirt, [0, 0.95, 0]);
  b.add(P.cyl(0.24, 0.25, 0.12, 14), C.sash, [0, 0.98, 0]);
  b.add(P.cyl(0.2, 0.22, 0.32, 14), C.hamalVest, [0, 1.33, 0]);
  b.add(P.box(0.06, 0.3, 0.03), C.hamalShirt, [0, 1.33, -0.21]);
  b.add(P.sph(0.1, 10, 8), C.hamalShirt, [-0.23, 1.42, 0]);
  b.add(P.sph(0.1, 10, 8), C.hamalShirt, [0.23, 1.42, 0]);
  // semer: a thick padded saddle on the back, with a wooden ledge at the bottom
  b.add(P.box(0.5, 0.68, 0.22), C.semer, [0, 1.25, 0.28], [0.12, 0, 0]);
  b.add(P.box(0.52, 0.06, 0.24), 0xd9a63a, [0, 1.42, 0.3], [0.12, 0, 0]);
  b.add(P.box(0.56, 0.1, 0.36), C.wood, [0, 0.9, 0.36]);
  face(b, 1.66, 0, { beard: 0x4a2a14, beardLong: 0.1 });
  b.add(P.cyl(0.15, 0.17, 0.22, 12), C.red, [0, 1.85, 0.01]);
  b.add(P.cyl(0.02, 0.02, 0.12, 4), DARK, [0.06, 1.98, 0.05], [0, 0, 0.5]);
  return { rigid: b.build(), limbs: limbs(C.hamalPants, C.boot, C.hamalShirt, 0.3, { cuff: 0xc8b898, armY: 1.42, armX: 0.26 }) };
}

/* ── Enemy footman (blue) on the pass ── */
function enemy() {
  const b = new Builder();
  b.add(P.cyl(0.21, 0.34, 0.78, 16), C.enemyCoat, [0, 0.88, 0]);
  b.add(P.cyl(0.235, 0.25, 0.12, 16), 0x5a3a20, [0, 1.02, 0]);
  b.add(P.cyl(0.19, 0.215, 0.32, 14), C.enemyCoat, [0, 1.33, 0]);
  b.add(P.box(0.3, 0.06, 0.03), 0xffffff, [0, 1.3, -0.205]);
  b.add(P.sph(0.105, 10, 8), C.enemyDark, [-0.24, 1.42, 0]);
  b.add(P.sph(0.105, 10, 8), C.enemyDark, [0.24, 1.42, 0]);
  face(b, 1.66, 0, { beard: 0x6b4a2a });
  b.add(P.halfSph(0.195), C.enemyHelm, [0, 1.7, 0]);
  b.add(P.cyl(0.2, 0.2, 0.05, 16), C.enemyHelm, [0, 1.71, 0], [0, 0, 0], 1, 0.8);
  b.add(P.cone(0.04, 0.14, 8), C.enemyHelm, [0, 1.95, 0]);
  return {
    rigid: b.build(),
    limbs: limbs(0x3b3b46, 0x2b2118, C.enemyDark, 0.44, {
      rightExtra: (a) => a.add(P.cyl(0.025, 0.025, 2.2, 5), 0x6a4a2a, [0.27, 1.2, -0.1]).add(P.cone(0.06, 0.25, 6), C.steel, [0.27, 2.4, -0.1]),
    }),
  };
}

export const MODELS = { cook, janissary, hamal, enemy };
