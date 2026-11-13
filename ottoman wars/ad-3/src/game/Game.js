import * as THREE from '../vendor/three.module.min.js';
import { AD, BATTLE_READY, COLORS as C, INFO, MAP, PADS, PLAYER, PRODUCE, RAID, TEXT } from '../config.js';
import { Environment } from '../world/Environment.js';
import { MODELS } from '../world/Models.js';
import { UnitBatch } from '../world/UnitBatch.js';
import { Guide, Items, Pad } from '../world/Props.js';
import { cannon, gatehouse, ghostOf, house, quarry, scaffold, tent, tower, townHall, tree, wallSegment, woodHut } from '../world/Town.js';
import { Fx } from '../fx/Fx.js';
import { sfx } from '../audio/Sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + (b - a) * Math.random();
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
const easeOutBack = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

const H = MAP.half;
const WALL_Z = -H;
const PILES = { wood: MAP.wood.pile, stone: MAP.quarry.pile };
const TOWER_H = 6.2;

export class Game {
  constructor(renderer, hud, { onEnd }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
    this.env = new Environment(this.scene);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
    this.batches = {
      pasha: new UnitBatch(this.scene, MODELS.pasha(), 1, mat, { scale: 1.1 }),
      worker: new UnitBatch(this.scene, MODELS.worker(), 8, mat),
      crew: new UnitBatch(this.scene, MODELS.crew(), 6, mat),
      sage: new UnitBatch(this.scene, MODELS.sage(), 1, mat, { scale: 1.05 }),
      enemy: new UnitBatch(this.scene, MODELS.enemy(), 70, mat),
      archer: new UnitBatch(this.scene, MODELS.archer(), 6, mat),
    };
    this.items = new Items(this.scene);
    this.fx = new Fx(this.scene);
    this.guide = new Guide(this.scene);
    this._v = new THREE.Vector3();
    this.width = 1;
    this.height = 1;
    this.camPos = new THREE.Vector3(30, 50, 50);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.buildTown();
    this.reset();
  }

  /* ───────────────────────── town ───────────────────────── */

  buildTown() {
    const S = this.scene;
    const put = (o, x, z, ry = 0) => {
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      S.add(o);
      return o;
    };
    put(townHall(), MAP.hall[0], MAP.hall[1]);
    put(woodHut(), MAP.wood.hut[0], MAP.wood.hut[1], 0.5);
    for (const [x, z, s] of [[-13.2, 12.8, 1.0], [-9.2, 8.8, 0.9], [-13.4, 7.0, 1.1], [-11.0, 13.6, 0.85]]) put(tree(s), x, z, x);
    put(quarry(), MAP.quarry.rock[0], MAP.quarry.rock[1], 0.6);
    this.gate = put(gatehouse(), 0, WALL_Z);
    // wall circuit: palisade now, stone later
    const gl = H - MAP.gateHalf;
    const segs = [
      [-(MAP.gateHalf + gl / 2), WALL_Z, 0, gl],
      [MAP.gateHalf + gl / 2, WALL_Z, 0, gl],
      [0, H, 0, H * 2],
      [-H, 0, Math.PI / 2, H * 2],
      [H, 0, Math.PI / 2, H * 2],
    ];
    this.palisade = new THREE.Group();
    this.stoneWalls = new THREE.Group();
    for (const [x, z, ry, len] of segs) {
      const p = wallSegment(len, 'palisade');
      p.position.set(x, 0, z);
      p.rotation.y = ry;
      this.palisade.add(p);
      const s = wallSegment(len, 'stone');
      s.position.set(x, 0, z);
      s.rotation.y = ry;
      this.stoneWalls.add(s);
    }
    S.add(this.palisade);
    S.add(this.stoneWalls);
    for (const [x, z] of [[-H, -H], [H, -H], [-H, H], [H, H]]) put(tower(5.2), x, z);

    // plots: building + translucent preview + scaffolding
    this.plots = {};
    for (const def of PADS) {
      let obj;
      let sc;
      let [x, z] = [def.x, def.z];
      if (def.kind === 'house') {
        obj = house(def.x > 0 ? 1 : 0);
        sc = scaffold(4.0, 3.8, 3.4);
      } else if (def.kind === 'tower') {
        obj = tower(TOWER_H);
        [x, z] = def.at;
        sc = scaffold(3.6, 7.8, 3.6);
      } else if (def.kind === 'cannon') {
        obj = cannon();
        sc = scaffold(3.6, 2.4, 3.6);
      } else if (def.kind === 'woodUp' || def.kind === 'quarryUp') {
        obj = tent();
        sc = scaffold(3.4, 3.4, 3.4);
      } else if (def.kind === 'stoneWalls') {
        obj = this.stoneWalls;
      }
      if (obj !== this.stoneWalls) put(obj, x, z);
      const ghost = ghostOf(obj);
      ghost.position.copy(obj.position);
      ghost.rotation.copy(obj.rotation);
      S.add(ghost);
      if (sc) {
        sc.position.set(x, 0, z);
        S.add(sc);
      }
      this.plots[def.id] = { def, obj, ghost, sc, x, z, h: def.kind === 'tower' ? TOWER_H + 4 : def.kind === 'cannon' ? 2.6 : def.kind === 'stoneWalls' ? 5 : 4 };
    }
  }

