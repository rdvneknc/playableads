import * as THREE from '../vendor/three.module.min.js';
import { COLORS as C, ECON, HAMAL, INFO, KITCHEN, MAP, PADS, PLAYER, TEXT } from '../config.js';
import { Environment } from '../world/Environment.js';
import { MODELS, SIT_DROP } from '../world/Models.js';
import { UnitBatch } from '../world/UnitBatch.js';
import { Guide, Items, Pad } from '../world/Props.js';
import { banner, cart, cauldron, counter, enemyTower, fieldCannon, hearth, mevzi, passGate, tarp, tent, waveFlag } from '../world/Town.js';
import { Fx } from '../fx/Fx.js';
import { JanissaryCrowd } from '../world/Janissaries.js';
import { withDetail } from '../world/Detail.js';
import { sfx } from '../audio/Sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + (b - a) * Math.random();
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const easeOutBack = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

// sacks spilled by the cart: slot offsets from MAP.pile (x, y, z)
const PILE_SLOTS = [
  [0, 0.18, 0],
  [0.68, 0.18, 0.12],
  [-0.66, 0.18, 0.18],
  [0.34, 0.52, 0.05],
  [-0.32, 0.52, 0.12],
  [0.0, 0.18, 0.62],
];
const SEAT_YAW = Math.PI; // seated soldiers face the table (+Z, toward the camera)
const RANK_COLS = 5;
const ENEMY_YAW = Math.PI;

