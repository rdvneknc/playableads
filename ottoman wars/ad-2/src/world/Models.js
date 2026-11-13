import { Builder, P } from './geom.js';
import { COLORS as C } from '../config.js';

// Stylised low-poly 3D characters (facing -Z, feet at y = 0).
// Each model = rigid body + animated limbs; every limb rotates about its pivot.
// anim(phase, mode): returns the limb angle. mode: 0 run, 1 fight, 2 idle, 3 cheer.

const DARK = 0x2a1a10;
const WOOD = 0x6b4424;

const swing = (amp, off = 0) => (ph, mode) => {
  if (mode === 0) return Math.sin(ph + off) * amp;
  if (mode === 1) return Math.sin(ph * 0.5 + off) * amp * 0.25;
  return 0;
};

function head(b, y, z = 0, { skin = C.skin, mustache = DARK } = {}) {
  b.add(P.cyl(0.07, 0.08, 0.1), skin, [0, y - 0.13, z]);
  b.add(P.sph(0.17), skin, [0, y, z]);
  b.add(P.sph(0.042, 8, 6), skin, [0, y - 0.01, z - 0.17], [0, 0, 0], 1, 0.92);
  b.add(P.sph(0.024, 6, 5), 0x111111, [-0.062, y + 0.035, z - 0.148]);
  b.add(P.sph(0.024, 6, 5), 0x111111, [0.062, y + 0.035, z - 0.148]);
  b.add(P.box(0.13, 0.045, 0.05), mustache, [-0.065, y - 0.065, z - 0.15], [0, 0, 0.32]);
  b.add(P.box(0.13, 0.045, 0.05), mustache, [0.065, y - 0.065, z - 0.15], [0, 0, -0.32]);
  b.add(P.box(0.08, 0.025, 0.03), mustache, [-0.065, y + 0.085, z - 0.15], [0, 0, -0.15]);
  b.add(P.box(0.08, 0.025, 0.03), mustache, [0.065, y + 0.085, z - 0.15], [0, 0, 0.15]);
}

function leg(x, color, boot) {
  return new Builder()
    .add(P.cyl(0.088, 0.075, 0.44, 10), color, [x, 0.4, 0])
    .add(P.box(0.13, 0.17, 0.25), boot, [x, 0.085, -0.04])
    .add(P.box(0.13, 0.05, 0.09), boot, [x, 0.03, -0.17], [0, 0, 0], 1, 0.85)
    .build();
}

function arm(x, coat, cuff, extra) {
  const b = new Builder()
    .add(P.cyl(0.078, 0.066, 0.48, 10), coat, [x, 1.17, 0])
    .add(P.cyl(0.072, 0.072, 0.07, 10), cuff, [x, 0.95, 0])
    .add(P.sph(0.066, 10, 8), C.skin, [x, 0.89, 0]);
  extra?.(b);
  return b.build();
}

