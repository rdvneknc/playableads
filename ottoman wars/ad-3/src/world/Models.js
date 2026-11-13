import { Builder, P } from './geom.js';
import { COLORS as C } from '../config.js';

// Stylised low-poly characters (facing -Z, feet at y = 0), inspired by the
// Ottoman Wars art: the Pasha, amele workers, catapult crew, the sage, archers and the enemy.
// anim(phase, mode): mode 0 walk, 1 work/fight, 2 idle, 3 cheer.

const DARK = 0x2a1a10;
const WOOD = C.wood;

const walk = (amp, off = 0) => (ph, mode) => (mode === 0 ? Math.sin(ph + off) * amp : 0);

function face(b, y, z = 0, { beard = DARK, beardLong = 0, skin = C.skin } = {}) {
  b.add(P.cyl(0.07, 0.08, 0.1), skin, [0, y - 0.13, z]);
  b.add(P.sph(0.17), skin, [0, y, z]);
  b.add(P.sph(0.042, 8, 6), skin, [0, y - 0.01, z - 0.17], [0, 0, 0], 1, 0.92);
  b.add(P.sph(0.024, 6, 5), 0x111111, [-0.062, y + 0.035, z - 0.148]);
  b.add(P.sph(0.024, 6, 5), 0x111111, [0.062, y + 0.035, z - 0.148]);
  b.add(P.box(0.08, 0.025, 0.03), beard, [-0.065, y + 0.085, z - 0.15], [0, 0, -0.15]);
  b.add(P.box(0.08, 0.025, 0.03), beard, [0.065, y + 0.085, z - 0.15], [0, 0, 0.15]);
  b.add(P.box(0.13, 0.045, 0.05), beard, [-0.06, y - 0.065, z - 0.15], [0, 0, 0.3]);
  b.add(P.box(0.13, 0.045, 0.05), beard, [0.06, y - 0.065, z - 0.15], [0, 0, -0.3]);
  // beard: a rounded wedge under the chin (longer for elders)
  b.add(P.sph(0.15, 10, 8), beard, [0, y - 0.12 - beardLong * 0.3, z - 0.07], [0.2, 0, 0], [1, 0.75 + beardLong, 0.8]);
}

function leg(x, pants, boot, len = 0.44) {
  return new Builder()
    .add(P.cyl(0.088, 0.075, len, 10), pants, [x, 0.62 - len / 2, 0])
    .add(P.box(0.13, 0.15, 0.25), boot, [x, 0.08, -0.04])
    .add(P.box(0.11, 0.06, 0.1), boot, [x, 0.06, -0.19], [0.5, 0, 0])
    .build();
}

function sleeve(x, coat, extra) {
  const b = new Builder()
    .add(P.cyl(0.08, 0.07, 0.48, 10), coat, [x, 1.17, 0])
    .add(P.sph(0.066, 10, 8), C.skin, [x, 0.89, 0]);
  extra?.(b);
  return b.build();
}

const swingArm = (amp, off) => (ph, mode) => (mode === 0 ? Math.sin(ph + off) * amp : mode === 3 ? -2.6 : 0);