export class Game {
  constructor(renderer, hud, { onEnd, models = {} }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
    this.env = new Environment(this.scene);
    const mat = withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 }), { strength: 0.12, scale: 2.2, ao: 0.7 });
    this.batches = {
      cook: new UnitBatch(this.scene, MODELS.cook(), 1, mat, { scale: 1.12 }),
      jan: new UnitBatch(this.scene, MODELS.janissary(), 16, mat),
      hamal: new UnitBatch(this.scene, MODELS.hamal(), 1, mat, { scale: 1.05 }),
      enemy: new UnitBatch(this.scene, MODELS.enemy(), 8, mat),
    };
    // the Yeniçeri: the artist's .glb when it loaded, the built-in low-poly model otherwise
    this.crowd = models.jan ? new JanissaryCrowd(this.scene, models.jan, 16) : null;
    this.items = new Items(this.scene);
    this.fx = new Fx(this.scene);
    this.guide = new Guide(this.scene);
    this._v = new THREE.Vector3();
    this.width = 1;
    this.height = 1;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.buildCamp();
    this.hungryIcons = this.makeHungryIcons(16);
    this.reset();
  }

  /* ───────────────────────── scene ───────────────────────── */

  buildCamp() {
    const S = this.scene;
    const put = (o, x, z, ry = 0) => {
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      S.add(o);
      return o;
    };
    this.kazanObjs = MAP.kazans.map(([x, z]) => {
      const h = put(hearth(), x, z);
      const pot = put(cauldron(), x, z);
      return { hearth: h, pot };
    });
    put(counter(), MAP.counter[0], MAP.counter[1], Math.PI / 2);
    put(cart(), MAP.cart[0], MAP.cart[1], 0.5);
    const ht = put(tent(), MAP.hamalTent[0], MAP.hamalTent[1], Math.atan2(MAP.pile[0] - MAP.hamalTent[0], MAP.pile[1] - MAP.hamalTent[1]));
    ht.scale.setScalar(1.15);
    this.banner = put(banner(), MAP.banner[0], MAP.banner[1]);
    put(mevzi(), MAP.mevzi[0], MAP.mevzi[1], yawFor(MAP.tower[0] - MAP.mevzi[0], MAP.tower[1] - MAP.mevzi[1]));
    this.cannon = put(fieldCannon(), MAP.covered[0], MAP.covered[1], 0.9);
    this.tarp = put(tarp(), MAP.covered[0], MAP.covered[1], 0.9);
    this.gate = put(passGate(MAP.cliffGap * 2 + 3), 0, MAP.pass);
    this.tower = put(enemyTower(), MAP.tower[0], MAP.tower[1]);
    this.towerParts = this.tower.parts.map((p) => ({ m: p, y0: p.position.y }));
  }

  // little thought bubbles with an empty bowl over hungry soldiers
  makeHungryIcons(n) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#fffaf0';
    c.strokeStyle = '#3a1d04';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(64, 56, 44, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(52, 96);
    c.lineTo(64, 122);
    c.lineTo(76, 96);
    c.fill();
    c.beginPath();
    c.arc(64, 50, 26, 0, Math.PI);
    c.closePath();
    c.fillStyle = '#c8742e';
    c.fill();
    c.stroke();
    c.fillStyle = '#3a1d04';
    c.fillRect(36, 46, 56, 7);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, toneMapped: false });
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(0.85);
      s.renderOrder = 20;
      s.visible = false;
      this.scene.add(s);
      list.push(s);
    }
    return list;
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
    this.stage = 0;
    this.fed = 0;
    this.everDropped = false;
    this.pasha = { x: MAP.start[0], z: MAP.start[1], yaw: 2.2, ph: 0, moving: false, stack: 0, pending: 0, pickT: 0, dropT: 0, payT: 0, gold: 0 };
    this.input = { x: 0, z: 0 };
    this.pile = 3;
    this.pileT = 0;
    this.pileStarted = false;
    this.sacksInFlight = 0;
    this.kazans = MAP.kazans.map(([x, z], i) => ({ x, z, active: i === 0, sacks: 0, cooking: false, cookT: 0, level: 0.2, heat: i === 0 ? 1 : 0 }));
    this.kazanObjs.forEach((k, i) => {
      k.hearth.visible = i === 0;
      k.pot.visible = i === 0;
      k.pot.position.y = 0;
      k.hearth.scale.setScalar(1);
    });
    this.bowls = [];
    this.soldiers = [];
    this.seats = MAP.seats.map(() => null);
    this.rankIdx = 0;
    this.rankFront = MAP.ranks;
    for (let i = 0; i < ECON.waves[0]; i++) {
      const [x, z] = MAP.seats[i];
      const s = this.newSoldier(x, z);
      s.st = 'wait';
      s.seat = i;
      s.sitting = true;
      s.yaw = SEAT_YAW;
      s.flip = i === 0;
      this.seats[i] = s;
    }
    this.hamal = { active: false, x: MAP.hamalTent[0], z: MAP.hamalTent[1] + 1.6, yaw: 0, ph: 0, load: 0, pending: 0, t: 0, spawn: 0, moving: false };
    this.focusHamal = 0;
    this.enemies = [];
    for (let i = 0; i < 4; i++) this.enemies.push({ x: -3 + i * 2, y: 0, z: MAP.pass - 1.4, ph: rnd(0, 6), alive: true, flee: false });
    for (const dx of [-0.8, 0.8]) this.enemies.push({ x: MAP.tower[0] + dx, y: this.tower.topY, z: MAP.tower[1] + 0.6, ph: rnd(0, 6), alive: true, top: true });
    // world objects back to their start
    this.cannon.position.set(MAP.covered[0], 0, MAP.covered[1]);
    this.cannon.rotation.set(0, 0.9, 0);
    this.cannon.visible = false;
    this.tarp.visible = true;
    this.tarp.position.set(MAP.covered[0], 0, MAP.covered[1]);
    this.tarp.rotation.set(0, 0.9, 0);
    this.tarp.scale.setScalar(1);
    this.gate.gate.rotation.x = 0;
    this.gate.gate.visible = true;
    this.towerParts.forEach((p) => {
      p.m.position.set(0, p.y0, 0);
      p.m.rotation.set(0, 0, 0);
      p.m.visible = true;
      p.vy = 0;
    });
    this.collapsing = false;
    for (const p of this.pads || []) this.scene.remove(p.plane);
    this.pads = PADS.map((def) => new Pad(this.scene, def));
    if (this.firePad) this.scene.remove(this.firePad.plane);
    this.firePad = new Pad(this.scene, { id: 'fire', kind: 'fire', x: MAP.mevzi[0] + 0.6, z: MAP.mevzi[1] + 3.1, need: {} });
    this.fired = false;
    this.hud.reset();
    this.hud.coins(0);
    this.hud.showCta(true);
    this.shake = 0;
    this.guide.set(null);
    this.snapCam = true;
  }

  newSoldier(x, z) {
    const s = { x, z, yaw: 0, ph: rnd(0, 6), st: 'arrive', seat: -1, sitting: false, bowl: null, hasBowl: false, t: 0, slot: -1, spawn: 1, flip: false, cheer: 0, delay: 0 };
    this.soldiers.push(s);
    return s;
  }

  get activePads() {
    return this.pads.filter((p) => p.active && !p.done);
  }

  get currentPad() {
    return this.activePads[0];
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

  // top of a load carried on the back
  backTop(c, n, base) {
    return new THREE.Vector3(c.x + Math.sin(c.yaw) * 0.4, base + n * (this.items.h.sack + 0.01) + 0.18, c.z + Math.cos(c.yaw) * 0.4);
  }

  pileSlot(i) {
    const s = PILE_SLOTS[i % PILE_SLOTS.length];
    return new THREE.Vector3(MAP.pile[0] + s[0], s[1], MAP.pile[1] + s[2]);
  }

  fly(type, from, toFn, dur, onArrive, arc = 1.4) {
    this.flyers.push({ type, from: from.clone(), toFn, t: 0, dur, onArrive, arc });
  }

  near(x, z, r = PLAYER.reach) {
    return dist(this.pasha.x, this.pasha.z, x, z) < r;
  }

  // rations still wanted: hungry soldiers minus everything already on its way to them
  demand() {
    const P = this.pasha;
    const H = this.hamal;
    let hungry = 0;
    for (const s of this.soldiers) if ((s.st === 'arrive' || s.st === 'wait') && !s.bowl) hungry++;
    let supply = this.sacksInFlight + P.stack + P.pending + H.load + H.pending;
    for (const k of this.kazans) supply += k.sacks + (k.cooking ? 1 : 0);
    for (const b of this.bowls) if (!b.soldier) supply++;
    return hungry - supply;
  }

  bestKazan(x, z, reach = 99) {
    let best = null;
    for (const k of this.kazans) {
      if (!k.active) continue;
      const d = dist(x, z, k.x, k.z);
      if (d > reach) continue;
      const score = k.sacks + (k.cooking ? 1 : 0) + d * 0.05;
      if (!best || score < best.score) best = { k, score, d };
    }
    return best?.k;
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

    const st = this.state;
    if (st === 'play') {
      this.movePasha(dt);
      this.handlePlayer(dt);
    }
    this.updatePile(dt);
    this.updateHamal(dt);
    this.updateKitchen(dt);
    this.updateSoldiers(dt);
    this.updateFlyers(dt);
    this.updateCollapse(dt);
    this.updateGuide();
    for (const p of this.pads) p.update(this.time, dt);
    this.firePad.update(this.time, dt);
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
    const ix = this.input.x;
    const iz = this.input.z;
    const m = Math.hypot(ix, iz);
    P.moving = m > 0.05;
    if (P.moving) {
      const sp = PLAYER.speed * Math.min(1, m) * dt;
      P.x += (ix / m) * sp;
      P.z += (iz / m) * sp;
      P.yaw = turn(P.yaw, yawFor(ix, iz), Math.min(1, dt * 14));
      P.ph += dt * 11;
    }
    P.x = clamp(P.x, -12.5, 12.5);
    P.z = clamp(P.z, -16, 9.5);
    const circles = [[MAP.banner[0], MAP.banner[1], 0.7]];
    this.kazans.forEach((k, i) => {
      if (this.kazanObjs[i].hearth.visible) circles.push([k.x, k.z, 1.25]);
    });
    circles.push([this.cannon.position.x, this.cannon.position.z, 1.4]);
    for (const [cx, cz, r] of circles) {
      const d = dist(P.x, P.z, cx, cz);
      if (d < r) {
        P.x = cx + ((P.x - cx) / (d || 1)) * r;
        P.z = cz + ((P.z - cz) / (d || 1)) * r;
      }
    }
    const boxes = [
      { x: MAP.counter[0], z: MAP.counter[1], w: 2.25, d: 0.6 },
      { x: MAP.cart[0], z: MAP.cart[1] + 0.2, w: 1.5, d: 1.0 },
    ];
    for (const s of boxes) {
      const dx = P.x - s.x;
      const dz = P.z - s.z;
      const ox = s.w + 0.4 - Math.abs(dx);
      const oz = s.d + 0.4 - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) P.x += Math.sign(dx || 1) * ox;
        else P.z += Math.sign(dz || 1) * oz;
      }
    }
  }

  handlePlayer(dt) {
    const P = this.pasha;
    P.pickT -= dt;
    P.dropT -= dt;
    P.payT -= dt;
    // pick up sacks at the cart (only as many as hungry soldiers are waiting for)
    if (this.moved && this.pile > 0 && P.pickT <= 0 && P.stack + P.pending < PLAYER.stackMax && this.near(MAP.pile[0], MAP.pile[1], PLAYER.reach + 0.5) && this.demand() > 0) {
      P.pickT = PLAYER.pickEvery;
      const from = this.pileSlot(this.pile - 1);
      this.pile--;
      this.pileStarted = true;
      P.pending++;
      const n = P.stack + P.pending - 1;
      this.fly('sack', from, () => this.backTop(P, n, 1.0), 0.24, () => {
        P.pending--;
        P.stack++;
        sfx.sack();
      });
      sfx.pop();
    }
    // drop them into the cauldron, one by one
    if (P.stack > 0 && P.dropT <= 0) {
      const k = this.bestKazan(P.x, P.z, 2.7);
      if (k) {
        P.dropT = PLAYER.dropEvery;
        const from = this.backTop(P, P.stack - 1, 1.0);
        P.stack--;
        this.dropSack(k, from);
      }
    }
    // pay akçe into the open plot
    for (const pad of [...this.activePads]) {
      if (P.gold <= 0 || P.payT > 0 || !this.near(pad.def.x, pad.def.z)) continue;
      if (pad.paid + (pad.inbound || 0) >= pad.total) continue;
      P.payT = PLAYER.payEvery;
      P.gold--;
      this.hud.coins(P.gold);
      pad.inbound = (pad.inbound || 0) + 1;
      this.fly('coin', new THREE.Vector3(P.x, 1.5, P.z), () => new THREE.Vector3(pad.def.x, 0.3, pad.def.z), 0.28, () => {
        pad.inbound--;
        sfx.coin();
        if (pad.done) return;
        this.fx.sparkle(pad.def.x, 0, pad.def.z, 0xffe08a, 2);
        if (pad.pay()) this.buy(pad);
      });
    }
  }

  dropSack(k, from) {
    this.sacksInFlight++;
    this.everDropped = true;
    this.fly('sack', from, () => new THREE.Vector3(k.x, 1.25, k.z), 0.3, () => {
      this.sacksInFlight--;
      k.sacks++;
      sfx.sack(true);
      this.fx.smoke.emit(k.x, 1.4, k.z, { vy: 2, color: 0xffffff, size: 1.6, life: 0.5, grow: 2, alpha: 0.7 });
      for (let i = 0; i < 6; i++)
        this.fx.glow.emit(k.x + rnd(-0.4, 0.4), 1.3, k.z + rnd(-0.4, 0.4), { vx: rnd(-1.5, 1.5), vy: rnd(2, 4), vz: rnd(-1.5, 1.5), color: 0xffb060, size: rnd(0.15, 0.3), life: 0.4, grav: 9, drag: 1 });
      if (!this.pads[0].active) {
        this.pads[0].show();
        sfx.tap();
      }
    }, 1.2);
  }

  updatePile(dt) {
    if (!this.pileStarted || this.pile >= KITCHEN.pileMax) return;
    this.pileT -= dt;
    if (this.pileT > 0) return;
    this.pileT = KITCHEN.pileEvery;
    const i = this.pile + (this.pileIncoming || 0);
    if (i >= KITCHEN.pileMax) return;
    this.pileIncoming = (this.pileIncoming || 0) + 1;
    const from = new THREE.Vector3(MAP.cart[0] + rnd(-0.6, 0.6), 1.3, MAP.cart[1] - 0.2);
    this.fly('sack', from, () => this.pileSlot(i), 0.35, () => {
      this.pileIncoming--;
      this.pile++;
    }, 0.6);
  }

  /* ── the hamal: cart → cauldron, two sacks a trip ── */
  updateHamal(dt) {
    const H = this.hamal;
    if (!H.active) return;
    H.spawn = Math.min(1, H.spawn + dt * 2.5);
    H.t -= dt;
    let tx = H.x;
    let tz = H.z;
    const carrying = H.load + H.pending;
    const want = this.demand() > 0;
    if (H.load > 0 && (H.load + H.pending >= HAMAL.carry || this.pile === 0 || !want) && !H.pending) {
      const k = this.bestKazan(H.x, H.z);
      if (k) {
        const d = dist(H.x, H.z, k.x, k.z);
        if (d > 2.2) {
          // approach from the cart side
          const vx = MAP.pile[0] - k.x;
          const vz = MAP.pile[1] - k.z;
          const vl = Math.hypot(vx, vz);
          tx = k.x + (vx / vl) * 1.7;
          tz = k.z + (vz / vl) * 1.7;
        } else if (H.t <= 0) {
          H.t = HAMAL.dropEvery;
          const from = this.backTop(H, H.load - 1, 1.2);
          H.load--;
          this.dropSack(k, from);
        }
      }
    } else if (want || carrying) {
      const d = dist(H.x, H.z, MAP.pile[0], MAP.pile[1]);
      if (d > 1.7) {
        tx = MAP.pile[0] + 0.9;
        tz = MAP.pile[1] - 1.2;
      } else if (H.t <= 0 && this.pile > 0 && carrying < HAMAL.carry && want) {
        H.t = HAMAL.pickEvery;
        const from = this.pileSlot(this.pile - 1);
        this.pile--;
        H.pending++;
        const n = carrying;
        this.fly('sack', from, () => this.backTop(H, n, 1.2), 0.26, () => {
          H.pending--;
          H.load++;
          sfx.sack();
        });
      }
    } else {
      tx = MAP.pile[0] + 1.4;
      tz = MAP.pile[1] - 1.8;
    }
    const dx = tx - H.x;
    const dz = tz - H.z;
    const d = Math.hypot(dx, dz);
    H.moving = d > 0.15;
    if (H.moving) {
      const sp = Math.min(d, HAMAL.speed * dt);
      H.x += (dx / d) * sp;
      H.z += (dz / d) * sp;
      H.yaw = turn(H.yaw, yawFor(dx, dz), Math.min(1, dt * 10));
      H.ph += dt * 10;
    } else {
      const k = this.bestKazan(H.x, H.z);
      const face = H.load ? [k.x - H.x, k.z - H.z] : [MAP.pile[0] - H.x, MAP.pile[1] - H.z];
      H.yaw = turn(H.yaw, yawFor(face[0], face[1]), Math.min(1, dt * 8));
    }
  }

  /* ── cauldrons cook, bowls go to the table, soldiers eat ── */
  updateKitchen(dt) {
    this.kazans.forEach((k, i) => {
      const obj = this.kazanObjs[i];
      if (!k.active) return;
      if (!k.cooking && k.sacks > 0) {
        k.sacks--;
        k.cooking = true;
        k.cookT = KITCHEN.cook;
      }
      if (k.cooking) {
        k.cookT -= dt;
        if (Math.random() < dt * 4) sfx.bubble();
        if (k.cookT <= 0) {
          k.cooking = false;
          this.serveBowl(k);
        }
      }
      const busy = k.cooking || k.sacks > 0;
      k.level = lerp(k.level, busy ? 1 : 0.35, Math.min(1, dt * 4));
      obj.pot.stew.position.y = 0.92 + k.level * 0.3;
      const s = 1 + Math.sin(this.time * (busy ? 18 : 4)) * (busy ? 0.03 : 0.01);
      obj.pot.stew.scale.set(s, s, 1);
      // steam + fire
      if (Math.random() < dt * (busy ? 9 : 2.5))
        this.fx.smoke.emit(k.x + rnd(-0.4, 0.4), 1.7, k.z + rnd(-0.4, 0.4), { vx: rnd(-0.3, 0.3), vy: rnd(1.4, 2.4), vz: rnd(-0.3, 0.3), color: 0xf4f0ea, size: rnd(0.6, 1.0), life: rnd(0.9, 1.4), grow: 2.4, alpha: busy ? 0.32 : 0.18 });
      if (Math.random() < dt * 14)
        this.fx.glow.emit(k.x + rnd(-0.5, 0.5), 0.25, k.z + rnd(-0.5, 0.5), { vy: rnd(0.5, 1.4), color: Math.random() < 0.5 ? 0xff8a2a : 0xffc04a, size: rnd(0.35, 0.7), life: rnd(0.3, 0.6), grow: 0.5, alpha: 0.9 });
      if (busy && Math.random() < dt * 10)
        this.fx.glow.emit(k.x + rnd(-0.5, 0.5), 1.25, k.z + rnd(-0.5, 0.5), { vy: rnd(0.4, 1), color: 0xffd090, size: rnd(0.12, 0.22), life: 0.25, grow: 1.5, alpha: 0.6 });
    });
    // bowls on the table look for a seated soldier
    for (const b of this.bowls) {
      if (b.phase === 'table') {
        if (!b.soldier) {
          const s = this.nextEater();
          if (s) {
            b.soldier = s;
            s.bowl = b;
          }
        }
        b.t -= dt;
        if (b.soldier && b.t <= 0 && b.soldier.sitting) {
          b.phase = 'take';
          b.t = 0;
          b.from = b.pos.clone();
        }
      } else if (b.phase === 'take') {
        b.t += dt / 0.25;
        const s = b.soldier;
        const to = this.handPos(s);
        b.pos.lerpVectors(b.from, to, Math.min(1, b.t));
        b.pos.y += Math.sin(Math.min(1, b.t) * Math.PI) * 0.4;
        if (b.t >= 1) {
          b.dead = true;
          this.startEating(s);
        }
      }
    }
    this.bowls = this.bowls.filter((b) => !b.dead);
  }

  nextEater() {
    for (const s of this.seats) if (s && s.st === 'wait' && s.sitting && !s.bowl) return s;
    return null;
  }

  handPos(s) {
    if (this.crowd) {
      const p = this.crowd.hand(this.soldiers.indexOf(s), new THREE.Vector3());
      if (p) return p.setY(p.y + 0.06);
    }
    return new THREE.Vector3(s.x - Math.sin(s.yaw) * 0.45, 1.12 - SIT_DROP, s.z - Math.cos(s.yaw) * 0.45);
  }

  serveBowl(k) {
    const s = this.nextEater();
    const x = s ? MAP.seats[s.seat][0] : MAP.counter[0] - 1.9 + this.bowls.filter((b) => !b.soldier).length * 0.5;
    const b = { phase: 'fly', soldier: s, pos: new THREE.Vector3(k.x, 1.3, k.z), t: KITCHEN.cook > 0 ? 0.22 : 0 };
    if (s) s.bowl = b;
    this.bowls.push(b);
    const spot = new THREE.Vector3(x, 1.08, MAP.counter[1] - (s ? 0.25 : -0.2));
    // ladled out with a little steam, then set down on the table
    this.fx.smoke.emit(k.x, 1.5, k.z, { vy: 1.5, color: 0xffffff, size: 1.2, life: 0.6, grow: 2, alpha: 0.6 });
    const from = b.pos.clone();
    this.tween(0.32, (t) => {
      b.pos.lerpVectors(from, spot, t);
      b.pos.y += Math.sin(t * Math.PI) * 0.9;
    }, () => {
      b.phase = 'table';
      b.pos.copy(spot);
      sfx.clink();
      this.fx.smoke.emit(spot.x, 1.3, spot.z, { vy: 1.2, color: 0xffffff, size: 0.7, life: 0.7, grow: 1.8, alpha: 0.5 });
    });
  }

  startEating(s) {
    s.st = 'eat';
    s.t = KITCHEN.eat;
    s.hasBowl = true;
    s.flip = false;
    s.bowl = null;
    this.fed++;
    sfx.fed();
    // the ration pays: two akçe fly to the cook
    const P = this.pasha;
    const p = this.project(s.x, 2.4, s.z);
    if (p.vis) this.hud.float(p.x, p.y, `+${ECON.akcePerRation}`, 'coin');
    for (let i = 0; i < ECON.akcePerRation; i++)
      this.later(0.12 + i * 0.12, () =>
        this.fly('coin', new THREE.Vector3(s.x, 1.6, s.z), () => new THREE.Vector3(P.x, 1.7, P.z), 0.5, () => {
          P.gold++;
          this.hud.coins(P.gold, true);
          sfx.coin();
        }, 1.8),
      );
  }

  rankPos(i) {
    const row = Math.floor(i / RANK_COLS);
    const col = i % RANK_COLS;
    return [(col - (RANK_COLS - 1) / 2) * 1.2 + (row % 2) * 0.3, this.rankFront + row * 1.3];
  }

  updateSoldiers(dt) {
    // free seats are taken by the next soldiers in line
    const line = this.soldiers.filter((s) => (s.st === 'arrive' || s.st === 'wait') && s.seat < 0);
    this.seats.forEach((occ, i) => {
      if (occ) return;
      const s = line.shift();
      if (!s) return;
      s.seat = i;
      s.sitting = false;
      this.seats[i] = s;
    });
    let li = 0;
    for (const s of this.soldiers) {
      s.cheer = Math.max(0, s.cheer - dt);
      if (s.delay > 0) {
        s.delay -= dt;
        continue;
      }
      let tx = null;
      let tz = null;
      let speed = 3.6;
      if (s.st === 'arrive' || s.st === 'wait') {
        if (s.seat >= 0) [tx, tz] = MAP.seats[s.seat];
        else {
          [tx, tz] = [MAP.line[0] + li * MAP.lineStep[0], MAP.line[1] + li * MAP.lineStep[1]];
          li++;
        }
      } else if (s.st === 'eat') {
        s.t -= dt;
        if (s.t <= 0) {
          // done: stand up and join the ranks under the banner
          s.st = 'go';
          s.hasBowl = false;
          s.sitting = false;
          this.seats[s.seat] = null;
          s.seat = -1;
          s.slot = this.rankIdx++;
          s.cheer = 0.6;
          this.fx.sparkle(s.x, 0.4, s.z, 0xffe9a0, 6);
        }
      } else if (s.st === 'go' || s.st === 'rank') {
        [tx, tz] = this.rankPos(s.slot);
        speed = 4.2;
      } else if (s.st === 'march') {
        const [rx] = this.rankPos(s.slot);
        tx = rx * 0.8;
        tz = -80;
        speed = 3.4;
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
        s.ph += dt * 10;
        s.walking = true;
        s.sitting = false;
        if (s.st === 'rank') s.st = 'go';
      } else {
        s.walking = false;
        if ((s.st === 'arrive' || s.st === 'wait') && s.seat >= 0) {
          s.st = 'wait';
          s.sitting = true;
          s.yaw = turn(s.yaw, SEAT_YAW, Math.min(1, dt * 12));
        } else if (s.st === 'arrive') {
          s.st = 'wait';
          s.yaw = turn(s.yaw, yawFor(MAP.counter[0] - s.x, MAP.counter[1] - s.z), Math.min(1, dt * 8));
        } else if (s.st === 'wait') s.yaw = turn(s.yaw, yawFor(MAP.counter[0] - s.x, MAP.counter[1] - s.z), Math.min(1, dt * 8));
        else if (s.st === 'go' || s.st === 'rank') {
          s.st = 'rank';
          s.yaw = turn(s.yaw, 0, Math.min(1, dt * 8));
          s.ph += dt * 2;
        }
      }
    }
  }

  spawnWave(n) {
    this.hud.callout(TEXT.newSoldiers, 'gold small');
    sfx.drum(0, 0.35);
    sfx.drum(0.2, 0.3);
    for (let i = 0; i < n; i++) {
      const s = this.newSoldier(MAP.arrive[0] + rnd(-1, 1), MAP.arrive[1] + i * 0.9);
      s.delay = i * 0.3;
    }
  }

  /* ───────────────────────── purchases ───────────────────────── */

  buy(pad) {
    const id = pad.def.id;
    const info = INFO[id];
    sfx.gateGood(true);
    const p = this.project(pad.def.x, 2.5, pad.def.z);
    this.hud.float(p.x, p.y, `${info.name}!`, 'good');
    this.fx.sparkle(pad.def.x, 0, pad.def.z, 0xffe9a0, 26);
    this.shake = Math.max(this.shake, 0.18);
    this.stage++;
    if (id === 'hamal') {
      const H = this.hamal;
      H.active = true;
      H.spawn = 0;
      H.x = MAP.hamalTent[0] + 1.2;
      H.z = MAP.hamalTent[1] + 1.4;
      this.fx.bigDust(H.x, 0.2, H.z, 8, 1, 0xe0d0aa);
      this.focusHamal = 3.2;
      // the empty second hearth appears: the next thing to buy
      const h2 = this.kazanObjs[1].hearth;
      h2.visible = true;
      this.tween(0.45, (k) => h2.scale.setScalar(Math.max(0.01, easeOutBack(k))));
      this.later(0.6, () => {
        this.pads[1].show();
        sfx.tap();
      });
      this.later(1.0, () => this.spawnWave(ECON.waves[1]));
    } else if (id === 'kazan2') {
      // the second cauldron drops onto its hearth
      const k = this.kazans[1];
      const pot = this.kazanObjs[1].pot;
      pot.visible = true;
      this.tween(0.45, (t) => (pot.position.y = 7 * (1 - t * t)), () => {
        pot.position.y = 0;
        k.active = true;
        sfx.boom(false);
        sfx.clink();
        this.shake = Math.max(this.shake, 0.3);
        this.fx.bigDust(k.x, 0.3, k.z, 12, 1.4, 0xd8c8a0);
        this.tween(0.25, (t) => (pot.position.y = Math.sin(t * Math.PI) * 0.25));
      });
      // the tarp comes off the cannon
      this.later(0.9, () => this.uncoverCannon());
      this.later(1.3, () => this.spawnWave(ECON.waves[2]));
    } else if (id === 'cannon') {
      this.rollCannon();
    }
  }

  uncoverCannon() {
    this.cannon.visible = true;
    const t0 = this.tarp.position.clone();
    sfx.whoosh();
    this.tween(1.1, (k) => {
      this.tarp.position.set(t0.x + k * 2.5, k * 5 + Math.sin(k * 6) * 0.3, t0.z - k * 1.5);
      this.tarp.rotation.set(k * 1.4, 0.9 + k * 2, k * 0.6);
      this.tarp.scale.setScalar(Math.max(0.01, 1 - k * k));
    }, () => (this.tarp.visible = false));
    this.fx.bigDust(t0.x, 0.3, t0.z, 10, 1.4, 0xd8c8a0);
    this.later(0.7, () => {
      this.pads[2].show();
      sfx.tap();
    });
  }

  rollCannon() {
    const c = this.cannon;
    const from = c.position.clone();
    const to = new THREE.Vector3(MAP.mevzi[0], 0, MAP.mevzi[1]);
    const aim = yawFor(MAP.tower[0] - to.x, MAP.tower[1] - to.z);
    const y0 = c.rotation.y;
    const travel = yawFor(to.x - from.x, to.z - from.z);
    const len = from.distanceTo(to);
    sfx.march();
    this.tween(2.0, (k) => {
      const e = easeInOut(k);
      c.position.lerpVectors(from, to, e);
      c.rotation.y = k < 0.25 ? turn(y0, travel, k * 4) : k > 0.7 ? turn(travel, aim, (k - 0.7) / 0.3) : travel;
      for (const w of c.wheels) w.rotation.x = (-e * len) / 0.62;
      if (Math.random() < 0.5) this.fx.dust(c.position.x, c.position.z, 1);
    }, () => {
      this.fx.bigDust(to.x, 0.3, to.z, 10, 1.6, 0xd8c8a0);
      this.firePad.show();
      sfx.tap();
    });
    // the fed soldiers form up in front of the pass
    this.rankFront = MAP.front;
    for (const s of this.soldiers) if (s.st === 'rank') s.st = 'go';
  }

  /* ───────────────────────── the shot ───────────────────────── */

  nearCannon() {
    return this.near(this.firePad.def.x, this.firePad.def.z, 3.2) || this.near(this.cannon.position.x, this.cannon.position.z, 3.6);
  }

  get fireReady() {
    return this.firePad.active && !this.fired && this.state === 'play';
  }

  fire() {
    if (!this.fireReady || !this.nearCannon()) return;
    this.fired = true;
    this.firePad.done = true;
    this.state = 'fire';
    this.stateT = 0;
    this.hud.fireButton(false);
    const c = this.cannon;
    const yaw = c.rotation.y;
    const barrel = c.barrel;
    this.tween(0.4, (k) => (barrel.position.z = -0.1 + Math.sin(k * Math.PI) * 0.45));
    const muzzle = new THREE.Vector3(c.position.x - Math.sin(yaw) * 2.2, 1.45, c.position.z - Math.cos(yaw) * 2.2);
    this.fx.glow.emit(muzzle.x, muzzle.y, muzzle.z, { color: 0xffd28a, size: 4, life: 0.2, grow: 2.5 });
    for (let i = 0; i < 14; i++)
      this.fx.smoke.emit(muzzle.x, muzzle.y, muzzle.z, { vx: rnd(-1.5, 1.5) - Math.sin(yaw) * 5, vy: rnd(0.5, 2.5), vz: rnd(-1.5, 1.5) - Math.cos(yaw) * 5, color: 0xd8d2c6, size: rnd(1.0, 1.8), life: rnd(0.9, 1.5), grow: 2, alpha: 0.5 });
    sfx.boom(true);
    this.shake = 0.5;
    const to = new THREE.Vector3(MAP.tower[0], 4.5, MAP.tower[1] + 1.2);
    this.fx.balls.shoot(muzzle, to, 1.0, 5, () => this.collapse(to));
  }

  collapse(at) {
    sfx.boom(true);
    sfx.collapse();
    this.shake = 0.9;
    this.collapsing = true;
    this.fx.glow.emit(at.x, at.y, at.z, { color: 0xffb060, size: 9, life: 0.3, grow: 2 });
    this.fx.bigDust(at.x, 2, at.z, 40, 5, 0xbcae94);
    this.towerParts.forEach((p, i) => {
      p.vy = rnd(1, 4) + i;
      p.vx = rnd(-2.5, 2.5);
      p.vz = rnd(1, 3.5);
      p.ax = rnd(-1.5, 1.5);
      p.az = rnd(-1.5, 1.5);
      p.delay = i * 0.08;
    });
    for (let i = 0; i < 40; i++)
      this.fx.debris.emit(at.x + rnd(-1.5, 1.5), rnd(1, 8), at.z + rnd(-1, 1), { vx: rnd(-7, 7), vy: rnd(3, 11), vz: rnd(-3, 8), color: i % 3 ? 0xb2a690 : 0x8f8470, sx: rnd(0.3, 0.7), sy: rnd(0.3, 0.6), sz: rnd(0.3, 0.6), life: 2.5 });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.top) {
        e.alive = false;
        this.fx.poof(e.x, e.y, e.z, C.enemyCoat);
      } else e.flee = true;
    }
    // the gate falls in
    const g = this.gate.gate;
    this.later(0.35, () => {
      this.tween(0.6, (k) => (g.rotation.x = -(k * k) * Math.PI * 0.48), () => {
        this.fx.bigDust(0, 0.5, MAP.pass - 1.5, 20, 3, 0xbcae94);
        sfx.boom(false);
        this.shake = Math.max(this.shake, 0.4);
      });
    });
    this.later(1.2, () => {
      this.hud.callout(TEXT.victory, 'gold mid');
      sfx.victory();
      this.soldiers.forEach((s) => {
        s.st = 'march';
        s.delay = Math.floor(s.slot / RANK_COLS) * 0.25;
        s.sitting = false;
      });
      sfx.march();
    });
    this.later(2.6, () => {
      this.state = 'won';
      this.stateT = 0;
    });
    this.later(5.4, () => {
      if (this.ended) return;
      this.ended = true;
      this.onEnd(true);
    });
  }

  updateCollapse(dt) {
    if (!this.collapsing) return;
    for (const p of this.towerParts) {
      if (!p.m.visible) continue;
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
      if (p.m.position.y < 0.3 && p.vy < 0 && !p.landed) {
        p.landed = true;
        this.fx.bigDust(this.tower.position.x + p.m.position.x, 0.5, this.tower.position.z + p.m.position.z, 6, 2, 0xbcae94);
      }
      if (p.m.position.y < -3) p.m.visible = false;
    }
    for (const e of this.enemies) {
      if (!e.alive || !e.flee) continue;
      e.z -= dt * 5;
      e.ph += dt * 12;
      if (e.z < MAP.tower[1] - 10) e.alive = false;
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

  /* ───────────────────────── guidance ───────────────────────── */

  objective() {
    const P = this.pasha;
    if (this.state !== 'play') return null;
    if (this.fireReady) return { tip: 'fire', x: this.firePad.def.x, z: this.firePad.def.z };
    const pad = this.currentPad;
    const left = pad ? pad.total - pad.paid - (pad.inbound || 0) : 0;
    if (pad && left > 0 && (P.gold >= left || (P.gold > 0 && this.near(pad.def.x, pad.def.z, 3)))) return { tip: 'pay', x: pad.def.x, z: pad.def.z };
    if (P.stack > 0 || P.pending > 0) {
      const k = this.bestKazan(P.x, P.z);
      return { tip: 'kazan', x: k.x, z: k.z };
    }
    if (this.demand() > 0) return { tip: 'sack', x: MAP.pile[0], z: MAP.pile[1] };
    if (pad) return { tip: left > 0 && P.gold < left ? 'wait' : 'pay', x: pad.def.x, z: pad.def.z };
    return null;
  }

  updateGuide() {
    const o = this.objective();
    this.obj = o;
    if (o && o.tip !== 'wait') this.guide.set(o.x, o.z);
    else if (o) this.guide.set(o.x, o.z);
    else this.guide.set(null);
  }

  /* ───────────────────────── render ───────────────────────── */

  draw(dt) {
    const B = this.batches;
    const P = this.pasha;
    const st = this.state;
    const end = st === 'won';
    B.cook.begin();
    B.cook.push(P.x, 0, P.z, P.yaw, P.ph, end ? 3 : P.moving ? (P.stack ? 6 : 0) : P.stack ? 1 : 2);
    B.cook.end();
    if (end) P.ph += dt * 6;

    B.hamal.begin();
    const H = this.hamal;
    if (H.active) B.hamal.push(H.x, 0, H.z, H.yaw, H.ph, H.moving ? (H.load ? 6 : 0) : 2, Math.max(0.01, easeOutBack(H.spawn)));
    B.hamal.end();

    B.jan.begin();
    for (const s of this.soldiers) {
      let mode = 2;
      let y = 0;
      if (s.walking) mode = 0;
      else if (s.st === 'eat') {
        mode = 5;
        y = -SIT_DROP;
      } else if (s.sitting) {
        mode = s.flip ? 5 : 4;
        y = -SIT_DROP;
      } else if (s.cheer > 0) mode = 3;
      if (st === 'won' && !s.walking) mode = 3;
      if (s.st === 'march') mode = 0;
      if (s.st === 'march' && s.delay > 0) mode = 3;
      if (!s.walking && s.st === 'rank') s.ph += dt * 1.5;
      if (mode === 3) s.ph += dt * 6;
      if (this.crowd) this.crowd.update(this.soldiers.indexOf(s), s.x, s.z, s.yaw, mode === 5 && s.flip ? 6 : mode, dt, s.st === 'march' ? 3.4 : 3.8);
      else B.jan.push(s.x, y, s.z, s.yaw, s.ph, mode);
    }
    B.jan.end();
    this.crowd?.hideFrom(this.soldiers.length);

    B.enemy.begin();
    for (const e of this.enemies) if (e.alive) B.enemy.push(e.x, e.y, e.z, e.flee ? 0 : ENEMY_YAW, (e.ph += dt * (e.flee ? 0 : 1.5)), e.flee ? 0 : 2);
    B.enemy.end();

    // hungry bubbles
    let hi = 0;
    for (const s of this.soldiers) {
      if (!(s.st === 'wait' || s.st === 'arrive') || s.bowl || hi >= this.hungryIcons.length) continue;
      const ic = this.hungryIcons[hi++];
      ic.visible = this.state === 'play';
      ic.position.set(s.x, (s.sitting ? 2.5 - SIT_DROP : 2.6) + Math.sin(this.time * 4 + s.ph) * 0.08, s.z);
    }
    for (; hi < this.hungryIcons.length; hi++) this.hungryIcons[hi].visible = false;

    const I = this.items;
    I.begin();
    for (let i = 0; i < this.pile; i++) {
      const p = this.pileSlot(i);
      I.put('sack', p.x, p.y, p.z, i * 0.7);
    }
    const back = (c, n, base) => {
      for (let i = 0; i < n; i++) {
        const p = this.backTop(c, i, base);
        const sway = Math.sin(this.time * 7 + i * 0.4) * (c.moving ? 1 : 0.25) * i * 0.045;
        I.put('sack', p.x + Math.cos(c.yaw) * sway, p.y - 0.18, p.z - Math.sin(c.yaw) * sway, c.yaw + Math.PI / 2 + i * 0.25, 1, 0, sway);
      }
    };
    back(P, P.stack, 1.0);
    if (H.active) back(H, H.load, 1.2);
    for (const b of this.bowls) I.put('bowl', b.pos.x, b.pos.y, b.pos.z, 0);
    for (const s of this.soldiers) {
      if (s.hasBowl) {
        const p = this.handPos(s);
        const lift = s.st === 'eat' ? Math.max(0, 1 - s.t / KITCHEN.eat) * 0.35 : 0;
        I.put('bowl', p.x, p.y + lift, p.z, s.yaw, 1, -lift * 1.2);
      } else if (s.flip && s.sitting) {
        // the first Janissary turns his empty bowl upside down: nothing falls out
        const p = this.handPos(s);
        const k = (Math.sin(this.time * 2.4) + 1) / 2;
        I.put('bowl', p.x, p.y + 0.1 + k * 0.25, p.z, s.yaw, 1, Math.PI * k);
      }
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
    const st = this.state;
    const iso = (x, z, h, d) => [new THREE.Vector3(x + d * 0.26, h, z + d * 0.97), new THREE.Vector3(x, 0, z)];
    let pos;
    let look;
    if (st === 'fire') {
      [pos, look] = iso(0.8, -29, lerp(25, 18, t), lerp(19, 15, t));
    } else if (st === 'won') {
      [pos, look] = iso(0, -20, lerp(44, 30, t), lerp(34, 26, t));
    } else {
      // close on the kitchen at first, opening up as the camp grows
      const s = Math.min(3, this.stage);
      const hs = [15, 17.5, 20, 23][s];
      const ds = [12.5, 14, 16, 18.5][s];
      const focus = this.stage >= 3 ? [1.5, -9] : this.stage ? [0.6, -2.4] : [-0.2, -2.4];
      let cx = lerp(P.x, focus[0], 0.5);
      let cz = lerp(P.z, focus[1], 0.55);
      this.focusHamal = Math.max(0, this.focusHamal - dt);
      if (this.focusHamal > 0 && this.hamal.active) {
        const k = Math.min(1, this.focusHamal) * 0.35;
        cx = lerp(cx, this.hamal.x, k);
        cz = lerp(cz, this.hamal.z, k);
      }
      [pos, look] = iso(cx, cz - t * 1.5, lerp(hs, hs * 1.05, t), lerp(ds, ds * 0.95, t));
    }
    const kk = this.snapCam ? 1 : Math.min(1, dt * (st === 'play' ? 4 : 1.6));
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
    const st = this.state;
    const playing = st === 'play';
    // the first Janissary complains until the first bowl is served
    const s0 = this.soldiers[0];
    const sp = this.project(s0.x, 2.9 - SIT_DROP, s0.z);
    this.hud.setTip('hungry', TEXT.hungry, sp.x, sp.y, playing && this.fed === 0 && !s0.bowl && sp.vis && this.time > 0.4);
    this.hud.quest(playing ? this.questInfo() : null);
    const top = this.backTop(P, P.stack, 1.0);
    const tp = this.project(P.x, top.y + 0.45, P.z);
    this.hud.stackCount(playing ? P.stack : 0, PLAYER.stackMax, tp.x, tp.y);
    // the one drag gesture toward the sacks
    if (playing && !this.moved) {
      const a = this.project(P.x, 0.2, P.z);
      const b = this.project(MAP.pile[0], 0.2, MAP.pile[1]);
      this.hud.dragHint(this.time > 0.6, a.x, a.y + 40, b.x, b.y + 40);
    } else this.hud.dragHint(false);
    // cards over open plots
    const cards = [];
    if (playing) {
      for (const pad of this.activePads) {
        const q = this.project(pad.def.x, 2.4, pad.def.z);
        if (!q.vis) continue;
        const info = INFO[pad.def.id];
        cards.push({ id: pad.def.id, x: q.x, y: q.y, name: info.name, desc: info.desc, k: pad.paid / pad.total, main: true });
      }
    }
    this.hud.cards(cards);
    // fire button next to the cannon
    const nearFire = this.fireReady && this.nearCannon();
    if (nearFire) {
      this.hud.fireButton(true, this.width / 2, this.height - Math.min(150, this.height * 0.2));
    } else this.hud.fireButton(false);
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
    const P = this.pasha;
    const o = this.obj;
    const now = o ? TEXT.tips[o.tip] || '' : '';
    if (this.fireReady) return { step: '⚔', title: TEXT.openPass, sub: TEXT.tips.fire, icon: 'battle', k: 1 };
    const next = this.pads.find((p) => !p.done);
    if (!next || !next.active || this.fed < ECON.waves[0]) {
      const n = ECON.waves[0];
      return { step: `${Math.min(this.fed, n)}/${n}`, title: TEXT.feed, sub: now, icon: 'bowl', k: Math.min(1, this.fed / n) };
    }
    const idx = this.pads.indexOf(next) + 1;
    const info = INFO[next.def.id];
    const have = Math.min(next.total, next.paid + P.gold);
    return { step: `${idx}/${this.pads.length}`, title: info.quest, sub: `${have}/${next.total} akçe · ${now}`, icon: 'gold', k: have / next.total };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
