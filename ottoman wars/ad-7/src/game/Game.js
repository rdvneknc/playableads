import * as THREE from '../vendor/three.module.min.js';
import { Terrain } from '../world/Terrain.js';
import { SkinnedCrowd, unitScale } from '../world/Models.js';
import { Builder, P } from '../world/geom.js';
import { Fx } from '../fx/Fx.js';
import { sfx } from '../audio/Sfx.js';
import { TEXT, CAMP, SPOTS, PADS, ECON, HERO, BEAR, BOSS, SOLDIER, TOWER, BEAR_SPAWNS, ENEMY_CASTLE } from '../config.js';

// The frontier camp. Everything runs from update(dt), so pausing the ad pauses the game.

const rnd = (a, b) => a + (b - a) * Math.random();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BS = 1.6; // town kit scale

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const shadowed = (m) => {
  m.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return m;
};

// ------------------------------------------------------------------ pad texture
function padCanvas(icon, cost, paid, meat) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const rr = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  rr(8, 8, 240, 240, 34);
  g.fillStyle = 'rgba(38,26,14,0.88)';
  g.fill();
  // progress fill from the bottom
  const k = clamp(paid / cost, 0, 1);
  if (k > 0) {
    g.save();
    rr(8, 8, 240, 240, 34);
    g.clip();
    g.fillStyle = 'rgba(120,200,70,0.55)';
    g.fillRect(8, 248 - 240 * k, 240, 240 * k);
    g.restore();
  }
  rr(8, 8, 240, 240, 34);
  g.lineWidth = 10;
  g.strokeStyle = '#f6e2b0';
  g.stroke();
  // icon
  g.save();
  g.translate(128, 100);
  g.fillStyle = '#fff6e0';
  g.strokeStyle = '#fff6e0';
  g.lineJoin = 'round';
  if (icon === 'tower') {
    g.fillRect(-26, -18, 52, 70);
    g.beginPath();
    g.moveTo(-40, -18);
    g.lineTo(0, -58);
    g.lineTo(40, -18);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(38,26,14,1)';
    g.fillRect(-10, 22, 20, 30);
    g.fillRect(-18, -6, 10, 14);
    g.fillRect(8, -6, 10, 14);
  } else if (icon === 'soldier') {
    g.beginPath();
    g.arc(0, -30, 18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-14, -48);
    g.lineTo(0, -76);
    g.lineTo(14, -48);
    g.fill();
    g.beginPath();
    g.moveTo(-34, 52);
    g.quadraticCurveTo(-34, -6, 0, -8);
    g.quadraticCurveTo(34, -6, 34, 52);
    g.fill();
  } else {
    g.rotate(-0.6);
    g.fillRect(-7, -24, 14, 84);
    g.fillRect(-36, -50, 72, 30);
  }
  g.restore();
  // price
  g.font = 'bold 56px Arial Black, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const left = Math.max(0, Math.ceil(cost - paid));
  const label = `${left}`;
  const w = g.measureText(label).width;
  const cx = 128 + 22;
  if (meat) {
    g.fillStyle = '#d8423a';
    g.beginPath();
    g.ellipse(cx - w / 2 - 30, 200, 22, 16, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f6e6d0';
    g.fillRect(cx - w / 2 - 22, 196, 18, 7);
  } else {
    g.fillStyle = '#f6c445';
    g.beginPath();
    g.arc(cx - w / 2 - 28, 200, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b77a12';
    g.beginPath();
    g.arc(cx - w / 2 - 28, 200, 11, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffffff';
  g.fillText(label, cx, 202);
  return cv;
}

export class Game {
  constructor(renderer, hud, { models, onEnd }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.M = models;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 300);
    this.terrain = new Terrain(this.scene);
    this.fx = new Fx(this.scene);
    this.time = 0;
    this.state = 'play';
    this.money = 0;
    this.input = { x: 0, z: 0 };
    this.moved = false;
    this.shake = 0;
    this.flags = {};
    this.jobs = [];

    const M = models;
    const soldierScale = unitScale(M.jan, 1.75);
    this.heroCrowd = new SkinnedCrowd(this.scene, M.hero, 1, HERO.scale);
    this.bearCrowd = new SkinnedCrowd(this.scene, M.bear, 16, BEAR.scale);
    this.bossCrowd = new SkinnedCrowd(this.scene, M.bear, 1, BEAR.scale * BOSS.scale);
    this.janCrowd = new SkinnedCrowd(this.scene, M.jan, ECON.maxSoldiers, soldierScale);
    this.workerCrowd = new SkinnedCrowd(this.scene, M.worker, ECON.workers, unitScale(M.worker, 1.7), { hide: ['Cuval'] });
    this.azapCrowd = new SkinnedCrowd(this.scene, M.azap, 2, unitScale(M.azap, 1.6));
    // darker fur for the boss
    this.bossCrowd.units[0].model.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(0x5a4232);
      }
    });
    this.socket = this.heroCrowd.units[0].model.getObjectByName('CarrySocket');

    this.makeItems();
    this.buildCamp();
    this.buildQuarry();
    this.buildFortress();
    this.buildEnemyCastle();

    // hero
    this.hero = { x: SPOTS.hero[0], z: SPOTS.hero[1], yaw: Math.PI, anim: 'Idle', cd: 0, stack: [], hitT: 0 };
    // a soft golden ring under the commander
    this.heroRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.75, depthWrite: false }));
    this.heroRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.heroRing);
    this.stackGroup = new THREE.Group();
    this.scene.add(this.stackGroup);

    // bears: three waiting at the gate at the start
    this.bears = [];
    this.bearSlot = 0;
    for (const [x, z] of [[-2.5, -11.5], [1.5, -12.6], [4.2, -11.2]]) this.spawnBear(x, z, false);
    this.spawnT = 6;
    this.soldiers = [];
    this.workers = Array.from({ length: ECON.workers }, (_, i) => ({ i, st: 'dig', t: i * 0.9 + 0.5, x: SPOTS.quarry[0] - 1, z: SPOTS.quarry[1] + 1.5, carry: null }));
    this.towers = [];
    this.groundCoins = [];
    this.flyers = [];

    // goal markers: a bouncing arrow over the target and a ground arrow at the hero's feet
    const arrow = new Builder().add(P.cone(0.45, 0.8, 4), 0xffd24a, [0, 0.4, 0], [Math.PI, Math.PI / 4, 0]).add(P.box(0.32, 0.6, 0.32), 0xffd24a, [0, 1.05, 0]).build();
    this.marker = new THREE.Mesh(arrow, new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.scene.add(this.marker);
    const sh = new THREE.Shape();
    sh.moveTo(0, -1.2).lineTo(0.55, -0.4).lineTo(0.2, -0.4).lineTo(0.2, 0.4).lineTo(-0.2, 0.4).lineTo(-0.2, -0.4).lineTo(-0.55, -0.4).closePath();
    const ga = new THREE.ShapeGeometry(sh);
    ga.rotateX(-Math.PI / 2);
    this.pointer = new THREE.Mesh(ga, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, depthWrite: false }));
    this.scene.add(this.pointer);

    this.cam = { x: this.hero.x, z: this.hero.z, d: 20, yaw: -0.22, pitch: 0.9 };
    this.hud.setMoney(0);
    this.hud.show();
  }

  // ------------------------------------------------------------------ items
  makeItems() {
    const stone = new Builder().add(P.box(0.5, 0.28, 0.42), 0xc8c0b0, [0, 0.14, 0]).add(P.box(0.48, 0.04, 0.4), 0xa89f8e, [0, 0.29, 0]).build();
    const meat = new Builder()
      .add(P.cyl(0.24, 0.26, 0.14, 12), 0xc8323a, [0, 0.07, 0], [0, 0, 0], [1.25, 1, 0.9])
      .add(P.cyl(0.15, 0.15, 0.15, 10), 0xf2a0a0, [0.05, 0.075, 0], [0, 0, 0], [1.1, 1, 0.8])
      .add(P.cyl(0.05, 0.05, 0.3, 6), 0xf6eedc, [0.32, 0.07, 0], [0, 0, Math.PI / 2])
      .build();
    const coin = new Builder().add(P.cyl(0.17, 0.17, 0.06, 14), 0xf6c445, [0, 0.03, 0]).add(P.cyl(0.11, 0.11, 0.07, 12), 0xd8a12a, [0, 0.03, 0]).build();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 });
    const gold = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.55 });
    this.items = { stone: { geo: stone, mat, h: 0.3 }, meat: { geo: meat, mat, h: 0.17 }, coin: { geo: coin, mat: gold, h: 0.065 } };
  }

  itemMesh(type) {
    const it = this.items[type];
    const m = new THREE.Mesh(it.geo, it.mat);
    m.castShadow = true;
    return m;
  }

  // an item flying in an arc from a to b
  fly(type, a, b, dur = 0.35, arc = 1.4, done = null, mesh = null) {
    const m = mesh || this.itemMesh(type);
    this.scene.add(m);
    this.flyers.push({ m, a: a.clone(), b, t: 0, dur, arc, done, spin: rnd(-6, 6) });
  }

  // an instanced pile of items laid out on a grid (stone pile, meat rack, coin stack)
  pile(type, x, y, z, cols, rows, max, dx, dz) {
    const it = this.items[type];
    const im = new THREE.InstancedMesh(it.geo, it.mat, max);
    im.castShadow = true;
    im.count = 0;
    this.scene.add(im);
    const o = new THREE.Object3D();
    const p = { im, n: 0, max, top: V(x, y, z) };
    p.set = (n) => {
      p.n = clamp(n, 0, max);
      for (let i = 0; i < p.n; i++) {
        const layer = Math.floor(i / (cols * rows));
        const k = i % (cols * rows);
        const cx = (k % cols) - (cols - 1) / 2;
        const cz = Math.floor(k / cols) - (rows - 1) / 2;
        o.position.set(x + cx * dx, y + layer * it.h, z + cz * dz);
        o.rotation.y = (layer % 2) * 0.12;
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      }
      im.count = p.n;
      im.instanceMatrix.needsUpdate = true;
      const layer = Math.floor(Math.max(0, p.n - 1) / (cols * rows));
      p.top.set(x, y + (layer + 1) * it.h + 0.1, z);
    };
    return p;
  }

  // ------------------------------------------------------------------ camp
  buildCamp() {
    const M = this.M;
    const wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    // palisade: sharpened logs along the sides, leaving the north gate and the east quarry gate
    this.fence = [];
    const logGeo = new Builder().add(P.cyl(0.17, 0.19, 1.7, 7), 0xc8935e, [0, 0.85, 0]).add(P.cone(0.17, 0.35, 7), 0xe0b07a, [0, 1.87, 0]).build();
    const log = (x, z) => {
      const m = new THREE.Mesh(logGeo, wood);
      m.position.set(x, 0, z);
      m.rotation.y = rnd(0, 6);
      m.scale.y = rnd(0.9, 1.1);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      this.fence.push(m);
    };
    const step = 0.36;
    for (let x = CAMP.x0; x <= CAMP.x1 + 0.01; x += step) {
      if (Math.abs(x) > CAMP.gate) log(x, CAMP.z0);
      log(x, CAMP.z1);
    }
    for (let z = CAMP.z0 + step; z < CAMP.z1; z += step) {
      log(CAMP.x0, z);
      if (z < CAMP.eastGate[0] || z > CAMP.eastGate[1]) log(CAMP.x1, z);
    }
    // a rail holding the logs together
    const rails = new Builder();
    const W = CAMP.x1 - CAMP.x0;
    const D = CAMP.z1 - CAMP.z0;
    for (const y of [0.55, 1.25]) {
      rails.add(P.box(W, 0.1, 0.1), 0x6b4a2c, [0, y, CAMP.z1 + 0.2]);
      rails.add(P.box(CAMP.x1 - CAMP.gate - 0.2 + 7.5 - 7.5, 0.1, 0.1), 0x6b4a2c, [-(CAMP.gate + 7.5) / 2 - 0.1, y, CAMP.z0 + 0.2], [0, 0, 0], [1, 1, 1]);
      rails.add(P.box(7.5 - CAMP.gate, 0.1, 0.1), 0x6b4a2c, [(CAMP.gate + 7.5) / 2, y, CAMP.z0 + 0.2]);
      rails.add(P.box(0.1, 0.1, D), 0x6b4a2c, [CAMP.x0 + 0.2, y, 0]);
    }
    // gate posts with a little banner
    for (const s of [-1, 1]) {
      rails.add(P.cyl(0.24, 0.26, 2.6, 8), 0x7a5230, [s * (CAMP.gate + 0.15), 1.3, CAMP.z0]);
      rails.add(P.box(0.06, 0.9, 0.6), 0xc8202a, [s * (CAMP.gate + 0.15), 2.05, CAMP.z0 + 0.32]);
      rails.add(P.cyl(0.2, 0.22, 2.2, 8), 0x7a5230, [CAMP.x1, 1.1, s < 0 ? CAMP.eastGate[0] - 0.1 : CAMP.eastGate[1] + 0.1]);
    }
    rails.add(P.box(CAMP.gate * 2 + 0.6, 0.22, 0.22), 0x6b4a2c, [0, 2.5, CAMP.z0]);
    this.camp = new THREE.Mesh(rails.build(), wood);
    this.camp.castShadow = this.camp.receiveShadow = true;
    this.scene.add(this.camp);

    // tents
    this.tents = [];
    const tentScale = unitScale(M.tent, 3);
    for (const [x, z, ry] of [[SPOTS.tent[0], SPOTS.tent[1], 0.4], [-1.2, 5.6, -0.2]]) {
      const t = shadowed(M.tent.scene.clone(true));
      t.scale.setScalar(tentScale);
      t.position.set(x, 0, z);
      t.rotation.y = ry;
      this.scene.add(t);
      this.tents.push(t);
    }

    // stations
    const st = new Builder();
    // stone pallet
    st.add(P.box(1.9, 0.14, 1.6), 0x8a6440, [SPOTS.pile[0], 0.07, SPOTS.pile[1]]);
    // the counter (tezgâh) with a little awning
    const [cx, cz] = SPOTS.counter;
    st.add(P.box(1.7, 0.95, 0.9), 0x9a6a3e, [cx, 0.48, cz]);
    st.add(P.box(1.85, 0.08, 1.0), 0x7a5230, [cx, 0.98, cz]);
    st.add(P.box(0.4, 0.3, 0.3), 0x6a6a72, [cx - 0.5, 1.12, cz]); // scales
    st.add(P.box(1.9, 0.03, 0.5), 0xc8202a, [cx, 1.03, cz + 0.2]);
    // coin tray
    st.add(P.box(1.4, 0.12, 1.2), 0x6b4a2c, [SPOTS.coins[0], 0.06, SPOTS.coins[1]]);
    // meat rack (a butcher's table)
    const [rx, rz] = SPOTS.rack;
    st.add(P.box(2.0, 0.7, 1.2), 0x9a6a3e, [rx, 0.35, rz]);
    st.add(P.box(2.1, 0.08, 1.3), 0xd8c8a8, [rx, 0.72, rz]);
    st.add(P.cyl(0.04, 0.04, 1.6, 6), 0x6b4a2c, [rx - 1, 1.5, rz - 0.6]);
    st.add(P.cyl(0.04, 0.04, 1.6, 6), 0x6b4a2c, [rx + 1, 1.5, rz - 0.6]);
    st.add(P.box(2.1, 0.06, 0.06), 0x6b4a2c, [rx, 2.25, rz - 0.6]);
    // barrels & crates for life
    for (const [x, z] of [[6.4, 5.6], [5.6, 6.1], [-6.5, -1.2], [-6.6, 0.0]]) st.add(P.cyl(0.32, 0.34, 0.8, 10), 0x7a5230, [x, 0.4, z]);
    for (const [x, z] of [[6.4, 4.4], [-6.4, 4.0]]) st.add(P.box(0.7, 0.6, 0.7), 0xa07648, [x, 0.3, z]);
    this.stations = new THREE.Mesh(st.build(), wood);
    this.stations.castShadow = this.stations.receiveShadow = true;
    this.scene.add(this.stations);

    this.stonePile = this.pile('stone', SPOTS.pile[0], 0.14, SPOTS.pile[1], 3, 3, ECON.pileMax, 0.55, 0.45);
    this.stonePile.set(ECON.pileStart);
    this.meatRack = this.pile('meat', rx, 0.76, rz, 4, 2, 24, 0.48, 0.5);
    this.coinPile = this.pile('coin', SPOTS.coins[0], 0.12, SPOTS.coins[1], 3, 3, 120, 0.36, 0.36);
    this.counterQ = 0;
    this.counterT = 0;

    // pads
    this.pads = {};
    for (const [k, c] of Object.entries(PADS)) this.pads[k] = this.makePad(k, c);
    this.showPad('tower1');

    // solid things the hero walks around
    this.blocks = [
      { x: SPOTS.pile[0], z: SPOTS.pile[1], r: 0.95 },
      { x: cx, z: cz, r: 0.95 },
      { x: rx, z: rz, r: 1.1 },
      { x: SPOTS.tent[0], z: SPOTS.tent[1], r: 1.3 },
      { x: -1.2, z: 5.6, r: 1.3 },
    ];
  }

  makePad(key, c) {
    const tex = new THREE.CanvasTexture(padCanvas(c.icon, c.cost, 0, c.meat));
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.at[0], 0.05, c.at[1]);
    m.renderOrder = 2;
    m.visible = false;
    this.scene.add(m);
    return { key, ...c, x: c.at[0], z: c.at[1], mesh: m, tex, paid: 0, open: false, done: false, pulse: 0, payT: 0 };
  }

  showPad(k) {
    const p = this.pads[k];
    if (!p || p.open || p.done) return;
    p.open = true;
    p.mesh.visible = true;
    p.pop = 0;
  }

  drawPad(p) {
    p.tex.image = padCanvas(p.icon, p.cost, p.paid, p.meat);
    p.tex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ quarry
  buildQuarry() {
    const b = new Builder();
    const [qx, qz] = SPOTS.quarry;
    const cols = [0x9d968c, 0x8a847a, 0xaaa398, 0x7f796f];
    let s = 3;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 1.5 + r() * 5;
      const h = 1.2 + r() * 2.6;
      b.add(new THREE.DodecahedronGeometry(1, 0), cols[i & 3], [qx + 1.5 + Math.cos(a) * d, h * 0.45, qz - 2 + Math.sin(a) * d * 0.8], [r() * 2, r() * 3, r()], [1.2 + r() * 1.4, h, 1.2 + r() * 1.3]);
    }
    for (let i = 0; i < 8; i++) b.add(P.box(0.5, 0.3, 0.42), 0xc8c0b0, [qx - 1.4 + r() * 2, 0.15 + (i > 4 ? 0.3 : 0), qz + 0.8 + r() * 1.2], [0, r() * 2, 0]);
    // pickaxe leaning on a rock
    b.add(P.cyl(0.04, 0.04, 1.2, 5), 0x6b4a2c, [qx - 2.2, 0.6, qz + 0.3], [0, 0, 0.4]);
    b.add(P.box(0.6, 0.08, 0.08), 0x5a5a60, [qx - 2.45, 1.15, qz + 0.3], [0, 0, 0.4]);
    const m = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    m.castShadow = m.receiveShadow = true;
    this.scene.add(m);
  }

  // ------------------------------------------------------------------ the fortress the camp becomes
  buildFortress() {
    const M = this.M;
    this.fort = [];
    const put = (g, x, z, ry = 0, sx = 1, delay = 0) => {
      const m = shadowed(g.scene.clone(true));
      m.scale.set(BS * sx, BS, BS);
      const grp = new THREE.Group();
      grp.add(m);
      grp.position.set(x, 0, z);
      grp.rotation.y = ry;
      grp.visible = false;
      this.scene.add(grp);
      this.fort.push({ g: grp, delay, k: 0 });
      return grp;
    };
    const W = CAMP.x1 - CAMP.x0;
    const D = CAMP.z1 - CAMP.z0;
    const corners = [[CAMP.x0, CAMP.z0], [0, CAMP.z0], [CAMP.x1, CAMP.z0], [CAMP.x1, 0], [CAMP.x1, CAMP.z1], [0, CAMP.z1], [CAMP.x0, CAMP.z1], [CAMP.x0, 0]];
    let order = 0;
    for (let i = 0; i < corners.length; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % corners.length];
      put(M.corner, ax, az, 0, 1, order++ * 0.09);
      const len = Math.hypot(bx - ax, bz - az) - BS;
      const n = Math.max(1, Math.round(len / (2 * BS)));
      const piece = len / n;
      for (let k = 0; k < n; k++) {
        const t = (BS / 2 + piece * (k + 0.5)) / Math.hypot(bx - ax, bz - az);
        const ry = Math.abs(bx - ax) > 0.1 ? 0 : Math.PI / 2;
        put(M.wall, ax + (bx - ax) * t, az + (bz - az) * t, ry, piece / (2 * BS), order++ * 0.09);
      }
    }
    void W;
    void D;
    const last = order * 0.09;
    put(M.palace, 0, -2.6, 0, 1, last + 0.2);
    put(M.house, -4.4, 3.6, 0.3, 1, last + 0.45);
    put(M.house, 3.9, 4.2, -0.3, 1, last + 0.55);
    put(M.gold, 4.4, -3.4, 0, 1, last + 0.65);
    put(M.archer, -4.8, -4.6, 0, 1, last + 0.75);
    put(M.archer, 5.1, 1.2, 0, 1, last + 0.85);
    put(M.windmill, -11, 2, 0.5, 1, last + 1.0);
  }

  // the enemy castle on the northern horizon (the next target)
  buildEnemyCastle() {
    const M = this.M;
    const g = new THREE.Group();
    const S = 2.4;
    const add = (src, x, z, ry = 0, sx = 1) => {
      const m = src.scene.clone(true);
      m.scale.set(S * sx, S, S);
      m.position.set(x, 0, z);
      m.rotation.y = ry;
      g.add(m);
    };
    const P2 = 5 * S;
    for (let i = -2; i <= 2; i++)
      for (const j of [0, 1]) {
        add(M.corner, i * P2, j * P2 * 1.2);
        if (i < 2) {
          add(M.wall, i * P2 + 1.5 * S, j * P2 * 1.2);
          add(M.wall, i * P2 + 3.5 * S, j * P2 * 1.2);
        }
      }
    for (const i of [-2, 2])
      for (const k of [1.5, 3.5]) add(M.wall, i * P2, k * S * 1.2, Math.PI / 2, 1.2);
    add(M.palace, 0, P2 * 0.55, 0, 1.3);
    add(M.archer, -P2 * 1.2, P2 * 0.5);
    add(M.archer, P2 * 1.2, P2 * 0.5);
    add(M.house, -P2 * 0.6, P2 * 0.7);
    add(M.house, P2 * 0.6, P2 * 0.6);
    // blue enemy banners
    const fl = new Builder();
    for (const x of [-2, -1, 0, 1, 2]) {
      fl.add(P.cyl(0.08, 0.08, 4, 6), 0x4a3a2a, [x * P2, 6.4, 0]);
      fl.add(P.box(1.8, 1.1, 0.06), 0x2f6fd6, [x * P2 + 0.95, 7.7, 0]);
    }
    const flags = new THREE.Mesh(fl.build(), new THREE.MeshStandardMaterial({ vertexColors: true }));
    g.add(flags);
    g.position.set(ENEMY_CASTLE.x, 0, ENEMY_CASTLE.z - P2 * 0.6);
    this.scene.add(g);
    this.enemyCastle = g;
  }

  // ------------------------------------------------------------------ actors
  spawnBear(x, z, boss) {
    const b = { x, z, yaw: 0, hp: boss ? BOSS.hp : BEAR.hp, max: boss ? BOSS.hp : BEAR.hp, cd: rnd(0, 1), anim: 'Walk', alive: true, boss, deadT: 0, hold: { x: rnd(-6, 6), z: rnd(-15, -10.5) }, hit: 0 };
    if (boss) b.slot = 0;
    else {
      // find a free slot in the pool
      let s = this.bears.findIndex((o) => !o.boss && !o.alive && o.deadT > 3);
      if (s >= 0) {
        const old = this.bears[s];
        b.slot = old.slot;
        this.bears.splice(s, 1);
      } else b.slot = this.bearSlot++;
      if (b.slot >= this.bearCrowd.units.length) return null;
    }
    this.bears.push(b);
    return b;
  }

  aliveSoldiers() {
    return this.soldiers.filter((s) => s.alive).length;
  }

  spawnSoldier() {
    if (this.aliveSoldiers() >= ECON.maxSoldiers) return;
    // reuse the slot of a fallen soldier
    let i = this.soldiers.length;
    const gone = this.soldiers.findIndex((o) => !o.alive && o.deadT > 3);
    if (gone >= 0) {
      i = this.soldiers[gone].i;
      this.soldiers.splice(gone, 1);
    } else if (i >= ECON.maxSoldiers) return;
    const s = { i, x: SPOTS.tent[0] + 1.2, z: SPOTS.tent[1] - 0.6, yaw: Math.PI, hp: SOLDIER.hp, cd: 0, anim: 'Walk', alive: true, post: { x: -3 + (i % 3) * 3, z: -9.6 - Math.floor(i / 3) * 1.6 }, path: [{ x: -1.5 + (i % 2), z: 1 }, { x: 0, z: CAMP.z0 + 1.2 }, { x: 0, z: CAMP.z0 - 1.5 }] };
    this.soldiers.push(s);
    this.fx.sparkle(s.x, 0.4, s.z, 0xffd25a, 14);
    this.hud.say(TEXT.newSoldier, 1.2);
    sfx.fed();
  }

  buildTower(pad) {
    const [x, z] = pad.tower;
    const g = shadowed(this.M.archer.scene.clone(true));
    g.scale.setScalar(BS);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const t = { x, z, g, k: 0, azap: this.towers.length, cd: 0.5, aim: null };
    this.towers.push(t);
    this.fx.bigDust(x, 0.4, z, 14, 1.4, 0xcdbf9e);
    sfx.collapse();
    sfx.gateGood(false);
    this.hud.say(TEXT.built, 1.3);
    this.shake = 0.3;
    this.blocks.push({ x, z, r: 1.0 });
  }

  // ------------------------------------------------------------------ input
  setInput(x, z) {
    this.input.x = x;
    this.input.z = z;
    if (x || z) this.moved = true;
  }

  // ------------------------------------------------------------------ helpers
  heroOutside() {
    const h = this.hero;
    return h.z < CAMP.z0 || h.x > CAMP.x1 || h.x < CAMP.x0 || h.z > CAMP.z1;
  }

  stackCount(type) {
    return this.hero.stack.filter((s) => s.type === type).length;
  }

  stackTop() {
    const h = this.hero.stack;
    let y = 0;
    for (const s of h) y += this.items[s.type].h;
    const p = this.socketPos(V(0, 0, 0));
    p.y += y;
    return p;
  }

  socketPos(out) {
    if (this.socket) this.socket.getWorldPosition(out);
    else out.set(this.hero.x, 1.2, this.hero.z);
    // a little in front of the chest
    out.x += -Math.sin(this.hero.yaw) * 0.25;
    out.z += -Math.cos(this.hero.yaw) * 0.25;
    return out;
  }

  pushItem(type) {
    const m = this.itemMesh(type);
    this.stackGroup.add(m);
    this.hero.stack.push({ type, m });
    this.layoutStack();
  }

  // take one item of a type off the stack (the topmost of that type)
  popItem(type) {
    const s = this.hero.stack;
    for (let i = s.length - 1; i >= 0; i--)
      if (s[i].type === type) {
        const it = s.splice(i, 1)[0];
        const p = new THREE.Vector3();
        it.m.getWorldPosition(p);
        this.stackGroup.remove(it.m);
        this.layoutStack();
        return { m: it.m, p };
      }
    return null;
  }

  layoutStack() {
    let y = 0;
    for (const s of this.hero.stack) {
      s.m.position.set(0, y, 0);
      s.m.rotation.y = Math.sin(y * 7) * 0.15;
      y += this.items[s.type].h;
    }
  }

  // ------------------------------------------------------------------ economy & stations
  updateStations(dt) {
    const h = this.hero;
    const near = (p, r = 1.9) => Math.hypot(h.x - p[0], h.z - p[1]) < r;
    h.tick = (h.tick || 0) - dt;
    const can = h.tick <= 0;
    // pick stones from the pile
    if (can && near(SPOTS.pile, 2.0) && this.stonePile.n > 0 && h.stack.length < ECON.carryMax) {
      h.tick = 0.07;
      const from = this.stonePile.top.clone();
      this.stonePile.set(this.stonePile.n - 1);
      const m = this.itemMesh('stone');
      this.fly('stone', from, null, 0.18, 0.8, () => this.pushItem('stone'), m);
      this.flyers[this.flyers.length - 1].toStack = true;
      sfx.pop();
      if (h.stack.length + 1 >= ECON.carryMax) this.fullMsg();
    }
    // drop stones on the counter
    else if (can && near(SPOTS.counter, 2.0) && this.stackCount('stone') > 0) {
      h.tick = 0.06;
      const it = this.popItem('stone');
      const [cx, cz] = SPOTS.counter;
      this.fly('stone', it.p, V(cx + 0.35, 1.1, cz), 0.22, 0.8, () => {
        this.counterQ++;
        sfx.drop();
      }, it.m);
    }
    // collect coins from the tray
    else if (can && near(SPOTS.coins, 1.9) && this.coinPile.n > 0) {
      h.tick = 0.025;
      const from = this.coinPile.top.clone();
      this.coinPile.set(this.coinPile.n - 1);
      this.fly('coin', from, null, 0.2, 0.8, () => this.addMoney(1));
      this.flyers[this.flyers.length - 1].toHero = true;
    }
    // meat from the rack
    else if (can && near(SPOTS.rack, 2.1) && this.meatRack.n > 0 && h.stack.length < ECON.carryMax && this.pads.recruit.open && this.stackCount('meat') < 6) {
      h.tick = 0.09;
      const from = this.meatRack.top.clone();
      this.meatRack.set(this.meatRack.n - 1);
      this.fly('meat', from, null, 0.2, 0.8, () => this.pushItem('meat'));
      this.flyers[this.flyers.length - 1].toStack = true;
      sfx.pop();
    }
    // pads
    for (const p of Object.values(this.pads)) {
      if (!p.open || p.done) continue;
      p.payT -= dt;
      const on = Math.hypot(h.x - p.x, h.z - p.z) < 1.25;
      if (!on || p.payT > 0) continue;
      if (p.meat) {
        if (this.stackCount('meat') <= 0 || this.aliveSoldiers() >= ECON.maxSoldiers) continue;
        p.payT = 0.14;
        const it = this.popItem('meat');
        this.fly('meat', it.p, V(p.x, 0.2, p.z), 0.25, 1, () => {
          p.paid++;
          sfx.drop();
          if (p.paid >= p.cost) {
            p.paid = 0;
            this.spawnSoldier();
            if (!this.flags.t2) {
              this.flags.t2 = true;
              this.later(1.5, () => this.showPad('tower2'));
            }
          }
          this.drawPad(p);
        }, it.m);
      } else {
        if (this.money <= 0 || p.paid + p.inflight >= p.cost) continue;
        p.inflight = (p.inflight || 0) + 1;
        p.payT = 0.03;
        this.money--;
        this.hud.setMoney(this.money);
        const from = this.socketPos(V(0, 0, 0));
        this.fly('coin', from, V(p.x, 0.15, p.z), 0.22, 1.2, () => {
          p.inflight--;
          p.paid++;
          sfx.coin();
          this.drawPad(p);
          if (p.paid >= p.cost && !p.done) this.padDone(p);
        });
      }
    }
    // the counter turns stones into akçe
    this.counterT -= dt;
    if (this.counterQ > 0 && this.counterT <= 0) {
      this.counterT = 0.11;
      this.counterQ--;
      const [cx, cz] = SPOTS.counter;
      for (let i = 0; i < ECON.stoneCoins; i++)
        this.fly('coin', V(cx + 0.4, 1.2, cz), this.coinPile.top.clone(), 0.3 + i * 0.05, 1.2, () => {
          this.coinPile.set(this.coinPile.n + 1);
          sfx.coin();
        });
    }
  }

  fullMsg() {
    if (this.fullT > this.time) return;
    this.fullT = this.time + 2;
    const s = this.toScreen(this.hero.x, 3.2, this.hero.z);
    this.hud.pop(s.x, s.y, TEXT.full, 'full');
  }

  addMoney(n) {
    this.money += n;
    this.hud.setMoney(this.money);
    this.hud.bump();
    sfx.gold();
  }

  padDone(p) {
    p.done = true;
    p.open = false;
    p.mesh.visible = false;
    this.fx.sparkle(p.x, 0.3, p.z, 0xffd25a, 20);
    if (p.key === 'tower1' || p.key === 'tower2') {
      this.buildTower(p);
      if (p.key === 'tower1') this.later(0.8, () => this.showPad('recruit'));
      if (p.key === 'tower2') this.later(2, () => this.startBoss());
    }
    if (p.key === 'fort') this.startFortress();
  }

  startBoss() {
    if (this.flags.boss) return;
    this.flags.boss = true;
    const b = this.spawnBear(-3, -21, true);
    this.boss = b;
    this.hud.bigText(TEXT.boss, 'red');
    sfx.roar(true);
    this.shake = 0.6;
  }

  killBear(b) {
    b.alive = false;
    b.anim = 'Die';
    b.deadT = 0;
    sfx.roar(false, true);
    const from = V(b.x, 1, b.z);
    if (b.boss) {
      // the boss bursts into a pile of akçe
      this.hud.flash();
      this.shake = 0.8;
      sfx.boom(true);
      this.fx.bigDust(b.x, 0.5, b.z, 16, 2.4, 0xcdbf9e);
      for (let i = 0; i < ECON.bossLoot; i++) {
        const a = rnd(0, Math.PI * 2);
        const r = rnd(0.5, 3.6);
        const to = V(clamp(b.x + Math.cos(a) * r, -9, 9), 0.05, Math.min(b.z + Math.sin(a) * r, CAMP.z0 - 1));
        const c = { x: to.x, z: to.z, m: this.itemMesh('coin'), ready: false };
        this.fly('coin', from, to, rnd(0.4, 0.9), rnd(2, 4), () => {
          c.ready = true;
          this.scene.add(c.m);
          c.m.position.copy(to);
        });
        this.groundCoins.push(c);
      }
      this.later(1.2, () => this.showPad('fort'));
      return;
    }
    for (let i = 0; i < ECON.meatPerBear; i++)
      this.later(i * 0.12, () =>
        this.fly('meat', from, this.meatRack.top.clone(), 0.75, 4, () => {
          this.meatRack.set(this.meatRack.n + 1);
          sfx.drop();
        }),
      );
  }

  // ------------------------------------------------------------------ the finale
  startFortress() {
    this.state = 'fort';
    this.fortT = 0;
    this.setInput(0, 0);
    this.hud.setGoal('');
    this.hud.bigText(TEXT.fortBuild, 'gold');
    sfx.march();
    for (const p of Object.values(this.pads)) p.mesh.visible = false;
    this.marker.visible = false;
    this.pointer.visible = false;
    // the bears flee into the forest
    for (const b of this.bears) if (b.alive) {
      b.alive = false;
      b.deadT = 4;
      (b.boss ? this.bossCrowd : this.bearCrowd).hide(b.slot);
    }
  }

  updateFortress(dt) {
    this.fortT += dt;
    const t = this.fortT;
    // the palisade comes down log by log, stone walls rise in its place
    const n = this.fence.length;
    const k = clamp((t - 0.4) / 1.8, 0, 1);
    for (let i = 0; i < n * k; i++) {
      const f = this.fence[i];
      if (f.visible) {
        f.visible = false;
        if (i % 6 === 0) this.fx.dust(f.position.x, f.position.z, 2);
      }
    }
    if (t > 0.6) this.camp.visible = false;
    for (const f of this.fort) {
      if (t - 0.5 < f.delay) continue;
      if (!f.g.visible) {
        f.g.visible = true;
        f.g.scale.y = 0.01;
        if (Math.random() < 0.5) sfx.stone();
        this.fx.bigDust(f.g.position.x, 0.3, f.g.position.z, 3, 1, 0xcdbf9e);
      }
      f.k = Math.min(1, f.k + dt * 3);
      const e = 1 + 2.70158 * (f.k - 1) ** 3 + 1.70158 * (f.k - 1) ** 2;
      f.g.scale.y = Math.max(0.01, e);
    }
    if (t > 1.4) {
      for (const tt of this.tents) tt.visible = false;
      this.stations.visible = false;
      this.stonePile.im.visible = false;
      this.meatRack.im.visible = false;
      this.coinPile.im.visible = false;
    }
    if (t > 3.2 && !this.flags.fortDone) {
      this.flags.fortDone = true;
      sfx.victory();
      this.fx.confetti.burst(0, 4, 0, 180);
      for (let i = 0; i < 4; i++) this.later(i * 0.25, () => this.fx.firework(rnd(-6, 6), rnd(9, 12), rnd(-5, 4), [0xffd25a, 0xff5a4a, 0x5ad06a, 0xffffff][i]));
    }
    if (t > 4.6 && !this.flags.reveal) {
      this.flags.reveal = true;
      this.hud.reveal();
      sfx.charge();
    }
    if (t > 8.2 && this.state === 'fort') {
      this.state = 'end';
      this.onEnd();
    }
  }

  later(t, fn) {
    this.jobs.push({ t: this.time + t, fn });
  }

  // ------------------------------------------------------------------ goals
  goal() {
    const h = this.hero;
    const P = this.pads;
    const live = this.bears.filter((b) => b.alive && !b.boss);
    if (this.boss?.alive) return { text: TEXT.obj.boss, x: this.boss.x, z: this.boss.z, y: 4.2 };
    const coins = this.groundCoins.filter((c) => c.ready);
    if (coins.length) {
      let best = coins[0];
      for (const c of coins) if (Math.hypot(c.x - h.x, c.z - h.z) < Math.hypot(best.x - h.x, best.z - h.z)) best = c;
      return { text: TEXT.obj.loot, x: best.x, z: best.z, y: 1.6 };
    }
    if (P.fort.open && this.money > 0) return { text: TEXT.obj.fort, x: P.fort.x, z: P.fort.z, y: 1.8 };
    if (!this.flags.firstKills && live.length && this.time < 14) return { text: TEXT.obj.bears, x: live[0].x, z: live[0].z, y: 2.6 };
    if (this.stackCount('stone') > 0) return { text: TEXT.obj.counter, x: SPOTS.counter[0], z: SPOTS.counter[1], y: 2.8 };
    if (this.stackCount('meat') > 0 && this.aliveSoldiers() < ECON.maxSoldiers) return { text: TEXT.obj.recruit, x: P.recruit.x, z: P.recruit.z, y: 1.8 };
    if (this.coinPile.n > 0) return { text: TEXT.obj.coins, x: SPOTS.coins[0], z: SPOTS.coins[1], y: 1.8 };
    const towerPad = [P.tower1, P.tower2].find((p) => p.open && !p.done);
    if (towerPad && this.money > 0) return { text: TEXT.obj.tower, x: towerPad.x, z: towerPad.z, y: 1.8 };
    if (P.recruit.open && this.meatRack.n >= 2 && this.aliveSoldiers() < ECON.maxSoldiers && this.stackCount('meat') < 2) return { text: TEXT.obj.meat, x: SPOTS.rack[0], z: SPOTS.rack[1], y: 2.2 };
    if (this.stonePile.n > 0) return { text: TEXT.obj.pile, x: SPOTS.pile[0], z: SPOTS.pile[1], y: 2.0 };
    if (P.fort.open) return { text: TEXT.obj.fort, x: P.fort.x, z: P.fort.z, y: 1.8 };
    return null;
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    const h = this.hero;

    if (this.jobs.length) {
      const due = this.jobs.filter((j) => j.t <= this.time);
      if (due.length) {
        this.jobs = this.jobs.filter((j) => j.t > this.time);
        for (const j of due) j.fn();
      }
    }

    // --- hero
    if (this.state === 'play') {
      const ix = this.input.x;
      const iz = this.input.z;
      const mag = Math.min(1, Math.hypot(ix, iz));
      const cy = Math.cos(this.cam.yaw);
      const sy = Math.sin(this.cam.yaw);
      // screen right / down → world, accounting for the camera yaw
      const wx = ix * cy + iz * sy;
      const wz = -ix * sy + iz * cy;
      if (mag > 0.05) {
        const sp = HERO.speed * mag * dt;
        const l = Math.hypot(wx, wz) || 1;
        this.moveHero((wx / l) * sp, (wz / l) * sp);
        h.yaw = yawTo(wx, wz);
      }
      h.moving = mag > 0.05;
    } else h.moving = false;

    // hero fights the nearest bear in reach
    h.cd -= dt;
    let foe = null;
    let fd = HERO.range;
    for (const b of this.bears) {
      if (!b.alive) continue;
      const d = Math.hypot(b.x - h.x, b.z - h.z) - (b.boss ? 1.2 : 0.3);
      if (d < fd) {
        fd = d;
        foe = b;
      }
    }
    h.attacking = !!foe && this.state === 'play';
    if (h.attacking) {
      if (!h.moving) h.yaw = yawTo(foe.x - h.x, foe.z - h.z);
      if (h.cd <= 0) {
        h.cd = HERO.rate;
        this.later(0.3, () => {
          if (!foe.alive) return;
          this.hitBear(foe, HERO.dmg);
          sfx.sack();
          this.fx.clash(foe.x, 1, foe.z);
        });
      }
    }
    const carrying = h.stack.length > 0;
    const anim = carrying ? 'Carry' : h.attacking && !h.moving ? 'Attack' : h.moving ? 'Walk' : 'Idle';
    const speed = anim === 'Carry' ? (h.moving ? 2.0 : 0.0001) : anim === 'Walk' ? 2.2 : 1;
    this.heroCrowd.update(0, h.x, 0, h.z, h.yaw, anim, dt, { speed });
    if (h.attacking && h.moving && !carrying && Math.random() < 0.05) this.fx.clash(foe.x, 1, foe.z);

    this.heroRing.position.set(h.x, 0.06, h.z);
    this.heroRing.visible = this.state === 'play';
    // stack follows the chest
    const sp = this.socketPos(V(0, 0, 0));
    this.stackGroup.position.copy(sp);
    this.stackGroup.rotation.y = h.yaw;

    if (this.state === 'play') this.updateStations(dt);

    // --- ground coins (boss loot): magnet
    for (const c of this.groundCoins) {
      if (!c.ready || c.taken) continue;
      if (Math.hypot(c.x - h.x, c.z - h.z) < 2.4) {
        c.taken = true;
        this.scene.remove(c.m);
        this.fly('coin', c.m.position.clone(), null, 0.22, 1, () => this.addMoney(1), c.m);
        this.flyers[this.flyers.length - 1].toHero = true;
      } else c.m.rotation.y += dt * 3;
    }
    this.groundCoins = this.groundCoins.filter((c) => !c.taken);

    // --- bears
    if (this.state === 'play') {
      if (!this.flags.firstKills && this.bears.filter((b) => b.alive).length === 0) this.flags.firstKills = true;
      this.spawnT -= dt;
      const live = this.bears.filter((b) => b.alive && !b.boss).length;
      const want = this.flags.boss ? (this.boss?.alive ? 1 : 3) : this.pads.tower1.done ? 4 : 2;
      if (this.spawnT <= 0 && live < want && this.time > 8) {
        this.spawnT = 3.5;
        const [x, z] = BEAR_SPAWNS[Math.floor(Math.random() * BEAR_SPAWNS.length)];
        this.spawnBear(x + rnd(-2, 2), z + rnd(-2, 2), false);
      }
    }
    for (const b of this.bears) this.updateBear(b, dt);
    // --- soldiers
    for (const s of this.soldiers) this.updateSoldier(s, dt);
    // --- towers
    for (const t of this.towers) {
      t.k = Math.min(1, t.k + dt * 2.5);
      const e = 1 + 2.70158 * (t.k - 1) ** 3 + 1.70158 * (t.k - 1) ** 2;
      t.g.scale.set(BS, BS * Math.max(0.01, e), BS);
      t.cd -= dt;
      let best = null;
      let bd = TOWER.range;
      for (const b of this.bears) {
        if (!b.alive) continue;
        const d = Math.hypot(b.x - t.x, b.z - t.z);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      t.aim = best;
      if (best && t.cd <= 0 && t.k >= 1) {
        t.cd = TOWER.rate;
        const a = V(t.x, 3.5, t.z);
        const p = V(best.x, best.boss ? 1.8 : 0.9, best.z);
        sfx.arrow();
        const tgt = best;
        this.fx.arrows.shoot(a, p, 0.4, 1, () => tgt.alive && this.hitBear(tgt, TOWER.dmg));
      }
      if (t.aim) t.yaw = yawTo(t.aim.x - t.x, t.aim.z - t.z);
      this.azapCrowd.update(t.azap, t.x, 2.55 * Math.max(0.01, e) * BS * 0.66, t.z, t.yaw || 0, t.aim ? 'Attack' : 'Idle', dt);
    }
    // --- workers
    for (const w of this.workers) this.updateWorker(w, dt);

    // --- flyers
    const tmp = new THREE.Vector3();
    this.flyers = this.flyers.filter((f) => {
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const b = f.toStack ? this.stackTop() : f.toHero ? this.socketPos(tmp.set(0, 0, 0)) : f.b;
      f.m.position.lerpVectors(f.a, b, k);
      f.m.position.y += Math.sin(k * Math.PI) * f.arc;
      f.m.rotation.y += f.spin * dt;
      if (k >= 1) {
        this.scene.remove(f.m);
        f.done?.();
        return false;
      }
      return true;
    });

    // --- pads pulse
    for (const p of Object.values(this.pads)) {
      if (!p.mesh.visible) continue;
      p.pop = Math.min(1, (p.pop ?? 1) + dt * 3);
      const e = 1 + 2.70158 * (p.pop - 1) ** 3 + 1.70158 * (p.pop - 1) ** 2;
      const on = Math.hypot(h.x - p.x, h.z - p.z) < 1.25;
      p.mesh.scale.setScalar(Math.max(0.01, e) * (on ? 1.08 : 1 + Math.sin(this.time * 4) * 0.03));
    }

    // --- goal markers
    if (this.state === 'play') {
      const g = this.goal();
      this.hud.setGoal(g ? g.text : '');
      this.marker.visible = !!g;
      this.pointer.visible = false;
      if (g) {
        this.marker.position.set(g.x, g.y + 0.5 + Math.abs(Math.sin(this.time * 4)) * 0.5, g.z);
        this.marker.rotation.y += dt * 2;
        const d = Math.hypot(g.x - h.x, g.z - h.z);
        if (d > 3.5) {
          this.pointer.visible = true;
          const a = Math.atan2(g.x - h.x, g.z - h.z);
          this.pointer.position.set(h.x + Math.sin(a) * 1.6, 0.08, h.z + Math.cos(a) * 1.6);
          this.pointer.rotation.y = a + Math.PI;
        }
      }
      // drag tutorial until the player moves
      if (!this.moved) {
        const s = this.toScreen(h.x, 0, h.z);
        this.hud.tutorial(true, s.x, s.y + 40);
      } else this.hud.tutorial(false);
    }
    if (this.state === 'fort' || this.state === 'end') this.updateFortress(dt);

    // --- camera
    const c = this.cam;
    let tx = h.x;
    let tz = h.z - 1.2;
    let dMul = 1;
    if (this.state === 'fort' || this.state === 'end') {
      const t = this.fortT;
      if (t < 4.4) {
        tx = 0;
        tz = 0;
        dMul = 1.35;
      } else {
        // look north to the enemy castle on the horizon
        const k = Math.min(1, (t - 4.4) / 1.8);
        const e = k * k * (3 - 2 * k);
        tx = 0;
        tz = -8 - e * 34;
        dMul = 1.35 + e * 1.4;
        c.pitch = 0.9 - e * 0.36;
      }
    } else if (this.boss?.alive) {
      tx = (h.x + this.boss.x) / 2;
      tz = (h.z + this.boss.z) / 2 - 1;
      dMul = 1.15;
    }
    const k = Math.min(1, dt * (this.state === 'play' ? 4 : 1.6));
    c.x += (tx - c.x) * k;
    c.z += (tz - c.z) * k;
    c.dm = (c.dm ?? 1) + (dMul - (c.dm ?? 1)) * Math.min(1, dt * 1.5);
    this.placeCamera();

    this.fx.update(dt);
    this.shake *= Math.exp(-dt * 6);
  }

  moveHero(dx, dz) {
    const h = this.hero;
    let nx = h.x + dx;
    let nz = h.z + dz;
    // the palisade: only the gates let you through
    const crossX = (x0, x1, wallX) => (x0 - wallX) * (x1 - wallX) <= 0;
    const inZ = (z) => z > CAMP.z0 - 0.3 && z < CAMP.z1 + 0.3;
    const inX = (x) => x > CAMP.x0 - 0.3 && x < CAMP.x1 + 0.3;
    for (const wx of [CAMP.x0, CAMP.x1]) {
      if (inZ(nz) && crossX(h.x, nx + Math.sign(dx) * 0.35, wx)) {
        const gate = wx === CAMP.x1 && nz > CAMP.eastGate[0] + 0.3 && nz < CAMP.eastGate[1] - 0.3;
        if (!gate) nx = h.x;
      }
    }
    for (const wz of [CAMP.z0, CAMP.z1]) {
      if (inX(nx) && crossX(h.z, nz + Math.sign(dz) * 0.35, wz)) {
        const gate = wz === CAMP.z0 && Math.abs(nx) < CAMP.gate - 0.3;
        if (!gate) nz = h.z;
      }
    }
    for (const b of this.blocks) {
      const d = Math.hypot(nx - b.x, nz - b.z);
      const r = b.r + 0.35;
      if (d < r && d > 1e-4) {
        nx = b.x + ((nx - b.x) / d) * r;
        nz = b.z + ((nz - b.z) / d) * r;
      }
    }
    h.x = clamp(nx, -24, 24);
    h.z = clamp(nz, -32, 12);
  }

  hitBear(b, dmg) {
    if (!b.alive) return;
    b.hp -= dmg;
    b.hit = 0.15;
    if (b.hp <= 0) {
      this.killBear(b);
      return;
    }
    if (b.boss && Math.random() < 0.15) sfx.roar(true);
  }

  updateBear(b, dt) {
    const crowd = b.boss ? this.bossCrowd : this.bearCrowd;
    if (!b.alive) {
      b.deadT += dt;
      if (b.deadT > 3) crowd.hide(b.slot);
      else crowd.update(b.slot, b.x, -Math.max(0, b.deadT - 2) * 0.8, b.z, b.yaw, 'Die', dt);
      return;
    }
    const st = b.boss ? BOSS : BEAR;
    const reach = b.boss ? 2.4 : 1.5;
    // targets: the hero and soldiers outside the camp
    let t = null;
    let td = b.boss ? 10 : BEAR.aggro;
    const cand = [];
    if (this.heroOutside() || Math.hypot(this.hero.x - b.x, this.hero.z - b.z) < 3) cand.push(this.hero);
    for (const s of this.soldiers) if (s.alive && s.out) cand.push(s);
    for (const o of cand) {
      const d = Math.hypot(o.x - b.x, o.z - b.z);
      if (d < td) {
        td = d;
        t = o;
      }
    }
    b.cd -= dt;
    if (t && td < reach) {
      b.yaw = yawTo(t.x - b.x, t.z - b.z);
      b.anim = 'Attack';
      if (b.cd <= 0) {
        b.cd = st.rate;
        const tgt = t;
        this.later(0.6, () => {
          if (!b.alive) return;
          if (tgt === this.hero) {
            this.hero.hitT = 0.25;
            this.shake = Math.max(this.shake, b.boss ? 0.35 : 0.12);
          } else if (tgt.alive) {
            tgt.hp -= st.dmg;
            if (tgt.hp <= 0) {
              tgt.alive = false;
              tgt.anim = 'Die';
              tgt.deadT = 0;
            }
          }
          sfx.sack();
        });
      }
    } else {
      const goal = t || (b.boss ? { x: 0, z: CAMP.z0 - 2.2 } : b.hold);
      const dx = goal.x - b.x;
      const dz = goal.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const sp = st.speed * dt * (t ? 1.25 : 1);
        b.x += (dx / d) * sp;
        b.z += (dz / d) * sp;
        b.z = Math.min(b.z, CAMP.z0 - (b.boss ? 1.6 : 0.8));
        b.yaw = yawTo(dx, dz);
        b.anim = 'Walk';
      } else {
        b.anim = 'Idle';
        if (!t && !b.boss && Math.random() < dt * 0.3) b.hold = { x: rnd(-6, 6), z: rnd(-15, -10.5) };
      }
    }
    // separation among bears
    for (const o of this.bears) {
      if (o === b || !o.alive) continue;
      const dx = b.x - o.x;
      const dz = b.z - o.z;
      const d = Math.hypot(dx, dz);
      const R = (b.boss || o.boss ? 2.2 : 1.2);
      if (d < R && d > 1e-4) {
        b.x += (dx / d) * (R - d) * 0.5;
        b.z += (dz / d) * (R - d) * 0.5;
      }
    }
    b.hit = Math.max(0, b.hit - dt);
    crowd.update(b.slot, b.x, 0, b.z, b.yaw + (b.hit > 0 ? Math.sin(this.time * 60) * 0.06 : 0), b.anim, dt, { speed: b.anim === 'Walk' ? (b.boss ? 2.2 : 3) : 1 });
  }

  updateSoldier(s, dt) {
    if (!s.alive) {
      s.deadT += dt;
      if (s.deadT > 3) this.janCrowd.hide(s.i);
      else this.janCrowd.update(s.i, s.x, -Math.max(0, s.deadT - 2) * 0.8, s.z, s.yaw, 'Die', dt);
      return;
    }
    let goal = null;
    if (s.path.length) {
      goal = s.path[0];
      if (Math.hypot(goal.x - s.x, goal.z - s.z) < 0.4) {
        s.path.shift();
        if (!s.path.length) s.out = true;
      }
    }
    let foe = null;
    if (s.out) {
      let fd = 9;
      for (const b of this.bears) {
        if (!b.alive) continue;
        const d = Math.hypot(b.x - s.x, b.z - s.z);
        if (d < fd) {
          fd = d;
          foe = b;
        }
      }
      goal = foe || s.post;
    }
    s.cd -= dt;
    const reach = foe ? (foe.boss ? 2.2 : 1.3) : 0.2;
    const dx = goal.x - s.x;
    const dz = goal.z - s.z;
    const d = Math.hypot(dx, dz);
    if (foe && d < reach) {
      s.yaw = yawTo(dx, dz);
      s.anim = 'Attack';
      if (s.cd <= 0) {
        s.cd = SOLDIER.rate;
        this.later(0.35, () => foe.alive && this.hitBear(foe, SOLDIER.dmg));
      }
    } else if (d > 0.25) {
      const sp = SOLDIER.speed * dt;
      s.x += (dx / d) * Math.min(sp, d);
      s.z += (dz / d) * Math.min(sp, d);
      s.yaw = yawTo(dx, dz);
      s.anim = 'Walk';
    } else {
      s.anim = 'Idle';
      s.yaw = Math.PI * 0 + 0;
    }
    // keep apart
    for (const o of this.soldiers) {
      if (o === s || !o.alive) continue;
      const ex = s.x - o.x;
      const ez = s.z - o.z;
      const e = Math.hypot(ex, ez);
      if (e < 0.8 && e > 1e-4) {
        s.x += (ex / e) * (0.8 - e) * 0.5;
        s.z += (ez / e) * (0.8 - e) * 0.5;
      }
    }
    this.janCrowd.update(s.i, s.x, 0, s.z, s.yaw, s.anim, dt, { speed: s.anim === 'Walk' ? 1.4 : 1 });
  }

  // quarry → east gate → pile, and back
  updateWorker(w, dt) {
    const Q = { x: SPOTS.quarry[0] - 1.6 + w.i * 0.4, z: SPOTS.quarry[1] + 1.6 + w.i * 0.3 };
    const route = [{ x: 9.6, z: -6.8 }, { x: CAMP.x1 + 0.8, z: -3.5 }, { x: SPOTS.pile[0] + 1.3, z: SPOTS.pile[1] + (w.i - 1) * 0.5 }];
    w.t -= dt;
    let anim = 'Idle';
    if (w.st === 'dig') {
      if (Math.random() < dt * 2) this.fx.dust(Q.x - 0.6, Q.z - 0.6, 1);
      if (w.t <= 0) {
        w.st = 'go';
        w.leg = 0;
        w.carry = this.itemMesh('stone');
        this.scene.add(w.carry);
      }
    } else {
      const path = w.st === 'go' ? route : [...route].reverse().slice(1).concat([Q]);
      const p = path[w.leg];
      const dx = p.x - w.x;
      const dz = p.z - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.25) {
        w.leg++;
        if (w.leg >= path.length) {
          if (w.st === 'go') {
            // drop the stone on the pile
            const it = w.carry;
            w.carry = null;
            const from = it.position.clone();
            this.scene.remove(it);
            if (this.stonePile.n < this.stonePile.max) this.fly('stone', from, this.stonePile.top.clone(), 0.3, 0.8, () => this.stonePile.set(this.stonePile.n + 1), it);
            w.st = 'back';
            w.leg = 0;
          } else {
            w.st = 'dig';
            w.t = ECON.workerTrip;
          }
        }
      } else {
        const sp = 3.4 * dt;
        w.x += (dx / d) * Math.min(sp, d);
        w.z += (dz / d) * Math.min(sp, d);
        w.yaw = yawTo(dx, dz);
      }
      anim = w.st === 'go' ? 'Carry' : 'Walk';
    }
    this.workerCrowd.update(w.i, w.x, 0, w.z, w.yaw || 0, anim, dt, { speed: 1.3 });
    if (w.carry) {
      const p = this.workerCrowd.hand(w.i, V(0, 0, 0));
      if (p) w.carry.position.set(p.x, p.y - 0.1, p.z);
      else w.carry.position.set(w.x, 1.2, w.z);
      w.carry.rotation.y = w.yaw || 0;
    }
  }

  // ------------------------------------------------------------------ camera
  placeCamera() {
    const c = this.cam;
    const cam = this.camera;
    const d = c.d * (c.dm ?? 1);
    const dir = V(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
    const tgt = V(c.x, 0, c.z);
    cam.position.copy(tgt).addScaledVector(dir, d);
    cam.lookAt(tgt);
    cam.updateMatrixWorld();
  }

  toScreen(x, y, z) {
    const v = V(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    const cam = this.camera;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const tanH = tanV * cam.aspect;
    // portrait: ~17 m across; landscape: ~16 m top to bottom
    this.cam.d = h > w ? 6.2 / tanH : 8.6 / tanV;
    this.scene.fog.near = this.cam.d + 30;
    this.scene.fog.far = this.cam.d + 140;
    this.placeCamera();
    this.fx.setScale(h / (2 * tanV));
  }

  render() {
    const cam = this.camera;
    const s = this.shake;
    const ox = s > 0.01 ? (Math.random() - 0.5) * s : 0;
    const oy = s > 0.01 ? (Math.random() - 0.5) * s : 0;
    cam.position.x += ox;
    cam.position.y += oy;
    this.renderer.render(this.scene, cam);
    cam.position.x -= ox;
    cam.position.y -= oy;
  }
}
