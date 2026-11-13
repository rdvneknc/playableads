import * as THREE from '../vendor/three.module.min.js';
import { AD, BATTLE_PAD, BATTLE_READY, COLORS as C, FONT_UI, MAP, PADS, PLAYER, PRODUCE, RAID, TEXT, WORKER } from '../config.js';
import { Environment, roundRect } from '../world/Environment.js';
import { MODELS } from '../world/Models.js';
import { UnitBatch } from '../world/UnitBatch.js';
import { Guide, Items, Pad, makeCatapult, makeGate, makeGrove, makeMarket, makeQuarry, makeWall, upgradeWall } from '../world/Props.js';
import { Fx } from '../fx/Fx.js';
import { sfx } from '../audio/Sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + (b - a) * Math.random();
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
const easeOutBack = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

const WALL_HALF = 15;
const GATE_HALF = 3.4;
const WALL_LEN = WALL_HALF - GATE_HALF;
const PILES = { stone: MAP.quarry.pile, wood: MAP.grove.pile };

// a flat sign on the ground (SELL spot)
function groundSign(text, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  roundRect(ctx, 10, 10, 236, 236, 40);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = '#ffcf3a';
  ctx.strokeStyle = '#7a4a06';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 100, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 100, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `52px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(30,14,4,.9)';
  ctx.strokeText(text, 128, 198);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 128, 198);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

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
      pasha: new UnitBatch(this.scene, MODELS.pasha(), 1, mat, { scale: 1.1 }),
      worker: new UnitBatch(this.scene, MODELS.worker(), 12, mat),
      crew: new UnitBatch(this.scene, MODELS.crew(), 6, mat),
      sage: new UnitBatch(this.scene, MODELS.sage(), 1, mat, { scale: 1.05 }),
      enemy: new UnitBatch(this.scene, MODELS.enemy(), 90, mat),
      archer: new UnitBatch(this.scene, MODELS.archer(), 8, mat),
    };
    this.items = new Items(this.scene);
    this.fx = new Fx(this.scene);
    this.guide = new Guide(this.scene);
    this._v = new THREE.Vector3();
    this.width = 1;
    this.height = 1;
    this.camPos = new THREE.Vector3(0, 40, 40);
    this.camLook = new THREE.Vector3(0, 0, 0);

    const quarry = makeQuarry();
    quarry.position.set(MAP.quarry.x, 0, MAP.quarry.z);
    quarry.rotation.y = 0.6;
    this.scene.add(quarry);
    const grove = makeGrove();
    grove.position.set(MAP.grove.x, 0, MAP.grove.z);
    this.scene.add(grove);
    this.gate = makeGate();
    this.gate.position.set(0, 0, MAP.wallZ);
    this.scene.add(this.gate);
    this.market = makeMarket();
    this.market.position.set(MAP.market.x, 0, MAP.market.z);
    this.scene.add(this.market);
    this.sellSign = groundSign(TEXT.sell, 'rgba(40,120,60,0.8)');
    this.sellSign.position.set(MAP.market.sell[0], 0.05, MAP.market.sell[1]);
    this.scene.add(this.sellSign);

    this.walls = { wallL: makeWall(WALL_LEN), wallR: makeWall(WALL_LEN) };
    this.walls.wallL.position.set(-(GATE_HALF + WALL_LEN / 2), 0, MAP.wallZ);
    this.walls.wallR.position.set(GATE_HALF + WALL_LEN / 2, 0, MAP.wallZ);
    Object.values(this.walls).forEach((w) => this.scene.add(w));
    this.catapults = {};
    for (const id of ['catapult1', 'catapult2']) {
      const def = PADS.find((p) => p.id === id);
      const c = makeCatapult();
      c.position.set(def.x, 0, def.z - 1.2);
      this.scene.add(c);
      this.catapults[id] = c;
    }
    this.battlePad = new Pad(this.scene, { id: 'battle', kind: 'battle', x: BATTLE_PAD.x, z: BATTLE_PAD.z, need: {} });

    this.obstacles = [
      { x: MAP.quarry.x, z: MAP.quarry.z - 0.6, r: 3.0 },
      { x: MAP.grove.x + 1, z: MAP.grove.z, r: 2.6 },
      { x: MAP.market.x, z: MAP.market.z - 0.5, r: 2.4 },
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
    this.piles = { stone: 6, wood: 4 };
    this.coinPile = 0;
    this.coinShown = 0;
    this.sellQueue = 0;
    this.sellT = 0;
    this.diggers = [
      { x: MAP.quarry.x + 2.0, z: MAP.quarry.z + 0.8, yaw: 2.1, ph: 0, t: rnd(0, 1) },
      { x: MAP.quarry.x - 0.6, z: MAP.quarry.z + 2.5, yaw: 2.9, ph: 2, t: rnd(0, 1) },
    ];
    this.cutters = [
      { x: MAP.grove.x - 1.4, z: MAP.grove.z - 1.4, yaw: -2.0, ph: 0, t: rnd(0, 1) },
      { x: MAP.grove.x - 0.6, z: MAP.grove.z + 2.0, yaw: -1.2, ph: 1, t: rnd(0, 1) },
    ];
    this.prodMul = 1;
    this.workers = [];
    this.crew = [];
    this.archers = [];
    this.enemies = [];
    this.raidQueued = false;
    this.scoutsSent = false;
    this.sageSay = null;
    this.wallMax = RAID.wallHp;
    this.wallHp = RAID.wallHp;
    for (const p of this.pads || []) this.scene.remove(p.plane);
    this.pads = PADS.map((def) => new Pad(this.scene, def));
    this.built = {};
    for (const w of Object.values(this.walls)) {
      w.visible = false;
      w.scale.set(1, 1, 1);
      if (w.lv2) {
        w.remove(w.lv2);
        w.lv2 = null;
        w.children.forEach((c) => (c.visible = true));
      }
    }
    for (const c of Object.values(this.catapults)) {
      c.visible = false;
      c.arm.rotation.x = 0.55;
      c.t = rnd(0.2, 1);
    }
    this.market.visible = false;
    this.sellSign.visible = false;
    this.battlePad.plane.visible = false;
    this.battlePad.active = false;
    this.battlePad.done = false;
    this.battleHold = 0;
    this.gate.door.visible = true;
    this.hud.reset();
    this.hud.coins(0);
    this.hud.showTitle(true);
    this.hud.showHand(false);
    this.hud.showCta(false);
    this.camPos.set(0, 36, 40);
    this.camLook.set(0, 0, 2);
    this.shake = 0;
    this.guide.set(null);
    this.activatePads();
  }

  activatePads() {
    for (const p of this.pads) {
      if (p.active || p.done) continue;
      if (!p.def.after || p.def.after.every((id) => this.built[id])) {
        p.show();
        if (this.state === 'play') sfx.tap();
      }
    }
    if (!this.battlePad.active && BATTLE_READY.every((id) => this.built[id]) && this.state === 'play') {
      this.battlePad.show();
    }
  }

  get activePads() {
    return this.pads.filter((p) => p.active && !p.done);
  }

  // the pad the tutorial points at: first open one in build order
  get currentPad() {
    return this.activePads[0];
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
    const isP = c === this.pasha;
    const back = isP ? 0.42 : 0.36;
    let h = isP ? 1.25 : 1.58;
    for (const t of c.stack) h += this.items.h[t] + 0.02;
    return new THREE.Vector3(c.x + Math.sin(c.yaw) * back, h, c.z + Math.cos(c.yaw) * back);
  }

  pilePos(type, i) {
    const [px, pz] = type === 'gold' ? MAP.market.coins : PILES[type];
    const per = type === 'gold' ? 9 : 6;
    const cols = 3;
    const layer = Math.floor(i / per);
    const k = i % per;
    const rows = per / cols;
    const x = px + ((k % cols) - 1) * (type === 'gold' ? 0.5 : 0.62);
    const z = pz + (Math.floor(k / cols) - (rows - 1) / 2) * (type === 'gold' ? 0.32 : 0.5);
    return new THREE.Vector3(x, 0.12 + layer * (this.items.h[type] + 0.02), z);
  }

  fly(type, from, toFn, dur, onArrive) {
    this.flyers.push({ type, from: from.clone(), toFn, t: 0, dur, onArrive });
  }

  build(pad) {
    const def = pad.def;
    const id = def.id;
    this.built[id] = true;
    sfx.gateGood(true);
    const p = this.project(def.x, 2.5, def.z);
    const label = def.kind === 'hire' ? '+1 WORKER' : def.kind === 'wallUp' ? 'WALLS LV2!' : def.kind === 'quarryUp' ? '+1 DIGGER' : `${TEXT.pads[def.kind]}!`;
    this.hud.float(p.x, p.y, label, 'good');
    this.fx.sparkle(def.x, 0, def.z, 0xffe9a0, 30);
    this.fx.bigDust(def.x, 0.2, def.z, 12, 2.2, 0xe6c79a);
    this.shake = Math.max(this.shake, 0.25);
    const pop = (g) => {
      g.visible = true;
      g.scale.set(1, 0.01, 1);
      this.tween(0.55, (k) => g.scale.set(1 + (1 - k) * 0.12, Math.max(0.01, easeOutBack(k)), 1 + (1 - k) * 0.12));
    };
    switch (def.kind) {
      case 'wall':
        pop(this.walls[id]);
        this.fx.bigDust(this.walls[id].position.x, 0.5, MAP.wallZ, 18, 5, 0xe6c79a);
        break;
      case 'market':
        pop(this.market);
        this.sellSign.visible = true;
        this.crew.push({ x: MAP.market.x + 0.4, z: MAP.market.z - 0.3, yaw: Math.PI, ph: 0, role: 'merchant' });
        break;
      case 'hire': {
        const type = id === 'hire1' ? 'stone' : 'wood';
        this.workers.push({ x: def.x, z: def.z, yaw: Math.PI, ph: 0, stack: [], type, task: 'toPile', t: 0, spawn: 0 });
        break;
      }
      case 'archers': {
        const side = id === 'archersL' ? -1 : 1;
        for (const off of [5.2, 8.9, 12.6]) this.archers.push({ x: side * off, side, ph: rnd(0, 6), t: rnd(0, RAID.arrowEvery), spawn: 0 });
        break;
      }
      case 'catapult': {
        const c = this.catapults[id];
        pop(c);
        this.crew.push({ x: c.position.x - 1.6, z: c.position.z + 0.8, yaw: Math.PI * 0.5, ph: 0, role: 'crew' });
        this.crew.push({ x: c.position.x + 1.6, z: c.position.z + 1.6, yaw: -Math.PI * 0.6, ph: 1, role: 'crew' });
        break;
      }
      case 'quarryUp':
        this.diggers.push({ x: MAP.quarry.x + 1.4, z: MAP.quarry.z + 2.6, yaw: 2.5, ph: 1, t: 0, spawn: 0 });
        this.prodMul = 0.8;
        break;
      case 'wallUp':
        for (const w of Object.values(this.walls)) {
          const add = upgradeWall(w, WALL_LEN);
          add.scale.set(1, 0.01, 1);
          this.tween(0.6, (k) => add.scale.set(1, Math.max(0.01, easeOutBack(k)), 1));
          this.fx.bigDust(w.position.x, 3, MAP.wallZ, 16, 5, 0xe6c79a);
        }
        this.wallMax = RAID.wallHpUp;
        this.wallHp = RAID.wallHpUp;
        break;
      default:
    }
    this.tween(0.4, () => {}, () => this.activatePads());
    // first archers on the wall → a few scouts test the defences
    if (id === 'archersL' && !this.scoutsSent) {
      this.scoutsSent = true;
      this.tween(2.5, () => {}, () => this.spawnScouts());
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
    if (st === 'intro' && this.stateT > 1.5) {
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
      this.updateWorkers(dt);
    }
    if (st === 'play') {
      if (this.playT > AD.attackAt && !this.raidQueued) this.queueRaid(0.1);
      this.handleBattlePad(dt);
    }
    if (st === 'raidIntro' && this.stateT > 2.2) {
      this.state = 'raid';
      this.stateT = 0;
    }
    this.updateCombat(dt);
    this.updateFlyers(dt);
    this.updateGuide();
    for (const p of this.pads) p.update(this.time, dt);
    this.battlePad.update(this.time, dt);
    this.guide.update(this.time);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.env.update(this.time, this.camPos.x, this.camPos.z);
    this.env.follow(this.camLook.x, this.camLook.z + 2);
    this.draw(dt);
    this.updateHud();
  }

  produce(dt) {
    const work = (list, type, every) => {
      for (const w of list) {
        w.t -= dt;
        if (w.t <= 0) {
          w.t = every * this.prodMul * rnd(0.85, 1.15);
          if (this.piles[type] < PRODUCE.pileMax) {
            this.piles[type]++;
            this.fx.bigDust(w.x - Math.sin(w.yaw) * 0.8, 0.2, w.z - Math.cos(w.yaw) * 0.8, 1, 0.3, type === 'stone' ? 0xc9a074 : 0xb08a5a);
          }
        }
      }
    };
    work(this.diggers, 'stone', PRODUCE.stoneEvery);
    work(this.cutters, 'wood', PRODUCE.woodEvery);
    // the market turns goods into coins on its pile
    if (this.sellQueue > 0) {
      this.sellT -= dt;
      if (this.sellT <= 0) {
        this.sellT = PRODUCE.sellEvery;
        this.sellQueue--;
        const n = Math.min(PRODUCE.coinsPerItem, PRODUCE.coinPileMax - this.coinPile);
        for (let i = 0; i < n; i++) {
          const idx = this.coinPile + i;
          const to = this.pilePos('gold', idx);
          const from = new THREE.Vector3(MAP.market.x, 1.4, MAP.market.z - 0.8);
          this.fly('gold', from, () => to, 0.3, () => (this.coinShown = Math.min(this.coinPile, Math.max(this.coinShown, idx + 1))));
        }
        this.coinPile += n;
        sfx.coin();
      }
    }
  }

  movePasha(dt) {
    const P = this.pasha;
    const ix = this.input.x;
    const iz = this.input.z;
    const m = Math.hypot(ix, iz);
    P.moving = m > 0.05;
    if (P.moving) {
      const sp = PLAYER.speed * Math.min(1, m) * dt;
      P.x += (ix / m) * sp;
      P.z += (iz / m) * sp;
      const yaw = yawFor(ix, iz);
      const d = Math.atan2(Math.sin(yaw - P.yaw), Math.cos(yaw - P.yaw));
      P.yaw += d * Math.min(1, dt * 14);
      P.ph += dt * 11;
    }
    P.x = clamp(P.x, -16, 16);
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

  near(x, z, r = PLAYER.reach) {
    return dist2(this.pasha.x, this.pasha.z, x, z) < r * r;
  }

  handleStations(dt) {
    const P = this.pasha;
    P.pickT -= dt;
    P.dropT -= dt;
    // 1) raw goods from the quarry / grove onto the back
    for (const type of ['stone', 'wood']) {
      const [px, pz] = PILES[type];
      if (this.near(px, pz, PLAYER.reach + 0.6) && this.piles[type] > 0 && P.stack.length + P.pending < PLAYER.stackMax && P.pickT <= 0) {
        P.pickT = PLAYER.pickEvery;
        const from = this.pilePos(type, this.piles[type] - 1);
        this.piles[type]--;
        P.pending++;
        this.fly(type, from, () => this.stackTop(P), 0.22, () => {
          P.pending--;
          P.stack.push(type);
        });
        sfx.pop();
      }
    }
    // 2) akçe from the market's coin pile into the purse
    if (this.built.market && this.coinShown > 0 && this.near(MAP.market.coins[0], MAP.market.coins[1], PLAYER.reach + 0.4) && P.pickT <= 0) {
      P.pickT = PLAYER.pickEvery * 0.45;
      const take = Math.min(2, this.coinShown);
      for (let i = 0; i < take; i++) {
        const from = this.pilePos('gold', this.coinPile - 1);
        this.coinPile--;
        this.coinShown = Math.min(this.coinShown, this.coinPile);
        this.fly('gold', from, () => new THREE.Vector3(P.x, 1.4, P.z), 0.2, () => {
          P.gold++;
          this.hud.coins(P.gold, true);
        });
      }
      sfx.coin();
    }
    if (P.dropT > 0) return;
    // 3) pay into any open pad we stand on
    for (const pad of this.activePads) {
      if (!this.near(pad.def.x, pad.def.z)) continue;
      if (pad.paid + (pad.inbound || 0) >= pad.total) continue;
      let from = null;
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
      this.payPad(pad, pad.type, from);
      return;
    }
    // 4) sell goods at the market
    if (this.built.market && P.stack.length && this.near(MAP.market.sell[0], MAP.market.sell[1], PLAYER.reach)) {
      P.dropT = PLAYER.dropEvery * 1.4;
      const t = P.stack.pop();
      const from = this.stackTop(P);
      this.fly(t, from, () => new THREE.Vector3(MAP.market.x - 0.8, 1.3, MAP.market.z - 0.6), 0.28, () => {
        this.sellQueue++;
        sfx.drop();
      });
    }
  }

  payPad(pad, type, from) {
    pad.inbound = (pad.inbound || 0) + 1;
    this.fly(type, from, () => new THREE.Vector3(pad.def.x, 0.2, pad.def.z), 0.24, () => {
      pad.inbound--;
      sfx.drop();
      if (!pad.done && pad.pay()) this.build(pad);
    });
  }

  handleBattlePad(dt) {
    const b = this.battlePad;
    if (!b.active || b.done) return;
    if (this.near(b.def.x, b.def.z, 1.6)) {
      this.battleHold += dt;
      if (this.battleHold >= 1.0) {
        b.done = true;
        this.queueRaid(0.3);
      }
    } else this.battleHold = Math.max(0, this.battleHold - dt * 2);
  }

  updateWorkers(dt) {
    for (const w of this.workers) {
      w.spawn = Math.min(1, w.spawn + dt * 3);
      const [qx, qz] = PILES[w.type];
      const pad = this.activePads.find((p) => p.type === w.type);
      const dest = pad ? [pad.def.x, pad.def.z + 0.9] : this.built.market ? [MAP.market.sell[0], MAP.market.sell[1] + 0.6] : null;
      let tx = w.x;
      let tz = w.z;
      if (w.task === 'toPile') {
        tx = qx + (w.type === 'stone' ? 1.3 : -1.3);
        tz = qz + 1.1;
        if (dist2(w.x, w.z, tx, tz) < 0.4) w.task = 'load';
      } else if (w.task === 'load') {
        w.t -= dt;
        if (w.t <= 0 && this.piles[w.type] > 0 && w.stack.length + (w.pending || 0) < WORKER.carry) {
          w.t = 0.22;
          const from = this.pilePos(w.type, this.piles[w.type] - 1);
          this.piles[w.type]--;
          w.pending = (w.pending || 0) + 1;
          this.fly(w.type, from, () => this.stackTop(w), 0.2, () => {
            w.pending--;
            w.stack.push(w.type);
          });
        }
        if (w.stack.length >= WORKER.carry && dest) w.task = 'deliver';
      } else if (w.task === 'deliver') {
        if (!dest) w.task = 'load';
        else {
          [tx, tz] = dest;
          if (dist2(w.x, w.z, tx, tz) < 1.0) w.task = 'unload';
        }
      } else if (w.task === 'unload') {
        w.t -= dt;
        if (w.t <= 0 && w.stack.length) {
          w.t = 0.14;
          const from = this.stackTop(w);
          from.y -= this.items.h[w.type];
          w.stack.pop();
          if (pad && pad.paid + (pad.inbound || 0) < pad.total) this.payPad(pad, w.type, from);
          else if (this.built.market) this.fly(w.type, from, () => new THREE.Vector3(MAP.market.x - 0.8, 1.3, MAP.market.z - 0.6), 0.28, () => this.sellQueue++);
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

  // what should the Pasha do next? → arrow + sage tip
  objective() {
    const P = this.pasha;
    if (this.state !== 'play') return null;
    const battle = this.battlePad.active && !this.battlePad.done ? { tip: 'battle', x: BATTLE_PAD.x, z: BATTLE_PAD.z } : null;
    const pad = this.currentPad;
    if (!pad) return battle;
    if (pad.type === 'gold') {
      if (P.gold >= Math.min(pad.total - pad.paid, 6)) return { tip: pad.def.id, x: pad.def.x, z: pad.def.z };
      if (this.coinShown > 0) return { tip: 'coins', x: MAP.market.coins[0], z: MAP.market.coins[1] };
      if (P.stack.length >= 6 || (P.stack.length && P.stack.length >= this.piles.stone + this.piles.wood))
        return { tip: 'gold', x: MAP.market.sell[0], z: MAP.market.sell[1] };
      const t = this.piles.stone >= this.piles.wood ? 'stone' : 'wood';
      return { tip: 'gold', x: PILES[t][0], z: PILES[t][1] };
    }
    const have = P.stack.filter((t) => t === pad.type).length;
    if (have >= Math.min(pad.total - pad.paid, 6) || (have && this.piles[pad.type] === 0)) return { tip: pad.def.id, x: pad.def.x, z: pad.def.z };
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
      this.enemies.push({ x: rnd(-11, 11), z: MAP.enemyFrom + 10 + rnd(-4, 4), ph: rnd(0, 6), alive: true, mode: 0, hp: 1, flash: 0, hold: rnd(0, 1), scout: true });
    this.sageSay = 'scouts';
    this.tween(6, () => {}, () => (this.sageSay = null));
  }

  queueRaid(delay) {
    this.raidQueued = true;
    this.tween(delay, () => {}, () => this.startRaid());
  }

  startRaid() {
    this.state = 'raidIntro';
    this.stateT = 0;
    this.battlePad.done = true;
    this.hud.callout(TEXT.incoming, 'red');
    sfx.charge();
    for (let i = 0; i < RAID.count; i++) {
      const wave = Math.floor(i / 22);
      this.enemies.push({ x: rnd(-13, 13), z: MAP.enemyFrom + rnd(-6, 6) - wave * 6, ph: rnd(0, 6), alive: true, mode: 0, hp: RAID.enemyHp, flash: 0, hold: wave * 2.6 + rnd(0, 0.8) });
    }
  }

  wallAt(x) {
    if (Math.abs(x) <= GATE_HALF) return true;
    return x < 0 ? !!this.built.wallL : !!this.built.wallR;
  }

  updateCombat(dt) {
    if (!this.enemies.length) return;
    const st = this.state;
    const front = MAP.wallZ - 1.3;
    let attackers = 0;
    let breach = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hold -= dt;
      if (e.hold > 0 || st === 'win') {
        e.ph += dt * 2;
        e.mode = 2;
        continue;
      }
      const blocked = this.wallAt(e.x);
      const goal = blocked ? front : 20;
      if (e.z < goal - 0.05) {
        e.z = Math.min(goal, e.z + RAID.speed * dt);
        e.x = clamp(e.x, -14, 14);
        e.mode = 0;
        e.ph += dt * 10;
      } else {
        e.mode = 1;
        e.ph += dt * 8;
        if (blocked) attackers++;
      }
      if (e.z > MAP.wallZ + 2) breach = true;
    }
    if (st === 'lose' || st === 'win') return;
    if (attackers) {
      this.wallHp -= attackers * RAID.hitDps * dt;
      if (Math.random() < attackers * dt * 1.2) {
        const a = this.enemies.find((e) => e.alive && e.mode === 1);
        if (a) this.fx.clash(a.x, 1.6, MAP.wallZ - 0.9);
        sfx.clash();
      }
    }
    this.updateDefence(dt);
    const alive = this.enemies.filter((e) => e.alive).length;
    if (st === 'raid' && !alive) return this.win();
    if (breach || this.wallHp <= 0) return this.lose();
    if (!alive && st === 'play') this.enemies = [];
  }

  updateDefence(dt) {
    const alive = this.enemies.filter((e) => e.alive && e.hold <= 0 && e.z > MAP.enemyFrom - 4);
    if (!alive.length) return;
    for (const [id, cat] of Object.entries(this.catapults)) {
      if (!this.built[id]) continue;
      cat.t -= dt;
      if (cat.t > 0) continue;
      cat.t = RAID.catapultEvery;
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
      this.fireCatapult(cat, best.x, best.z + RAID.speed * 1.0);
    }
    const wallY = this.wallMax > RAID.wallHp ? 4.55 : 3.25;
    for (const a of this.archers) {
      a.t -= dt;
      if (a.t > 0) continue;
      a.t = RAID.arrowEvery * rnd(0.85, 1.15);
      let t = null;
      let bd = 1e9;
      for (const e of alive) {
        const d = dist2(e.x, e.z, a.x, MAP.wallZ);
        if (d < bd && d < 40 * 40) {
          bd = d;
          t = e;
        }
      }
      if (!t) continue;
      const from = new THREE.Vector3(a.x, wallY + 1.5, MAP.wallZ - 0.2);
      const lead = new THREE.Vector3(t.x, 1.0, Math.min(t.z + RAID.speed * 0.45, MAP.wallZ - 1.3));
      sfx.arrow();
      this.fx.arrows.shoot(from, lead, 0.45, 2.2, () => {
        if (!t.alive) return;
        t.hp -= 1;
        t.flash = 1;
        if (t.hp <= 0) this.killEnemy(t);
      });
    }
  }

  fireCatapult(cat, x, z) {
    const arm = cat.arm;
    cat.rockMesh.visible = false;
    this.tween(0.16, (k) => (arm.rotation.x = lerp(0.55, -1.5, k * k)), () =>
      this.tween(0.9, (k) => (arm.rotation.x = lerp(-1.5, 0.55, k)), () => (cat.rockMesh.visible = true)),
    );
    sfx.whoosh();
    const from = new THREE.Vector3(cat.position.x, 4.2, cat.position.z - 1.2);
    const to = new THREE.Vector3(clamp(x, -14, 14), 0.4, Math.min(z, MAP.wallZ - 1.5));
    const d = from.distanceTo(to);
    this.fx.boulders.shoot(from, to, 0.75 + d * 0.012, 6 + d * 0.15, () => {
      sfx.boom(false);
      this.shake = Math.max(this.shake, 0.3);
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
    if (this.wallHp <= 0) {
      this.gate.door.visible = false;
      for (let i = 0; i < 20; i++) this.fx.debris.emit(rnd(-2, 2), rnd(0.5, 3), MAP.wallZ, { vx: rnd(-5, 5), vy: rnd(3, 8), vz: rnd(2, 8), color: 0x6a3f1e, sx: 0.4, sy: 0.9, sz: 0.2, life: 2.5 });
      this.fx.bigDust(0, 1, MAP.wallZ, 20, 3);
      sfx.boom(true);
    }
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
    for (const d of [...this.diggers, ...this.cutters]) {
      d.ph += dt * 7;
      d.spawn = Math.min(1, (d.spawn ?? 1) + dt * 3);
      B.worker.push(d.x, 0, d.z, d.yaw, d.ph, cheer ? 3 : 1, d.spawn);
    }
    for (const w of this.workers) B.worker.push(w.x, 0, w.z, w.yaw, w.ph, w.moving ? 0 : w.task === 'load' || w.task === 'unload' ? 1 : 2, w.spawn);
    B.worker.end();

    const fighting = this.enemies.some((e) => e.alive && e.hold <= 0);
    B.crew.begin();
    for (const c of this.crew) {
      c.ph += dt * 4;
      B.crew.push(c.x, 0, c.z, c.yaw, c.ph, cheer ? 3 : fighting && c.role === 'crew' ? 1 : 2);
    }
    B.crew.end();

    B.sage.begin();
    const sy = yawFor(P.x - MAP.sage[0], P.z - MAP.sage[1]);
    this.sageYaw = this.sageYaw == null ? sy : this.sageYaw + Math.atan2(Math.sin(sy - this.sageYaw), Math.cos(sy - this.sageYaw)) * Math.min(1, dt * 3);
    B.sage.push(MAP.sage[0], 0, MAP.sage[1], this.sageYaw, this.time * 2, cheer ? 3 : 2);
    B.sage.end();

    const wallY = this.wallMax > RAID.wallHp ? 4.5 : 3.25;
    B.archer.begin();
    for (const a of this.archers) {
      a.spawn = Math.min(1, a.spawn + dt * 3);
      B.archer.push(a.x, wallY, MAP.wallZ + 0.1, 0, (a.ph += dt * 4), cheer ? 3 : fighting ? 1 : 2, a.spawn);
    }
    B.archer.end();

    B.enemy.begin();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, (e.flash || 0) - dt * 5);
      B.enemy.push(e.x, 0, e.z, Math.PI, e.ph, st === 'lose' ? 3 : e.mode, 1, e.flash);
    }
    B.enemy.end();

    const I = this.items;
    I.begin();
    for (const type of ['stone', 'wood']) for (let i = 0; i < this.piles[type]; i++) {
      const p = this.pilePos(type, i);
      I.put(type, p.x, p.y, p.z, (i % 3) * 0.05);
    }
    for (let i = 0; i < Math.min(this.coinPile, this.coinShown); i++) {
      const p = this.pilePos('gold', i);
      I.put('gold', p.x, p.y, p.z, (i % 2) * 0.2);
    }
    const drawStack = (c, sway) => {
      let h = c === P ? 1.25 : 1.58;
      const back = c === P ? 0.42 : 0.36;
      const bx = c.x + Math.sin(c.yaw) * back;
      const bz = c.z + Math.cos(c.yaw) * back;
      c.stack.forEach((t, i) => {
        h += I.h[t] / 2;
        const off = Math.sin(this.time * 6 + i * 0.3) * sway * i * 0.014;
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
      const y = lerp(f.from.y, to.y, k) + Math.sin(k * Math.PI) * 1.4;
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
    const fov = lerp(52, 42, t);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const P = this.pasha;
    const st = this.state;
    let pos;
    let look;
    if (st === 'intro') {
      pos = new THREE.Vector3(0, 34, 38);
      look = new THREE.Vector3(0, 0, 2);
    } else if (st === 'raidIntro' || st === 'raid' || st === 'lose') {
      const zc = st === 'raidIntro' && this.stateT < 1.3 ? -30 : -13;
      pos = new THREE.Vector3(0, lerp(30, 19, t), zc + lerp(26, 20, t));
      look = new THREE.Vector3(0, 0, zc - 2);
    } else if (st === 'win') {
      pos = new THREE.Vector3(P.x * 0.5, lerp(16, 12, t), P.z + lerp(16, 13, t));
      look = new THREE.Vector3(P.x, 1.5, P.z - 2);
    } else {
      // three-quarter view following the Pasha; pulls back when scouts attack
      const scouts = this.enemies.some((e) => e.alive) ? 1 : 0;
      this.scoutCam = lerp(this.scoutCam || 0, scouts, Math.min(1, dt * 2));
      const s = this.scoutCam;
      const cx = clamp(P.x, -8, 8) * (1 - s * 0.6);
      const cz = clamp(P.z, 0, 12) - s * 7;
      pos = new THREE.Vector3(cx * 0.8, lerp(31, 19, t) + s * 6, cz + lerp(18.5, 14.5, t) + s * 3);
      look = new THREE.Vector3(cx * 0.8, 0, cz - 1);
    }
    const kk = Math.min(1, dt * (st === 'play' ? 4.5 : 2.4));
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