  /* ───────────────────────── setup ───────────────────────── */

  reset() {
    this.time = 0;
    this.playT = 0;
    this.state = 'intro';
    this.stateT = 0;
    this.ended = false;
    this.moved = false;
    this.tweens = [];
    this.flyers = [];
    this.pasha = { x: MAP.start[0], z: MAP.start[1], yaw: 0.8, ph: 0, moving: false, stack: [], pending: 0, pickT: 0, dropT: 0, gold: 0 };
    this.input = { x: 0, z: 0 };
    this.piles = { wood: 3, stone: 2 };
    this.cutters = [{ kind: 'wood', x: MAP.wood.workers[0][0], z: MAP.wood.workers[0][1], yaw: -0.6, ph: 0, t: 1.2, spawn: 1 }];
    this.masons = [{ kind: 'stone', x: MAP.quarry.workers[0][0], z: MAP.quarry.workers[0][1], yaw: 2.6, ph: 1, t: 1.6, spawn: 1 }];
    this.houses = [];
    this.crew = [];
    this.archers = [];
    this.enemies = [];
    this.raidQueued = false;
    this.scoutsSent = false;
    this.sageSay = null;
    this.wallMax = RAID.wallHp;
    this.wallHp = RAID.wallHp;
    this.built = {};
    for (const p of this.pads || []) this.scene.remove(p.plane);
    this.pads = PADS.map((def) => new Pad(this.scene, def));
    for (const pl of Object.values(this.plots)) {
      pl.obj.visible = false;
      pl.obj.scale.set(1, 1, 1);
      pl.ghost.visible = false;
      if (pl.sc) pl.sc.visible = false;
      pl.started = false;
    }
    this.palisade.visible = true;
    this.gate.visible = true;
    this.battle = { active: false, done: false, hold: 0, pad: this.battle?.pad };
    if (!this.battle.pad) this.battle.pad = new Pad(this.scene, { id: 'battle', kind: 'battle', x: MAP.battle[0], z: MAP.battle[1], need: {} });
    this.battle.pad.plane.visible = false;
    this.battle.pad.active = false;
    this.battle.pad.done = false;
    this.hud.reset();
    this.hud.coins(0);
    this.hud.showTitle(true);
    this.hud.showHand(false);
    this.hud.showCta(false);
    this.camPos.set(26, 44, 40);
    this.camLook.set(0, 0, 0);
    this.shake = 0;
    this.guide.set(null);
    this.activatePads();
  }

  activatePads() {
    for (const p of this.pads) {
      if (p.active || p.done) continue;
      if (!p.def.after || p.def.after.every((id) => this.built[id])) {
        p.show();
        this.plots[p.def.id].ghost.visible = true;
        if (this.state === 'play') sfx.tap();
      }
    }
    if (!this.battle.active && BATTLE_READY.every((id) => this.built[id]) && this.state === 'play') {
      this.battle.active = true;
      this.battle.pad.show();
    }
  }

  get activePads() {
    return this.pads.filter((p) => p.active && !p.done);
  }

  get currentPad() {
    return this.activePads[0];
  }

  /* ───────────────────────── input ───────────────────────── */

  // joystick in screen space → world direction relative to the camera
  setInput(sx, sy) {
    const fx = this.camLook.x - this.camPos.x;
    const fz = this.camLook.z - this.camPos.z;
    const fl = Math.hypot(fx, fz) || 1;
    const f = [fx / fl, fz / fl];
    const r = [-f[1], f[0]];
    this.input.x = r[0] * sx - f[0] * sy;
    this.input.z = r[1] * sx - f[1] * sy;
    if (sx || sy) {
      if (this.state === 'ready') this.begin();
      this.moved = true;
    }
  }

  press() {
    sfx.unlock();
    if (this.state === 'ready') this.begin();
  }

  begin() {
    this.state = 'play';
    this.stateT = 0;
    this.hud.showTitle(false);
    this.hud.showCta(true);
  }

  /* ───────────────────────── helpers ───────────────────────── */

  tween(time, fn, done) {
    this.tweens.push({ t: 0, time, fn, done });
  }

