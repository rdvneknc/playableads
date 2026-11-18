import * as THREE from '../vendor/three.module.min.js';
import { ARMY, COLORS as C, DEER, ECON, INFO, KITCHEN, LOOT, MAP, OUTPOSTS, PLAYER, REGEN, TEXT, UNITS, UPGRADES, WORKER, WORKERS } from '../config.js';
import { Environment } from '../world/Environment.js';
import { MODELS, SIT_DROP } from '../world/Models.js';
import { UnitBatch } from '../world/UnitBatch.js';
import { Guide, Items, Pad } from '../world/Props.js';
import { archerTower, banner, baruthane, cauldron, counter, enemyTower, fieldCannon, forge, gatehouse, hearth, tent, wallSegment, waveFlag } from '../world/Town.js';
import { Fx } from '../fx/Fx.js';
import { withDetail } from '../world/Detail.js';
import { SkinnedCrowd, cannonModel, staticModel, unitScale } from '../world/Janissaries.js';
import { sfx } from '../audio/Sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + (b - a) * Math.random();
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const easeOutBack = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const SEAT_YAW = Math.PI; // seated soldiers face the table and the camera (+Z)
const KINDS = ['jan', 'azap', 'tuf', 'top'];
const POOL = { jan: 18, azap: 6, tuf: 4, enemy: 34, deer: DEER.count + 1 };