/* ── The Pasha: cream brocade kaftan with gold trim, green sleeves, red sash, white turban ── */
function pasha() {
  const b = new Builder();
  b.add(P.cyl(0.25, 0.43, 1.12, 18), C.pashaRobe, [0, 0.72, 0]);
  b.add(P.cyl(0.44, 0.44, 0.06, 18), C.pashaGold, [0, 0.18, 0]);
  b.add(P.box(0.06, 1.1, 0.03), C.pashaGold, [-0.09, 0.73, -0.33], [0.15, 0, 0]);
  b.add(P.box(0.06, 1.1, 0.03), C.pashaGold, [0.09, 0.73, -0.33], [0.15, 0, 0]);
  // brocade dots
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.add(P.sph(0.035, 6, 4), C.pashaGold, [Math.sin(a) * 0.37, 0.45 + (i % 3) * 0.18, Math.cos(a) * 0.37]);
  }
  b.add(P.cyl(0.27, 0.28, 0.16, 16), C.sash, [0, 1.15, 0]);
  b.add(P.box(0.16, 0.42, 0.04), C.sash, [0.0, 0.9, -0.3], [0.12, 0, 0]);
  b.add(P.sph(0.075, 10, 8), C.pashaGold, [0, 1.15, -0.27], [0, 0, 0], [1.2, 1.2, 0.5]);
  b.add(P.sph(0.03, 6, 4), 0x2fb34a, [0, 1.15, -0.31]);
  b.add(P.cyl(0.22, 0.26, 0.32, 16), C.pashaRobe, [0, 1.38, 0]);
  b.add(P.cyl(0.2, 0.23, 0.08, 16), C.pashaGold, [0, 1.55, 0]);
  b.add(P.sph(0.12, 10, 8), C.pashaRobe, [-0.26, 1.48, 0]);
  b.add(P.sph(0.12, 10, 8), C.pashaRobe, [0.26, 1.48, 0]);
  face(b, 1.73, 0, { beard: C.beard, beardLong: 0.3 });
  // turban
  b.add(P.sph(0.24, 16, 12), C.turban, [0, 1.98, 0.02], [0, 0, 0], [1, 0.72, 1]);
  b.add(P.torus(0.2, 0.06, 8, 18), 0xe5e0d4, [0, 1.92, 0.02], [Math.PI / 2, 0, 0.3]);
  b.add(P.torus(0.18, 0.045, 8, 18), C.sash, [0, 1.87, 0.02], [Math.PI / 2, 0, 0]);
  b.add(P.cyl(0.08, 0.1, 0.12, 10), C.sash, [0, 2.14, 0.02]);
  b.add(P.sph(0.05, 8, 6), C.pashaGold, [0, 1.98, -0.22]);
  return {
    rigid: b.build(),
    limbs: [
      { geo: leg(-0.11, C.pashaSleeve, C.boot, 0.3), pivot: [-0.11, 0.62, 0], anim: walk(0.55) },
      { geo: leg(0.11, C.pashaSleeve, C.boot, 0.3), pivot: [0.11, 0.62, 0], anim: walk(0.55, Math.PI) },
      { geo: sleeve(-0.3, C.pashaSleeve, (a) => a.add(P.cyl(0.085, 0.085, 0.06, 10), C.pashaGold, [-0.3, 0.95, 0])), pivot: [-0.3, 1.45, 0], anim: swingArm(0.4, Math.PI) },
      { geo: sleeve(0.3, C.pashaSleeve, (a) => a.add(P.cyl(0.085, 0.085, 0.06, 10), C.pashaGold, [0.3, 0.95, 0])), pivot: [0.3, 1.45, 0], anim: (ph, mode) => (mode === 0 ? Math.sin(ph) * 0.4 : mode === 3 ? -2.6 : mode === 1 ? -1.2 : 0) },
    ],
  };
}