  project(x, y, z) {
    const v = this._v.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, vis: v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1 };
  }

  stackTop(c) {
    let h = 1.25;
    for (const t of c.stack) h += this.items.h[t] + 0.02;
    return new THREE.Vector3(c.x + Math.sin(c.yaw) * 0.42, h, c.z + Math.cos(c.yaw) * 0.42);
  }

  pilePos(type, i, base) {
    const [px, pz] = base || PILES[type];
    const per = type === 'gold' ? 4 : 6;
    const cols = type === 'gold' ? 2 : 3;
    const layer = Math.floor(i / per);
    const k = i % per;
    const rows = per / cols;
    const x = px + ((k % cols) - (cols - 1) / 2) * (type === 'gold' ? 0.5 : 0.62);
    const z = pz + (Math.floor(k / cols) - (rows - 1) / 2) * (type === 'gold' ? 0.32 : 0.5);
    return new THREE.Vector3(x, 0.12 + layer * (this.items.h[type] + 0.02), z);
  }

  fly(type, from, toFn, dur, onArrive) {
    this.flyers.push({ type, from: from.clone(), toFn, t: 0, dur, onArrive });
  }

  /* ───────────────────────── building ───────────────────────── */

  // the plot grows with every delivery: scaffolding + the building rising
  progress(pad) {
    const pl = this.plots[pad.def.id];
    const k = pad.paid / pad.total;
    if (!pl.started) {
      pl.started = true;
      pl.obj.visible = true;
      if (pl.sc) pl.sc.visible = true;
      if (pad.def.kind === 'stoneWalls') this.stoneWalls.children.forEach((s) => (s.scale.y = 0.02));
    }
    if (pad.def.kind === 'stoneWalls') this.stoneWalls.children.forEach((s) => (s.scale.y = Math.max(0.02, k * 0.98)));
    else pl.obj.scale.y = Math.max(0.03, k * 0.92);
    pl.ghost.ghostMat.opacity = 0.28 * (1 - k) + 0.05;
    // a puff of dust & a hammer tap where the work happens
    this.fx.bigDust(pl.x + rnd(-1, 1), 0.3, pl.z + rnd(-1, 1), 1, 0.6, 0xd8c8a0);
  }

  build(pad) {
    const def = pad.def;
    const id = def.id;
    const pl = this.plots[id];
    this.built[id] = true;
    sfx.gateGood(true);
    const info = INFO[def.kind];
    const p = this.project(pl.x, pl.h, pl.z);
    this.hud.float(p.x, p.y, `${info.name}!`, 'good');
    this.fx.sparkle(pl.x, 0, pl.z, 0xffe9a0, 30);
    this.fx.bigDust(pl.x, 0.2, pl.z, 12, 2.2, 0xe0d0aa);
    this.shake = Math.max(this.shake, 0.22);
    pl.ghost.visible = false;
    if (pl.sc) pl.sc.visible = false;
    const pop = (o) => {
      o.visible = true;
      this.tween(0.5, (k) => o.scale.set(1 + (1 - k) * 0.1, Math.max(0.03, easeOutBack(k)), 1 + (1 - k) * 0.1));
    };
    switch (def.kind) {
      case 'house':
        pop(pl.obj);
        this.houses.push({ id, x: pl.x + 1.9, z: pl.z + 1.9, coins: 0, t: 1.0 });
        break;
      case 'tower':
        pop(pl.obj);
        for (const dx of [-0.6, 0.6]) this.archers.push({ x: pl.x + dx, y: TOWER_H + 0.42, z: pl.z - 0.35, ph: rnd(0, 6), t: rnd(0.2, RAID.arrowEvery), spawn: 0 });
        break;
      case 'cannon':
        pop(pl.obj);
        pl.obj.t = rnd(0.3, 1.2);
        this.crew.push({ x: pl.x - 1.9, z: pl.z + 0.6, yaw: Math.PI * 0.5, ph: 0 });
        this.crew.push({ x: pl.x + 1.9, z: pl.z + 1.2, yaw: -Math.PI * 0.6, ph: 1 });
        break;
      case 'woodUp':
        pop(pl.obj);
        this.cutters.push({ kind: 'wood', x: MAP.wood.workers[1][0], z: MAP.wood.workers[1][1], yaw: 0.6, ph: 0, t: 1, spawn: 0 });
        break;
      case 'quarryUp':
        pop(pl.obj);
        this.masons.push({ kind: 'stone', x: MAP.quarry.workers[1][0], z: MAP.quarry.workers[1][1], yaw: -2.6, ph: 0, t: 1, spawn: 0 });
        break;
      case 'stoneWalls':
        this.palisade.visible = false;
        this.stoneWalls.children.forEach((s) => {
          s.scale.y = 1;
          this.fx.bigDust(s.position.x, 1.5, s.position.z, 10, 6, 0xe0d0aa);
        });
        this.wallMax = RAID.wallHpStone;
        this.wallHp = RAID.wallHpStone;
        break;
      default:
    }
    this.tween(0.45, () => {}, () => this.activatePads());
    if (id === 'towerL' && !this.scoutsSent) {
      this.scoutsSent = true;
      this.tween(3, () => {}, () => this.spawnScouts());
    }
  }

  /* ───────────────────────── update ───────────────────────── */

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.stateT += dt;
    this.tweens = this.tweens.filter((tw) => {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.time);
      tw.fn?.(k);
      if (k >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });
    const st = this.state;
    if (st === 'intro' && this.stateT > 1.6) {
      this.state = 'ready';
      this.stateT = 0;
    }
    if (st === 'ready') {
      this.hud.showHand(true);
      if (this.stateT > 5) this.begin();
    } else this.hud.showHand(st === 'play' && !this.moved && this.stateT > 0.2);

    const live = st === 'play' || st === 'raid' || st === 'raidIntro';
    if (live) this.playT += dt;
    this.produce(dt);
    if (live) {
      this.movePasha(dt);
      this.handleStations(dt);
    }
    if (st === 'play') {
      if (this.playT > AD.attackAt && !this.raidQueued) this.queueRaid(0.1);
      this.handleBattle(dt);
    }
    if (st === 'raidIntro' && this.stateT > 2.4) {
      this.state = 'raid';
      this.stateT = 0;
    }
    this.updateCombat(dt);
    this.updateFlyers(dt);
    this.updateGuide();
    for (const p of this.pads) p.update(this.time, dt);
    this.battle.pad.update(this.time, dt);
    this.guide.update(this.time);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.env.update(this.time, this.camPos.x, this.camPos.z);
    this.env.follow(this.camLook.x, this.camLook.z);
    this.draw(dt);
    this.updateHud();
  }

  produce(dt) {
    // woodcutters & stonecutters: each finished piece is carried to its pile
    const work = (list, type, every) => {
      for (const w of list) {
        w.t -= dt;
        if (w.t > 0) continue;
        w.t = every * rnd(0.9, 1.1);
        if (this.piles[type] + (w.carrying ? 1 : 0) >= PRODUCE.pileMax) continue;
        const from = new THREE.Vector3(w.x - Math.sin(w.yaw) * 0.7, 0.6, w.z - Math.cos(w.yaw) * 0.7);
        this.fx.bigDust(from.x, 0.2, from.z, 2, 0.4, type === 'stone' ? 0xd8ccb0 : 0xb08a5a);
        w.carrying = true;
        const idx = this.piles[type] + (this.incoming?.[type] || 0);
        this.incoming = this.incoming || { wood: 0, stone: 0 };
        this.incoming[type]++;
        this.fly(type, from, () => this.pilePos(type, idx), 0.55, () => {
          w.carrying = false;
          this.incoming[type]--;
          this.piles[type] = Math.min(PRODUCE.pileMax, this.piles[type] + 1);
        });
        sfx.wood();
      }
    };
    work(this.cutters, 'wood', PRODUCE.woodEvery);
    work(this.masons, 'stone', PRODUCE.stoneEvery);
    // houses pay taxes into a little stack of akçe by their door
    for (const h of this.houses) {
      h.t -= dt;
      if (h.t > 0) continue;
      h.t = PRODUCE.taxEvery;
      if (h.coins >= PRODUCE.taxMax) continue;
      h.coins = Math.min(PRODUCE.taxMax, h.coins + PRODUCE.taxAmount);
      const p = this.project(h.x, 1.6, h.z);
      if (p.vis && this.state === 'play') this.hud.float(p.x, p.y, `+${PRODUCE.taxAmount}`, 'coin');
      this.fx.sparkle(h.x, 0, h.z, 0xffe08a, 4);
    }
  }

  movePasha(dt) {
    const P = this.pasha;
    const ix = this.input.x;
    const iz = this.input.z;
    const m = Math.hypot(ix, iz);
    P.moving = m > 0.05 && this.state !== 'win' && this.state !== 'lose';
    if (P.moving) {
      const sp = PLAYER.speed * Math.min(1, m) * dt;
      P.x += (ix / m) * sp;
      P.z += (iz / m) * sp;
      const yaw = yawFor(ix, iz);
      const d = Math.atan2(Math.sin(yaw - P.yaw), Math.cos(yaw - P.yaw));
      P.yaw += d * Math.min(1, dt * 14);
      P.ph += dt * 11;
    }
    // inside the walls, around the buildings
    P.x = clamp(P.x, -H + 1.4, H - 1.4);
    P.z = clamp(P.z, -H + 1.6, H - 1.4);
    const solids = [
      { x: MAP.hall[0], z: MAP.hall[1], w: 4.4, d: 3.4 },
      { x: MAP.wood.hut[0], z: MAP.wood.hut[1], w: 1.7, d: 1.5 },
      { x: MAP.quarry.rock[0], z: MAP.quarry.rock[1] - 0.4, w: 2.4, d: 1.8 },
    ];
    for (const id of ['house1', 'house2', 'house3']) if (this.built[id]) solids.push({ x: this.plots[id].x, z: this.plots[id].z, w: 2.0, d: 1.7 });
    for (const id of ['cannonL', 'cannonR']) if (this.built[id]) solids.push({ x: this.plots[id].x, z: this.plots[id].z, w: 1.6, d: 1.6 });
    for (const s of solids) {
      const dx = P.x - s.x;
      const dz = P.z - s.z;
      const ox = s.w + 0.4 - Math.abs(dx);
      const oz = s.d + 0.4 - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) P.x += Math.sign(dx || 1) * ox;
        else P.z += Math.sign(dz || 1) * oz;
      }
    }
    const sd = Math.hypot(P.x - MAP.sage[0], P.z - MAP.sage[1]);
    if (sd < 1.1) {
      P.x = MAP.sage[0] + ((P.x - MAP.sage[0]) / (sd || 1)) * 1.1;
      P.z = MAP.sage[1] + ((P.z - MAP.sage[1]) / (sd || 1)) * 1.1;
    }
  }

  near(x, z, r = PLAYER.reach) {
    return dist2(this.pasha.x, this.pasha.z, x, z) < r * r;
  }

  handleStations(dt) {
    const P = this.pasha;
    P.pickT -= dt;
    P.dropT -= dt;
    for (const type of ['wood', 'stone']) {
      const [px, pz] = PILES[type];
      // only pick up what an open plot still needs (no useless clutter on the back)
      const wanted = this.activePads.reduce((n, q) => n + (q.type === type ? q.total - q.paid - (q.inbound || 0) : 0), 0);
      const carried = P.stack.filter((t) => t === type).length + (P.pendingType?.[type] || 0);
      if (wanted <= carried) continue;
      if (this.near(px, pz, PLAYER.reach + 0.5) && this.piles[type] > 0 && P.stack.length + P.pending < PLAYER.stackMax && P.pickT <= 0) {
        P.pendingType = P.pendingType || {};
        P.pendingType[type] = (P.pendingType[type] || 0) + 1;
        P.pickT = PLAYER.pickEvery;
        const from = this.pilePos(type, this.piles[type] - 1);
        this.piles[type]--;
        P.pending++;
        this.fly(type, from, () => this.stackTop(P), 0.24, () => {
          P.pending--;
          P.pendingType[type]--;
          P.stack.push(type);
        });
        sfx.pop();
      }
    }
    for (const h of this.houses) {
      if (h.coins > 0 && this.near(h.x, h.z, PLAYER.reach + 0.3) && P.pickT <= 0) {
        P.pickT = PLAYER.pickEvery * 0.5;
        const from = this.pilePos('gold', h.coins - 1, [h.x, h.z]);
        h.coins--;
        this.fly('gold', from, () => new THREE.Vector3(P.x, 1.4, P.z), 0.22, () => {
          P.gold++;
          this.hud.coins(P.gold, true);
        });
        sfx.coin();
      }
    }
    if (P.dropT > 0) return;
    for (const pad of this.activePads) {
      if (!this.near(pad.def.x, pad.def.z)) continue;
      if (pad.paid + (pad.inbound || 0) >= pad.total) continue;
      let from;
      if (pad.type === 'gold') {
        if (P.gold <= 0) continue;
        P.gold--;
        this.hud.coins(P.gold);
        from = new THREE.Vector3(P.x, 1.3, P.z);
      } else {
        const i = P.stack.lastIndexOf(pad.type);
        if (i < 0) continue;
        from = this.stackTop(P);
        from.y -= (P.stack.length - i) * (this.items.h[pad.type] + 0.02);
        P.stack.splice(i, 1);
      }
      P.dropT = PLAYER.dropEvery;
      pad.inbound = (pad.inbound || 0) + 1;
      const pl = this.plots[pad.def.id];
      this.fly(pad.type, from, () => new THREE.Vector3(pl.x, 0.6, pl.z), 0.3, () => {
        pad.inbound--;
        sfx.drop();
        if (pad.done) return;
        const finished = pad.pay();
        this.progress(pad);
        if (finished) this.build(pad);
      });
      return;
    }
  }

  handleBattle(dt) {
    const b = this.battle;
    if (!b.active || b.done) return;
    if (this.near(MAP.battle[0], MAP.battle[1], 1.6)) {
      b.hold += dt;
      if (b.hold >= 1.0) {
        b.done = true;
        this.queueRaid(0.3);
      }
    } else b.hold = 0;
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

  objective() {
    const P = this.pasha;
    if (this.state !== 'play') return null;
    const battle = this.battle.active && !this.battle.done ? { tip: 'battle', x: MAP.battle[0], z: MAP.battle[1] } : null;
    const pad = this.currentPad;
    if (!pad) return battle;
    const need = pad.total - pad.paid;
    if (pad.type === 'gold') {
      if (P.gold >= Math.min(need, 5) || (P.gold > 0 && this.near(pad.def.x, pad.def.z, 3))) return { tip: pad.def.id, x: pad.def.x, z: pad.def.z };
      const rich = this.houses.reduce((a, h) => (!a || h.coins > a.coins ? h : a), null);
      if (rich) return { tip: 'gold', x: rich.x, z: rich.z };
      return { tip: pad.def.id, x: pad.def.x, z: pad.def.z };
    }
    const have = P.stack.filter((t) => t === pad.type).length;
    const full = P.stack.length + P.pending >= PLAYER.stackMax;
    if (have >= Math.min(need, PLAYER.stackMax) || (have && (this.piles[pad.type] === 0 || full || this.near(pad.def.x, pad.def.z, 3)))) return { tip: pad.def.id, x: pad.def.x, z: pad.def.z };
    // carrying something this plot can't use: drop it at another open plot that takes it
    if (full) {
      const other = this.activePads.find((q) => q !== pad && q.type !== 'gold' && P.stack.includes(q.type));
      if (other) return { tip: other.def.id, x: other.def.x, z: other.def.z };
    }
    return { tip: pad.type, x: PILES[pad.type][0], z: PILES[pad.type][1] };
  }

  updateGuide() {
    const o = this.objective();
    this.obj = o;
    if (o) this.guide.set(o.x, o.z);
    else this.guide.set(null);
  }

  /* ───────────────────────── combat ───────────────────────── */

  spawnScouts() {
    this.hud.callout(TEXT.scouts, 'red small');
    sfx.horn(294, 0.5, 0, 0.12);
    for (let i = 0; i < RAID.scouts; i++)
      this.enemies.push({ x: rnd(-11, 11), z: MAP.enemyFrom + 14 + rnd(-4, 4), ph: rnd(0, 6), alive: true, mode: 0, hp: 1, flash: 0, hold: rnd(0, 1) });
    this.sageSay = 'scouts';
    this.tween(7, () => {}, () => (this.sageSay = null));
  }

  queueRaid(delay) {
    this.raidQueued = true;
    this.tween(delay, () => {}, () => this.startRaid());
  }

  startRaid() {
    this.state = 'raidIntro';
    this.stateT = 0;
    this.battle.done = true;
    this.battle.pad.done = true;
    this.hud.callout(TEXT.incoming, 'red');
    sfx.charge();
    for (let i = 0; i < RAID.count; i++) {
      const wave = Math.floor(i / 18);
      this.enemies.push({ x: rnd(-13, 13), z: MAP.enemyFrom + rnd(-6, 6) - wave * 6, ph: rnd(0, 6), alive: true, mode: 0, hp: RAID.enemyHp, flash: 0, hold: wave * 2.8 + rnd(0, 0.8) });
    }
  }

  updateCombat(dt) {
    if (!this.enemies.length) return;
    const st = this.state;
    const front = WALL_Z - 1.4;
    let attackers = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hold -= dt;
      if (e.hold > 0 || st === 'win') {
        e.ph += dt * 2;
        e.mode = 2;
        continue;
      }
      if (e.z < front - 0.05) {
        e.z = Math.min(front, e.z + RAID.speed * dt);
        e.mode = 0;
        e.ph += dt * 10;
      } else {
        e.mode = 1;
        e.ph += dt * 8;
        attackers++;
      }
    }
    if (st === 'lose' || st === 'win') return;
    if (attackers) {
      this.wallHp -= attackers * RAID.hitDps * dt;
      if (Math.random() < attackers * dt * 1.2) {
        const a = this.enemies.find((e) => e.alive && e.mode === 1);
        if (a) this.fx.clash(a.x, 1.6, WALL_Z - 0.9);
        sfx.clash();
      }
    }
    this.updateDefence(dt);
    const alive = this.enemies.filter((e) => e.alive).length;
    if (st === 'raid' && !alive) return this.win();
    if (this.wallHp <= 0) return this.lose();
    if (!alive && st === 'play') this.enemies = [];
  }

  updateDefence(dt) {
    const alive = this.enemies.filter((e) => e.alive && e.hold <= 0 && e.z > MAP.enemyFrom + 2);
    if (!alive.length) return;
    for (const id of ['cannonL', 'cannonR']) {
      if (!this.built[id]) continue;
      const c = this.plots[id].obj;
      c.t -= dt;
      if (c.t > 0) continue;
      c.t = RAID.cannonEvery;
      let best = alive[0];
      let bestN = -1;
      for (const e of alive) {
        let n = 0;
        for (const o of alive) if (dist2(e.x, e.z, o.x, o.z) < RAID.cannonRadius ** 2) n++;
        if (n > bestN || (n === bestN && e.z > best.z)) {
          bestN = n;
          best = e;
        }
      }
      this.fireCannon(c, best.x, best.z + RAID.speed * 0.7);
    }
    for (const a of this.archers) {
      a.t -= dt;
      if (a.t > 0) continue;
      a.t = RAID.arrowEvery * rnd(0.85, 1.15);
      let t = null;
      let bd = 1e9;
      for (const e of alive) {
        const d = dist2(e.x, e.z, a.x, WALL_Z);
        if (d < bd && d < 45 * 45) {
          bd = d;
          t = e;
        }
      }
      if (!t) continue;
      const from = new THREE.Vector3(a.x, a.y + 1.4, a.z);
      const lead = new THREE.Vector3(t.x, 1.0, Math.min(t.z + RAID.speed * 0.45, WALL_Z - 1.4));
      sfx.arrow();
      this.fx.arrows.shoot(from, lead, 0.5, 2.2, () => {
        if (!t.alive) return;
        t.hp -= 1;
        t.flash = 1;
        if (t.hp <= 0) this.killEnemy(t);
      });
    }
  }

  fireCannon(c, x, z) {
    const yaw = Math.atan2(-(x - c.position.x), -(z - c.position.z));
    c.rotation.y = yaw;
    const barrel = c.barrel;
    this.tween(0.35, (k) => (barrel.position.z = 0.1 + Math.sin(k * Math.PI) * 0.35));
    const muzzle = new THREE.Vector3(c.position.x - Math.sin(yaw) * 1.8, 1.9, c.position.z - Math.cos(yaw) * 1.8);
    this.fx.glow.emit(muzzle.x, muzzle.y, muzzle.z, { color: 0xffd28a, size: 2.4, life: 0.15, grow: 2.5 });
    for (let i = 0; i < 6; i++) this.fx.smoke.emit(muzzle.x, muzzle.y, muzzle.z, { vx: rnd(-1, 1) - Math.sin(yaw) * 2, vy: rnd(0.5, 2), vz: rnd(-1, 1) - Math.cos(yaw) * 2, color: 0xe8e2d6, size: rnd(1, 1.8), life: rnd(0.8, 1.4), grow: 1.8, alpha: 0.7 });
    sfx.boom(false);
    this.shake = Math.max(this.shake, 0.18);
    const to = new THREE.Vector3(clamp(x, -14, 14), 0.4, Math.min(z, WALL_Z - 1.6));
    const d = muzzle.distanceTo(to);
    this.fx.balls.shoot(muzzle, to, 0.35 + d * 0.012, 2 + d * 0.06, () => {
      sfx.boom(false);
      this.shake = Math.max(this.shake, 0.3);
      this.fx.glow.emit(to.x, 0.8, to.z, { color: 0xffb060, size: 4, life: 0.2, grow: 2 });
      this.fx.bigDust(to.x, 0.3, to.z, 14, 2.2, 0x9a8a6a);
      for (let i = 0; i < 8; i++)
        this.fx.debris.emit(to.x, 0.5, to.z, { vx: rnd(-6, 6), vy: rnd(4, 9), vz: rnd(-6, 6), color: 0x6a5a40, sx: 0.2, sy: 0.2, sz: 0.2, life: 1.2 });
      for (const e of this.enemies) if (e.alive && e.hold <= 0 && dist2(e.x, e.z, to.x, to.z) < RAID.cannonRadius ** 2) this.killEnemy(e, true);
    });
  }

  killEnemy(e, blast = false) {
    e.alive = false;
    this.fx.poof(e.x, 0, e.z, C.enemyCoat);
    if (blast) for (let i = 0; i < 2; i++) this.fx.debris.emit(e.x, 1, e.z, { vx: rnd(-5, 5), vy: rnd(5, 9), vz: rnd(-5, 2), color: C.enemyCoat, sx: 0.2, sy: 0.3, sz: 0.2, life: 1.2 });
    sfx.poof();
  }

  win() {
    if (this.ended) return;
    this.ended = true;
    this.state = 'win';
    this.stateT = 0;
    sfx.victory();
    this.hud.doFlash('rgba(255,240,200,0.7)');
    this.fx.confetti.burst(this.pasha.x, 5, this.pasha.z, 150);
    for (let i = 0; i < 4; i++) this.tween(0.4 + i * 0.4, () => {}, () => this.fx.firework(rnd(-10, 10), rnd(12, 18), rnd(-8, 4), [0xffd36a, 0xff5a5a, 0x7ad0ff, 0xffffff][i % 4]));
    this.tween(2.6, () => {}, () => this.onEnd(true));
  }

  lose() {
    if (this.ended) return;
    this.ended = true;
    this.state = 'lose';
    this.stateT = 0;
    sfx.defeat();
    this.gate.visible = false;
    for (let i = 0; i < 26; i++) this.fx.debris.emit(rnd(-3, 3), rnd(0.5, 4), WALL_Z, { vx: rnd(-5, 5), vy: rnd(3, 8), vz: rnd(2, 8), color: i % 2 ? 0x6a3f1e : 0xcfc1a2, sx: 0.5, sy: 0.6, sz: 0.4, life: 2.5 });
    this.fx.bigDust(0, 1, WALL_Z, 24, 3);
    sfx.boom(true);
    for (const e of this.enemies) if (e.alive) e.z = Math.max(e.z, WALL_Z - 1);
    this.tween(1.8, () => {}, () => this.onEnd(false));
  }

  /* ───────────────────────── render ───────────────────────── */

  draw(dt) {
    const B = this.batches;
    const P = this.pasha;
    const st = this.state;
    const cheer = st === 'win';
    B.pasha.begin();
    B.pasha.push(P.x, 0, P.z, P.yaw, P.ph, cheer ? 3 : P.moving ? 0 : 2);
    B.pasha.end();
    if (cheer) P.ph += dt * 6;

    B.worker.begin();
    for (const w of [...this.cutters, ...this.masons]) {
      w.ph += dt * 7;
      w.spawn = Math.min(1, (w.spawn ?? 1) + dt * 3);
      B.worker.push(w.x, 0, w.z, w.yaw, w.ph, cheer ? 3 : 1, w.spawn);
    }
    B.worker.end();

    const fighting = this.enemies.some((e) => e.alive && e.hold <= 0);
    B.crew.begin();
    for (const c of this.crew) {
      c.ph += dt * 4;
      B.crew.push(c.x, 0, c.z, c.yaw, c.ph, cheer ? 3 : fighting ? 1 : 2);
    }
    B.crew.end();

    B.sage.begin();
    const sy = yawFor(P.x - MAP.sage[0], P.z - MAP.sage[1]);
    this.sageYaw = this.sageYaw == null ? sy : this.sageYaw + Math.atan2(Math.sin(sy - this.sageYaw), Math.cos(sy - this.sageYaw)) * Math.min(1, dt * 3);
    B.sage.push(MAP.sage[0], 0, MAP.sage[1], this.sageYaw, this.time * 2, cheer ? 3 : 2);
    B.sage.end();

    B.archer.begin();
    for (const a of this.archers) {
      a.spawn = Math.min(1, a.spawn + dt * 2);
      B.archer.push(a.x, a.y, a.z, 0, (a.ph += dt * 4), cheer ? 3 : fighting ? 1 : 2, a.spawn);
    }
    B.archer.end();

    B.enemy.begin();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt * 5);
      B.enemy.push(e.x, 0, e.z, Math.PI, e.ph, st === 'lose' ? 3 : e.mode, 1, e.flash);
    }
    B.enemy.end();

    const I = this.items;
    I.begin();
    for (const type of ['wood', 'stone']) for (let i = 0; i < this.piles[type]; i++) {
      const p = this.pilePos(type, i);
      I.put(type, p.x, p.y, p.z, (i % 3) * 0.05);
    }
    for (const h of this.houses) for (let i = 0; i < h.coins; i++) {
      const p = this.pilePos('gold', i, [h.x, h.z]);
      I.put('gold', p.x, p.y, p.z, 0.3);
    }
    let hgt = 1.25;
    const bx = P.x + Math.sin(P.yaw) * 0.42;
    const bz = P.z + Math.cos(P.yaw) * 0.42;
    P.stack.forEach((t, i) => {
      hgt += I.h[t] / 2;
      const off = Math.sin(this.time * 6 + i * 0.3) * (P.moving ? 1 : 0.3) * i * 0.014;
      I.put(t, bx + Math.cos(P.yaw) * off, hgt, bz - Math.sin(P.yaw) * off, P.yaw);
      hgt += I.h[t] / 2 + 0.02;
    });
    for (const f of this.flyers) {
      const k = Math.min(1, f.t / f.dur);
      const to = f.toFn();
      I.put(f.type, lerp(f.from.x, to.x, k), lerp(f.from.y, to.y, k) + Math.sin(k * Math.PI) * 1.4, lerp(f.from.z, to.z, k), k * 3, 1);
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
    const fov = lerp(48, 38, t);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const P = this.pasha;
    const st = this.state;
    let pos;
    let look;
    // isometric three-quarter view like the city screen of the game
    const iso = (x, z, h, d) => [new THREE.Vector3(x + d * 0.45, h, z + d * 0.89), new THREE.Vector3(x, 0, z)];
    if (st === 'intro') {
      [pos, look] = iso(0, 0, 46, 42);
    } else if (st === 'raidIntro' || st === 'raid' || st === 'lose') {
      const zc = st === 'raidIntro' && this.stateT < 1.3 ? -40 : -24;
      pos = new THREE.Vector3(6, lerp(30, 20, t), zc + lerp(30, 24, t));
      look = new THREE.Vector3(0, 0, zc);
    } else if (st === 'win') {
      [pos, look] = iso(P.x, P.z, lerp(15, 11, t), lerp(15, 12, t));
    } else {
      const sc = this.enemies.some((e) => e.alive) ? 1 : 0;
      this.scoutCam = lerp(this.scoutCam || 0, sc, Math.min(1, dt * 2));
      const s = this.scoutCam;
      const cx = clamp(P.x, -10, 10) * (1 - s * 0.5);
      const cz = lerp(clamp(P.z, -10, 11), -16, s * 0.6);
      [pos, look] = iso(cx, cz, lerp(29, 18, t) + s * 6, lerp(24, 17, t) + s * 4);
    }
    const kk = Math.min(1, dt * (st === 'play' ? 4 : 2.2));
    this.camPos.lerp(pos, kk);
    this.camLook.lerp(look, kk);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake;
    this.camera.position.set(this.camPos.x + rnd(-1, 1) * sh, this.camPos.y + rnd(-1, 1) * sh, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  updateHud() {
    const P = this.pasha;
    const st = this.state;
    const playing = st === 'play';
    const key = this.sageSay || this.obj?.tip || '';
    const sp = this.project(MAP.sage[0], 3.1, MAP.sage[1]);
    this.hud.setTip(key, TEXT.tips[key], sp.x, sp.y, playing && !!key && sp.vis);
    const top = this.stackTop(P);
    const p = this.project(P.x, top.y + 0.5, P.z);
    this.hud.stackCount(playing || st === 'raid' ? P.stack.length : 0, PLAYER.stackMax, p.x, p.y);
    // info cards over open plots near the Pasha (and over the current goal)
    const cards = [];
    if (playing) {
      const cur = this.currentPad;
      for (const pad of this.activePads) {
        const pl = this.plots[pad.def.id];
        if (pad !== cur && !this.near(pl.x, pl.z, 9)) continue;
        const q = this.project(pl.x, pl.h + 0.6, pl.z);
        if (!q.vis) continue;
        const info = INFO[pad.def.kind];
        cards.push({ id: pad.def.id, x: q.x, y: q.y, name: info.name, desc: info.desc, k: pad.paid / pad.total, main: pad === cur });
      }
    }
    this.hud.cards(cards);
    // edge pointer when the goal is off screen
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
    const alive = this.enemies.filter((e) => e.alive).length;
    const fight = st === 'raid' || st === 'raidIntro' || (playing && alive > 0);
    this.hud.raidBar(fight, this.wallHp / this.wallMax, alive);
    const left = Math.max(0, AD.attackAt - this.playT);
    this.hud.timer(playing && !fight, left, left / AD.attackAt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