export class Game {
  constructor(renderer, hud, { onEnd, models = {} }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.models = models;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
    const ref = models.jan || models.enemy;
    this.unit = ref ? unitScale(ref) : 1.1;
    this.env = new Environment(this.scene, models.tent ? () => staticModel(models.tent, this.unit) : null);
    const mat = withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 }), { strength: 0.12, scale: 2.2, ao: 0.7 });
    // built-in low-poly characters: the two workers, and stand-ins for any model that failed to load
    this.batches = {
      cook: new UnitBatch(this.scene, MODELS.cook(), 2, mat, { scale: 1.12 }),
      hamal: new UnitBatch(this.scene, MODELS.hamal(), 1, mat, { scale: 1.05 }),
      jan: new UnitBatch(this.scene, MODELS.janissary(), 30, mat),
      enemy: new UnitBatch(this.scene, MODELS.enemy(), POOL.enemy, mat),
    };
    // the artist's animated models
    this.crowds = {};
    for (const k of ['jan', 'azap', 'tuf', 'enemy', 'deer']) {
      const g = models[k];
      if (!g) continue;
      this.crowds[k] = new SkinnedCrowd(this.scene, g, POOL[k], this.unit * (k === 'deer' ? 0.85 : 1));
      this.crowds[k].free = Array.from({ length: POOL[k] }, (_, i) => POOL[k] - 1 - i);
    }
    this.cookUnit = models.cook ? new SkinnedCrowd(this.scene, models.cook, 1, this.unit * 1.05, { hide: ['Cuval'] }) : null;
    this.items = new Items(this.scene);
    this.fx = new Fx(this.scene);
    this.guide = new Guide(this.scene);
    this._v = new THREE.Vector3();
    this.width = 1;
    this.height = 1;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.buildCamp();
    this.reset();
  }

  /* ───────────────────────── scene ───────────────────────── */

  put(o, x, z, ry = 0) {
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    this.scene.add(o);
    return o;
  }

  buildCamp() {
    const M = this.models;
    this.put(hearth(), MAP.kazan[0], MAP.kazan[1]);
    this.pot = this.put(cauldron(), MAP.kazan[0], MAP.kazan[1]);
    this.put(counter(), MAP.counter[0], MAP.counter[1], Math.PI / 2);
    this.banner = this.put(banner(), MAP.banner[0], MAP.banner[1]);
    // army upgrade buildings (hidden until bought)
    const B = MAP.buildings;
    const tentOf = (tint) => (M.tent ? staticModel(M.tent, this.unit * 1.15, tint) : tent());
    this.upBuild = {
      ordu10: this.put(tentOf(null), B.ordu10[0], B.ordu10[1], 0.6),
      azap: this.put(tentOf(0xbfe0a0), B.azap[0], B.azap[1], 1.2),
      tufek: this.put(baruthane(), B.tufek[0], B.tufek[1], 1.4),
      top: this.put(forge(), B.top[0], B.top[1], 1.2),
    };
    // our cannon (joins the army when the foundry is built)
    this.cannon = this.put(M.cannon ? cannonModel(M.cannon, this.unit * 1.15) : fieldCannon(), B.top[0], B.top[1]);
    // the enemy, outpost by outpost
    this.outposts = OUTPOSTS.map((o, oi) => {
      const op = { def: o, i: oi, buildings: [] };
      for (const [x, z] of o.tents) {
        const obj = this.put(tentOf(0x9ab8ff), x, z, rnd(-0.4, 0.4) + Math.PI);
        op.buildings.push({ kind: 'tent', x, z, r: 1.5, max: 8, obj, op: oi, soft: 0.6 });
      }
      for (const t of o.towers) {
        const obj = archerTower();
        if (t.y) obj.position.y = t.y;
        this.put(obj, t.x, t.z, Math.PI);
        if (t.y) obj.position.y = t.y;
        op.buildings.push({ kind: "tower", x: t.x, z: t.z, r: 1.4, max: t.hp, dps: t.dps, range: t.range || 10.5, obj, op: oi, soft: 0.6, topY: obj.topY + (t.y || 0) });
      }
      if (o.wall) {
        const w = o.wall;
        const segLen = w.len / 2 - (w.gate ? 3.2 : w.gap);
        for (const s of [-1, 1]) this.put(wallSegment(segLen, w.kind), s * (w.len / 2 - segLen / 2), w.z);
        if (w.gate) {
          const obj = this.put(gatehouse(), 0, w.z, Math.PI);
          op.buildings.push({ kind: 'gate', x: 0, z: w.z, r: 2.6, max: w.gate.hp, obj, op: oi, soft: w.gate.soft });
        }
      }
      if (o.keep) {
        const obj = this.put(enemyTower(), o.keep.x, o.keep.z);
        obj.scale.setScalar(1.25);
        op.buildings.push({ kind: 'keep', x: o.keep.x, z: o.keep.z, r: 2.6, max: o.keep.hp, obj, op: oi, soft: o.keep.soft, parts: obj.parts.map((m) => ({ m, y0: m.position.y })) });
      }
      for (const b of op.buildings) {
        b.home = { y: b.obj.position.y, rx: b.obj.rotation.x, rz: b.obj.rotation.z, sy: b.obj.scale.y };
      }
      return op;
    });
  }

  /* ───────────────────────── setup ───────────────────────── */

  reset() {
    this.time = 0;
    this.state = 'play';
    this.stateT = 0;
    this.ended = false;
    this.moved = false;
    this.tweens = [];
    this.flyers = [];
    this.pasha = { x: MAP.start[0], z: MAP.start[1], yaw: Math.PI, moving: false, type: null, n: 0, pending: 0, pickT: 0, dropT: 0, payT: 0, shootT: 0, gold: 0, hp: PLAYER.hp, hurtT: 9, dead: false, respawnT: 0, stepD: 0 };
    this.groundCoins = [];
    this.campaign = false;
    this.input = { x: 0, z: 0 };
    this.kz = { queue: 0, cooking: false, t: 0, level: 0.35 };
    this.food = 0;
    this.foodIn = 0;
    this.coins = 0;
    this.coinsIn = 0;
    this.meats = [];
    this.fedTotal = 0;
    this.cap = { ...ARMY.base };
    this.bought = {};
    this.cleared = 0;
    this.arriveT = 0.2;
    // pools back to free
    for (const c of Object.values(this.crowds)) {
      c.free = Array.from({ length: c.units.length }, (_, i) => c.units.length - 1 - i);
      c.hideFrom(0);
    }
    this.men = [];
    this.seats = MAP.seats.map(() => null);
    this.slotsTaken = { jan: [], azap: [], tuf: [], top: [] };
    // two soldiers already at the table, the rest on their way
    for (let i = 0; i < 2; i++) {
      const s = this.newMan('jan', MAP.seats[i][0], MAP.seats[i][1]);
      s.st = 'wait';
      s.seat = i;
      s.sitting = true;
      s.yaw = SEAT_YAW;
      this.seats[i] = s;
    }
    this.deer = [];
    for (let i = 0; i < DEER.count; i++) this.spawnDeer(i === 0 ? { x: MAP.start[0] - 1.5, z: MAP.start[1] + 4.5 } : null);
    this.workers = {};
    // enemies
    this.enemies = [];
    for (const op of this.outposts) {
      op.cleared = false;
      for (const b of op.buildings) {
        b.hp = b.max;
        b.dead = false;
        b.shotT = rnd(0, 1);
        b.obj.visible = true;
        b.obj.position.y = b.home.y;
        b.obj.rotation.x = b.home.rx;
        b.obj.rotation.z = b.home.rz;
        b.obj.scale.y = b.home.sy;
        b.parts?.forEach((p) => {
          p.m.position.set(0, p.y0, 0);
          p.m.rotation.set(0, 0, 0);
          p.m.visible = true;
          p.falling = false;
        });
        if (b.kind === 'tower') b.archer = this.newEnemy(b.x, b.z, op.i, { onTower: b, y: b.topY });
      }
      const inside = !!op.def.wall?.gate;
      for (const [x, z] of op.def.soldiers) this.newEnemy(x, z, op.i, { inside });
    }
    // pads
    for (const p of this.pads || []) this.scene.remove(p.plane);
    this.pads = [];
    const zone = (x, z, label, icon) => {
      const p = new Pad(this.scene, { id: icon, kind: 'zone', zone: true, x, z, label, icon });
      p.show();
      this.pads.push(p);
      return p;
    };
    zone(MAP.meatZone[0], MAP.meatZone[1], TEXT.zoneMeat, 'meat');
    zone(MAP.foodZone[0], MAP.foodZone[1], TEXT.zoneFood, 'bowl');
    zone(MAP.coinZone[0], MAP.coinZone[1], TEXT.zoneCoins, 'coin');
    this.attackPad = new Pad(this.scene, { id: 'attack', kind: 'attack', x: MAP.attackPad[0], z: MAP.attackPad[1], need: {}, label: TEXT.attack });
    this.attackPad.show();
    this.pads.push(this.attackPad);
    this.attackHold = 0;
    this.buyPads = [];
    this.nextUpgrade = 0;
    this.nextWorker = 0;
    for (const b of Object.values(this.upBuild)) b.visible = false;
    this.cannon.visible = false;
    this.cannonMan = null;
    this.battle = null;
    this.hud.reset();
    this.hud.coins(0);
    this.hud.showCta(true);
    this.shake = 0;
    this.guide.set(null);
    this.snapCam = true;
    this.calloutQueue = [];
  }

  /* ── people ── */

  alloc(kind) {
    const c = this.crowds[kind];
    if (!c) return -1;
    return c.free.length ? c.free.pop() : -1;
  }

  release(kind, idx) {
    const c = this.crowds[kind];
    if (!c || idx < 0) return;
    c.hide(idx);
    c.free.push(idx);
  }

  newMan(kind, x, z) {
    const s = { kind, x, z, yaw: 0, st: 'arrive', seat: -1, sitting: false, served: false, t: 0, slot: -1, via: null, hp: UNITS[kind].hp, cheer: 0, ph: rnd(0, 6), shotT: rnd(0, 0.5), u: this.alloc(kind) };
    this.men.push(s);
    return s;
  }

  newEnemy(x, z, op, { inside = false, onTower = null, y = 0 } = {}) {
    const e = { x, z, y, home: [x, z], yaw: 0, hp: UNITS.enemy.hp * (OUTPOSTS[op].power || 1), power: OUTPOSTS[op].power || 1, op, inside, onTower, active: false, dead: false, dieT: 0, ph: rnd(0, 6), u: this.alloc('enemy') };
    this.enemies.push(e);
    return e;
  }

  spawnDeer(at = null) {
    const m = MAP.meadow;
    const a = rnd(0, Math.PI * 2);
    const r = Math.sqrt(Math.random());
    const d = { x: at ? at.x : m.x + Math.cos(a) * m.rx * r, z: at ? at.z : m.z + Math.sin(a) * m.rz * r, yaw: rnd(0, 6), hp: DEER.hp, st: 'wander', t: rnd(0.5, 2), tx: 0, tz: 0, fade: 0, u: this.alloc('deer') };
    d.tx = d.x;
    d.tz = d.z;
    this.deer.push(d);
    return d;
  }

  /* ───────────────────────── input ───────────────────────── */

  setInput(sx, sy) {
    const fx = this.camLook.x - this.camPos.x;
    const fz = this.camLook.z - this.camPos.z;
    const fl = Math.hypot(fx, fz) || 1;
    const f = [fx / fl, fz / fl];
    const r = [-f[1], f[0]];
    this.input.x = r[0] * sx - f[0] * sy;
    this.input.z = r[1] * sx - f[1] * sy;
    if (sx || sy) this.moved = true;
  }

  press() {
    sfx.unlock();
  }

  fire() {}

  /* ───────────────────────── helpers ───────────────────────── */

  tween(time, fn, done) {
    this.tweens.push({ t: 0, time, fn, done });
  }

  later(time, done) {
    this.tween(time, null, done);
  }

  project(x, y, z) {
    const v = this._v.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, vis: v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05 };
  }

  backTop(c, n, type, base = 1.0) {
    const h = type === 'bowl' ? 0.22 : 0.32;
    return V(c.x + Math.sin(c.yaw) * 0.42, base + n * h + 0.15, c.z + Math.cos(c.yaw) * 0.42);
  }

  fly(type, from, toFn, dur, onArrive, arc = 1.4) {
    this.flyers.push({ type, from: from.clone(), toFn, t: 0, dur, onArrive, arc });
  }

  near(x, z, r = PLAYER.reach) {
    return dist(this.pasha.x, this.pasha.z, x, z) < r;
  }

  foodSlot(i) {
    const col = i % 4;
    const layer = Math.floor(i / 4);
    return V(MAP.foodZone[0] + (col - 1.5) * 0.5, 0.12 + layer * 0.2, MAP.foodZone[1] + (layer % 2) * 0.15);
  }

  coinSlot(i) {
    const col = i % 3;
    const row = Math.floor(i / 3) % 3;
    const layer = Math.floor(i / 9);
    return V(MAP.coinZone[0] + (col - 1) * 0.42, 0.05 + layer * 0.075, MAP.coinZone[1] + (row - 1) * 0.42);
  }

  slotPos(kind, i) {
    const R = MAP.ranks[kind];
    if (kind === 'jan') {
      const per = this.cap.jan <= 6 ? Math.max(1, this.cap.jan) : Math.ceil(this.cap.jan / 2);
      return [(i % per - (per - 1) / 2) * 1.25, R[1] + Math.floor(i / per) * 1.3];
    }
    if (kind === 'azap') return [(i - 1.5) * 1.3, R[1]];
    if (kind === 'tuf') return [(i - 0.5) * 1.6, R[1]];
    return [R[0], R[1]];
  }

  takeSlot(kind) {
    const t = this.slotsTaken[kind];
    let i = 0;
    while (t[i]) i++;
    t[i] = true;
    return i;
  }

  // soldiers of each kind that exist (hungry, eating or in the army)
  count(kind, armyOnly = false) {
    let n = 0;
    for (const s of this.men) if (s.kind === kind && s.st !== 'dead' && (!armyOnly || s.army)) n++;
    return n;
  }

  get armyFull() {
    for (const k of KINDS) if (this.count(k, true) < this.cap[k]) return false;
    return true;
  }

  // hungry soldiers who still need a bowl, minus the food already on its way
  bowlsNeeded() {
    let need = 0;
    for (const s of this.men) if (!s.army && !s.served && s.st !== 'dead') need++;
    for (const k of KINDS) if (k !== 'top') need += Math.max(0, this.cap[k] - this.count(k));
    const P = this.pasha;
    const carried = (P.type === 'bowl' ? P.n + P.pending : 0) + (this.workers.garson?.type === 'bowl' ? this.workers.garson.n : 0);
    return need - this.food - this.foodIn - carried;
  }

  meatNeeded() {
    const P = this.pasha;
    const H = this.workers.avci;
    const carried = (P.type === 'meat' ? P.n + P.pending : 0) + (H ? H.n + H.pending : 0);
    return this.bowlsNeeded() - this.kz.queue - (this.kz.cooking ? 1 : 0) - this.meatsInFlight() - carried - this.meats.length;
  }

  meatsInFlight() {
    return this.flyers.filter((f) => f.type === 'meat' && f.toKazan).length;
  }

  // anyone still waiting for food (at the table, in line, or yet to come)
  anyoneHungry() {
    if (this.men.some((s) => !s.army && !s.served && s.st !== 'dead')) return true;
    for (const k of ['jan', 'azap', 'tuf']) if (this.count(k) < this.cap[k]) return true;
    return false;
  }

  unservedSeated() {
    return this.seats.filter((s) => s && s.st === 'wait' && s.sitting && !s.served);
  }

  /* ───────────────────────── update ───────────────────────── */

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.stateT += dt;
    const finished = [];
    this.tweens = this.tweens.filter((tw) => {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.time);
      tw.fn?.(k);
      if (k >= 1) {
        if (tw.done) finished.push(tw.done);
        return false;
      }
      return true;
    });
    finished.forEach((f) => f());

    const P = this.pasha;
    if (P.dead) {
      P.moving = false;
      P.respawnT -= dt;
      if (P.respawnT <= 0) {
        // back on his feet at the camp
        P.dead = false;
        P.hp = PLAYER.hp;
        P.x = MAP.kazan[0];
        P.z = MAP.kazan[1] + 3.5;
        this.fx.sparkle(P.x, 0, P.z, 0xffe9a0, 14);
        this.snapCam = true;
      }
    } else {
      P.hurtT += dt;
      if (P.hurtT > 3) P.hp = Math.min(PLAYER.hp, P.hp + PLAYER.regen * dt);
    }
    if (this.state === 'play' && !P.dead) {
      this.movePasha(dt);
      this.handlePlayer(dt);
    }
    this.updateDeer(dt);
    this.updateKitchen(dt);
    this.updateWorkers(dt);
    this.updateArrivals(dt);
    this.updateMen(dt);
    this.updateBattle(dt);
    this.updateEnemies(dt);
    this.updateFlyers(dt);
    this.updatePads(dt);
    this.updateGuide();
    for (const p of this.pads) p.update(this.time, dt);
    this.guide.origin(this.pasha.x, this.pasha.z);
    this.guide.update(this.time);
    waveFlag(this.banner.flag, this.time);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.env.update(this.time, this.camPos.x, this.camPos.z);
    this.env.follow(this.camLook.x, this.camLook.z);
    this.draw(dt);
    this.updateHud();
  }

  movePasha(dt) {
    const P = this.pasha;
    const m = Math.hypot(this.input.x, this.input.z);
    P.moving = m > 0.05;
    if (P.moving) {
      const sp = PLAYER.speed * Math.min(1, m) * dt;
      P.x += (this.input.x / m) * sp;
      P.z += (this.input.z / m) * sp;
      P.yaw = turn(P.yaw, yawFor(this.input.x, this.input.z), Math.min(1, dt * 14));
      P.stepD += sp;
      if (P.stepD > 1.7) {
        P.stepD = 0;
        sfx.step();
      }
    }
    const b = MAP.bounds;
    P.x = clamp(P.x, b.x0, b.x1);
    P.z = clamp(P.z, b.z0, b.z1);
    const circles = [[MAP.kazan[0], MAP.kazan[1], 1.3], [MAP.banner[0], MAP.banner[1], 0.7]];
    for (const [id, o] of Object.entries(this.upBuild)) if (o.visible) circles.push([MAP.buildings[id][0], MAP.buildings[id][1], 1.9]);
    for (const [cx, cz, r] of circles) {
      const d = dist(P.x, P.z, cx, cz);
      if (d < r) {
        P.x = cx + ((P.x - cx) / (d || 1)) * r;
        P.z = cz + ((P.z - cz) / (d || 1)) * r;
      }
    }
    const s = { x: MAP.counter[0], z: MAP.counter[1], w: 2.25, d: 0.6 };
    const dx = P.x - s.x;
    const dz = P.z - s.z;
    const ox = s.w + 0.4 - Math.abs(dx);
    const oz = s.d + 0.4 - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) P.x += Math.sign(dx || 1) * ox;
      else P.z += Math.sign(dz || 1) * oz;
    }
  }

  handlePlayer(dt) {
    const P = this.pasha;
    P.pickT -= dt;
    P.dropT -= dt;
    P.payT -= dt;
    P.shootT -= dt;
    const total = () => P.n + P.pending;
    // hunt: shoot the nearest deer in range (not while carrying food)
    if (P.type !== 'bowl' && P.shootT <= 0) {
      const d = this.nearestDeer(P.x, P.z, PLAYER.shootRange);
      if (d) {
        P.shootT = PLAYER.shootEvery;
        if (!P.moving) P.yaw = yawFor(d.x - P.x, d.z - P.z);
        this.shootDeer(V(P.x, 1.5, P.z), d);
      }
    }
    // pick up meat from the ground
    if ((P.type === null || P.type === 'meat') && total() < PLAYER.stackMax && P.pickT <= 0) {
      const m = this.meats.find((mm) => mm.ready && dist(mm.x, mm.z, P.x, P.z) < 1.9);
      if (m) {
        P.pickT = PLAYER.pickEvery;
        this.meats.splice(this.meats.indexOf(m), 1);
        P.type = 'meat';
        P.pending++;
        const n = total() - 1;
        this.fly('meat', V(m.x, 0.2, m.z), () => this.backTop(P, n, 'meat'), 0.22, () => {
          P.pending--;
          P.n++;
          sfx.pop();
        });
      }
    }
    // meat into the kazan
    if (P.type === 'meat' && P.n > 0 && P.dropT <= 0 && this.near(MAP.meatZone[0], MAP.meatZone[1], 2.1)) {
      P.dropT = PLAYER.dropEvery;
      const from = this.backTop(P, P.n - 1, 'meat');
      P.n--;
      if (!P.n && !P.pending) P.type = null;
      this.meatToKazan(from);
    }
    // bowls from the food zone
    if ((P.type === null || P.type === 'bowl') && this.food > 0 && total() < PLAYER.stackMax && P.pickT <= 0 && this.near(MAP.foodZone[0], MAP.foodZone[1], 2.1)) {
      P.pickT = PLAYER.pickEvery;
      this.food--;
      P.type = 'bowl';
      P.pending++;
      const n = total() - 1;
      this.fly('bowl', this.foodSlot(this.food), () => this.backTop(P, n, 'bowl'), 0.22, () => {
        P.pending--;
        P.n++;
        sfx.clink();
      });
    }
    // nobody left to feed: spare bowls go back on the pile
    if (P.type === 'bowl' && P.n > 0 && P.dropT <= 0 && !this.anyoneHungry() && this.near(MAP.foodZone[0], MAP.foodZone[1], 2.1) && this.food + this.foodIn < KITCHEN.pileMax) {
      P.dropT = PLAYER.dropEvery;
      const from = this.backTop(P, P.n - 1, 'bowl');
      P.n--;
      if (!P.n && !P.pending) P.type = null;
      const i = this.food + this.foodIn;
      this.foodIn++;
      this.fly('bowl', from, () => this.foodSlot(i), 0.25, () => {
        this.foodIn--;
        this.food++;
      });
    }
    // bowls to the soldiers at the table
    if (P.type === 'bowl' && P.n > 0 && P.dropT <= 0) {
      const s = this.unservedSeated().find((ss) => dist(ss.x, ss.z, P.x, P.z) < 4.4);
      if (s) {
        P.dropT = PLAYER.dropEvery;
        const from = this.backTop(P, P.n - 1, 'bowl');
        P.n--;
        if (!P.n && !P.pending) P.type = null;
        this.serve(s, from);
      }
    }
    // akçe lying on the battlefield
    if (P.payT <= 0) {
      const c = this.groundCoins.find((cc) => cc.ready && dist(cc.x, cc.z, P.x, P.z) < 2.3);
      if (c) {
        P.payT = 0.04;
        this.groundCoins.splice(this.groundCoins.indexOf(c), 1);
        this.fly('coin', V(c.x, 0.2, c.z), () => V(P.x, 1.6, P.z), 0.25, () => {
          P.gold++;
          this.hud.coins(P.gold, true);
          sfx.coin();
        }, 1.0);
      }
    }
    // collect the akçe pile
    if (this.coins > 0 && P.payT <= 0 && this.near(MAP.coinZone[0], MAP.coinZone[1], 2.0)) {
      P.payT = 0.045;
      this.coins--;
      this.fly('coin', this.coinSlot(this.coins), () => V(P.x, 1.6, P.z), 0.3, () => {
        P.gold++;
        this.hud.coins(P.gold, true);
        sfx.coin();
      }, 1.2);
    }
    // pay into a plot
    for (const pad of this.buyPads) {
      if (pad.done || P.gold <= 0 || P.payT > 0 || !this.near(pad.def.x, pad.def.z)) continue;
      if (pad.paid + (pad.inbound || 0) >= pad.total) continue;
      P.payT = PLAYER.payEvery;
      P.gold--;
      this.hud.coins(P.gold);
      pad.inbound = (pad.inbound || 0) + 1;
      this.fly('coin', V(P.x, 1.5, P.z), () => V(pad.def.x, 0.3, pad.def.z), 0.26, () => {
        pad.inbound--;
        sfx.coin();
        if (pad.done) return;
        this.fx.sparkle(pad.def.x, 0, pad.def.z, 0xffe08a, 2);
        if (pad.pay()) this.buy(pad);
      });
    }
    // stand on SALDIR: the army marches out
    const onAttack = this.near(MAP.attackPad[0], MAP.attackPad[1], 1.9) && this.canAttack();
    this.attackHold = onAttack ? this.attackHold + dt : Math.max(0, this.attackHold - dt * 2);
    this.attackPad.setFill(Math.min(1, this.attackHold / 1.2));
    if (this.attackHold >= 1.2) {
      this.attackHold = 0;
      this.startBattle();
    }
  }

  /* ── hunting ── */

  nearestDeer(x, z, range) {
    let best = null;
    let bd = range;
    for (const d of this.deer) {
      if (d.st === 'dead' || d.st === 'gone' || d.targeted > 0) continue;
      const dd = dist(x, z, d.x, d.z);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return best;
  }

  shootDeer(from, d) {
    d.targeted = (d.targeted || 0) + 1;
    sfx.arrow();
    this.fx.arrows.shoot(from, V(d.x, 1.1, d.z), 0.2, 0.25, () => {
      d.targeted--;
      if (d.st === 'dead' || d.st === 'gone') return;
      d.hp--;
      this.fx.glow.emit(d.x, 1.2, d.z, { color: 0xffe0a0, size: 0.9, life: 0.15, grow: 2 });
      if (d.hp <= 0) this.killDeer(d);
      else {
        d.st = 'flee';
        d.t = 1.2;
        const a = Math.atan2(d.z - from.z, d.x - from.x) + rnd(-0.6, 0.6);
        d.tx = d.x + Math.cos(a) * 6;
        d.tz = d.z + Math.sin(a) * 6;
      }
    });
  }

  killDeer(d) {
    d.st = 'dead';
    d.t = 0;
    sfx.poof();
    // the meat pops out
    this.later(0.45, () => {
      const m = { x: d.x + rnd(-0.3, 0.3), z: d.z + rnd(-0.3, 0.3), ready: false, t: 0 };
      this.meats.push(m);
      this.fx.sparkle(m.x, 0.2, m.z, 0xffd0a0, 6);
      sfx.pop();
      this.later(0.25, () => (m.ready = true));
    });
  }

  updateDeer(dt) {
    const m = MAP.meadow;
    for (const d of this.deer) {
      d.t -= dt;
      if (d.st === 'dead') {
        d.fade += dt;
        if (d.fade > 1.6) {
          d.st = 'gone';
          this.release('deer', d.u);
          d.u = -1;
          this.later(DEER.respawn, () => {
            this.deer.splice(this.deer.indexOf(d), 1);
            this.spawnDeer();
          });
        }
        continue;
      }
      if (d.st === 'gone') continue;
      if (d.t <= 0) {
        d.st = 'wander';
        d.t = rnd(1.5, 3.5);
        if (Math.random() < 0.6) {
          const a = rnd(0, Math.PI * 2);
          const r = Math.sqrt(Math.random());
          d.tx = m.x + Math.cos(a) * m.rx * r;
          d.tz = m.z + Math.sin(a) * m.rz * r;
        } else {
          d.tx = d.x;
          d.tz = d.z;
        }
      }
      const speed = d.st === 'flee' ? DEER.run : DEER.walk;
      if (d.st === 'flee' && d.moving && dist(d.x, d.z, this.pasha.x, this.pasha.z) < 14) sfx.hoof();
      const dx = d.tx - d.x;
      const dz = d.tz - d.z;
      const dd = Math.hypot(dx, dz);
      d.moving = dd > 0.2;
      if (d.moving) {
        const sp = Math.min(dd, speed * dt);
        d.x += (dx / dd) * sp;
        d.z += (dz / dd) * sp;
        d.yaw = turn(d.yaw, yawFor(dx, dz), Math.min(1, dt * 6));
      }
      // keep them in (and near) the meadow
      d.x = clamp(d.x, m.x - m.rx - 2, m.x + m.rx + 2);
      d.z = clamp(d.z, m.z - m.rz - 2, m.z + m.rz + 3);
    }
    for (const mt of this.meats) mt.t += dt;
  }

  /* ── kitchen ── */

  meatToKazan(from) {
    const f = { type: 'meat', from: from.clone(), toFn: () => V(MAP.kazan[0], 1.3, MAP.kazan[1]), t: 0, dur: 0.32, arc: 1.3, toKazan: true };
    f.onArrive = () => {
      this.kz.queue++;
      sfx.sack(true);
      this.fx.smoke.emit(MAP.kazan[0], 1.5, MAP.kazan[1], { vy: 2, color: 0xffffff, size: 1.4, life: 0.5, grow: 2, alpha: 0.5 });
    };
    this.flyers.push(f);
  }

  updateKitchen(dt) {
    const K = this.kz;
    if (!K.cooking && K.queue > 0 && this.food + this.foodIn < KITCHEN.pileMax) {
      K.queue--;
      K.cooking = true;
      K.t = KITCHEN.cook;
    }
    if (K.cooking) {
      K.t -= dt;
      if (Math.random() < dt * 4) sfx.bubble();
      if (K.t <= 0) {
        K.cooking = false;
        const i = this.food + this.foodIn;
        this.foodIn++;
        this.fly('bowl', V(MAP.kazan[0], 1.4, MAP.kazan[1]), () => this.foodSlot(i), 0.35, () => {
          this.foodIn--;
          this.food++;
          sfx.clink();
        }, 1.2);
      }
    }
    const busy = K.cooking || K.queue > 0;
    K.level = lerp(K.level, busy ? 1 : 0.35, Math.min(1, dt * 4));
    const stew = this.pot.stew;
    stew.position.y = 0.92 + K.level * 0.3;
    const s = 1 + Math.sin(this.time * (busy ? 18 : 4)) * (busy ? 0.03 : 0.01);
    stew.scale.set(s, s, 1);
    const [kx, kz] = MAP.kazan;
    if (Math.random() < dt * (busy ? 9 : 2.5))
      this.fx.smoke.emit(kx + rnd(-0.4, 0.4), 1.7, kz + rnd(-0.4, 0.4), { vx: rnd(-0.3, 0.3), vy: rnd(1.4, 2.4), vz: rnd(-0.3, 0.3), color: 0xf4f0ea, size: rnd(0.6, 1.0), life: rnd(0.9, 1.4), grow: 2.4, alpha: busy ? 0.32 : 0.18 });
    if (Math.random() < dt * 14)
      this.fx.glow.emit(kx + rnd(-0.5, 0.5), 0.25, kz + rnd(-0.5, 0.5), { vy: rnd(0.5, 1.4), color: Math.random() < 0.5 ? 0xff8a2a : 0xffc04a, size: rnd(0.35, 0.7), life: rnd(0.3, 0.6), grow: 0.5, alpha: 0.9 });
  }

  serve(s, from) {
    s.served = true;
    this.fly('bowl', from, () => this.handPos(s), 0.3, () => {
      s.st = 'eat';
      s.t = KITCHEN.eat;
      s.hasBowl = true;
      sfx.fed();
    }, 1.0);
  }

  handPos(s) {
    const c = this.crowds[s.kind];
    if (c && s.u >= 0) {
      const p = c.hand(s.u, V(0, 0, 0));
      if (p) return p.setY(p.y + 0.06);
    }
    return V(s.x - Math.sin(s.yaw) * 0.45, 1.12 - SIT_DROP, s.z - Math.cos(s.yaw) * 0.45);
  }

  /* ── workers: the hunter and the waiter ── */

  updateWorkers(dt) {
    const H = this.workers.avci;
    if (H) {
      H.t -= dt;
      H.shootT -= dt;
      let tx = H.x;
      let tz = H.z;
      const meat = this.meats.filter((m) => m.ready).sort((a, b) => dist(a.x, a.z, H.x, H.z) - dist(b.x, b.z, H.x, H.z))[0];
      const deer = this.nearestDeer(H.x, H.z, 99);
      if (H.n > 0 && (H.n + H.pending >= WORKER.carry || (!meat && !deer))) {
        [tx, tz] = [MAP.meatZone[0] - 1.2, MAP.meatZone[1] + 1.2];
        if (dist(H.x, H.z, MAP.meatZone[0], MAP.meatZone[1]) < 2.0 && H.t <= 0) {
          H.t = 0.2;
          const from = this.backTop(H, H.n - 1, 'meat', 1.2);
          H.n--;
          this.meatToKazan(from);
        }
      } else if (meat && H.n + H.pending < WORKER.carry) {
        [tx, tz] = [meat.x, meat.z];
        if (dist(H.x, H.z, meat.x, meat.z) < 1.4) {
          this.meats.splice(this.meats.indexOf(meat), 1);
          H.pending++;
          const n = H.n + H.pending - 1;
          this.fly('meat', V(meat.x, 0.2, meat.z), () => this.backTop(H, n, 'meat', 1.2), 0.22, () => {
            H.pending--;
            H.n++;
          });
        }
      } else if (deer) {
        const dd = dist(H.x, H.z, deer.x, deer.z);
        if (dd > PLAYER.shootRange - 1.5) [tx, tz] = [deer.x, deer.z];
        else if (H.shootT <= 0) {
          H.shootT = WORKER.shootEvery;
          H.yaw = yawFor(deer.x - H.x, deer.z - H.z);
          this.shootDeer(V(H.x, 1.5, H.z), deer);
        }
      }
      this.stepTo(H, tx, tz, WORKER.speed, dt);
    }
    const G = this.workers.garson;
    if (G) {
      G.t -= dt;
      let tx = G.x;
      let tz = G.z;
      const hungry = this.unservedSeated();
      if (G.n > 0 && hungry.length) {
        const s = hungry[0];
        [tx, tz] = [s.x, MAP.counter[1] + 1.4];
        if (G.t <= 0) {
          const t = hungry.find((ss) => dist(ss.x, ss.z, G.x, G.z) < 4.4);
          if (t) {
            G.t = 0.2;
            const from = this.backTop(G, G.n - 1, 'bowl', 1.0);
            G.n--;
            this.serve(t, from);
          }
        }
      } else if (this.food > 0 && G.n < WORKER.carry) {
        [tx, tz] = [MAP.foodZone[0] + 1.2, MAP.foodZone[1] + 0.8];
        if (dist(G.x, G.z, MAP.foodZone[0], MAP.foodZone[1]) < 2.0 && G.t <= 0) {
          G.t = 0.18;
          this.food--;
          G.pending = (G.pending || 0) + 1;
          const n = G.n + G.pending - 1;
          this.fly('bowl', this.foodSlot(this.food), () => this.backTop(G, n, 'bowl', 1.0), 0.22, () => {
            G.pending--;
            G.n++;
          });
        }
      } else if (G.n > 0) [tx, tz] = [MAP.counter[0], MAP.counter[1] + 1.4];
      else [tx, tz] = [MAP.foodZone[0] + 1.6, MAP.foodZone[1] + 1.0];
      this.stepTo(G, tx, tz, WORKER.speed, dt);
    }
  }

  stepTo(c, tx, tz, speed, dt) {
    const dx = tx - c.x;
    const dz = tz - c.z;
    const d = Math.hypot(dx, dz);
    c.moving = d > 0.12;
    if (c.moving) {
      const sp = Math.min(d, speed * dt);
      c.x += (dx / d) * sp;
      c.z += (dz / d) * sp;
      c.yaw = turn(c.yaw, yawFor(dx, dz), Math.min(1, dt * 10));
      c.ph = (c.ph || 0) + dt * 10;
    }
    return !c.moving;
  }

  /* ── soldiers: arrive hungry, sit, eat, pay, join the army ── */

  updateArrivals(dt) {
    this.arriveT -= dt;
    if (this.arriveT > 0) return;
    for (const k of ['jan', 'azap', 'tuf']) {
      if (this.count(k) >= this.cap[k]) continue;
      if (this.men.filter((s) => !s.army && s.st !== 'dead').length >= 9) return;
      const s = this.newMan(k, MAP.arrive[0] + rnd(-1, 1), MAP.arrive[1] + rnd(-1, 1));
      s.via = [[14.5, -6.0]];
      this.arriveT = KITCHEN.arriveEvery;
      return;
    }
  }

  updateMen(dt) {
    // free seats are taken by the next in line
    const line = this.men.filter((s) => !s.army && (s.st === 'arrive' || s.st === 'wait') && s.seat < 0);
    this.seats.forEach((occ, i) => {
      if (occ) return;
      const s = line.shift();
      if (!s) return;
      s.seat = i;
      s.sitting = false;
      this.seats[i] = s;
    });
    let li = 0;
    for (const s of this.men) {
      s.cheer = Math.max(0, s.cheer - dt);
      if (s.st === 'dead') {
        s.t += dt;
        if (s.t > 1.6 && !s.gone) {
          s.gone = true;
          this.fx.poof(s.x, 0, s.z, 0xb3302a);
          this.release(s.kind, s.u);
          if (s.slot >= 0) this.slotsTaken[s.kind][s.slot] = false;
        }
        continue;
      }
      if (s.st === 'fight') continue; // the battle moves them
      let tx = null;
      let tz = null;
      let speed = 3.8;
      if (s.via?.length && dist(s.x, s.z, s.via[0][0], s.via[0][1]) < 0.5) s.via.shift();
      if ((s.st === 'arrive' || s.st === 'wait') && s.via?.length) [tx, tz] = s.via[0];
      else if (s.st === 'arrive' || s.st === 'wait') {
        if (s.seat >= 0) [tx, tz] = MAP.seats[s.seat];
        else {
          [tx, tz] = [MAP.line[0] + li * MAP.lineStep[0], MAP.line[1] + li * MAP.lineStep[1]];
          li++;
        }
      } else if (s.st === 'eat') {
        s.t -= dt;
        if (s.t <= 0) this.finishMeal(s);
        continue;
      } else if (s.st === 'go' || s.st === 'rank' || s.st === 'return') {
        [tx, tz] = this.slotPos(s.kind, s.slot);
        speed = s.st === 'return' ? 5.5 : 4.4;
      } else if (s.st === 'march') {
        tx = this.slotPos(s.kind, s.slot)[0];
        tz = -95;
        speed = 4;
      }
      if (tx == null) continue;
      const dx = tx - s.x;
      const dz = tz - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.06) {
        const sp = Math.min(d, speed * dt);
        s.x += (dx / d) * sp;
        s.z += (dz / d) * sp;
        s.yaw = turn(s.yaw, yawFor(dx, dz), Math.min(1, dt * 10));
        s.walking = true;
        s.sitting = false;
        s.speed = speed;
        if (s.st === 'rank') s.st = 'go';
      } else {
        s.walking = false;
        if ((s.st === 'arrive' || s.st === 'wait') && s.seat >= 0) {
          s.st = 'wait';
          s.sitting = true;
          s.yaw = turn(s.yaw, SEAT_YAW, Math.min(1, dt * 12));
        } else if (s.st === 'arrive' || s.st === 'wait') {
          s.st = 'wait';
          s.yaw = turn(s.yaw, yawFor(MAP.counter[0] - s.x, MAP.counter[1] - s.z), Math.min(1, dt * 8));
        } else if (s.st === 'go' || s.st === 'return') {
          s.st = 'rank';
          s.yaw = 0;
        } else if (s.st === 'rank') s.yaw = turn(s.yaw, 0, Math.min(1, dt * 8));
      }
    }
    this.men = this.men.filter((s) => !s.gone);
  }

  finishMeal(s) {
    s.hasBowl = false;
    s.sitting = false;
    this.seats[s.seat] = null;
    s.seat = -1;
    s.army = true;
    s.st = 'go';
    s.slot = this.takeSlot(s.kind);
    s.cheer = 0.7;
    this.fedTotal++;
    this.fx.sparkle(s.x, 0.4, s.z, 0xffe9a0, 6);
    // the akçe go to the pile beside the table
    const p = this.project(s.x, 2.4, s.z);
    if (p.vis) this.hud.float(p.x, p.y, `+${ECON.akcePerSoldier}`, 'coin');
    for (let i = 0; i < ECON.akcePerSoldier; i++)
      this.later(0.1 + i * 0.12, () => {
        const slot = this.coins + this.coinsIn;
        this.coinsIn++;
        this.fly('coin', V(s.x, 1.5, s.z), () => this.coinSlot(slot), 0.45, () => {
          this.coinsIn--;
          this.coins++;
          sfx.coin();
        }, 1.6);
      });
    if (this.armyFull && !this.saidFull) {
      this.saidFull = true;
      this.later(0.8, () => this.hud.callout(TEXT.armyFull, 'gold small'));
    }
  }

  /* ───────────────────────── purchases ───────────────────────── */

  updatePads() {
    // the next army upgrade appears once its outpost requirement is met
    const up = UPGRADES[this.nextUpgrade];
    if (up && !this.upPad && this.cleared >= up.after && this.fedTotal >= 2) {
      this.upPad = this.addBuyPad(up.id, MAP.upgradePad, up.cost);
    }
    const w = WORKERS[this.nextWorker];
    if (w && !this.workPad && this.fedTotal >= (this.nextWorker ? 3 : 2)) {
      this.workPad = this.addBuyPad(w.id, w.at, w.cost);
    }
  }

  addBuyPad(id, [x, z], cost) {
    const p = new Pad(this.scene, { id, kind: id, x, z, need: { gold: cost } });
    p.show();
    this.pads.push(p);
    this.buyPads.push(p);
    sfx.tap();
    return p;
  }

  buy(pad) {
    const id = pad.def.id;
    const info = INFO[id];
    sfx.gateGood(true);
    const p = this.project(pad.def.x, 2.5, pad.def.z);
    this.hud.float(p.x, p.y, `${info.name}!`, 'good');
    this.fx.sparkle(pad.def.x, 0, pad.def.z, 0xffe9a0, 26);
    this.shake = Math.max(this.shake, 0.18);
    this.buyPads = this.buyPads.filter((b) => b !== pad);
    if (pad === this.upPad) {
      this.upPad = null;
      this.nextUpgrade++;
      for (const [k, v] of Object.entries(ARMY[id])) this.cap[k] = v;
      this.saidFull = false;
      const b = this.upBuild[id];
      b.visible = true;
      const sy = b.scale.y;
      this.tween(0.5, (k) => b.scale.set(b.scale.x, Math.max(0.01, easeOutBack(k)) * sy, b.scale.z));
      const [bx, bz] = MAP.buildings[id];
      this.fx.bigDust(bx, 0.3, bz, 12, 1.8, 0xd8c8a0);
      if (id === 'top') this.later(0.6, () => this.makeCannon());
      else this.later(0.6, () => this.hud.callout(TEXT.newSoldiers, 'gold small'));
    } else if (pad === this.workPad) {
      this.workPad = null;
      this.nextWorker++;
      const [x, z] = pad.def.id === 'avci' ? [MAP.avciPad[0], MAP.avciPad[1]] : [MAP.garsonPad[0], MAP.garsonPad[1]];
      this.workers[id] = { x, z, yaw: Math.PI, n: 0, pending: 0, t: 0, shootT: 0, spawn: 0, type: id === 'avci' ? 'meat' : 'bowl' };
      this.fx.bigDust(x, 0.2, z, 8, 1, 0xe0d0aa);
    }
  }

  makeCannon() {
    const [x, z] = MAP.buildings.top;
    const s = this.newMan('top', x + 1.5, z + 1.5);
    s.army = true;
    s.st = 'go';
    s.slot = this.takeSlot('top');
    this.cannonMan = s;
    this.cannon.visible = true;
    sfx.boom(false);
    this.fx.bigDust(s.x, 0.3, s.z, 10, 1.4, 0xd8c8a0);
  }

  /* ───────────────────────── battle ───────────────────────── */

  get currentOutpost() {
    return this.outposts.find((o) => !o.cleared);
  }

  canAttack() {
    return this.state === 'play' && !!this.currentOutpost && this.men.some((s) => s.army && s.kind !== 'top' && (s.st === 'rank' || s.st === 'go'));
  }

  // SALDIR: everyone standing in the ranks marches out and fights until the last man
  startBattle() {
    const op = this.currentOutpost;
    this.hud.callout(op.def.hq ? TEXT.attackHq : TEXT.attackOn(op.i + 1), 'red');
    sfx.charge();
    sfx.march();
    this.campaign = true;
    for (const s of this.men) if (s.army && (s.st === 'rank' || s.st === 'go')) Object.assign(s, { st: 'fight', walking: false, attacking: false, target: null });
  }

  // a point to walk to on the way to (tx, tz), going through the gap of the outpost wall
  waypoint(u, tx, tz, op) {
    const w = op?.def.wall;
    if (!w) return [tx, tz];
    const ourSide = u.z > w.z;
    const targetSide = tz > w.z;
    if (ourSide === targetSide) return [tx, tz];
    const gate = op.buildings.find((b) => b.kind === 'gate');
    if (gate && !gate.dead) return [tx, ourSide ? w.z + 1.6 : w.z - 1.6];
    const gx = clamp(u.x, -w.gap + 0.7, w.gap - 0.7);
    if (Math.abs(u.x - gx) > 0.3 || Math.abs(u.z - w.z) > 1.2) return [gx, ourSide ? w.z + 0.5 : w.z - 0.5];
    return [gx, targetSide ? w.z + 1.5 : w.z - 1.5];
  }

  // keep units from walking through a wall outside its gap
  wallClamp(u, op) {
    const w = op?.def.wall;
    if (!w || Math.abs(u.x) > w.len / 2) return;
    const gate = op.buildings.find((b) => b.kind === 'gate');
    const open = gate ? gate.dead : true;
    if (open && Math.abs(u.x) < w.gap) return;
    const side = u.prevZ > w.z ? 1 : -1;
    if (side > 0 && u.z < w.z + 0.9) u.z = w.z + 0.9;
    if (side < 0 && u.z > w.z - 0.9) u.z = w.z - 0.9;
  }

  // enemies that can fight right now (the headquarters garrison waits behind its gate)
  foesOf(op) {
    return this.enemies.filter((e) => !e.dead && e.op === op.i && !e.onTower && (!e.inside || this.gateDown(op)));
  }

  // the battle runs all the time, whether the player is watching or not
  updateBattle(dt) {
    if (this.state === 'won') return;
    const P = this.pasha;
    const ours = this.men.filter((s) => s.st === 'fight');
    const op = this.currentOutpost;
    let clashes = 0;
    if (op) {
      const foes = this.foesOf(op);
      const builds = op.buildings.filter((b) => !b.dead);
      for (const s of ours) {
        const st = UNITS[s.kind];
        s.prevZ = s.z;
        s.shotT -= dt;
        let t = null;
        let td = 1e9;
        const ranged = s.kind !== 'jan';
        if (s.kind === 'top') {
          const pri = { gate: 0, tower: 1, keep: 2, tent: 3 };
          for (const b of builds) {
            const d = dist(s.x, s.z, b.x, b.z) + pri[b.kind] * 6;
            if (d < td) {
              td = d;
              t = b;
            }
          }
        }
        if (!t)
          for (const e of foes) {
            const d = dist(s.x, s.z, e.x, e.z);
            if (d < td) {
              td = d;
              t = e;
            }
          }
        if (!t || (ranged && s.kind !== 'top' && td > st.range + 2)) {
          let bt = null;
          let bd = 1e9;
          for (const b of builds) {
            const d = dist(s.x, s.z, b.x, b.z) + (ranged && b.kind !== 'tower' ? 4 : 0);
            if (d < bd) {
              bd = d;
              bt = b;
            }
          }
          if (!t || (bt && bd < td)) {
            t = bt;
            td = bd;
          }
        }
        const gate = op.buildings.find((b) => b.kind === 'gate' && !b.dead);
        if (t && gate && t !== gate && t.z < op.def.wall.z && s.z > op.def.wall.z) t = gate;
        s.target = t;
        if (!t) {
          s.walking = false;
          s.attacking = false;
          continue;
        }
        // bows and muskets can't hurt a stone gate: they press up to it with the others
        const reach = t.kind === 'gate' && ranged && s.kind !== 'top' ? 3 + t.r : st.range + (t.r || 0.4);
        const d = dist(s.x, s.z, t.x, t.z);
        if (d > reach) {
          const [wx, wz] = s.kind === 'jan' || d > reach + 3 ? this.waypoint(s, t.x, t.z, op) : [t.x, t.z];
          const dx = wx - s.x;
          const dz = wz - s.z;
          const dd = Math.hypot(dx, dz) || 1;
          const sp = Math.min(dd, st.speed * dt);
          s.x += (dx / dd) * sp;
          s.z += (dz / dd) * sp;
          s.yaw = turn(s.yaw, yawFor(dx, dz), Math.min(1, dt * 10));
          s.walking = true;
          s.attacking = false;
          s.speed = st.speed;
          if (s.kind === 'top') this.rollCannonWheels(sp);
        } else {
          s.walking = false;
          s.attacking = true;
          s.yaw = turn(s.yaw, yawFor(t.x - s.x, t.z - s.z), Math.min(1, dt * 10));
          if (s.kind === 'jan') {
            this.damage(t, st.dps * dt, 'melee');
            clashes++;
          } else if (s.shotT <= 0) {
            s.shotT = st.shot;
            this.rangedShot(s, t, st.dps * st.shot);
          }
        }
        this.wallClamp(s, op);
      }
    }
    // every enemy that is not yet beaten defends itself: against our army and against the cook
    const playerOk = !P.dead;
    const targetsFor = (x, z) => {
      let t = null;
      let td = 1e9;
      for (const s of ours) {
        if (s.kind === 'top') continue;
        const d = dist(x, z, s.x, s.z);
        if (d < td) {
          td = d;
          t = s;
        }
      }
      if (playerOk) {
        const d = dist(x, z, P.x, P.z);
        if (d < td) {
          td = d;
          t = P;
        }
      }
      return [t, td];
    };
    const live = [];
    for (const o of this.outposts) {
      if (o.cleared) continue;
      for (const e of this.foesOf(o)) {
        e.prevZ = e.z;
        const [t, td] = targetsFor(e.x, e.z);
        // the outpost under attack fights with everything; the ones behind only guard their own ground
        const current = o === op;
        const aggro = t === P ? UNITS.enemy.aggroPlayer : current ? UNITS.enemy.aggro : 4.5;
        const leash = current ? 17 : 10;
        if (!e.active && t && td < aggro) e.active = true;
        if (e.active && (!t || td > 20 || dist(e.x, e.z, e.home[0], e.home[1]) > leash)) e.active = false;
        if (!e.active) continue;
        live.push(e);
        if (td > UNITS.enemy.range + 0.4) {
          const [wx, wz] = this.waypoint(e, t.x, t.z, o);
          const dx = wx - e.x;
          const dz = wz - e.z;
          const dd = Math.hypot(dx, dz) || 1;
          const sp = Math.min(dd, UNITS.enemy.speed * dt);
          e.x += (dx / dd) * sp;
          e.z += (dz / dd) * sp;
          e.yaw = turn(e.yaw, yawFor(dx, dz), Math.min(1, dt * 10));
          e.walking = true;
          e.attacking = false;
        } else {
          e.walking = false;
          e.attacking = true;
          e.yaw = turn(e.yaw, yawFor(t.x - e.x, t.z - e.z), Math.min(1, dt * 10));
          const dmg = UNITS.enemy.dps * e.power * dt;
          if (t === P) {
            this.hurtPlayer(dmg);
            if (Math.random() < dt * 3) sfx.sword();
          } else this.hurt(t, dmg);
        }
        this.wallClamp(e, o);
      }
      // archer towers shoot whoever comes in range
      for (const b of o.buildings) {
        if (b.dead || b.kind !== 'tower') continue;
        b.shotT -= dt;
        if (b.shotT > 0) continue;
        const [t, td] = targetsFor(b.x, b.z);
        if (!t || td > b.range) continue;
        b.shotT = 0.9;
        if (b.archer && !b.archer.dead) {
          b.archer.yaw = yawFor(t.x - b.x, t.z - b.z);
          b.archer.shootAnim = 0.6;
        }
        if (dist(b.x, b.z, P.x, P.z) < 22) sfx.arrow();
        this.fx.arrows.shoot(V(b.x, b.topY + 1.3, b.z), V(t.x, 1.2, t.z), 0.45, 0.6, () => {
          if (t === P) {
            if (!P.dead && dist(P.x, P.z, t.x, t.z) < 2.5) this.hurtPlayer(b.dps * 0.9);
          } else if (t.st === 'fight') this.hurt(t, b.dps * 0.9);
        });
      }
    }
    // separation
    const all = [...ours, ...live];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = a.kind === 'top' || b.kind === 'top' ? 1.6 : 0.85;
        if (d > 0.01 && d < min) {
          const push = (min - d) * 0.5;
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
        }
      }
    if (clashes && Math.random() < dt * Math.min(6, clashes * 1.2)) {
      const s = ours.filter((o) => o.attacking && o.kind === 'jan')[Math.floor(Math.random() * clashes)];
      if (s) {
        this.fx.clash(s.x - Math.sin(s.yaw) * 0.7, 1.4, s.z - Math.cos(s.yaw) * 0.7);
        if (dist(s.x, s.z, P.x, P.z) < 24) sfx.sword();
      }
    }
    // an outpost with no soldiers and no buildings left is ours
    if (op && !this.enemies.some((e) => !e.dead && e.op === op.i && !e.onTower) && !op.buildings.some((b) => !b.dead)) this.clearOutpost(op);
    // the army is gone: build a new one
    if (this.campaign && !ours.some((s) => s.kind !== 'top')) {
      this.campaign = false;
      this.hud.callout(TEXT.armyLost, 'red small');
      sfx.defeat();
      if (this.cannonMan && this.cannonMan.st === 'fight') this.cannonMan.st = 'go';
      this.saidFull = false;
    }
    this.regenerate(dt);
  }

  clearOutpost(op) {
    op.cleared = true;
    this.cleared++;
    if (op.def.hq) return this.finale();
    this.hud.callout(TEXT.victoryOutpost, 'gold');
    sfx.victory();
    for (const s of this.men) if (s.st === 'fight') s.cheer = 1.0;
  }

  // the enemy rebuilds what we broke and sends fresh soldiers out of its tents
  regenerate(dt) {
    const P = this.pasha;
    const someoneNear = (x, z, r) => (!P.dead && dist(P.x, P.z, x, z) < r - 2) || this.men.some((s) => s.st === 'fight' && dist(s.x, s.z, x, z) < r);
    for (const op of this.outposts) {
      if (op.cleared) continue;
      // soldiers
      op.regenT = (op.regenT ?? REGEN.soldier) - dt;
      if (op.regenT <= 0) {
        op.regenT = REGEN.soldier;
        const dead = this.enemies.find((e) => e.dead && e.gone && e.op === op.i && !e.onTower && !e.respawned);
        const tents = op.buildings.filter((b) => !b.dead && (b.kind === 'tent' || b.kind === 'keep'));
        if (dead && tents.length) {
          const from = tents[Math.floor(Math.random() * tents.length)];
          if (!someoneNear(from.x, from.z, 9)) {
            dead.respawned = true;
            const e = this.newEnemy(from.x, from.z + 1.2, op.i, { inside: dead.inside });
            e.home = dead.home;
            this.fx.poof(e.x, 0, e.z, C.enemyCoat);
          }
        }
      }
      // buildings
      for (const b of op.buildings) {
        if (!b.dead || b.kind === 'keep') continue;
        b.deadT = (b.deadT || 0) + dt;
        if (b.deadT < REGEN.building || someoneNear(b.x, b.z, 10)) continue;
        this.rebuild(b);
      }
    }
  }

  rebuild(b) {
    b.dead = false;
    b.deadT = 0;
    b.hp = b.max;
    const o = b.obj;
    o.visible = true;
    o.rotation.x = b.home.rx;
    o.rotation.z = b.home.rz;
    o.position.y = b.home.y;
    this.tween(0.6, (k) => (o.scale.y = b.home.sy * Math.max(0.02, easeOutBack(k))));
    this.fx.bigDust(b.x, 0.3, b.z, 8, 1.6, 0xbcae94);
    if (b.kind === 'tower') b.archer = this.newEnemy(b.x, b.z, b.op, { onTower: b, y: b.topY });
  }

  gateDown(op) {
    const g = op.buildings.find((b) => b.kind === 'gate');
    return !g || g.dead;
  }

  rangedShot(s, t, dmg) {
    const P = this.pasha;
    const heard = dist(s.x, s.z, P.x, P.z) < 26;
    const from = V(s.x - Math.sin(s.yaw) * 0.6, s.kind === 'top' ? 1.4 : 1.5, s.z - Math.cos(s.yaw) * 0.6);
    const to = V(t.x, t.kind ? 1.6 : 1.1, t.z);
    if (s.kind === 'azap') {
      if (heard) sfx.arrow();
      this.fx.arrows.shoot(from, to, 0.45, 1.0, () => this.damage(t, dmg, 'arrow'));
    } else if (s.kind === 'tuf') {
      if (heard) sfx.musket();
      this.fx.glow.emit(from.x, from.y, from.z, { color: 0xffd28a, size: 1.2, life: 0.1, grow: 2 });
      this.fx.smoke.emit(from.x, from.y, from.z, { vy: 0.8, color: 0xe8e2d6, size: 1.0, life: 0.8, grow: 2, alpha: 0.6 });
      this.later(0.12, () => this.damage(t, dmg, 'shot'));
    } else {
      // the cannon
      const c = this.cannon;
      this.tween(0.4, (k) => c.recoil?.(Math.sin(k * Math.PI)));
      const muzzle = V(s.x - Math.sin(s.yaw) * (c.muzzleFwd || 2), c.muzzleY || 1.4, s.z - Math.cos(s.yaw) * (c.muzzleFwd || 2));
      this.fx.glow.emit(muzzle.x, muzzle.y, muzzle.z, { color: 0xffd28a, size: 3, life: 0.2, grow: 2.5 });
      for (let i = 0; i < 8; i++)
        this.fx.smoke.emit(muzzle.x, muzzle.y, muzzle.z, { vx: rnd(-1.5, 1.5) - Math.sin(s.yaw) * 4, vy: rnd(0.5, 2), vz: rnd(-1.5, 1.5) - Math.cos(s.yaw) * 4, color: 0xd8d2c6, size: rnd(1, 1.6), life: rnd(0.8, 1.3), grow: 2, alpha: 0.5 });
      if (heard) {
        sfx.cannon();
        this.shake = Math.max(this.shake, 0.3);
      }
      this.fx.balls.shoot(muzzle, to, 0.7, 2.5, () => {
        this.fx.glow.emit(to.x, to.y, to.z, { color: 0xffb060, size: 4, life: 0.25, grow: 2 });
        this.fx.bigDust(to.x, 0.6, to.z, 10, 1.6, 0xbcae94);
        this.damage(t, dmg, 'cannon');
        for (const e of this.enemies) if (!e.dead && e !== t && !e.onTower && dist(e.x, e.z, to.x, to.z) < UNITS.top.splash) this.damage(e, dmg * 0.5, 'cannon');
      });
    }
  }

  damage(t, amount, how) {
    if (t.dead) return;
    if (t.kind) {
      // a building: soft walls shrug off anything but the cannon
      // (arrows and musket balls do nothing to a stone gate)
      const mult = how === 'cannon' ? 1 : how === 'melee' ? t.soft : t.kind === 'gate' ? 0 : t.soft * 0.6;
      t.hp -= amount * mult;
      if (Math.random() < 0.3) this.fx.debris.emit(t.x + rnd(-0.6, 0.6), rnd(0.5, 2), t.z + rnd(0, 1), { vx: rnd(-2, 2), vy: rnd(2, 4), vz: rnd(0, 3), color: t.kind === 'tent' ? 0xc8c0b0 : 0x8a7a64, sx: 0.2, sy: 0.2, sz: 0.2, life: 1 });
      if (t.hp <= 0) this.destroy(t);
      return;
    }
    t.hp -= amount;
    t.flash = 0.4;
    if (t.hp <= 0) {
      t.dead = true;
      t.dieT = 0;
      sfx.poof();
      this.dropCoins(t.x, t.z, LOOT.soldier);
    }
  }

  // akçe scattered on the ground where an enemy fell or a building came down
  dropCoins(x, z, n) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const r = rnd(0.3, 1.2);
      const c = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, t: -i * 0.08, ready: false };
      this.groundCoins.push(c);
      this.later(0.5 + i * 0.08, () => (c.ready = true));
    }
  }

  hurt(s, amount) {
    if (s.st === 'dead') return;
    s.hp -= amount;
    if (s.hp <= 0) {
      s.st = 'dead';
      s.t = 0;
      s.army = false;
      s.walking = s.attacking = false;
      sfx.poof();
    }
  }

  hurtPlayer(amount) {
    const P = this.pasha;
    if (P.dead || this.state !== 'play') return;
    P.hp -= amount;
    P.hurtT = 0;
    P.flash = 0.3;
    if (P.hp > 0) return;
    // the cook falls: everything he carried is lost, he wakes up back at the camp
    P.dead = true;
    P.respawnT = PLAYER.respawn;
    P.n = 0;
    P.pending = 0;
    P.type = null;
    this.fx.poof(P.x, 0, P.z, 0xf3ead6);
    this.hud.callout(TEXT.playerDown, 'red small');
    sfx.defeat();
  }

  destroy(b) {
    b.dead = true;
    b.deadT = 0;
    sfx.collapse();
    this.dropCoins(b.x, b.z + 1.2, LOOT[b.kind] || 2);
    if (dist(b.x, b.z, this.pasha.x, this.pasha.z) < 25) this.shake = Math.max(this.shake, b.kind === 'keep' ? 0.9 : 0.4);
    this.fx.bigDust(b.x, 1, b.z, b.kind === 'tent' ? 10 : 22, b.kind === 'tent' ? 1.6 : 3, 0xbcae94);
    for (let i = 0; i < (b.kind === 'tent' ? 6 : 18); i++)
      this.fx.debris.emit(b.x + rnd(-1, 1), rnd(1, 4), b.z + rnd(-1, 1), { vx: rnd(-5, 5), vy: rnd(3, 9), vz: rnd(-3, 5), color: b.kind === 'tent' ? 0xd8d0c0 : i % 2 ? 0x8a6a40 : 0xb2a690, sx: rnd(0.2, 0.5), sy: rnd(0.15, 0.4), sz: rnd(0.2, 0.5), life: 2 });
    if (b.archer && !b.archer.dead) {
      b.archer.dead = true;
      b.archer.dieT = 1.5;
      this.fx.poof(b.archer.x, b.archer.y, b.archer.z, C.enemyCoat);
    }
    const o = b.obj;
    if (b.kind === 'keep') {
      b.parts.forEach((p, i) => {
        p.falling = true;
        p.vy = rnd(1, 4) + i;
        p.vx = rnd(-2.5, 2.5);
        p.vz = rnd(1, 3.5);
        p.ax = rnd(-1.5, 1.5);
        p.az = rnd(-1.5, 1.5);
        p.delay = i * 0.08;
      });
      return;
    }
    const tip = rnd(-1, 1) > 0 ? 1 : -1;
    this.tween(0.9, (k) => {
      if (b.kind === 'tent') {
        // the tent folds up and sinks into the dust
        o.scale.y = b.home.sy * Math.max(0.02, 1 - k);
        o.rotation.z = b.home.rz + tip * k * 0.5;
      } else {
        o.rotation.z = b.home.rz + tip * k * k * 1.35;
        o.position.y = b.home.y - k * k * (b.kind === 'gate' ? 4.5 : 1.2);
      }
    }, () => b.dead && (o.visible = false));
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) {
        e.dieT += dt;
        continue;
      }
      if (e.onTower) {
        e.x = e.onTower.x;
        e.z = e.onTower.z;
        e.shootAnim = Math.max(0, (e.shootAnim || 0) - dt);
        continue;
      }
      // idle soldiers go back to their posts
      if (!e.active) {
        e.attacking = false;
        const [hx, hz] = e.home;
        const d = dist(e.x, e.z, hx, hz);
        e.walking = d > 0.1;
        if (e.walking) {
          const sp = Math.min(d, 3 * dt);
          e.x += ((hx - e.x) / d) * sp;
          e.z += ((hz - e.z) / d) * sp;
          e.yaw = turn(e.yaw, yawFor(hx - e.x, hz - e.z), Math.min(1, dt * 8));
        } else e.yaw = turn(e.yaw, Math.PI, Math.min(1, dt * 4));
      }
    }
    // the keep comes down in pieces
    for (const op of this.outposts)
      for (const b of op.buildings) {
        if (!b.parts) continue;
        for (const p of b.parts) {
          if (!p.falling || !p.m.visible) continue;
          if (p.delay > 0) {
            p.delay -= dt;
            continue;
          }
          p.vy -= 16 * dt;
          p.m.position.x += p.vx * dt;
          p.m.position.y += p.vy * dt;
          p.m.position.z += p.vz * dt;
          p.m.rotation.x += p.ax * dt;
          p.m.rotation.z += p.az * dt;
          if (p.m.position.y < -3) p.m.visible = false;
        }
      }
  }

  finale() {
    this.state = 'won';
    this.stateT = 0;
    this.hud.callout(TEXT.victory, 'gold mid');
    sfx.victory();
    this.shake = 0.9;
    for (const s of this.men) if (s.st === 'fight') s.cheer = 99;
    for (let i = 0; i < 5; i++)
      this.later(0.4 + i * 0.35, () => this.fx.firework(rnd(-6, 6), rnd(10, 16), -74 + rnd(-4, 4), [0xffd23f, 0xff5a3a, 0xffffff][i % 3]));
    this.later(4.2, () => {
      if (this.ended) return;
      this.ended = true;
      this.onEnd(true);
    });
  }

  rollCannonWheels(dist0) {
    const c = this.cannon;
    for (const w of c.wheels || []) w.rotation.x += (c.wheelSign || -1) * (dist0 / 0.6);
  }

  updateFlyers(dt) {
    this.flyers = this.flyers.filter((f) => {
      f.t += dt;
      if (f.t >= f.dur) {
        f.onArrive?.();
        return false;
      }
      return true;
    });
  }

  /* ───────────────────────── guidance ───────────────────────── */

  objective() {
    const P = this.pasha;
    if (this.state !== 'play' || P.dead) return null;
    const hungry = this.unservedSeated();
    if (P.type === 'bowl' && P.n + P.pending > 0 && !this.anyoneHungry()) return { tip: 'bowls', x: MAP.foodZone[0], z: MAP.foodZone[1] };
    if (P.type === 'bowl' && P.n + P.pending > 0) {
      const s = hungry[0] || this.seats.find((ss) => ss);
      return { tip: "serve", x: s ? s.x : MAP.counter[0], z: MAP.counter[1] + 1.1 };
    }
    const meatNeed = this.meatNeeded();
    if (P.type === 'meat' && P.n > 0 && (P.n + P.pending >= PLAYER.stackMax || meatNeed <= 0 || !this.nearestDeer(P.x, P.z, 99))) return { tip: 'meat', x: MAP.meatZone[0], z: MAP.meatZone[1] };
    if (!this.workers.garson && this.food > 0 && hungry.length && P.n === 0) return { tip: 'bowls', x: MAP.foodZone[0], z: MAP.foodZone[1] };
    // a plot we can afford (counting the akçe on the pile)
    const pad = this.buyPads.filter((b) => !b.done).sort((a, b) => a.total - a.paid - (b.total - b.paid))[0];
    if (pad && P.n === 0) {
      const left = pad.total - pad.paid - (pad.inbound || 0);
      if (P.gold >= left) return { tip: 'pay', x: pad.def.x, z: pad.def.z, pad };
      if (P.gold + this.coins + this.coinsIn >= left && this.coins > 0) return { tip: 'coins', x: MAP.coinZone[0], z: MAP.coinZone[1] };
    }
    const hqWait = this.currentOutpost?.def.hq && !this.cannonMan && this.nextUpgrade < UPGRADES.length;
    if (this.armyFull && this.currentOutpost && P.n === 0 && this.coins < 4 && !hqWait) return { tip: 'attack', x: MAP.attackPad[0], z: MAP.attackPad[1] };
    if (this.coins >= 6 && P.n === 0) return { tip: 'coins', x: MAP.coinZone[0], z: MAP.coinZone[1] };
    // akçe left on the battlefield (only once the fighting there has moved on, or close by)
    const loot = this.groundCoins.filter((c) => c.ready).sort((a, b) => dist(a.x, a.z, P.x, P.z) - dist(b.x, b.z, P.x, P.z))[0];
    if (loot && P.n === 0 && P.hp > PLAYER.hp * 0.5 && !this.dangerAt(loot.x, loot.z)) return { tip: 'loot', x: loot.x, z: loot.z };
    if (meatNeed > 0 && !(this.workers.avci && P.type !== 'meat')) {
      const m = this.meats.filter((mm) => mm.ready).sort((a, b) => dist(a.x, a.z, P.x, P.z) - dist(b.x, b.z, P.x, P.z))[0];
      if (m) return { tip: 'hunt', x: m.x, z: m.z };
      const d = this.nearestDeer(P.x, P.z, 99);
      if (d) return { tip: 'hunt', x: d.x, z: d.z, deer: true };
    }
    if (P.type === 'meat' && P.n > 0) return { tip: 'meat', x: MAP.meatZone[0], z: MAP.meatZone[1] };
    if (this.coins > 0) return { tip: 'coins', x: MAP.coinZone[0], z: MAP.coinZone[1] };
    if (this.currentOutpost && this.men.some((s) => s.army && s.kind !== 'top')) return { tip: 'attack', x: MAP.attackPad[0], z: MAP.attackPad[1] };
    return null;
  }

  // is an active enemy soldier or a standing tower close to (x, z)?
  dangerAt(x, z) {
    for (const e of this.enemies) if (!e.dead && !e.onTower && (e.active || !e.inside) && dist(e.x, e.z, x, z) < 6) return true;
    for (const op of this.outposts) if (!op.cleared) for (const b of op.buildings) if (!b.dead && b.kind === 'tower' && dist(b.x, b.z, x, z) < 10) return true;
    return false;
  }

  updateGuide() {
    const o = this.objective();
    this.obj = o;
    if (o) this.guide.set(o.x, o.z);
    else this.guide.set(null);
  }

  /* ───────────────────────── render ───────────────────────── */

  draw(dt) {
    const B = this.batches;
    const P = this.pasha;
    const won = this.state === 'won';
    B.cook.begin();
    if (this.cookUnit && P.dead) this.cookUnit.hide(0);
    else if (this.cookUnit) this.cookUnit.update(0, P.x, 0, P.z, P.yaw, P.moving && this.state === 'play' ? (P.n ? 'Carry' : 'Walk') : 'Idle', dt, { speed: P.moving ? 1.9 : 1 });
    else B.cook.push(P.x, 0, P.z, P.yaw, (P.ph = (P.ph || 0) + dt * 11), P.moving ? (P.n ? 6 : 0) : 2);
    const G = this.workers.garson;
    if (G) B.cook.push(G.x, 0, G.z, G.yaw, G.ph || 0, G.moving ? (G.n ? 6 : 0) : 2, 0.95);
    B.cook.end();
    B.hamal.begin();
    const H = this.workers.avci;
    if (H) B.hamal.push(H.x, 0, H.z, H.yaw, H.ph || 0, H.moving ? (H.n ? 6 : 0) : 2);
    B.hamal.end();

    // our soldiers
    B.jan.begin();
    for (const s of this.men) {
      if (s.kind === 'top') continue;
      let anim = 'Idle';
      if (s.st === 'dead') anim = 'Die';
      else if (s.walking) anim = 'Walk';
      else if (s.attacking || s.cheer > 0 || won) anim = 'Attack';
      const sit = s.sitting || s.st === 'eat';
      const hold = s.st === 'eat';
      const c = this.crowds[s.kind];
      if (c && s.u >= 0) c.update(s.u, s.x, 0, s.z, s.yaw, anim, dt, { speed: anim === 'Walk' ? (s.speed || 3.8) / 2.6 : 1, sit, hold });
      else if (s.st !== 'dead') B.jan.push(s.x, sit ? -SIT_DROP : 0, s.z, s.yaw, (s.ph += dt * 8), anim === 'Walk' ? 0 : anim === 'Attack' ? 3 : sit ? 4 : 2);
    }
    B.jan.end();
    // our cannon
    const cm = this.cannonMan;
    if (cm) {
      this.cannon.visible = cm.st !== 'dead';
      if (cm.st !== 'fight' && cm.walking) this.rollCannonWheels(Math.min(1, dt * 4));
      this.cannon.position.set(cm.x, 0, cm.z);
      this.cannon.rotation.y = cm.yaw;
    }

    // enemies
    B.enemy.begin();
    const EC = this.crowds.enemy;
    for (const e of this.enemies) {
      if (e.dead && e.dieT > 1.6) {
        if (!e.gone) {
          e.gone = true;
          this.fx.poof(e.x, e.y, e.z, C.enemyCoat);
          this.release('enemy', e.u);
        }
        continue;
      }
      const anim = e.dead ? 'Die' : e.walking ? 'Walk' : e.attacking || e.shootAnim > 0 ? 'Attack' : 'Idle';
      if (EC && e.u >= 0) EC.update(e.u, e.x, e.y, e.z, e.yaw, anim, dt, { speed: anim === 'Walk' ? 1.6 : 1 });
      else if (!e.dead) B.enemy.push(e.x, e.y, e.z, e.yaw, (e.ph += dt * 8), anim === 'Walk' ? 0 : anim === 'Attack' ? 3 : 2);
    }
    B.enemy.end();

    // deer
    const DC = this.crowds.deer;
    for (const d of this.deer) {
      if (d.st === 'gone' || !DC || d.u < 0) continue;
      const anim = d.st === 'dead' ? 'Die' : d.moving ? (d.st === 'flee' ? 'Run' : 'Walk') : 'Idle';
      DC.update(d.u, d.x, d.st === 'dead' ? -Math.max(0, d.fade - 1.0) * 1.2 : 0, d.z, d.yaw, anim, dt, { speed: anim === 'Run' ? 1.2 : 1 });
    }

    // items: food pile, coin pile, meat on the ground, loads on backs, flyers
    const I = this.items;
    I.begin();
    for (let i = 0; i < this.food; i++) {
      const p = this.foodSlot(i);
      I.put('bowl', p.x, p.y, p.z, i);
    }
    for (let i = 0; i < this.coins; i++) {
      const p = this.coinSlot(i);
      I.put('coin', p.x, p.y, p.z, i * 0.7);
    }
    for (const c of this.groundCoins) {
      c.t += dt;
      const k = Math.min(1, Math.max(0, c.t) * 3);
      I.put('coin', c.x, 0.12 + Math.abs(Math.sin(c.t * 3 + c.x)) * 0.1, c.z, this.time * 3 + c.x, easeOutBack(k) * 1.3, Math.PI / 2);
    }
    for (const m of this.meats) {
      const s = Math.min(1, m.t * 4);
      I.put('meat', m.x, 0.18 + Math.max(0, Math.sin(m.t * 3)) * 0.12, m.z, this.time * 1.5 + m.x, easeOutBack(s));
    }
    const back = (c, n, type, base) => {
      for (let i = 0; i < n; i++) {
        const p = this.backTop(c, i, type, base);
        const sway = Math.sin(this.time * 7 + i * 0.4) * (c.moving ? 1 : 0.25) * i * 0.04;
        I.put(type, p.x + Math.cos(c.yaw) * sway, p.y - 0.16, p.z - Math.sin(c.yaw) * sway, c.yaw + (type === 'meat' ? Math.PI / 2 : 0) + i * 0.3);
      }
    };
    if (P.type) back(P, P.n, P.type, 1.0);
    if (H) back(H, H.n, 'meat', 1.2);
    if (G) back(G, G.n, 'bowl', 1.0);
    for (const s of this.men) {
      if (!s.hasBowl) continue;
      const p = this.handPos(s);
      const lift = Math.max(0, 1 - s.t / KITCHEN.eat) * 0.3;
      I.put('bowl', p.x, p.y + lift, p.z, s.yaw, 1, -lift);
    }
    for (const f of this.flyers) {
      const k = Math.min(1, f.t / f.dur);
      const to = f.toFn();
      I.put(f.type, lerp(f.from.x, to.x, k), lerp(f.from.y, to.y, k) + Math.sin(k * Math.PI) * f.arc, lerp(f.from.z, to.z, k), k * 3, 1, f.type === 'coin' ? Math.PI / 2 : 0);
    }
    I.end();
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h * 0.9);
  }

  updateCamera(dt) {
    const aspect = this.width / this.height;
    const t = clamp((aspect - 0.6) / 0.9, 0, 1);
    const fov = lerp(50, 40, t);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const P = this.pasha;
    const iso = (x, z, h, d) => [V(x + d * 0.26, h, z + d * 0.97), V(x, 0, z)];
    let pos;
    let look;
    if (this.state === 'battle') {
      // follow the fight
      // follow the fight: our men and the enemies that are fighting them
      const op = this.battle.op;
      const pts = this.men.filter((s) => s.st === 'fight').map((s) => [s.x, s.z]);
      for (const e of this.enemies) if (!e.dead && e.op === op.i && e.active) pts.push([e.x, e.z]);
      let cx = 0;
      let cz = op.def.z + 6;
      if (pts.length) {
        cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      }
      cz = lerp(cz, op.def.z, 0.25);
      [pos, look] = iso(cx * 0.6, cz + 1.5, lerp(23, 18, t), lerp(18, 15, t));
    } else if (this.state === 'won') {
      [pos, look] = iso(0, -60, lerp(48, 34, t), lerp(36, 28, t));
    } else {
      const cx = lerp(P.x, 3, 0.25);
      const cz = lerp(P.z, -2, 0.25);
      [pos, look] = iso(cx, cz - t * 1.5, lerp(19, 20, t), lerp(15.5, 15, t));
    }
    const kk = this.snapCam ? 1 : Math.min(1, dt * (this.state === 'play' ? 4 : 1.8));
    this.snapCam = false;
    this.camPos.lerp(pos, kk);
    this.camLook.lerp(look, kk);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake;
    this.camera.position.set(this.camPos.x + rnd(-1, 1) * sh, this.camPos.y + rnd(-1, 1) * sh, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  updateHud() {
    const P = this.pasha;
    const playing = this.state === 'play';
    this.hud.quest(this.state === 'won' ? null : this.questInfo());
    const tp = this.project(P.x, 1.0 + P.n * 0.3 + 0.9, P.z);
    this.hud.stackCount(playing && !P.dead ? P.n : 0, PLAYER.stackMax, tp.x, tp.y);
    const hp = this.project(P.x, 2.9, P.z);
    this.hud.playerHp(playing && !P.dead && P.hp < PLAYER.hp - 0.05, P.hp / PLAYER.hp, hp.x, hp.y);
    if (playing && !this.moved) {
      const a = this.project(P.x, 0.2, P.z);
      const d = this.deer[0];
      const b = this.project(d.x, 0.2, d.z);
      this.hud.dragHint(this.time > 0.6, a.x, a.y + 40, b.x, b.y + 40);
    } else this.hud.dragHint(false);
    const cards = [];
    if (playing)
      for (const pad of this.buyPads) {
        if (pad.done) continue;
        const q = this.project(pad.def.x, 2.4, pad.def.z);
        if (!q.vis) continue;
        const info = INFO[pad.def.id];
        cards.push({ id: pad.def.id, x: q.x, y: q.y, name: info.name, desc: info.desc, k: pad.paid / pad.total, main: true });
      }
    this.hud.cards(cards);
    this.hud.fireButton(false);
    this.hud.army(
      this.state === 'won'
        ? null
        : KINDS.filter((k) => this.cap[k] > 0).map((k) => ({ kind: k, n: this.count(k, true), max: this.cap[k] })),
    );
    if (playing && this.obj) {
      const v = this._v.set(this.obj.x, 0.5, this.obj.z).project(this.camera);
      const off = v.z > 1 || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.86;
      let dx = v.x;
      let dy = -v.y;
      if (v.z > 1) {
        dx = -dx;
        dy = -dy;
      }
      this.hud.pointer(off, dx, dy);
    } else this.hud.pointer(false);
  }

  questInfo() {
    const op = this.currentOutpost;
    if (this.state === 'battle') return { step: '⚔', title: this.battle.op.def.name, sub: 'Savaş sürüyor!', icon: 'battle', k: 1 };
    const o = this.obj;
    const tip = o ? TEXT.tips[o.tip] || '' : '';
    let army = 0;
    let cap = 0;
    for (const k of KINDS) {
      army += this.count(k, true);
      cap += this.cap[k];
    }
    if (o?.tip === 'pay' || (o?.tip === 'coins' && this.buyPads.length)) {
      const pad = o.pad || this.buyPads[0];
      return { step: `${pad.paid}/${pad.total}`, title: INFO[pad.def.id].quest, sub: tip, icon: 'gold', k: pad.paid / pad.total };
    }
    if (o?.tip === 'attack' && op) return { step: '⚔', title: op.def.hq ? TEXT.attackHq : TEXT.attackOn(op.i + 1), sub: tip, icon: 'battle', k: 1 };
    return { step: `${army}/${cap}`, title: TEXT.feed, sub: tip, icon: 'bowl', k: cap ? army / cap : 0 };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
