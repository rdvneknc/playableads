import * as THREE from '../vendor/three.module.min.js';
import { AD, COLORS as C, MAP, PADS, PLAYER, PRODUCE, RAID, TEXT, WORKER } from '../config.js';
import { Environment } from '../world/Environment.js';
import { MODELS } from '../world/Models.js';
import { UnitBatch } from '../world/UnitBatch.js';
import { Guide, Items, Pad, makeCatapult, makeGate, makeQuarry, makeTower, makeTreasury, makeWall } from '../world/Props.js';
import { Fx } from '../fx/Fx.js';
import { sfx } from '../audio/Sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + (b - a) * Math.random();
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
const easeOutBack = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

const WALL_HALF = 14;
const GATE_HALF = 3.4;

export class Game {
  constructor(renderer, hud, { onEnd }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);
    this.env = new Environment(this.scene);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
    this.batches = {
      pasha: new UnitBatch(this.scene, MODELS.pasha(), 1, mat, { scale: 1.08 }),
      worker: new UnitBatch(this.scene, MODELS.worker(), 12, mat),
      crew: new UnitBatch(this.scene, MODELS.crew(), 4, mat),
      sage: new UnitBatch(this.scene, MODELS.sage(), 1, mat, { scale: 1.05 }),
      enemy: new UnitBatch(this.scene, MODELS.enemy(), 80, mat),
      archer: new UnitBatch(this.scene, MODELS.archer(), 4, mat),
    };
    this.items = new Items(this.scene);
    this.fx = new Fx(this.scene);
    this.guide = new Guide(this.scene);
    this._v = new THREE.Vector3();
    this.width = 1;
    this.height = 1;
    this.camPos = new THREE.Vector3(0, 40, 40);
    this.camLook = new THREE.Vector3(0, 0, 0);

    // static camp pieces
    const quarry = makeQuarry();
    quarry.position.set(MAP.quarry.x, 0, MAP.quarry.z);
    quarry.rotation.y = 0.5;
    this.scene.add(quarry);
    const treasury = makeTreasury();
    treasury.position.set(MAP.treasury.x, 0, MAP.treasury.z - 1.2);
    treasury.rotation.y = -0.45;
    this.scene.add(treasury);
    this.gate = makeGate();
    this.gate.position.set(0, 0, MAP.wallZ);
    this.scene.add(this.gate);

    // buildings unlocked by pads (hidden until built)
    const wallLen = WALL_HALF - GATE_HALF;
    this.buildings = {
      wallL: makeWall(wallLen),
      wallR: makeWall(wallLen),
      catapult: makeCatapult(),
      tower: makeTower(),
    };
    this.buildings.wallL.position.set(-(GATE_HALF + wallLen / 2), 0, MAP.wallZ);
    this.buildings.wallR.position.set(GATE_HALF + wallLen / 2, 0, MAP.wallZ);
    for (const b of Object.values(this.buildings)) this.scene.add(b);