/* ── Amele (worker): green tunic, red sash, leg wraps, basket on the back, shovel ── */
function worker() {
  const b = new Builder();
  b.add(P.cyl(0.21, 0.3, 0.62, 14), C.workTunic, [0, 0.95, 0]);
  b.add(P.cyl(0.24, 0.25, 0.12, 14), C.sash, [0, 0.98, 0]);
  b.add(P.box(0.12, 0.4, 0.04), C.sash, [0.12, 0.72, -0.24], [0.1, 0, 0]);
  b.add(P.cyl(0.19, 0.21, 0.28, 14), C.workTunic, [0, 1.33, 0]);
  b.add(P.box(0.03, 0.22, 0.02), 0xc8e0b0, [0, 1.36, -0.2]);
  b.add(P.sph(0.1, 10, 8), C.workTunic, [-0.23, 1.42, 0]);
  b.add(P.sph(0.1, 10, 8), C.workTunic, [0.23, 1.42, 0]);
  // straps + basket
  b.add(P.box(0.05, 0.5, 0.42), 0x6b4424, [-0.13, 1.2, 0.02], [0.1, 0, 0]);
  b.add(P.box(0.05, 0.5, 0.42), 0x6b4424, [0.13, 1.2, 0.02], [0.1, 0, 0]);
  b.add(P.cyl(0.28, 0.22, 0.62, 12), 0xa0662e, [0, 1.2, 0.33]);
  b.add(P.torus(0.27, 0.035, 6, 14), 0x6b4424, [0, 1.5, 0.33], [Math.PI / 2, 0, 0]);
  face(b, 1.66, 0, { beard: 0x4a2a14 });
  b.add(P.cyl(0.19, 0.2, 0.2, 14), C.workCap, [0, 1.83, 0.01]);
  b.add(P.torus(0.19, 0.04, 6, 14), 0xb5ad9e, [0, 1.79, 0.01], [Math.PI / 2, 0, 0]);
  b.add(P.sph(0.1, 10, 6), C.sash, [0, 1.93, 0.01], [0, 0, 0], [1, 0.6, 1]);
  const workLeg = (x) =>
    new Builder()
      .add(P.cyl(0.095, 0.08, 0.28, 10), C.workPants, [x, 0.52, 0])
      .add(P.cyl(0.075, 0.07, 0.26, 10), C.wrap, [x, 0.27, 0])
      .add(P.box(0.13, 0.13, 0.25), C.boot, [x, 0.07, -0.04])
      .build();
  const dig = (ph, mode) => (mode === 1 ? -0.9 + Math.sin(ph * 1.2) * 0.75 : mode === 0 ? Math.sin(ph) * 0.4 : 0);
  return {
    rigid: b.build(),
    limbs: [
      { geo: workLeg(-0.1), pivot: [-0.1, 0.62, 0], anim: walk(0.7) },
      { geo: workLeg(0.1), pivot: [0.1, 0.62, 0], anim: walk(0.7, Math.PI) },
      { geo: sleeve(-0.26, C.workTunic), pivot: [-0.26, 1.42, 0], anim: (ph, mode) => (mode === 1 ? dig(ph, 1) : mode === 0 ? Math.sin(ph + Math.PI) * 0.4 : 0) },
      {
        geo: sleeve(0.26, C.workTunic, (a) =>
          a
            .add(P.cyl(0.03, 0.03, 1.3, 6), WOOD, [0.26, 0.85, -0.22], [-0.35, 0, 0])
            .add(P.box(0.24, 0.28, 0.03), C.steel, [0.26, 0.24, -0.43], [-0.35, 0, 0])
            .add(P.box(0.2, 0.04, 0.05), WOOD, [0.26, 1.46, -0.01], [-0.35, 0, 0]),
        ),
        pivot: [0.26, 1.42, 0],
        anim: (ph, mode) => (mode === 1 ? dig(ph, 1) : mode === 0 ? Math.sin(ph) * 0.4 : 0),
      },
    ],
  };
}