/* ── Janissary (Yeniçeri): red kaftan, gold sash, tall white börk with gold plate ── */
function janissary() {
  const b = new Builder();
  b.add(P.cyl(0.2, 0.37, 0.8, 16), C.coat, [0, 0.88, 0]);
  b.add(P.box(0.07, 0.8, 0.03), C.gold, [0, 0.88, -0.29], [0.2, 0, 0]);
  b.add(P.cyl(0.235, 0.25, 0.13, 16), C.gold, [0, 1.02, 0]);
  b.add(P.cyl(0.19, 0.215, 0.32, 14), C.coat, [0, 1.33, 0]);
  b.add(P.box(0.14, 0.26, 0.03), C.gold, [0, 1.33, -0.2], [0, 0, 0], 1, 0.9);
  b.add(P.sph(0.105, 10, 8), C.coat, [-0.24, 1.42, 0]);
  b.add(P.sph(0.105, 10, 8), C.coat, [0.24, 1.42, 0]);
  head(b, 1.66);
  // börk
  b.add(P.cyl(0.188, 0.188, 0.075, 16), C.gold, [0, 1.8, 0.01]);
  b.add(P.cyl(0.13, 0.172, 0.52, 14), C.hat, [0, 2.07, 0.07], [0.24, 0, 0]);
  b.add(P.box(0.24, 0.6, 0.05), C.hat, [0, 1.78, 0.27], [-0.12, 0, 0], 1, 0.9);
  b.add(P.box(0.1, 0.22, 0.04), C.gold, [0, 1.93, -0.15], [0.22, 0, 0]);
  b.add(P.sph(0.035, 8, 6), C.gold, [0, 2.07, -0.13]);
  return {
    rigid: b.build(),
    limbs: [
      { geo: leg(-0.1, C.trousers, C.boot), pivot: [-0.1, 0.62, 0], anim: swing(0.75) },
      { geo: leg(0.1, C.trousers, C.boot), pivot: [0.1, 0.62, 0], anim: swing(0.75, Math.PI) },
      {
        // left arm: round shield
        geo: arm(-0.27, C.coat, C.gold, (a) =>
          a
            .add(P.cyl(0.23, 0.23, 0.05, 18), C.gold, [-0.37, 1.0, -0.03], [0, 0, Math.PI / 2])
            .add(P.cyl(0.18, 0.18, 0.06, 18), C.coat, [-0.38, 1.0, -0.03], [0, 0, Math.PI / 2])
            .add(P.sph(0.055, 8, 6), C.gold, [-0.42, 1.0, -0.03]),
        ),
        pivot: [-0.27, 1.4, 0],
        anim: (ph, mode) => (mode === 3 ? -2.6 : mode === 1 ? -0.5 : Math.sin(ph + Math.PI) * 0.45),
      },
      {
        // right arm: yatağan
        geo: arm(0.27, C.coat, C.gold, (a) =>
          a
            .add(P.box(0.15, 0.035, 0.05), C.gold, [0.27, 0.89, -0.04])
            .add(P.box(0.04, 0.66, 0.014), C.steel, [0.27, 1.12, -0.28], [-0.88, 0, 0])
            .add(P.box(0.02, 0.6, 0.016), 0xffffff, [0.285, 1.12, -0.27], [-0.88, 0, 0]),
        ),
        pivot: [0.27, 1.4, 0],
        anim: (ph, mode) => (mode === 1 ? -1.9 + Math.max(0, Math.sin(ph * 1.6)) * 2.2 : mode === 3 ? -2.8 : Math.sin(ph) * 0.45),
      },
    ],
    height: 2.3,
  };
}

/* ── Enemy footman: blue tunic, steel helmet, spear and kite shield ── */
function enemy() {
  const b = new Builder();
  b.add(P.cyl(0.21, 0.34, 0.78, 16), C.enemyCoat, [0, 0.88, 0]);
  b.add(P.cyl(0.235, 0.25, 0.12, 16), 0x5a3a20, [0, 1.02, 0]);
  b.add(P.cyl(0.19, 0.215, 0.32, 14), C.enemyCoat, [0, 1.33, 0]);
  b.add(P.box(0.3, 0.06, 0.03), 0xffffff, [0, 1.3, -0.205]);
  b.add(P.box(0.06, 0.3, 0.03), 0xffffff, [0, 1.3, -0.206], [0, 0, 0.78]);
  b.add(P.sph(0.105, 10, 8), C.enemyDark, [-0.24, 1.42, 0]);
  b.add(P.sph(0.105, 10, 8), C.enemyDark, [0.24, 1.42, 0]);
  head(b, 1.66, 0, { mustache: 0x6b4a2a });
  b.add(P.halfSph(0.195), C.enemyHelm, [0, 1.7, 0]);
  b.add(P.cyl(0.2, 0.2, 0.05, 16), C.enemyHelm, [0, 1.71, 0], [0, 0, 0], 1, 0.8);
  b.add(P.box(0.035, 0.15, 0.03), C.enemyHelm, [0, 1.65, -0.19]);
  b.add(P.cone(0.04, 0.14, 8), C.enemyHelm, [0, 1.95, 0]);
  return {
    rigid: b.build(),
    limbs: [
      { geo: leg(-0.1, 0x3b3b46, 0x2b2118), pivot: [-0.1, 0.62, 0], anim: swing(0.75) },
      { geo: leg(0.1, 0x3b3b46, 0x2b2118), pivot: [0.1, 0.62, 0], anim: swing(0.75, Math.PI) },
      {
        geo: arm(-0.27, C.enemyDark, C.enemyHelm, (a) =>
          a
            .add(P.box(0.05, 0.62, 0.42), C.enemyCoat, [-0.39, 1.0, -0.03])
            .add(P.box(0.055, 0.5, 0.06), 0xffffff, [-0.4, 1.0, -0.03])
            .add(P.box(0.055, 0.06, 0.32), 0xffffff, [-0.4, 1.08, -0.03]),
        ),
        pivot: [-0.27, 1.4, 0],
        anim: (ph, mode) => (mode === 1 ? -0.6 : Math.sin(ph + Math.PI) * 0.4),
      },
      {
        geo: arm(0.27, C.enemyDark, C.enemyHelm, (a) =>
          a
            .add(P.cyl(0.022, 0.022, 2.0, 6), WOOD, [0.27, 1.25, -0.12], [-0.12, 0, 0])
            .add(P.cone(0.055, 0.22, 8), C.steel, [0.27, 2.32, -0.25], [-0.12, 0, 0]),
        ),
        pivot: [0.27, 1.4, 0],
        anim: (ph, mode) => (mode === 1 ? -1.0 + Math.max(0, Math.sin(ph * 1.6)) * 0.9 : Math.sin(ph) * 0.35),
      },
    ],
    height: 2.3,
  };
}