    // obstacles the Pasha walks around
    this.obstacles = [
      { x: MAP.quarry.x - 0.5, z: MAP.quarry.z - 1.2, r: 3.0 },
      { x: MAP.treasury.x, z: MAP.treasury.z - 1.2, r: 2.6 },
      { x: MAP.sage[0], z: MAP.sage[1], r: 0.7 },
      { x: -2.6, z: MAP.wallZ, r: 1.5 },
      { x: 2.6, z: MAP.wallZ, r: 1.5 },
    ];
    this.reset();
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
    this.pasha = { x: MAP.start[0], z: MAP.start[1], yaw: Math.PI, ph: 0, moving: false, stack: [], pending: 0, pickT: 0, dropT: 0, gold: 0 };
    this.input = { x: 0, z: 0 };
    this.piles = { stone: 8, gold: 6 };
    this.prodT = { stone: 0, gold: 0 };
    this.diggers = [
      { x: MAP.quarry.x + 1.6, z: MAP.quarry.z + 0.6, yaw: 2.2, ph: 0 },
      { x: MAP.quarry.x - 1.4, z: MAP.quarry.z + 1.6, yaw: 2.6, ph: 2 },
    ];
    this.workers = [];
    this.crew = [];
    this.archers = [];
    this.enemies = [];
    this.raidQueued = false;
    this.wallHp = RAID.wallHp;
    this.catT = 0.6;
    this.arrowT = 0.4;
    for (const p of this.pads || []) this.scene.remove(p.plane);
    this.pads = PADS.map((def) => new Pad(this.scene, def));
    this.built = {};
    for (const [id, b] of Object.entries(this.buildings)) {
      b.visible = false;
      b.scale.set(1, 1, 1);
      if (id === 'catapult') b.arm.rotation.x = 0.55;
    }
    this.buildings.catapult.position.set(PADS.find((p) => p.id === 'catapult').x, 0, PADS.find((p) => p.id === 'catapult').z);
    this.buildings.tower.position.set(PADS.find((p) => p.id === 'tower').x, 0, PADS.find((p) => p.id === 'tower').z);
    this.gate.door.visible = true;
    this.hud.reset();
    this.hud.coins(0);
    this.hud.showTitle(true);
    this.hud.showHand(false);
    this.hud.showCta(false);
    this.camPos.set(0, 34, 40);
    this.camLook.set(0, 0, 0);
    this.shake = 0;
    this.guide.set(null);
    this.activatePads();
  }

  activatePads() {
    for (const p of this.pads) {
      if (p.active || p.done) continue;
      if (!p.def.after || this.built[p.def.after]) p.show();
    }
  }

  get currentPad() {
    return this.pads.find((p) => p.active && !p.done);
  }

  /* ───────────────────────── input ───────────────────────── */

  setInput(x, z) {
    this.input.x = x;
    this.input.z = z;
    if (x || z) {
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
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, vis: v.z < 1 };
  }

  stackTop(c) {
    // world position of the next slot on a carrier's back
    const back = c === this.pasha ? 0.42 : 0.36;
    const base = c === this.pasha ? 1.25 : 1.58;
    const sx = -Math.sin(c.yaw) * -back;
    const sz = -Math.cos(c.yaw) * -back;
    let h = base;
    for (const t of c.stack) h += this.items.h[t] + 0.02;
    return new THREE.Vector3(c.x + sx, h, c.z + sz);
  }

  pilePos(type, i) {
    const [px, pz] = type === 'stone' ? MAP.quarry.pile : MAP.treasury.pile;
    const layer = Math.floor(i / 6);
    const k = i % 6;
    const x = px + ((k % 3) - 1) * 0.62;
    const z = pz + (Math.floor(k / 3) - 0.5) * 0.5;
    return new THREE.Vector3(x, 0.16 + layer * (this.items.h[type] + 0.02), z);
  }

  fly(type, from, toFn, dur, onArrive) {
    this.flyers.push({ type, from: from.clone(), toFn, t: 0, dur, onArrive });
  }

  build(pad) {
    const id = pad.def.id;
    this.built[id] = true;
    sfx.gateGood(true);
    const p = this.project(pad.def.x, 2.5, pad.def.z);
    this.hud.float(p.x, p.y, pad.def.kind === 'hire' ? '+1 WORKER' : `${TEXT.pads[pad.def.kind]}!`, 'good');
    this.fx.sparkle(pad.def.x, 0, pad.def.z, 0xffe9a0, 30);
    this.fx.bigDust(pad.def.x, 0.2, pad.def.z, 14, 2.2, 0xe6c79a);
    this.shake = Math.max(this.shake, 0.25);
    if (pad.def.kind === 'hire') {
      const w = { x: MAP.treasury.x - 2, z: MAP.treasury.z + 2, yaw: 0, ph: 0, stack: [], task: 'toPile', t: 0, spawn: 0 };
      this.workers.push(w);
    } else {
      const b = this.buildings[id];
      b.visible = true;
      b.scale.set(1, 0.01, 1);
      this.tween(0.55, (k) => {
        const s = easeOutBack(k);
        b.scale.set(1 + (1 - k) * 0.15, Math.max(0.01, s), 1 + (1 - k) * 0.15);
      });
      if (id === 'catapult') {
        this.crew = [
          { x: b.position.x - 1.6, z: b.position.z + 0.6, yaw: Math.PI * 0.5, ph: 0 },
          { x: b.position.x + 1.6, z: b.position.z + 1.4, yaw: -Math.PI * 0.6, ph: 1 },
        ];
      }
      if (id === 'tower') {
        this.archers = b.archerSpots.map((s) => ({ x: b.position.x + s.x, y: s.y, z: b.position.z + s.z, ph: rnd(0, 6) }));
      }
    }
    this.tween(0.4, () => {}, () => this.activatePads());
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
    if (st === 'intro' && this.stateT > 1.5) {
      this.state = 'ready';
      this.stateT = 0;
    }
    if (st === 'ready') {
      this.hud.showHand(true);
      if (this.stateT > 5) this.begin();
    } else this.hud.showHand(st === 'play' && !this.moved && this.stateT > 0.2);

    if (st === 'play' || st === 'raid' || st === 'raidIntro') this.playT += dt;
    this.produce(dt);
    if (st === 'play' || st === 'raid' || st === 'raidIntro') this.movePasha(dt);
    if (st === 'play') {
      this.handleStations(dt);
      if (this.pads.every((p) => p.done) && !this.raidQueued) this.queueRaid(1.6);
      if (this.playT * 1000 > AD.attackAtMs && !this.raidQueued) this.queueRaid(0.2);
    }
    if (st === 'play' || st === 'raidIntro' || st === 'raid') this.updateWorkers(dt);
    if (st === 'raidIntro' && this.stateT > 2.2) {
      this.state = 'raid';
      this.stateT = 0;
    }
    if (st === 'raid' || st === 'raidIntro') this.updateRaid(dt);
    this.updateFlyers(dt);
    this.updateGuide();
    for (const p of this.pads) p.update(this.time, dt);
    this.guide.update(this.time);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.env.update(this.time, this.camPos.x, this.camPos.z);
    this.env.follow(this.camLook.x, this.camLook.z + 2);
    this.draw(dt);
    this.updateHud();
  }

  produce(dt) {
    for (const type of ['stone', 'gold']) {
      this.prodT[type] -= dt;
      if (this.prodT[type] <= 0 && this.piles[type] < PRODUCE.pileMax) {
        this.prodT[type] = type === 'stone' ? PRODUCE.stoneEvery : PRODUCE.goldEvery;
        this.piles[type]++;
        if (type === 'stone' && Math.random() < 0.35) {
          const d = this.diggers[Math.floor(Math.random() * 2)];
          this.fx.bigDust(d.x - 0.4, 0.2, d.z - 0.6, 1, 0.3, 0xc9a074);
        }
      }
    }
  }

  movePasha(dt) {
    const P = this.pasha;
    const ix = this.input.x;
    const iz = this.input.z;
    const m = Math.hypot(ix, iz);
    P.moving = m > 0.05 && this.state !== 'win' && this.state !== 'lose';
    if (P.moving) {
      const sp = PLAYER.speed * Math.min(1, m);
      P.x += (ix / m) * sp * Math.min(1, m) * dt;
      P.z += (iz / m) * sp * Math.min(1, m) * dt;
      const yaw = yawFor(ix, iz);
      let d = yaw - P.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      P.yaw += d * Math.min(1, dt * 14);
      P.ph += dt * 11;
    }
    // stay inside the camp, outside the obstacles
    P.x = clamp(P.x, -15, 15);
    P.z = clamp(P.z, MAP.wallZ + 1.6, 17);
    for (const o of this.obstacles) {
      const dx = P.x - o.x;
      const dz = P.z - o.z;
      const d = Math.hypot(dx, dz);
      const r = o.r + 0.45;
      if (d < r && d > 1e-4) {
        P.x = o.x + (dx / d) * r;
        P.z = o.z + (dz / d) * r;
      }
    }
  }

  handleStations(dt) {
    const P = this.pasha;
    const R = PLAYER.reach;
    // pick up from the piles
    P.pickT -= dt;
    for (const type of ['stone', 'gold']) {
      const [px, pz] = type === 'stone' ? MAP.quarry.pile : MAP.treasury.pile;
      // stones stack on the back; akçe goes into the purse (counter)
      const room = type === 'gold' ? P.gold + P.pending < 99 : P.stack.length + P.pending < PLAYER.stackMax;
      if (dist2(P.x, P.z, px, pz) < (R + 0.6) ** 2 && this.piles[type] > 0 && room && P.pickT <= 0) {
        P.pickT = PLAYER.pickEvery;
        const from = this.pilePos(type, this.piles[type] - 1);
        this.piles[type]--;
        P.pending++;
        if (type === 'gold') {
          this.fly(type, from, () => new THREE.Vector3(P.x, 1.3, P.z), 0.2, () => {
            P.pending--;
            P.gold++;
            this.hud.coins(P.gold, true);
          });
          sfx.coin();
        } else {
          this.fly(type, from, () => this.stackTop(P), 0.22, () => {
            P.pending--;
            P.stack.push(type);
          });
          sfx.pop();
        }
      }
    }
    // deliver to the active pad
    P.dropT -= dt;
    const pad = this.currentPad;
    if (pad && dist2(P.x, P.z, pad.def.x, pad.def.z) < R * R && P.dropT <= 0) {
      const i = pad.type === 'gold' ? (P.gold > 0 ? 0 : -1) : P.stack.lastIndexOf('stone');
      if (i >= 0 && pad.paid + (pad.inbound || 0) < pad.total) {
        P.dropT = PLAYER.dropEvery;
        let from;
        if (pad.type === 'gold') {
          from = new THREE.Vector3(P.x, 1.3, P.z);
          P.gold--;
          this.hud.coins(P.gold);
        } else {
          from = this.stackTop(P);
          from.y -= this.items.h.stone + 0.02;
          P.stack.splice(i, 1);
        }
        pad.inbound = (pad.inbound || 0) + 1;
        this.fly(pad.type, from, () => new THREE.Vector3(pad.def.x, 0.2, pad.def.z), 0.24, () => {
          pad.inbound--;
          sfx.drop();
          if (!pad.done && pad.pay()) this.build(pad);
        });
      }
    }
  }

  updateWorkers(dt) {
    for (const w of this.workers) {
      w.spawn = Math.min(1, w.spawn + dt * 3);
      const pad = this.pads.find((p) => p.active && !p.done && p.type === 'stone');
      let tx = w.x;
      let tz = w.z;
      const [qx, qz] = MAP.quarry.pile;
      if (w.task === 'toPile') {
        tx = qx + 1.2;
        tz = qz + 1.0;
        if (dist2(w.x, w.z, tx, tz) < 0.5) w.task = 'load';
      } else if (w.task === 'load') {
        tx = w.x;
        tz = w.z;
        w.t -= dt;
        if (w.t <= 0 && this.piles.stone > 0 && w.stack.length < WORKER.carry) {
          w.t = 0.12;
          this.piles.stone--;
          w.stack.push('stone');
        }
        if (w.stack.length >= WORKER.carry || (w.stack.length && this.piles.stone === 0)) w.task = pad ? 'toPad' : 'wait';
      } else if (w.task === 'wait') {
        if (pad) w.task = 'toPad';
      } else if (w.task === 'toPad') {
        if (!pad) {
          w.task = 'wait';
        } else {
          tx = pad.def.x;
          tz = pad.def.z + 1.0;
          if (dist2(w.x, w.z, tx, tz) < 1.0) w.task = 'unload';
        }
      } else if (w.task === 'unload') {
        w.t -= dt;
        if (!pad) w.task = 'wait';
        else if (w.t <= 0 && w.stack.length) {
          w.t = 0.09;
          const from = this.stackTop(w);
          w.stack.pop();
          if (pad.paid + (pad.inbound || 0) < pad.total) {
            pad.inbound = (pad.inbound || 0) + 1;
            this.fly('stone', from, () => new THREE.Vector3(pad.def.x, 0.2, pad.def.z), 0.24, () => {
              pad.inbound--;
              if (!pad.done && pad.pay()) this.build(pad);
            });
          }
        }
        if (!w.stack.length) w.task = 'toPile';
      }
      const dx = tx - w.x;
      const dz = tz - w.z;
      const d = Math.hypot(dx, dz);
      w.moving = d > 0.2;
      if (w.moving) {
        const sp = WORKER.speed * dt;
        w.x += (dx / d) * Math.min(sp, d);
        w.z += (dz / d) * Math.min(sp, d);
        w.yaw = yawFor(dx, dz);
        w.ph += dt * 10;
      }
    }
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

  updateGuide() {
    if (this.state !== 'play') {
      this.guide.set(null);
      return;
    }
    const pad = this.currentPad;
    if (!pad) {
      this.guide.set(null);
      return;
    }
    const has = pad.type === 'gold' ? this.pasha.gold > 0 : this.pasha.stack.includes('stone');
    if (has) this.guide.set(pad.def.x, pad.def.z);
    else {
      const [x, z] = pad.type === 'stone' ? MAP.quarry.pile : MAP.treasury.pile;
      this.guide.set(x, z);
    }
  }

  /* ───────────────────────── raid ───────────────────────── */

  queueRaid(delay) {
    this.raidQueued = true;
    this.tween(delay, () => {}, () => this.startRaid());
  }

  startRaid() {
    this.state = 'raidIntro';
    this.stateT = 0;
    this.guide.set(null);
    this.hud.callout(TEXT.incoming, 'red');
    sfx.charge();
    for (let i = 0; i < RAID.count; i++) {
      const wave = Math.floor(i / 18);
      this.enemies.push({
        x: rnd(-12.5, 12.5),
        z: MAP.enemyFrom + rnd(-6, 6) - wave * 9,
        ph: rnd(0, 6),
        alive: true,
        mode: 0,
        flash: 0,
        hold: wave * 2.2 + rnd(0, 0.6),
      });
    }
  }

  wallAt(x) {
    if (Math.abs(x) <= GATE_HALF) return true;
    if (x < 0) return !!this.built.wallL;
    return !!this.built.wallR;
  }

  updateRaid(dt) {
    const front = MAP.wallZ - 1.3;
    let attackers = 0;
    let breach = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hold -= dt;
      if (e.hold > 0) {
        e.ph += dt * 2;
        e.mode = 2;
        continue;
      }
      const blocked = this.wallAt(e.x);
      const goal = blocked ? front : 20;
      if (e.z < goal - 0.05) {
        e.z = Math.min(goal, e.z + RAID.speed * dt);
        e.x = clamp(e.x, -13, 13);
        e.mode = 0;
        e.ph += dt * 10;
      } else {
        e.mode = 1;
        e.ph += dt * 8;
        if (blocked) attackers++;
      }
      if (e.z > MAP.wallZ + 2) breach = true;
    }
    if (this.state === 'raid') {
      if (attackers) {
        this.wallHp -= attackers * RAID.hitDps * dt;
        if (Math.random() < attackers * dt * 1.5) {
          const a = this.enemies.find((e) => e.alive && e.mode === 1);
          if (a) this.fx.clash(a.x, 1.6, MAP.wallZ - 0.9);
          sfx.clash();
        }
      }
      this.updateDefence(dt);
      const alive = this.enemies.filter((e) => e.alive).length;
      if (!alive) return this.win();
      if (breach || this.wallHp <= 0) return this.lose();
    }
  }

  updateDefence(dt) {
    const alive = this.enemies.filter((e) => e.alive && e.hold <= 0);
    if (!alive.length) return;
    // catapult: lob a boulder into the thickest part of the enemy
    if (this.built.catapult) {
      this.catT -= dt;
      if (this.catT <= 0) {
        this.catT = RAID.catapultEvery;
        let best = alive[0];
        let bestN = -1;
        for (const e of alive) {
          let n = 0;
          for (const o of alive) if (dist2(e.x, e.z, o.x, o.z) < RAID.catapultRadius ** 2) n++;
          if (n > bestN || (n === bestN && e.z > best.z)) {
            bestN = n;
            best = e;
          }
        }
        this.fireCatapult(best.x, best.z + RAID.speed * 0.9);
      }
    }
    // archers
    if (this.built.tower) {
      this.arrowT -= dt;
      if (this.arrowT <= 0) {
        this.arrowT = RAID.arrowEvery;
        const a = this.archers[Math.floor(Math.random() * this.archers.length)];
        const t = alive.reduce((p, e) => (e.z > p.z ? e : p), alive[0]);
        if (a && t) {
          const from = new THREE.Vector3(a.x, a.y + 1.5, a.z);
          const lead = new THREE.Vector3(t.x, 1.0, Math.min(t.z + RAID.speed * 0.45, MAP.wallZ - 1.3));
          sfx.arrow();
          this.fx.arrows.shoot(from, lead, 0.45, 2.4, () => {
            if (t.alive) this.killEnemy(t);
          });
        }
      }
    }
  }

  fireCatapult(x, z) {
    const cat = this.buildings.catapult;
    const arm = cat.arm;
    cat.rockMesh.visible = false;
    this.tween(0.16, (k) => (arm.rotation.x = lerp(0.55, -1.5, k * k)), () =>
      this.tween(0.9, (k) => (arm.rotation.x = lerp(-1.5, 0.55, k)), () => (cat.rockMesh.visible = true)),
    );
    sfx.whoosh();
    const from = new THREE.Vector3(cat.position.x, 4.2, cat.position.z - 1.2);
    const to = new THREE.Vector3(clamp(x, -13, 13), 0.4, Math.min(z, MAP.wallZ - 1.5));
    const d = from.distanceTo(to);
    this.fx.boulders.shoot(from, to, 0.75 + d * 0.012, 6 + d * 0.15, () => {
      sfx.boom(false);
      this.shake = Math.max(this.shake, 0.35);
      this.fx.bigDust(to.x, 0.3, to.z, 16, 2.2, 0xd8b480);
      for (let i = 0; i < 8; i++)
        this.fx.debris.emit(to.x, 0.5, to.z, { vx: rnd(-6, 6), vy: rnd(4, 9), vz: rnd(-6, 6), color: 0x8a6a4a, sx: 0.25, sy: 0.25, sz: 0.25, life: 1.4 });
      for (const e of this.enemies) if (e.alive && e.hold <= 0 && dist2(e.x, e.z, to.x, to.z) < RAID.catapultRadius ** 2) this.killEnemy(e, true);
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
    for (let i = 0; i < 4; i++) this.tween(0.4 + i * 0.4, () => {}, () => this.fx.firework(rnd(-10, 10), rnd(12, 18), rnd(-6, 6), [0xffd36a, 0xff5a5a, 0x7ad0ff, 0xffffff][i % 4]));
    this.tween(2.6, () => {}, () => this.onEnd(true));
  }

  lose() {
    if (this.ended) return;
    this.ended = true;
    this.state = 'lose';
    this.stateT = 0;
    sfx.defeat();
    this.gate.door.visible = this.wallHp > 0;
    if (this.wallHp <= 0) {
      for (let i = 0; i < 20; i++) this.fx.debris.emit(rnd(-2, 2), rnd(0.5, 3), MAP.wallZ, { vx: rnd(-5, 5), vy: rnd(3, 8), vz: rnd(2, 8), color: 0x6a3f1e, sx: 0.4, sy: 0.9, sz: 0.2, life: 2.5 });
      this.fx.bigDust(0, 1, MAP.wallZ, 20, 3);
      sfx.boom(true);
    }
    for (const e of this.enemies) if (e.alive) e.hold = -1;
    this.tween(1.8, () => {}, () => this.onEnd(false));
  }

  /* ───────────────────────── render ───────────────────────── */

  draw(dt) {
    const B = this.batches;
    const P = this.pasha;
    const st = this.state;
    B.pasha.begin();
    B.pasha.push(P.x, 0, P.z, P.yaw, P.ph, st === 'win' ? 3 : P.moving ? 0 : 2);
    B.pasha.end();
    if (st === 'win') P.ph += dt * 6;

    B.worker.begin();
    for (const d of this.diggers) {
      d.ph += dt * 7;
      B.worker.push(d.x, 0, d.z, d.yaw, d.ph, st === 'win' ? 3 : 1);
    }
    for (const w of this.workers) B.worker.push(w.x, 0, w.z, w.yaw, w.ph, w.moving ? 0 : w.task === 'load' || w.task === 'unload' ? 1 : 2, w.spawn);
    B.worker.end();

    B.crew.begin();
    for (const c of this.crew) {
      c.ph += dt * 4;
      B.crew.push(c.x, 0, c.z, c.yaw, c.ph, st === 'win' ? 3 : st === 'raid' ? 1 : 2);
    }
    B.crew.end();

    B.sage.begin();
    const sy = yawFor(P.x - MAP.sage[0], P.z - MAP.sage[1]);
    this.sageYaw = this.sageYaw == null ? sy : this.sageYaw + Math.atan2(Math.sin(sy - this.sageYaw), Math.cos(sy - this.sageYaw)) * Math.min(1, dt * 3);
    B.sage.push(MAP.sage[0], 0, MAP.sage[1], this.sageYaw, this.time * 2, st === 'win' ? 3 : 2);
    B.sage.end();

    B.archer.begin();
    for (const a of this.archers) B.archer.push(a.x, a.y, a.z, 0, (a.ph += dt * 4), st === 'raid' ? 1 : 2);
    B.archer.end();

    B.enemy.begin();
    for (const e of this.enemies) if (e.alive) B.enemy.push(e.x, 0, e.z, Math.PI, e.ph, st === 'lose' ? 3 : e.mode, 1, 0);
    B.enemy.end();

    // items: piles, stacks, flyers
    const I = this.items;
    I.begin();
    for (const type of ['stone', 'gold']) for (let i = 0; i < this.piles[type]; i++) {
      const p = this.pilePos(type, i);
      I.put(type, p.x, p.y, p.z, (i % 3) * 0.05);
    }
    const drawStack = (c, sway) => {
      let h = c === P ? 1.25 : 1.58;
      const back = c === P ? 0.42 : 0.36;
      const bx = c.x + Math.sin(c.yaw) * back;
      const bz = c.z + Math.cos(c.yaw) * back;
      c.stack.forEach((t, i) => {
        h += I.h[t] / 2;
        const off = Math.sin(this.time * 6 + i * 0.3) * sway * i * 0.012;
        I.put(t, bx + Math.cos(c.yaw) * off, h, bz - Math.sin(c.yaw) * off, c.yaw);
        h += I.h[t] / 2 + 0.02;
      });
    };
    drawStack(P, P.moving ? 1 : 0.3);
    for (const w of this.workers) drawStack(w, w.moving ? 1 : 0.3);
    for (const f of this.flyers) {
      const k = Math.min(1, f.t / f.dur);
      const to = f.toFn();
      const x = lerp(f.from.x, to.x, k);
      const z = lerp(f.from.z, to.z, k);
      const y = lerp(f.from.y, to.y, k) + Math.sin(k * Math.PI) * 1.6;
      I.put(f.type, x, y, z, k * 3, 1);
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
    const fov = lerp(54, 42, t);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const P = this.pasha;
    const st = this.state;
    let pos;
    let look;
    if (st === 'intro') {
      pos = new THREE.Vector3(0, 30, 34);
      look = new THREE.Vector3(0, 0, 2);
    } else if (st === 'raidIntro' || st === 'raid' || st === 'win' || st === 'lose') {
      const zc = st === 'raidIntro' && this.stateT < 1.3 ? -30 : -13;
      pos = new THREE.Vector3(0, lerp(28, 18, t), zc + lerp(24, 19, t));
      look = new THREE.Vector3(0, 0, zc - 2);
      if (st === 'win') {
        pos = new THREE.Vector3(P.x * 0.5, lerp(16, 12, t), P.z + lerp(16, 13, t));
        look = new THREE.Vector3(P.x, 1.5, P.z - 2);
      }
    } else {
      // classic idle-arcade three-quarter view following the Pasha
      const cx = clamp(P.x, -8, 8);
      const cz = clamp(P.z, 0, 12);
      pos = new THREE.Vector3(cx * 0.8, lerp(27, 17, t), cz + lerp(16, 13, t));
      look = new THREE.Vector3(cx * 0.8, 0, cz - 1);
    }
    const kk = Math.min(1, dt * (st === 'play' ? 5 : 2.4));
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
    // sage tip
    let key = '';
    const pad = this.currentPad;
    if (playing && pad) {
      const has = pad.type === 'gold' ? P.gold > 0 : P.stack.includes('stone');
      key = has ? pad.def.tip : pad.type === 'stone' ? 'stone' : 'gold';
    } else if (playing && !pad) key = 'ready';
    const sp = this.project(MAP.sage[0], 3.1, MAP.sage[1]);
    this.hud.setTip(key, TEXT.tips[key], sp.x, sp.y, playing && !!key && sp.vis);
    const top = this.stackTop(P);
    const p = this.project(P.x, top.y + 0.5, P.z);
    this.hud.stackCount(playing ? P.stack.length : 0, PLAYER.stackMax, p.x, p.y);
    const alive = this.enemies.filter((e) => e.alive).length;
    this.hud.raidBar(st === 'raid' || st === 'raidIntro', this.wallHp / RAID.wallHp, alive);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