/* ── Catapult crew: teal coat, red sash, white turban with red crown ── */
function crew() {
  const b = new Builder();
  b.add(P.cyl(0.21, 0.36, 0.95, 16), C.crewCoat, [0, 0.82, 0]);
  b.add(P.cyl(0.24, 0.25, 0.14, 14), C.sash, [0, 1.1, 0]);
  for (let i = 0; i < 4; i++) b.add(P.box(0.08, 0.025, 0.03), 0x1d5a5a, [0, 1.42 - i * 0.12, -0.21]);
  b.add(P.cyl(0.19, 0.21, 0.32, 14), C.crewCoat, [0, 1.36, 0]);
  b.add(P.sph(0.1, 10, 8), C.crewCoat, [-0.23, 1.44, 0]);
  b.add(P.sph(0.1, 10, 8), C.crewCoat, [0.23, 1.44, 0]);
  face(b, 1.68, 0, { beard: 0x3a2412 });
  b.add(P.sph(0.2, 14, 10), C.turban, [0, 1.9, 0.01], [0, 0, 0], [1, 0.6, 1]);
  b.add(P.cyl(0.1, 0.12, 0.14, 10), C.sash, [0, 2.0, 0.01]);
  return {
    rigid: b.build(),
    limbs: [
      { geo: leg(-0.1, 0x4a4a5a, 0x7a2a1a), pivot: [-0.1, 0.62, 0], anim: walk(0.6) },
      { geo: leg(0.1, 0x4a4a5a, 0x7a2a1a), pivot: [0.1, 0.62, 0], anim: walk(0.6, Math.PI) },
      { geo: sleeve(-0.27, C.crewCoat), pivot: [-0.27, 1.42, 0], anim: (ph, mode) => (mode === 1 ? -1.4 + Math.sin(ph) * 0.3 : mode === 3 ? -2.6 : 0) },
      { geo: sleeve(0.27, C.crewCoat), pivot: [0.27, 1.42, 0], anim: (ph, mode) => (mode === 1 ? -1.4 + Math.sin(ph + 1) * 0.3 : mode === 3 ? -2.6 : 0) },
    ],
  };
}

/* ── The sage: brown cloak over a green robe, tall turban, long white beard, staff ── */
function sage() {
  const b = new Builder();
  b.add(P.cyl(0.24, 0.4, 1.3, 16), C.sageRobe, [0, 0.66, 0]);
  b.add(P.cyl(0.27, 0.46, 1.25, 16, true), C.sageCloak, [0, 0.72, 0.04], [0, 0, 0], [1, 1, 0.98]);
  b.add(P.box(0.16, 1.2, 0.06), C.sageRobe, [0, 0.7, -0.38], [0.14, 0, 0]);
  b.add(P.cyl(0.25, 0.26, 0.12, 14), C.sash, [0, 1.12, 0]);
  b.add(P.cyl(0.22, 0.27, 0.34, 14), C.sageCloak, [0, 1.42, 0]);
  b.add(P.sph(0.13, 10, 8), C.sageCloak, [-0.27, 1.5, 0]);
  b.add(P.sph(0.13, 10, 8), C.sageCloak, [0.27, 1.5, 0]);
  face(b, 1.76, 0, { beard: C.beard, beardLong: 1.0 });
  b.add(P.sph(0.25, 16, 12), C.turban, [0, 2.0, 0.02], [0, 0, 0], [1, 0.75, 1]);
  b.add(P.cyl(0.11, 0.14, 0.5, 12), 0xa8322a, [0, 2.32, 0.02]);
  for (let i = 0; i < 6; i++) b.add(P.box(0.012, 0.5, 0.25), 0x8a2620, [0, 2.32, 0.02], [0, (i / 6) * Math.PI, 0]);
  return {
    rigid: b.build(),
    limbs: [
      {
        // left hand: amber prayer beads
        geo: sleeve(-0.3, C.sageCloak, (a) => {
          for (let i = 0; i < 9; i++) a.add(P.sph(0.035, 6, 5), 0xe8902a, [-0.3 + Math.sin(i * 0.7) * 0.04, 0.82 - i * 0.06, -0.08]);
        }),
        pivot: [-0.3, 1.48, 0],
        anim: (ph, mode) => (mode === 3 ? -2.4 : -0.5 + Math.sin(ph * 0.5) * 0.06),
      },
      {
        // right hand: carved staff
        geo: sleeve(0.3, C.sageCloak, (a) =>
          a.add(P.cyl(0.035, 0.045, 2.1, 6), 0xb07a3a, [0.32, 1.05, -0.1]).add(P.sph(0.08, 8, 6), 0xb07a3a, [0.36, 2.1, -0.12], [0, 0, 0], [1, 1.4, 1]),
        ),
        pivot: [0.3, 1.48, 0],
        anim: (ph, mode) => (mode === 3 ? -2.2 + Math.sin(ph) * 0.2 : -0.15),
      },
    ],
  };
}

