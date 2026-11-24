import * as THREE from '../vendor/three.module.min.js';
import { Terrain } from '../world/Terrain.js';
import { SkinnedCrowd, cannonModel, staticModel, unitScale } from '../world/Models.js';
import { Builder, P } from '../world/geom.js';
import { Fx } from '../fx/Fx.js';
import { sfx } from '../audio/Sfx.js';
import { TEXT, BS, PITCH, GRID, BUILDINGS, BTYPES, UNITS, DEFENDERS, ABILITY, DEPLOY, TIMER } from '../config.js';

// The raid. Everything runs from update(dt), so pausing the ad pauses the battle.

const rnd = (a, b) => a + (b - a) * Math.random();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const CARD_ORDER = ['jan', 'tuf', 'top', 'pasha'];
const LABEL = { jan: 'Yeniçeri', tuf: 'Tüfekli', top: 'Top', pasha: 'Paşa' };

// segment (ax,az)->(bx,bz) against an axis-aligned box: does it cross?
function segHitsBox(ax, az, bx, bz, b, pad) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  for (const [p, d, lo, hi] of [
    [ax, dx, b.x0 - pad, b.x1 + pad],
    [az, dz, b.z0 - pad, b.z1 + pad],
  ]) {
    if (Math.abs(d) < 1e-6) {
      if (p < lo || p > hi) return false;
    } else {
      let ta = (lo - p) / d;
      let tb = (hi - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return true;
}
const boxDist = (x, z, b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

export class Game {
  constructor(renderer, hud, { models, onEnd }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.models = models;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 260);
    this.terrain = new Terrain(this.scene);
    this.fx = new Fx(this.scene);
    this.unit = models.jan ? unitScale(models.jan, 1.4) : 0.00006;

    this.time = 0;
    this.state = 'intro';
    this.clock = TIMER;
    this.loot = 0;
    this.lootLeft = 0;
    this.moons = 0;
    this.shake = 0;
    this.stock = Object.fromEntries(Object.entries(UNITS).map(([k, u]) => [k, u.stock]));
    this.selected = 'jan';
    this.units = [];
    this.deployed = 0;
    this.idle = 0;
    this.hintKey = '';
    this.hintStep = 0;
    this.abilityReady = false;
    this.abilityUsed = false;

    // animated soldier pools
    const C = (g, n, s) => (g ? new SkinnedCrowd(this.scene, g, n, s) : null);
    this.crowds = {
      jan: C(models.jan, UNITS.jan.stock, this.unit),
      tuf: C(models.tuf, UNITS.tuf.stock, this.unit),
      pasha: C(models.jan, 1, this.unit * 1.5),
      enemy: C(models.enemy, DEFENDERS.groups.reduce((a, g) => a + g.n, 0), this.unit),
      azap: C(models.azap, 2, this.unit * 0.95),
    };
    this.slots = { jan: 0, tuf: 0, pasha: 0, enemy: 0, azap: 0, top: 0 };
    this.cannons = [];
    for (let i = 0; i < UNITS.top.stock; i++) {
      const c = cannonModel(models.cannon, this.unit * 0.95);
      c.visible = false;
      this.scene.add(c);
      this.cannons.push(c);
    }
    // the Paşa's golden ring
    this.pashaRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 40), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.85, depthWrite: false }));
    this.pashaRing.rotation.x = -Math.PI / 2;
    this.pashaRing.visible = false;
    this.scene.add(this.pashaRing);
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false }));
    this.wave.rotation.x = -Math.PI / 2;
    this.wave.position.y = 0.15;
    this.scene.add(this.wave);
    // no-deploy zone (shown red when tapped)
    const zw = DEPLOY.x1 - DEPLOY.x0;
    const zd = DEPLOY.z1 - DEPLOY.z0;
    this.zone = new THREE.Mesh(new THREE.PlaneGeometry(zw, zd), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, depthWrite: false }));
    this.zone.rotation.x = -Math.PI / 2;
    this.zone.position.set((DEPLOY.x0 + DEPLOY.x1) / 2, 0.06, (DEPLOY.z0 + DEPLOY.z1) / 2);
    this.scene.add(this.zone);
    this.zoneA = 0;

    this.buildTown();
    this.initNav();
    this.spawnDefenders();
    this.makeCards();

    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.cam = { x: 0, z: -9, d: 40, yaw: 0.42, pitch: 0.92, follow: 0 };
    this.panAt = -10;
    this.intro = 0;
    hud.setLoot(this.loot, this.lootLeft);
    hud.setTime(this.clock);
    hud.updateCards(this.stock, this.selected, null);
  }

  // ---------------------------------------------------------------- town
  buildTown() {
    const M = this.models;
    this.walls = [];
    this.buildings = [];
    const rubbleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const putModel = (g, x, z, ry = 0, scale = BS) => {
      const m = g.scene.clone(true);
      m.scale.setScalar(scale);
      m.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const grp = new THREE.Group();
      grp.add(m);
      grp.position.set(x, 0, z);
      grp.rotation.y = ry;
      this.scene.add(grp);
      return grp;
    };
    const rubble = (x, z, w, d, h, wood = 0.3) => {
      const b = new Builder();
      const n = Math.round(6 + w * d * 2.2);
      for (let i = 0; i < n; i++) {
        const isWood = Math.random() < wood;
        const px = rnd(-w / 2, w / 2);
        const pz = rnd(-d / 2, d / 2);
        const edge = 1 - Math.max(Math.abs(px) / (w / 2), Math.abs(pz) / (d / 2));
        if (isWood) b.add(P.box(rnd(0.6, 1.4), 0.12, 0.14), Math.random() < 0.5 ? 0x6b4a2c : 0x5a3d24, [px, rnd(0.1, h * 0.6) * edge + 0.1, pz], [rnd(-0.5, 0.5), rnd(0, 3), rnd(-0.4, 0.4)]);
        else b.add(new THREE.DodecahedronGeometry(rnd(0.22, 0.45), 0), [0xb5aa96, 0x9d9280, 0xc8bea8, 0x8a7f6c][i & 3], [px, rnd(0.05, h) * edge + 0.1, pz], [rnd(0, 3), rnd(0, 3), 0], [1, rnd(0.6, 1), 1]);
      }
      b.add(P.cyl(1, 1, 0.08, 12), 0x7a6a52, [0, 0.04, 0], [0, 0, 0], [w * 0.55, 1, d * 0.55]);
      const m = new THREE.Mesh(b.build(), rubbleMat);
      m.position.set(x, 0, z);
      m.castShadow = m.receiveShadow = true;
      m.visible = false;
      this.scene.add(m);
      return m;
    };

    // walls & corner towers on the grid
    const x0 = GRID.x0;
    const z0 = GRID.z0;
    const hl = BS;
    const ht = 0.4;
    for (let j = 0; j <= GRID.rows; j++)
      for (let i = 0; i <= GRID.cols; i++) {
        const x = x0 + i * PITCH;
        const z = z0 + j * PITCH;
        const g = putModel(M.corner, x, z);
        this.walls.push({ kind: 'corner', x, z, box: { x0: x - 0.95, x1: x + 0.95, z0: z - 0.95, z1: z + 0.95 }, hp: BTYPES.corner.hp, max: BTYPES.corner.hp, alive: true, group: g, rubble: rubble(x, z, 2, 2, 0.9, 0) });
        for (const k of [1.5, 3.5]) {
          if (i < GRID.cols) {
            const wx = x + k * BS;
            this.walls.push({ kind: 'wall', x: wx, z, box: { x0: wx - hl, x1: wx + hl, z0: z - ht, z1: z + ht }, hp: BTYPES.wall.hp, max: BTYPES.wall.hp, alive: true, group: putModel(M.wall, wx, z), rubble: rubble(wx, z, 3.6, 0.9, 0.7, 0) });
          }
          if (j < GRID.rows) {
            const wz = z + k * BS;
            this.walls.push({ kind: 'wall', x, z: wz, box: { x0: x - ht, x1: x + ht, z0: wz - hl, z1: wz + hl }, hp: BTYPES.wall.hp, max: BTYPES.wall.hp, alive: true, group: putModel(M.wall, x, wz, Math.PI / 2), rubble: rubble(x, wz, 0.9, 3.6, 0.7, 0) });
          }
        }
      }
    this.town = { x0: x0, x1: x0 + GRID.cols * PITCH, z0: z0, z1: z0 + GRID.rows * PITCH };

    // buildings
    const tentScale = M.tent ? unitScale(M.tent, 2.8) : 1;
    for (const b of BUILDINGS) {
      const T = BTYPES[b.type];
      let g;
      if (b.type === 'tent') g = putModel(M.tent, b.x, b.z, b.ry || 0, tentScale);
      else if (b.type === 'cannon') {
        g = new THREE.Group();
        g.position.set(b.x, 0, b.z);
        const base = new THREE.Mesh(
          new Builder().add(P.cyl(1.25, 1.4, 0.55, 14), 0xc9bea6, [0, 0.27, 0]).add(P.cyl(1.32, 1.32, 0.12, 14), 0xb3a88f, [0, 0.58, 0]).build(),
          new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
        );
        base.castShadow = base.receiveShadow = true;
        g.add(base);
        const c = cannonModel(M.cannon, this.unit * 0.95);
        c.position.y = 0.62;
        g.add(c);
        g.gun = c;
        this.scene.add(g);
      } else g = putModel(M[b.type === 'archer' ? 'archer' : b.type], b.x, b.z, b.ry || 0);
      const B = { ...b, ...T, hp: T.hp, max: T.hp, alive: true, group: g, cd: rnd(0, 1), r: T.r };
      if (b.type === 'windmill') {
        const clip = M.windmill.animations[0];
        if (clip) {
          B.mixer = new THREE.AnimationMixer(g.children[0]);
          B.mixer.clipAction(clip).play();
        }
      }
      if (b.type === 'archer') B.azap = this.slots.azap++;
      const size = b.type === 'palace' ? 4.4 : b.type === 'tent' ? 3 : b.type === 'archer' ? 1.8 : 2.6;
      B.rubble = rubble(b.x, b.z, size, size, b.type === 'palace' ? 1.5 : 1.1, b.type === 'house' || b.type === 'windmill' || b.type === 'tent' ? 0.45 : 0.15);
      B.bar = this.makeBar();
      B.bar.position.set(b.x, b.type === 'archer' ? 5.4 : b.type === 'palace' ? 4.6 : 3.4, b.z);
      this.buildings.push(B);
      this.lootLeft += T.loot;
    }
    this.palace = this.buildings.find((b) => b.type === 'palace');
    this.total = this.buildings.length;
    this.razed = 0;
  }

  makeBar() {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.24), new THREE.MeshBasicMaterial({ color: 0x1a0e06, depthTest: false, transparent: true, opacity: 0.85 }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.15), new THREE.MeshBasicMaterial({ color: 0x5fd04a, depthTest: false }));
    fg.position.z = 0.01;
    bg.renderOrder = 20;
    fg.renderOrder = 21;
    g.add(bg, fg);
    g.fg = fg;
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  spawnDefenders() {
    for (const grp of DEFENDERS.groups)
      for (let i = 0; i < grp.n; i++) {
        const a = (i / grp.n) * Math.PI * 2;
        const x = grp.x + Math.cos(a) * 1.3;
        const z = grp.z + Math.sin(a) * 0.9;
        this.units.push({ kind: 'enemy', team: 'E', x, z, hx: x, hz: z, aggro: grp.aggro, hp: DEFENDERS.hp, max: DEFENDERS.hp, yaw: 0, cd: rnd(0, 1), slot: this.slots.enemy++, alive: true, anim: 'Idle', speed: DEFENDERS.speed, rage: 0 });
      }
  }

  // card portraits rendered from the real models
  makeCards() {
    const shots = {};
    try {
      const cv = document.createElement('canvas');
      cv.width = 160;
      cv.height = 180;
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a40, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 2.4);
      sun.position.set(-1, 2, 3);
      sc.add(sun);
      const cam = new THREE.PerspectiveCamera(30, 160 / 180, 0.01, 100);
      const snap = (key, obj, h, focusY, dist) => {
        sc.add(obj);
        cam.position.set(dist * 0.35, focusY + dist * 0.12, dist);
        cam.lookAt(0, focusY, 0);
        r.render(sc, cam);
        shots[key] = cv.toDataURL('image/png');
        sc.remove(obj);
      };
      const pose = (g, s) => {
        const c = new SkinnedCrowd(sc, g, 1, s);
        c.update(0, 0, 0, 0, Math.PI, 'Idle', 0.4);
        return c.units[0].root;
      };
      if (this.models.jan) snap('jan', pose(this.models.jan, this.unit), 1.15, 0.9, 1.35);
      if (this.models.tuf) snap('tuf', pose(this.models.tuf, this.unit), 1.15, 0.9, 1.35);
      if (this.models.cannon) {
        const c = cannonModel(this.models.cannon, this.unit * 0.95);
        c.rotation.y = Math.PI * 0.8;
        snap('top', c, 1, 0.4, 2.6);
      }
      if (this.models.jan) snap('pasha', pose(this.models.jan, this.unit), 1.15, 0.95, 1.2);
      r.dispose();
      r.forceContextLoss?.();
    } catch (e) {
      console.warn('portraits failed', e);
    }
    this.hud.setCards(CARD_ORDER.map((k) => ({ key: k, img: shots[k] || '', count: this.stock[k], label: LABEL[k] })));
  }

  // ---------------------------------------------------------------- input
  groundAt(x, y) {
    const ndc = new THREE.Vector2((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, p) ? p : null;
  }

  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h, behind: v.z > 1 };
  }

  pointerDown(x, y) {
    sfx.unlock();
    this.drag = { x, y, sx: x, sy: y, moved: false, g: this.groundAt(x, y) };
  }

  pointerMove(x, y) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 12) d.moved = true;
    if (d.moved && d.g && this.state !== 'intro') {
      const g = this.groundAt(x, y);
      if (g) {
        this.cam.x += d.g.x - g.x;
        this.cam.z += d.g.z - g.z;
        this.clampCam();
        this.placeCamera();
        this.panAt = this.time;
      }
    }
  }

  pointerUp() {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved) return;
    if (this.state !== 'play') return;
    const p = this.groundAt(d.sx, d.sy);
    if (p) this.deploy(p.x, p.z, d.sx, d.sy);
  }

  selectCard(k) {
    sfx.unlock();
    if (this.state !== 'play' || this.stock[k] <= 0) return;
    this.selected = k;
    sfx.tap();
    this.idle = 0;
    this.refreshCards();
  }

  validSpot(x, z) {
    if (Math.abs(x) > DEPLOY.bound || z < -DEPLOY.bound - 12 || z > DEPLOY.bound - 18) return false;
    if (x > DEPLOY.x0 && x < DEPLOY.x1 && z > DEPLOY.z0 && z < DEPLOY.z1) return false;
    for (const b of this.buildings) if (b.alive && Math.hypot(b.x - x, b.z - z) < b.r + 0.3) return false;
    return true;
  }

  deploy(x, z, sx, sy) {
    const k = this.selected;
    if (this.stock[k] <= 0) return;
    if (!this.validSpot(x, z)) {
      this.zoneA = 0.45;
      this.hud.tapMark(sx, sy, false);
      sfx.gateBad();
      return;
    }
    this.hud.tapMark(sx, sy, true);
    const U = UNITS[k];
    const n = Math.min(U.deploy, this.stock[k]);
    this.stock[k] -= n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(0, 0.5);
      const rr = n > 1 ? rnd(0.5, 1.2) : 0;
      this.spawn(k, x + Math.cos(a) * rr, z + Math.sin(a) * rr, i * 0.06);
    }
    this.deployed++;
    this.idle = 0;
    this.fx.dust(x, z, 6);
    sfx.drop();
    if (k === 'pasha') {
      sfx.charge();
      this.hud.say(TEXT.callPasha.replace('ÇAĞIR', 'GELDİ').replace('’YI', ''), 1.6);
      this.shake = 0.35;
    }
    if (this.stock[k] <= 0) {
      const next = CARD_ORDER.find((c) => this.stock[c] > 0 && c !== 'pasha') || (this.stock.pasha > 0 ? 'pasha' : k);
      this.selected = next;
    }
    this.hintKey = '';
    this.hud.hint(null);
    this.refreshCards();
  }

  spawn(kind, x, z, delay = 0) {
    const U = UNITS[kind];
    const u = { kind, team: 'A', x, z, hp: U.hp, max: U.hp, yaw: Math.PI, cd: rnd(0.2, 0.6), slot: this.slots[kind]++, alive: true, anim: 'Idle', speed: U.speed, U, tgt: null, wp: null, plan: 0, delay, rage: 0, y: 6 };
    if (kind === 'top') {
      u.model = this.cannons[u.slot];
      u.model.visible = true;
    }
    this.units.push(u);
    return u;
  }

  // ---------------------------------------------------------------- targets & paths
  wallBlocking(ax, az, bx, bz, pad = 0.3) {
    let best = null;
    let bd = 1e9;
    for (const w of this.walls) {
      if (!w.alive) continue;
      if (!segHitsBox(ax, az, bx, bz, w.box, pad)) continue;
      const d = boxDist(ax, az, w.box);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    return best;
  }

  nearestBuilding(u, filter) {
    let best = null;
    let bd = 1e9;
    for (const b of this.buildings) {
      if (!b.alive || (filter && !filter(b))) continue;
      const d = Math.hypot(b.x - u.x, b.z - u.z) - b.r;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  nearestUnit(u, team, maxD) {
    let best = null;
    let bd = maxD;
    for (const o of this.units) {
      if (!o.alive || o.team !== team || o.delay > 0) continue;
      const d = Math.hypot(o.x - u.x, o.z - u.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  distTo(u, t) {
    if (t.box) return boxDist(u.x, u.z, t.box);
    if (t.team) return Math.hypot(t.x - u.x, t.z - u.z) - 0.35;
    return Math.hypot(t.x - u.x, t.z - u.z) - t.r;
  }

  // ---- flow fields: one distance map per target building, walls are passable but costly
  initNav() {
    const N = (this.nav = { x0: -34, z0: -38, cs: 0.7 });
    N.w = Math.ceil(68 / N.cs);
    N.h = Math.ceil(52 / N.cs);
    N.wall = new Int16Array(N.w * N.h).fill(-1);
    N.bld = new Int16Array(N.w * N.h).fill(-1);
    for (let iz = 0; iz < N.h; iz++)
      for (let ix = 0; ix < N.w; ix++) {
        const x = N.x0 + (ix + 0.5) * N.cs;
        const z = N.z0 + (iz + 0.5) * N.cs;
        const k = iz * N.w + ix;
        this.walls.forEach((w, wi) => {
          const b = w.box;
          if (x > b.x0 - 0.35 && x < b.x1 + 0.35 && z > b.z0 - 0.35 && z < b.z1 + 0.35) N.wall[k] = wi;
        });
        this.buildings.forEach((b, bi) => {
          if (Math.hypot(b.x - x, b.z - z) < b.r) N.bld[k] = bi;
        });
      }
    this.navVer = 0;
    this.fields = new Map();
  }

  field(b) {
    const N = this.nav;
    let f = this.fields.get(b);
    if (f && f.ver === this.navVer) return f.d;
    const n = N.w * N.h;
    const d = f?.d || new Float64Array(n);
    d.fill(1e9);
    // binary heap of [dist, idx]
    const hk = [];
    const hv = [];
    const push = (dist, k) => {
      let i = hk.length;
      hk.push(dist);
      hv.push(k);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hk[p] <= hk[i]) break;
        [hk[p], hk[i]] = [hk[i], hk[p]];
        [hv[p], hv[i]] = [hv[i], hv[p]];
        i = p;
      }
    };
    const pop = () => {
      const k = hv[0];
      const lk = hk.pop();
      const lv = hv.pop();
      if (hk.length) {
        hk[0] = lk;
        hv[0] = lv;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < hk.length && hk[l] < hk[m]) m = l;
          if (r < hk.length && hk[r] < hk[m]) m = r;
          if (m === i) break;
          [hk[m], hk[i]] = [hk[i], hk[m]];
          [hv[m], hv[i]] = [hv[i], hv[m]];
          i = m;
        }
      }
      return k;
    };
    const ring = b.r + 0.75;
    const ix0 = Math.max(0, Math.floor((b.x - ring - N.x0) / N.cs));
    const ix1 = Math.min(N.w - 1, Math.floor((b.x + ring - N.x0) / N.cs));
    const iz0 = Math.max(0, Math.floor((b.z - ring - N.z0) / N.cs));
    const iz1 = Math.min(N.h - 1, Math.floor((b.z + ring - N.z0) / N.cs));
    for (let iz = iz0; iz <= iz1; iz++)
      for (let ix = ix0; ix <= ix1; ix++) {
        const x = N.x0 + (ix + 0.5) * N.cs;
        const z = N.z0 + (iz + 0.5) * N.cs;
        const k = iz * N.w + ix;
        if (Math.hypot(b.x - x, b.z - z) <= ring && !(N.wall[k] >= 0 && this.walls[N.wall[k]].alive)) {
          d[k] = 0;
          push(0, k);
        }
      }
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (hk.length) {
      const dist = hk[0];
      const k = pop();
      if (dist > d[k]) continue;
      const ix = k % N.w;
      const iz = (k / N.w) | 0;
      for (const [dx, dz, c] of DIRS) {
        const jx = ix + dx;
        const jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= N.w || jz >= N.h) continue;
        const j = jz * N.w + jx;
        let cost = c;
        const wi = N.wall[j];
        if (wi >= 0 && this.walls[wi].alive) cost += 9; // a wall: worth a detour of a few metres, not more
        const bi = N.bld[j];
        if (bi >= 0 && this.buildings[bi].alive && this.buildings[bi] !== b) cost += 6;
        const nd = dist + cost;
        if (nd < d[j]) {
          d[j] = nd;
          push(nd, j);
        }
      }
    }
    this.fields.set(b, { ver: this.navVer, d });
    return d;
  }

  // the next cell to step to (world point) and the wall standing in it, if any
  flowStep(u, b) {
    const N = this.nav;
    const d = this.field(b);
    const ix = clamp(Math.floor((u.x - N.x0) / N.cs), 0, N.w - 1);
    const iz = clamp(Math.floor((u.z - N.z0) / N.cs), 0, N.h - 1);
    let best = iz * N.w + ix;
    let bd = d[best];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const jx = ix + dx;
        const jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= N.w || jz >= N.h) continue;
        const j = jz * N.w + jx;
        const v = d[j] + (dx && dz ? 0.05 : 0);
        if (v < bd) {
          bd = v;
          best = j;
        }
      }
    const wi = N.wall[best];
    return {
      x: N.x0 + ((best % N.w) + 0.5) * N.cs,
      z: N.z0 + (((best / N.w) | 0) + 0.5) * N.cs,
      wall: wi >= 0 && this.walls[wi].alive ? this.walls[wi] : null,
    };
  }

  // pick what this attacker goes for
  plan(u) {
    const ranged = u.U.range > 2;
    const foe = this.nearestUnit(u, 'E', ranged ? u.U.range : 3.6);
    if (foe) {
      u.tgt = foe;
      u.goal = null;
      return;
    }
    let t = u.kind === 'top' ? this.nearestBuilding(u, (b) => !!b.def) || this.nearestBuilding(u) : this.nearestBuilding(u);
    u.goal = t;
    u.tgt = t;
  }

  insideWall(x, z, pad = 0.32) {
    for (const w of this.walls) {
      if (!w.alive) continue;
      const b = w.box;
      if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return w;
    }
    return null;
  }
  insideBuilding(x, z, pad = 0.3) {
    for (const b of this.buildings) if (b.alive && Math.hypot(b.x - x, b.z - z) < b.r + pad) return b;
    return null;
  }

  // ---------------------------------------------------------------- combat
  damage(t, dmg, from) {
    if (!t.alive) return;
    if (t.team) {
      t.hp -= dmg;
      if (t.hp <= 0) this.kill(t);
      return;
    }
    if (t.kind === 'wall' || t.kind === 'corner') {
      t.hp -= dmg * (from?.U?.wallMul ?? 1);
      if (t.hp <= 0) this.razeWall(t);
      return;
    }
    t.hp -= dmg;
    t.hit = 0.12;
    if (t.hp <= 0) this.raze(t);
  }

  kill(u) {
    u.alive = false;
    u.anim = 'Die';
    u.deadT = 0;
    if (u.kind === 'top') {
      const p = u.model.position;
      this.fx.poof(p.x, 0.3, p.z, 0x5a4a32);
      this.fx.bigDust(p.x, 0.2, p.z, 6, 1.2);
    }
    if (u.kind === 'pasha') {
      this.pashaRing.visible = false;
      this.hud.showAbility(false);
    }
  }

  razeWall(w) {
    w.alive = false;
    this.navVer++;
    w.group.visible = false;
    w.rubble.visible = true;
    this.fx.bigDust(w.x, 0.5, w.z, 7, 1.4, 0xcdbf9e);
    for (let i = 0; i < 8; i++) this.fx.debris.emit(w.x, 1.2, w.z, { vx: rnd(-5, 5), vy: rnd(3, 8), vz: rnd(-5, 5), color: 0xc8bea8, sx: 0.3, sy: 0.25, sz: 0.3, life: 1.6 });
    sfx.stone();
    sfx.collapse();
    this.shake = Math.max(this.shake, 0.2);
    if (!this.wallBroken) {
      this.wallBroken = true;
      this.hud.say('Sur yıkıldı! İçeri!', 1.6);
    }
  }

  raze(b) {
    b.alive = false;
    b.bar.visible = false;
    b.sink = 0;
    this.razed++;
    this.fx.bigDust(b.x, 0.6, b.z, 12, b.r * 1.1, 0xcdbf9e);
    for (let i = 0; i < 14; i++) this.fx.debris.emit(b.x, 1.5, b.z, { vx: rnd(-6, 6), vy: rnd(4, 10), vz: rnd(-6, 6), color: i % 3 ? 0xc8bea8 : 0x6b4a2c, sx: 0.32, sy: 0.28, sz: 0.32, life: 1.8 });
    sfx.collapse();
    this.shake = Math.max(this.shake, b.type === 'palace' ? 0.7 : 0.3);
    // loot
    this.loot += b.loot;
    this.lootLeft -= b.loot;
    const s = this.toScreen(b.x, 2.5, b.z);
    this.hud.lootText(s.x, s.y, b.loot);
    for (let i = 0; i < 6; i++) this.hud.coinFly(s.x + rnd(-20, 20), s.y + rnd(-10, 10), i * 0.06);
    this.later(0.65, () => {
      sfx.gold();
      this.hud.setLoot(this.loot, this.lootLeft);
      this.hud.bump();
    });
    if (b.azap != null) this.azapFall = this.azapFall || {}, (this.azapFall[b.azap] = 0);
    if (b.type === 'palace') {
      this.hud.bigText(TEXT.palaceDown, 'gold');
      this.hud.flash();
      this.giveMoon(1);
    }
    const pct = (this.razed / this.total) * 100;
    this.hud.setPct(pct);
    if (pct >= 50) this.giveMoon(0);
    if (this.razed >= this.total) this.giveMoon(2);
  }

  giveMoon(i) {
    if (this.gotMoon?.[i]) return;
    this.gotMoon = this.gotMoon || {};
    this.gotMoon[i] = true;
    this.moons++;
    this.hud.moon(i);
    sfx.gateGood(this.moons === 3);
    if (this.moons === 3) this.victory();
  }

  // the battle cry: a shockwave around the Paşa, and every soldier near him rages
  useAbility() {
    sfx.unlock();
    const p = this.units.find((u) => u.kind === 'pasha' && u.alive);
    if (!p || this.abilityUsed || this.state !== 'play') return;
    this.abilityUsed = true;
    this.hud.showAbility(false);
    this.hud.hint(null);
    this.hud.bigText(TEXT.ability, 'red');
    this.hud.flash();
    sfx.charge();
    sfx.boom(true);
    this.shake = 1;
    this.waveT = 0;
    this.wave.position.x = p.x;
    this.wave.position.z = p.z;
    const R = ABILITY.radius;
    this.fx.bigDust(p.x, 0.3, p.z, 18, R * 0.6, 0xe0cfa8);
    for (const b of this.buildings) if (b.alive && Math.hypot(b.x - p.x, b.z - p.z) < R + b.r) this.damage(b, ABILITY.dmg);
    for (const w of this.walls) if (w.alive && boxDist(p.x, p.z, w.box) < R * 0.7) this.damage(w, ABILITY.dmg * 0.6);
    for (const u of this.units) {
      if (!u.alive) continue;
      const d = Math.hypot(u.x - p.x, u.z - p.z);
      if (u.team === 'E' && d < R) this.damage(u, ABILITY.dmg);
      if (u.team === 'A' && d < R + 4) u.rage = ABILITY.rage;
    }
  }

  // ---------------------------------------------------------------- per frame
  updateAttacker(u, dt) {
    const U = u.U;
    const mul = u.rage > 0 ? ABILITY.rageMul : 1;
    u.plan -= dt;
    if (!u.tgt || !u.tgt.alive || u.plan <= 0) {
      this.plan(u);
      u.plan = 0.5 + Math.random() * 0.3;
    }
    const t = u.tgt;
    if (!t) {
      u.anim = 'Idle';
      return;
    }
    const d = this.distTo(u, t);
    const reach = t.team ? (U.range > 2 ? U.range : 0.9) : U.range + 0.15;
    if (d <= reach) {
      // fight
      u.yaw = yawTo(t.x - u.x, t.z - u.z);
      u.anim = 'Attack';
      u.cd -= dt * mul;
      if (u.cd <= 0) {
        u.cd = U.rate;
        this.strike(u, t, mul);
      }
      return;
    }
    // walk: chase a soldier directly, follow the flow field to a building
    let wx = t.x;
    let wz = t.z;
    if (t.box) {
      wx = clamp(u.x, t.box.x0, t.box.x1);
      wz = clamp(u.z, t.box.z0, t.box.z1);
    } else if (!t.team && u.goal) {
      const st = this.flowStep(u, u.goal);
      if (st.wall) {
        // the way leads through a wall: knock it down
        u.tgt = st.wall;
        u.plan = 1.0;
        return;
      }
      wx = st.x;
      wz = st.z;
    }
    let dx = wx - u.x;
    let dz = wz - u.z;
    const dd = Math.hypot(dx, dz);
    if (dd < 0.01) return;
    dx /= dd;
    dz /= dd;
    const sp = Math.min(dd + 0.2, u.speed * mul * dt);
    const nx = u.x + dx * sp;
    const nz = u.z + dz * sp;
    const w = this.insideWall(nx, nz, 0.2);
    if (w) {
      u.tgt = w;
      u.plan = 1.0;
      return;
    }
    u.x = nx;
    u.z = nz;
    u.yaw = yawTo(dx, dz);
    u.anim = 'Walk';
  }

  strike(u, t, mul) {
    const U = u.U;
    const dmg = U.dmg * mul;
    if (u.kind === 'jan' || u.kind === 'pasha') {
      sfx.sword();
      const hx = (u.x + t.x) / 2;
      const hz = (u.z + t.z) / 2;
      if (Math.random() < 0.5) this.fx.clash(hx, 0.9, hz);
      if (t.box || (!t.team && t.r)) sfx.stone();
      if (U.splash) {
        // the Paşa's swing hits everyone around his target
        for (const o of this.units) if (o.alive && o.team === 'E' && Math.hypot(o.x - t.x, o.z - t.z) < U.splash) this.damage(o, dmg * 0.6, u);
      }
      this.damage(t, dmg, u);
    } else if (u.kind === 'tuf') {
      sfx.musket();
      const a = new THREE.Vector3(u.x - Math.sin(u.yaw) * 0.6, 1.0, u.z - Math.cos(u.yaw) * 0.6);
      this.fx.smoke.emit(a.x, a.y, a.z, { color: 0xf0ece4, size: 0.9, life: 0.7, grow: 2, alpha: 0.7, vy: 0.6 });
      this.fx.glow.emit(a.x, a.y, a.z, { color: 0xffd080, size: 0.8, life: 0.08, grow: 1.4 });
      this.damage(t, dmg, u);
      this.fx.clash(t.x, 1, t.z);
    } else if (u.kind === 'top') {
      sfx.cannon();
      const m = u.model;
      m.recoilT = 0.35;
      const a = new THREE.Vector3(u.x - Math.sin(u.yaw) * 1.3, 0.9, u.z - Math.cos(u.yaw) * 1.3);
      for (let i = 0; i < 5; i++) this.fx.smoke.emit(a.x, a.y, a.z, { vx: -Math.sin(u.yaw) * rnd(1, 3), vy: rnd(0.3, 1.2), vz: -Math.cos(u.yaw) * rnd(1, 3), color: 0xeae4d8, size: rnd(1.2, 2), life: rnd(0.8, 1.3), grow: 2.2, alpha: 0.8 });
      this.fx.glow.emit(a.x, a.y, a.z, { color: 0xffc060, size: 2, life: 0.1, grow: 1.6 });
      const b = new THREE.Vector3(t.x, 0.8, t.z);
      this.fx.balls.shoot(a, b, 0.45, 1.2, () => {
        this.boom(b.x, b.z, 0.9);
        this.damage(t, dmg, u);
        // splash: walls next to the one we hit
        for (const w of this.walls) if (w !== t && w.alive && boxDist(b.x, b.z, w.box) < 1.4) this.damage(w, dmg * 0.4, u);
      });
    }
  }

  boom(x, z, s = 1) {
    this.fx.glow.emit(x, 1, z, { color: 0xffb050, size: 3 * s, life: 0.18, grow: 1.6 });
    for (let i = 0; i < 6; i++) this.fx.smoke.emit(x, 0.6, z, { vx: rnd(-2, 2), vy: rnd(1, 3), vz: rnd(-2, 2), color: 0x8a7a62, size: rnd(1.2, 2) * s, life: rnd(0.7, 1.1), grow: 2, alpha: 0.8 });
    sfx.stone();
    this.shake = Math.max(this.shake, 0.18 * s);
  }

  updateDefender(u, dt) {
    const home = Math.hypot(u.x - u.hx, u.z - u.hz);
    let t = u.tgt && u.tgt.alive && Math.hypot(u.tgt.x - u.x, u.tgt.z - u.z) < 12 ? u.tgt : null;
    if (!t || (u.retarget = (u.retarget || 0) - dt) <= 0) {
      u.retarget = 0.5;
      let best = null;
      let bd = u.aggro;
      for (const o of this.units) {
        if (!o.alive || o.team !== 'A' || o.delay > 0) continue;
        const d = Math.hypot(o.x - u.hx, o.z - u.hz);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      t = best;
      u.tgt = t;
    }
    if (!t) {
      if (home > 0.4) this.walk(u, u.hx, u.hz, dt);
      else u.anim = 'Idle';
      return;
    }
    const d = Math.hypot(t.x - u.x, t.z - u.z);
    if (d < 1.0) {
      u.yaw = yawTo(t.x - u.x, t.z - u.z);
      u.anim = 'Attack';
      u.cd -= dt;
      if (u.cd <= 0) {
        u.cd = DEFENDERS.rate;
        sfx.sword();
        this.damage(t, DEFENDERS.dmg, u);
      }
    } else this.walk(u, t.x, t.z, dt);
  }

  walk(u, x, z, dt) {
    let dx = x - u.x;
    let dz = z - u.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    dx /= d;
    dz /= d;
    const nx = u.x + dx * u.speed * dt;
    const nz = u.z + dz * u.speed * dt;
    if (!this.insideWall(nx, nz)) {
      u.x = nx;
      u.z = nz;
    }
    u.yaw = yawTo(dx, dz);
    u.anim = 'Walk';
  }

  updateDefenses(dt) {
    for (const b of this.buildings) {
      if (!b.alive || !b.def) continue;
      b.cd -= dt;
      const t = this.nearestUnit(b, 'A', b.def.range);
      b.aim = t;
      if (!t || b.cd > 0) continue;
      b.cd = b.def.rate;
      if (b.type === 'archer') {
        const a = new THREE.Vector3(b.x, 3.4, b.z);
        const p = new THREE.Vector3(t.x, 0.8, t.z);
        sfx.arrow();
        this.fx.arrows.shoot(a, p, 0.45, 1.2, () => this.damage(t, b.def.dmg));
      } else {
        const g = b.group.gun;
        g.rotation.y = yawTo(t.x - b.x, t.z - b.z);
        g.recoilT = 0.35;
        const a = new THREE.Vector3(b.x - Math.sin(g.rotation.y) * 1.2, 1.4, b.z - Math.cos(g.rotation.y) * 1.2);
        const p = new THREE.Vector3(t.x, 0.6, t.z);
        sfx.cannon();
        for (let i = 0; i < 4; i++) this.fx.smoke.emit(a.x, a.y, a.z, { vy: rnd(0.3, 1), vx: rnd(-0.5, 0.5), vz: rnd(-0.5, 0.5), color: 0xeae4d8, size: rnd(1, 1.6), life: 0.9, grow: 2.2, alpha: 0.8 });
        this.fx.balls.shoot(a, p, 0.5, 1.4, () => {
          this.boom(p.x, p.z, 0.8);
          for (const o of this.units) if (o.alive && o.team === 'A' && Math.hypot(o.x - p.x, o.z - p.z) < b.def.splash) this.damage(o, b.def.dmg);
        });
      }
    }
  }

  separate() {
    const L = this.units;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive || a.delay > 0) continue;
      const ra = a.kind === 'top' ? 0.9 : a.kind === 'pasha' ? 0.6 : 0.42;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.alive || b.delay > 0) continue;
        const rb = b.kind === 'top' ? 0.9 : b.kind === 'pasha' ? 0.6 : 0.42;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        const R = ra + rb;
        if (d2 > R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (R - d) * 0.5;
        const nx = (dx / d) * push;
        const nz = (dz / d) * push;
        if (!this.insideWall(a.x - nx, a.z - nz)) {
          a.x -= nx;
          a.z -= nz;
        }
        if (!this.insideWall(b.x + nx, b.z + nz)) {
          b.x += nx;
          b.z += nz;
        }
      }
    }
  }

  // ---------------------------------------------------------------- flow
  start() {
    this.state = 'play';
    this.hud.show();
    this.hud.bigText(TEXT.start, 'green');
    this.hud.say(TEXT.goal, 2.6);
    sfx.march();
  }

  victory() {
    if (this.state !== 'play') return;
    this.state = 'won';
    this.hud.hint(null);
    this.hud.showAbility(false);
    this.later(0.9, () => {
      this.hud.bigText(TEXT.victory, 'gold');
      sfx.victory();
      for (let i = 0; i < 4; i++) this.later(i * 0.26, () => this.fx.firework(rnd(-10, 10), rnd(8, 12), rnd(-20, -8), [0xffd25a, 0xff5a4a, 0x5ad06a, 0xffffff][i]));
      this.fx.confetti.burst(0, 3, -12, 160);
    });
    this.later(3.2, () => this.finish(true));
  }

  defeat() {
    if (this.state !== 'play') return;
    this.state = 'lost';
    this.hud.hint(null);
    this.hud.showAbility(false);
    this.hud.bigText(this.moons >= 2 ? TEXT.victory : TEXT.defeat, this.moons >= 2 ? 'gold' : 'red');
    if (this.moons >= 2) sfx.victory();
    else sfx.defeat();
    this.later(2.4, () => this.finish(this.moons >= 2));
  }

  later(t, fn) {
    (this.jobs ||= []).push({ t: this.time + t, fn });
  }

  finish(win) {
    this.state = 'end';
    this.onEnd({ win, stars: this.moons, loot: this.loot });
  }

  refreshCards() {
    this.hud.updateCards(this.stock, this.selected, this.glowCard || null);
  }

  // what the player should do next (hand + card glow)
  updateHints(dt) {
    if (this.state !== 'play') return;
    this.idle += dt;
    const alive = this.units.filter((u) => u.alive && u.team === 'A');
    const atWall = alive.filter((u) => u.tgt && u.tgt.box && u.anim === 'Attack').length;
    this.wallT = atWall >= 3 ? (this.wallT || 0) + dt : 0;
    const wallFight = this.wallT > 1.5 || this.glowCard === 'top';
    const pashaAlive = alive.some((u) => u.kind === 'pasha');
    let key = '';
    let glow = null;
    let p = null;
    let label = '';
    const ground = (x, z) => this.toScreen(x, 0, z);
    if (this.deployed === 0) {
      key = 'first';
      p = this.time > 0.6 ? ground(-13.5, 0.8) : null;
      if (!this.saidTap && this.time > 4.2) {
        this.saidTap = true;
        this.hud.say(TEXT.tapHere, 2.6);
      }
    } else if (this.stock.top === UNITS.top.stock && wallFight && this.time > 4) {
      glow = 'top';
      if (this.selected !== 'top') {
        key = 'topcard';
        p = this.hud.cardPoint('top');
      } else {
        key = 'topground';
        const w = alive.find((u) => u.tgt && u.tgt.box && u.anim === 'Attack')?.tgt;
        if (w) {
          const ox = w.x + (w.z === this.town.z1 ? 0 : 0);
          p = ground(ox, Math.max(w.z + 6, DEPLOY.z1 + 1.2));
        }
      }
    } else if (this.stock.pasha > 0 && (this.time > 26 || (this.stock.jan + this.stock.tuf === 0 && alive.length < 10) || this.razed >= 7)) {
      glow = 'pasha';
      if (this.selected !== 'pasha') {
        key = 'pashacard';
        p = this.hud.cardPoint('pasha');
      } else {
        key = 'pashaground';
        p = ground(0, DEPLOY.z1 + 1.2);
      }
    } else if (pashaAlive && !this.abilityUsed) {
      const pa = alive.find((u) => u.kind === 'pasha');
      if (pa.anim === 'Attack' || pa.z < -2) {
        this.hud.showAbility(true, true);
        key = 'ability';
        const r = this.hud.ability.getBoundingClientRect();
        p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    } else if (this.idle > 3 && this.stock[this.selected] > 0) {
      key = 'more';
      const t = this.nearestBuilding({ x: 0, z: 4 });
      if (t) p = ground(clamp(t.x * 1.15, -24, 24), t.z < DEPLOY.z1 ? DEPLOY.z1 + 1.5 : t.z + 3);
    }
    if (glow !== this.glowCard) {
      this.glowCard = glow;
      this.refreshCards();
      if (glow === 'top') this.hud.say(TEXT.needCannon, 2.4);
      if (glow === 'pasha') this.hud.say(TEXT.callPasha, 2.4);
    }
    if (key !== 'ability' && !pashaAlive) this.hud.showAbility(false);
    this.hud.hint(p, label);
    this.hintKey = key;
  }

  checkEnd() {
    if (this.state !== 'play') return;
    const left = CARD_ORDER.some((k) => this.stock[k] > 0);
    const alive = this.units.some((u) => u.alive && u.team === 'A');
    if (!left && !alive) this.defeat();
    if (this.clock <= 0 || this.time > 80) this.defeat();
  }

  // ---------------------------------------------------------------- camera
  clampCam() {
    const portrait = this.h > this.w;
    this.cam.x = clamp(this.cam.x, portrait ? -14 : -8, portrait ? 14 : 8);
    this.cam.z = clamp(this.cam.z, -20, 0);
  }

  placeCamera() {
    const c = this.cam;
    const cam = this.camera;
    const dir = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
    const tgt = new THREE.Vector3(c.x, 0, c.z);
    cam.position.copy(tgt).addScaledVector(dir, c.d);
    cam.lookAt(tgt);
    cam.updateMatrixWorld();
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    const cam = this.camera;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const portrait = h > w;
    // fit: portrait shows the front of the town across the width; landscape the whole town
    const pts = portrait
      ? [[-10.5, -9], [10.5, -9], [-10.5, -14], [10.5, -14]]
      : [[-14, -22.5], [14, -22.5], [-14, -4], [14, -4]];
    const c = this.cam;
    const saveD = c.d;
    const keep = { x: c.x, z: c.z, yaw: c.yaw };
    c.x = 0;
    c.z = portrait ? -11 : -11.5;
    c.yaw = 0.42;
    const v = new THREE.Vector3();
    let lo = 10;
    let hi = 160;
    for (let i = 0; i < 28; i++) {
      c.d = (lo + hi) / 2;
      this.placeCamera();
      let ok = true;
      for (const [x, z] of pts) {
        v.set(x, 0, z).project(cam);
        if (Math.abs(v.x) > 0.97 || (!portrait && (v.y > 0.8 || v.y < -0.5))) ok = false;
      }
      if (ok) hi = c.d;
      else lo = c.d;
    }
    c.d = hi;
    this.baseD = hi;
    if (this.fitted) Object.assign(c, keep);
    else c.yaw = keep.yaw;
    this.scene.fog.near = hi + 25;
    this.scene.fog.far = hi + 110;
    cam.far = hi + 200;
    cam.updateProjectionMatrix();
    if (this.state === 'intro' && !this.fitted) c.d = hi;
    this.fitted = true;
    if (saveD && this.state !== 'intro') c.d = hi;
    this.placeCamera();
    this.fx.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))));
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    const c = this.cam;

    if (this.state === 'intro') {
      // a slow push in over the town while the drums play
      this.intro += dt;
      const k = Math.min(1, this.intro / 2.4);
      const e = 1 - (1 - k) ** 3;
      c.d = this.baseD * (0.62 + 0.38 * e);
      c.yaw = 0.42 + (1 - e) * 0.35;
      if (k >= 1) this.start();
    } else if (this.state === 'play') {
      this.clock -= dt;
      this.hud.setTime(this.clock);
      // follow the fight when the player is not panning
      const alive = this.units.filter((u) => u.alive && u.team === 'A' && u.delay <= 0);
      if (alive.length && this.time - this.panAt > 2.5) {
        let x = 0;
        let z = 0;
        for (const u of alive) {
          x += u.x;
          z += u.z;
        }
        x /= alive.length;
        z /= alive.length;
        const k = Math.min(1, dt * 0.6);
        c.x += (x * 0.4 - c.x) * k;
        c.z += (clamp(-11 + (z + 11) * 0.3, -16, -6) - c.z) * k;
        this.clampCam();
      }
    }
    this.placeCamera();

    // units
    for (const u of this.units) {
      if (u.delay > 0) {
        u.delay -= dt;
        continue;
      }
      if (u.y > 0) u.y = Math.max(0, u.y - dt * 30);
      u.rage = Math.max(0, u.rage - dt);
      if (u.alive) {
        if (u.team === 'A') this.updateAttacker(u, dt);
        else this.updateDefender(u, dt);
        if (u.rage > 0 && Math.random() < 0.3) this.fx.glow.emit(u.x, 1.2, u.z, { color: 0xff6030, size: 0.5, life: 0.4, grow: 0.5, vy: 1.5 });
      } else u.deadT += dt;
    }
    if (this.state === 'play' || this.state === 'won') this.updateDefenses(dt);
    this.separate();

    // draw units
    for (const u of this.units) {
      if (u.delay > 0) continue;
      if (u.kind === 'top') {
        const m = u.model;
        if (!u.alive) {
          if (u.deadT > 1.5) m.visible = false;
          else m.position.y = -u.deadT * 0.4;
          continue;
        }
        const moved = Math.hypot(m.position.x - u.x, m.position.z - u.z);
        m.position.set(u.x, u.y, u.z);
        m.rotation.y = u.yaw;
        for (const wh of m.wheels) wh.rotation.x += moved * 1.6 * m.wheelSign;
        m.recoilT = Math.max(0, (m.recoilT || 0) - dt);
        m.recoil(m.recoilT / 0.35);
        continue;
      }
      const crowd = this.crowds[u.kind];
      if (!crowd) continue;
      if (!u.alive && u.deadT > 3) {
        crowd.hide(u.slot);
        continue;
      }
      const sink = !u.alive && u.deadT > 2 ? (u.deadT - 2) * 0.8 : 0;
      crowd.update(u.slot, u.x, u.y - sink, u.z, u.yaw, u.anim, dt, { speed: u.rage > 0 ? 1.5 : 1 });
    }
    // the Paşa's ring
    const pa = this.units.find((u) => u.kind === 'pasha' && u.alive && u.delay <= 0);
    this.pashaRing.visible = !!pa;
    if (pa) {
      this.pashaRing.position.set(pa.x, 0.08, pa.z);
      this.pashaRing.scale.setScalar(1 + Math.sin(this.time * 5) * 0.08);
      if (Math.random() < 0.35) this.fx.glow.emit(pa.x + rnd(-0.6, 0.6), rnd(0.2, 1.6), pa.z + rnd(-0.6, 0.6), { color: 0xffd25a, size: 0.35, life: 0.6, vy: 1.2, grow: 0.4 });
    }
    // archers on their towers
    for (const b of this.buildings) {
      if (b.azap == null || !this.crowds.azap) continue;
      const fall = this.azapFall?.[b.azap];
      if (fall != null) {
        this.azapFall[b.azap] = fall + dt;
        if (fall > 1.6) this.crowds.azap.hide(b.azap);
        else this.crowds.azap.update(b.azap, b.x, Math.max(0, 2.85 - fall * fall * 6), b.z, b.azapYaw || 0, 'Die', dt);
        continue;
      }
      if (b.aim) b.azapYaw = yawTo(b.aim.x - b.x, b.aim.z - b.z);
      this.crowds.azap.update(b.azap, b.x, 2.85, b.z, b.azapYaw || 0, b.aim ? 'Attack' : 'Idle', dt);
    }
    // buildings: hit flash, sinking, bars, guns
    for (const b of this.buildings) {
      b.mixer?.update(dt);
      if (b.group.gun) {
        const g = b.group.gun;
        if (b.aim && b.alive) g.rotation.y += (yawTo(b.aim.x - b.x, b.aim.z - b.z) - g.rotation.y) * Math.min(1, dt * 6);
        g.recoilT = Math.max(0, (g.recoilT || 0) - dt);
        g.recoil(g.recoilT / 0.35);
      }
      if (b.alive) {
        if (b.hp < b.max) {
          b.bar.visible = true;
          b.bar.quaternion.copy(this.camera.quaternion);
          const k = Math.max(0, b.hp / b.max);
          b.bar.fg.scale.x = Math.max(0.001, k);
          b.bar.fg.position.x = -0.8 * (1 - k);
          b.bar.fg.material.color.setHex(k > 0.5 ? 0x5fd04a : k > 0.25 ? 0xf0c040 : 0xe04a30);
        }
        if (b.hit > 0) {
          b.hit -= dt;
          b.group.position.x = b.x + Math.sin(this.time * 70) * 0.05;
        } else b.group.position.x = b.x;
      } else if (b.sink != null && b.sink < 1) {
        b.sink = Math.min(1, b.sink + dt * 1.6);
        b.group.scale.y = 1 - b.sink * 0.85;
        b.group.rotation.z = b.sink * 0.12;
        if (b.sink >= 1) {
          b.group.visible = false;
          b.rubble.visible = true;
        }
      }
    }
    // shockwave ring
    if (this.waveT != null) {
      this.waveT += dt;
      const k = Math.min(1, this.waveT / 0.6);
      this.wave.scale.setScalar(0.5 + k * ABILITY.radius);
      this.wave.material.opacity = (1 - k) * 0.9;
      if (k >= 1) this.waveT = null;
    }
    this.zoneA = Math.max(0, this.zoneA - dt * 0.6);
    this.zone.material.opacity = this.zoneA;

    if (this.jobs?.length) {
      const due = this.jobs.filter((j) => j.t <= this.time);
      if (due.length) {
        this.jobs = this.jobs.filter((j) => j.t > this.time);
        for (const j of due) j.fn();
      }
    }
    this.updateHints(dt);
    this.checkEnd();
    this.fx.update(dt);
    this.shake *= Math.exp(-dt * 6);
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