/* ── Akıncı: light cavalry, brown horse with red saddle cloth, green-clad rider ── */
function rider() {
  const H = C.horse;
  const b = new Builder();
  // horse
  b.add(P.capsule(0.33, 0.9, 6, 14), H, [0, 1.08, 0], [Math.PI / 2, 0, 0]);
  b.add(P.sph(0.34, 14, 10), H, [0, 1.12, -0.42]);
  b.add(P.sph(0.35, 14, 10), H, [0, 1.12, 0.45]);
  b.add(P.cyl(0.15, 0.24, 0.75, 12), H, [0, 1.55, -0.72], [-0.62, 0, 0]);
  b.add(P.box(0.22, 0.24, 0.52), H, [0, 1.82, -1.05], [-0.55, 0, 0]);
  b.add(P.box(0.2, 0.18, 0.2), C.horseDark, [0, 1.66, -1.27], [-0.55, 0, 0]);
  b.add(P.box(0.07, 0.4, 0.62), C.horseDark, [0, 1.75, -0.66], [-0.62, 0, 0]);
  b.add(P.cone(0.05, 0.14, 6), H, [-0.07, 2.04, -0.92]);
  b.add(P.cone(0.05, 0.14, 6), H, [0.07, 2.04, -0.92]);
  b.add(P.sph(0.03, 6, 5), 0x111111, [-0.11, 1.9, -1.1]);
  b.add(P.sph(0.03, 6, 5), 0x111111, [0.11, 1.9, -1.1]);
  b.add(P.cyl(0.05, 0.1, 0.7, 8), C.horseDark, [0, 1.05, 0.88], [0.55, 0, 0]);
  // saddle cloth + tack
  b.add(P.box(0.72, 0.1, 0.78), C.saddle, [0, 1.36, 0.05]);
  b.add(P.box(0.74, 0.04, 0.8), C.gold, [0, 1.3, 0.05]);
  b.add(P.box(0.7, 0.38, 0.05), C.saddle, [0, 1.15, 0.43], [0, 0, 0], [1, 1, 1], 0.9);
  b.add(P.torus(0.17, 0.025, 6, 14), C.gold, [0, 1.45, -0.58], [0.9, 0, 0]);
  // rider
  b.add(P.box(0.16, 0.14, 0.42), 0x3a2a1c, [-0.24, 1.42, -0.08], [0, 0, 0.35]);
  b.add(P.box(0.16, 0.14, 0.42), 0x3a2a1c, [0.24, 1.42, -0.08], [0, 0, -0.35]);
  b.add(P.box(0.12, 0.36, 0.14), C.boot, [-0.36, 1.18, -0.2]);
  b.add(P.box(0.12, 0.36, 0.14), C.boot, [0.36, 1.18, -0.2]);
  b.add(P.cyl(0.2, 0.27, 0.62, 14), 0x3f7a3a, [0, 1.76, 0.05]);
  b.add(P.cyl(0.24, 0.25, 0.1, 14), C.gold, [0, 1.6, 0.05]);
  b.add(P.box(0.07, 0.55, 0.03), C.gold, [0, 1.78, -0.2], [0.12, 0, 0]);
  b.add(P.sph(0.1, 10, 8), 0x3f7a3a, [-0.23, 2.0, 0.05]);
  head(b, 2.25, 0.05);
  b.add(P.cone(0.19, 0.38, 14), C.steel, [0, 2.47, 0.05]);
  b.add(P.cyl(0.2, 0.2, 0.05, 14), C.gold, [0, 2.32, 0.05]);
  b.add(P.sph(0.03, 6, 5), C.gold, [0, 2.68, 0.05]);
  // left arm + shield (rigid, holding reins)
  b.add(P.cyl(0.075, 0.065, 0.42, 10), 0x3f7a3a, [-0.27, 1.8, -0.1], [-0.6, 0, 0.2]);
  b.add(P.cyl(0.24, 0.24, 0.05, 18), C.gold, [-0.4, 1.72, -0.05], [0, 0, Math.PI / 2]);
  b.add(P.cyl(0.19, 0.19, 0.06, 18), C.coat, [-0.41, 1.72, -0.05], [0, 0, Math.PI / 2]);
  const legGeo = (x, z) =>
    new Builder()
      .add(P.cyl(0.085, 0.06, 0.9, 8), H, [x, 0.55, z])
      .add(P.cyl(0.075, 0.08, 0.1, 8), C.horseDark, [x, 0.06, z])
      .build();
  const gallop = (off) => (ph, mode) => (mode === 0 ? Math.sin(ph * 0.8 + off) * 0.75 : mode === 3 ? Math.sin(ph) * 0.2 : 0);
  return {
    rigid: b.build(),
    limbs: [
      { geo: legGeo(-0.2, -0.45), pivot: [-0.2, 1.0, -0.45], anim: gallop(0) },
      { geo: legGeo(0.2, -0.45), pivot: [0.2, 1.0, -0.45], anim: gallop(0.7) },
      { geo: legGeo(-0.2, 0.48), pivot: [-0.2, 1.0, 0.48], anim: gallop(Math.PI) },
      { geo: legGeo(0.2, 0.48), pivot: [0.2, 1.0, 0.48], anim: gallop(Math.PI + 0.7) },
      {
        geo: new Builder()
          .add(P.cyl(0.078, 0.066, 0.46, 10), 0x3f7a3a, [0.27, 1.77, 0.05])
          .add(P.sph(0.066, 10, 8), C.skin, [0.27, 1.52, 0.05])
          .add(P.box(0.15, 0.035, 0.05), C.gold, [0.27, 1.52, 0.01])
          .add(P.box(0.04, 0.72, 0.014), C.steel, [0.27, 1.62, -0.33], [-1.2, 0, 0])
          .add(P.box(0.02, 0.66, 0.016), 0xffffff, [0.285, 1.62, -0.32], [-1.2, 0, 0])
          .build(),
        pivot: [0.27, 2.0, 0.05],
        anim: (ph, mode) => (mode === 1 ? -2.0 + Math.max(0, Math.sin(ph * 1.6)) * 2.0 : -2.3 + Math.sin(ph * 0.8) * 0.25),
      },
    ],
    height: 2.8,
  };
}

/* ── Wall archer (enemy, on the battlements): uses the footman body with a bow arm ── */
function archer() {
  const m = enemy();
  m.limbs[3] = {
    geo: new Builder()
      .add(P.cyl(0.078, 0.066, 0.48, 10), C.enemyDark, [0.27, 1.17, 0])
      .add(P.sph(0.066, 10, 8), C.skin, [0.27, 0.89, 0])
      .add(P.torus(0.42, 0.022, 5, 18, Math.PI), WOOD, [0.27, 0.89, -0.1], [0, Math.PI / 2, Math.PI / 2])
      .build(),
    pivot: [0.27, 1.4, 0],
    anim: (ph) => -1.5 + Math.sin(ph * 0.7) * 0.1,
  };
  return m;
}

export const MODELS = { janissary, enemy, rider, archer };