/* ── Enemy footman (blue) ── */
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
  b.add(P.box(0.035, 0.15, 0.03), C.enemyHelm, [0, 1.65, -0.19]);
  b.add(P.cone(0.04, 0.14, 8), C.enemyHelm, [0, 1.95, 0]);
  return {
    rigid: b.build(),
    limbs: [
      { geo: leg(-0.1, 0x3b3b46, 0x2b2118), pivot: [-0.1, 0.62, 0], anim: walk(0.75) },
      { geo: leg(0.1, 0x3b3b46, 0x2b2118), pivot: [0.1, 0.62, 0], anim: walk(0.75, Math.PI) },
      {
        geo: sleeve(-0.27, C.enemyDark, (a) => a.add(P.box(0.05, 0.62, 0.42), C.enemyCoat, [-0.39, 1.0, -0.03]).add(P.box(0.055, 0.5, 0.06), 0xffffff, [-0.4, 1.0, -0.03])),
        pivot: [-0.27, 1.4, 0],
        anim: (ph, mode) => (mode === 1 ? -0.6 : mode === 0 ? Math.sin(ph + Math.PI) * 0.4 : 0),
      },
      {
        geo: sleeve(0.27, C.enemyDark, (a) =>
          a.add(P.box(0.04, 0.66, 0.014), C.steel, [0.27, 1.12, -0.28], [-0.88, 0, 0]).add(P.box(0.15, 0.035, 0.05), C.gold, [0.27, 0.89, -0.04]),
        ),
        pivot: [0.27, 1.4, 0],
        anim: (ph, mode) => (mode === 1 ? -1.9 + Math.max(0, Math.sin(ph * 1.6)) * 2.2 : mode === 0 ? Math.sin(ph) * 0.4 : 0),
      },
    ],
  };
}

/* ── Azap archer (ours) for the tower ── */
function archer() {
  const b = new Builder();
  b.add(P.cyl(0.21, 0.32, 0.78, 16), 0xd9a03a, [0, 0.88, 0]);
  b.add(P.cyl(0.235, 0.25, 0.12, 16), C.sash, [0, 1.02, 0]);
  b.add(P.cyl(0.19, 0.215, 0.32, 14), 0xd9a03a, [0, 1.33, 0]);
  b.add(P.box(0.08, 0.5, 0.18), 0x7a4a20, [0.15, 1.3, 0.22], [0, 0, 0.4]);
  face(b, 1.66, 0, { beard: 0x3a2412 });
  b.add(P.cyl(0.17, 0.19, 0.18, 12), C.red, [0, 1.84, 0.01]);
  b.add(P.torus(0.18, 0.05, 6, 14), C.turban, [0, 1.78, 0.01], [Math.PI / 2, 0, 0]);
  return {
    rigid: b.build(),
    limbs: [
      { geo: leg(-0.1, 0x6b2a1a, C.boot), pivot: [-0.1, 0.62, 0], anim: () => 0 },
      { geo: leg(0.1, 0x6b2a1a, C.boot), pivot: [0.1, 0.62, 0], anim: () => 0 },
      {
        geo: sleeve(-0.27, 0xd9a03a, (a) => a.add(P.torus(0.45, 0.022, 5, 18, Math.PI), 0x6b4424, [-0.27, 0.89, -0.05], [0, Math.PI / 2, Math.PI / 2])),
        pivot: [-0.27, 1.4, 0],
        anim: (ph, mode) => (mode === 1 ? -1.5 + Math.sin(ph) * 0.05 : -0.3),
      },
      { geo: sleeve(0.27, 0xd9a03a), pivot: [0.27, 1.4, 0], anim: (ph, mode) => (mode === 1 ? -1.4 + Math.max(0, Math.sin(ph * 0.8)) * 0.6 : -0.2) },
    ],
  };
}

export const MODELS = { pasha, worker, crew, sage, enemy, archer };
