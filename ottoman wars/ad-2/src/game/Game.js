import * as THREE from '../vendor/three.module.min.js';
import { ARMY, COLORS as C, FINALE, LEVEL, ROAD, TEXT } from '../config.js';
import { Environment } from '../world/Environment.js';
import { MODELS } from '../world/Models.js';
import { UnitBatch } from '../world/UnitBatch.js';
import { Castle, GatePair, Spikes, WarBanner, isGood, opLabel } from '../world/Props.js';
import { Fx } from '../fx/Fx.js';
import { sfx } from '../audio/Sfx.js';

const GOLDEN = 2.399963;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const rnd = (a, b) => a + (b - a) * Math.random();
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);

let uid = 0;

export class Game {
  constructor(renderer, hud, { onEnd }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1600);
    this.env = new Environment(this.scene);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.04 });
    this.batches = {
      j: new UnitBatch(this.scene, MODELS.janissary(), ARMY.maxVisible, mat),
      r: new UnitBatch(this.scene, MODELS.rider(), 90, mat),
      e: new UnitBatch(this.scene, MODELS.enemy(), 150, mat),
      a: new UnitBatch(this.scene, MODELS.archer(), 12, mat),
    };
    this.fx = new Fx(this.scene);
    this.castle = new Castle(this.scene, -FINALE.castleD);
    this.tweens = [];
    this.shake = 0;
    this.camPos = new THREE.Vector3(0, 30, 40);
    this.camLook = new THREE.Vector3(0, 0, -10);
    this.width = 1;
    this.height = 1;
    this._v = new THREE.Vector3();
    this.props = [];
    this.banner = new WarBanner(this.scene, C.coat, { height: 5.6, w: 2.1, h: 1.4 });
    this.banner.group.rotation.y = -Math.PI / 2;
    this.reset();
  }

  /* ───────────────────────── setup ───────────────────────── */

  reset() {
    for (const p of this.props) p.dispose?.();
    this.props.forEach((p) => p.group && this.scene.remove(p.group));
    this.props.forEach((p) => p.mesh && this.scene.remove(p.mesh));
    this.props.forEach((p) => p.glow && this.scene.remove(p.glow));
    this.props = [];
    (this.squads || []).forEach((s) => this.scene.remove(s.banner.group));
    this.tweens = [];
    this.time = 0;
    this.stateT = 0;
    this.state = 'intro';
    this.ended = false;
    this.touched = false;
    this.idle = 0;
    this.army = { d: 0, x: 0, tx: 0, speed: 0, units: [], hw: 1, front: 0 };
    for (let i = 0; i < ARMY.start; i++) this.addUnit('j', 0, 0, false);
    this.relayout(true);
    for (const u of this.army.units) {
      u.x = u.ox;
      u.z = u.oz;
    }
    this.events = LEVEL.map((ev) => ({ ...ev, done: false }));
    this.squads = [];
    for (const ev of this.events) {
      if (ev.type === 'gate') ev.obj = new GatePair(this.scene, ev);
      else if (ev.type === 'spikes') ev.obj = new Spikes(this.scene, ev);
      else if (ev.type === 'squad') ev.obj = this.makeSquad(ev.n, ev.x || 0, ev.d);
      if (ev.obj && ev.type !== 'squad') this.props.push(ev.obj);
    }
    this.finale = this.makeSquad(FINALE.armyN, 0, FINALE.armyD, true);
    this.gateHp = FINALE.gateHp;
    this.archers = this.castle.archerSpots.map((p) => ({ x: p.x, y: p.y, z: p.z, ph: rnd(0, 6), alive: true }));
    // castle back to enemy hands
    this.castle.door.visible = true;
    this.castle.door.position.set(0, 0, -0.6);
    this.castle.door.rotation.set(0, 0, 0);
    this.castle.merlons.forEach((m) => (m.visible = true));
    this.castle.bannerMat.color.setHex(C.enemyCoat);
    this.hud.reset();
    this.hud.showTitle(true);
    this.hud.showHand(false);
    this.hud.showTop(false);
    this.camPos.set(0, 34, 46);
    this.camLook.set(0, 0, -30);
    this.foe = null;
    this.killT = 0;
    this.siegeT = 0;
    this.arrowT = 0;
  }

  makeSquad(n, x, d, finale = false) {
    const units = [];
    const c = finale ? 0.52 : 0.44;
    for (let i = 0; i < n; i++) {
      const r = c * Math.sqrt(i + 0.5);
      const a = i * GOLDEN;
      units.push({ id: uid++, x: x + Math.cos(a) * r * (finale ? 1.5 : 1), z: -d + Math.sin(a) * r * 0.9, ph: rnd(0, 6), flash: 0, alive: true });
    }
    const R = c * Math.sqrt(n + 0.5) * 0.9;
    const banner = new WarBanner(this.scene, C.enemyCoat, finale ? { height: 6, w: 2.2, h: 1.4 } : {});
    banner.group.position.set(x, 0, -d - R * 0.5);
    const s = { id: `s${uid++}`, d, x, units, R, finale, engaged: false, done: false, banner };
    this.squads.push(s);
    return s;
  }

  addUnit(kind, x, z, pop = true) {
    const u = { id: uid++, kind, x, z, ox: 0, oz: 0, ph: rnd(0, 6), spawn: pop ? 0 : 1, flash: 0, yaw: 0, vx: 0 };
    this.army.units.push(u);
    return u;
  }

  get count() {
    return this.army.units.length;
  }

  // Sunflower formation: janissaries in a disc, akıncı riders as a vanguard wedge in front.
  relayout() {
    const A = this.army;
    const js = A.units.filter((u) => u.kind === 'j');
    const rs = A.units.filter((u) => u.kind === 'r');
    const cj = Math.min(ARMY.spacing * 0.56, (ROAD.half - 0.6) / Math.sqrt(Math.max(1, js.length)));
    js.forEach((u, i) => {
      const r = cj * Math.sqrt(i + 0.5);
      const a = i * GOLDEN;
      u.ox = Math.cos(a) * r;
      u.oz = Math.sin(a) * r * 0.85;
    });
    const Rj = js.length ? cj * Math.sqrt(js.length + 0.5) : 0;
    const cr = Math.min(ARMY.riderSpacing * 0.56, (ROAD.half - 0.9) / Math.sqrt(Math.max(1, rs.length)));
    const Rr = rs.length ? cr * Math.sqrt(rs.length + 0.5) : 0;
    const off = rs.length ? -(Rj * 0.85 + 1.0 + Rr) : 0;
    rs.forEach((u, i) => {
      const r = cr * Math.sqrt(i + 0.5);
      const a = i * GOLDEN;
      u.ox = Math.cos(a) * r;
      u.oz = off + Math.sin(a) * r * 0.9;
    });
    A.hw = Math.max(Rj, Rr, 0.4);
    A.front = rs.length ? -off + Rr : Rj * 0.85;
  }

  /* ───────────────────────── input ───────────────────────── */

  drag(dxPx) {
    const k = (ROAD.width * 1.35) / Math.max(320, Math.min(this.width, this.height * 1.1));
    this.army.tx += dxPx * k;
    this.touched = true;
    this.idle = 0;
  }

  press() {
    if (this.state === 'ready') this.begin();
    this.idle = 0;
  }

  begin() {
    this.state = 'run';
    this.stateT = 0;
    this.hud.showTitle(false);
    this.hud.showHand(false);
    this.hud.showTop(true);
    sfx.charge();
  }

  /* ───────────────────────── helpers ───────────────────────── */

  tween(time, fn, done) {
    this.tweens.push({ t: 0, time, fn, done });
  }

  project(x, y, z) {
    const v = this._v.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, vis: v.z < 1 };
  }

  kill(u, color = C.coat) {
    const A = this.army;
    const i = A.units.indexOf(u);
    if (i < 0) return;
    A.units.splice(i, 1);
    this.fx.poof(u.x, 0, u.z, u.kind === 'r' ? C.saddle : color);
    sfx.poof();
  }

  killEnemy(s, e) {
    e.alive = false;
    this.fx.poof(e.x, 0, e.z, C.enemyCoat);
  }

  applyGate(ev, side) {
    const o = side < 0 ? ev.left : ev.right;
    const A = this.army;
    const n0 = this.count;
    const gx = (side * ROAD.half) / 2;
    const gz = -ev.d;
    let add = 0;
    let remove = 0;
    if (o.op === '+') add = o.n;
    if (o.op === 'x') add = n0 * (o.n - 1);
    if (o.op === '-') remove = Math.min(o.n, n0 - 1);
    if (o.op === '/') remove = n0 - Math.max(1, Math.ceil(n0 / o.n));
    const kind = o.kind === 'rider' ? 'r' : 'j';
    for (let i = 0; i < add; i++) {
      const u = this.addUnit(kind, gx + rnd(-2.4, 2.4), gz + rnd(-0.5, 1.5));
      u.spawn = -i * 0.004; // tiny stagger for the pop-in
    }
    if (remove) {
      const pool = [...A.units].sort((a, b) => Math.abs(b.x - gx) - Math.abs(a.x - gx));
      pool.slice(0, remove).forEach((u, i) => this.tween(0.02 * i + 0.01, () => {}, () => this.kill(u)));
    }
    this.relayout();
    const good = isGood(o);
    const p = this.project(gx, 3.6, gz);
    this.hud.float(p.x, p.y, opLabel(o), good ? 'good' : 'bad');
    ev.obj.pass(side, (time, fn) => this.tween(time, fn));
    this.fx.sparkle(gx, 0, gz, good ? 0x9fdcff : 0xff9a9a, 26);
    if (good) sfx.gateGood(o.op === 'x' || o.n >= 25);
    else sfx.gateBad();
    if (kind === 'r') this.hud.callout(`${TEXT.akinci}!`, 'gold');
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

    const A = this.army;
    const st = this.state;

    if (st === 'intro') {
      if (this.stateT > 1.6) {
        this.state = 'ready';
        this.stateT = 0;
        this.hud.showHand(true);
      }
    } else if (st === 'ready') {
      if (this.stateT > 6) this.begin();
    } else if (st === 'run' || st === 'march') {
      A.speed = lerp(A.speed, ARMY.speed, Math.min(1, dt * 3));
      A.d += A.speed * dt;
      this.idle += dt;
      if (!this.touched && this.stateT > 2.2) this.hud.showHand(true);
      if (this.touched) this.hud.showHand(false);
      this.checkEvents();
    } else if (st === 'battle') {
      this.updateBattle(dt);
    } else if (st === 'siege') {
      this.updateSiege(dt);
    }

    // steering (always responsive while the army moves)
    const lim = Math.max(0, ROAD.half - 0.45 - A.hw);
    A.tx = clamp(A.tx, -lim, lim);
    if (st !== 'siege' && st !== 'win') A.x = lerp(A.x, A.tx, Math.min(1, dt * ARMY.steer));

    this.updateUnits(dt);
    this.updateEnemies(dt);
    for (const p of this.props) p.update?.(this.time);
    this.castle.update(this.time, dt);
    this.env.update(this.time, this.camPos.z);
    this.env.follow(A.x, -A.d);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.updateHud();
  }

  checkEvents() {
    const A = this.army;
    for (const ev of this.events) {
      if (ev.done) continue;
      if (ev.type === 'gate' && A.d >= ev.d) {
        ev.done = true;
        this.applyGate(ev, A.x < 0 ? -1 : 1);
      } else if (ev.type === 'spikes') {
        if (A.d - A.hw - 4 > ev.d) ev.done = true;
        else if (A.d + A.front + 2 > ev.d) {
          // a barricade can take at most ~35% of the army
          if (ev.budget == null) ev.budget = Math.ceil(this.count * 0.35);
          let hit = 0;
          for (const u of [...A.units]) {
            // the stakes never wipe out the whole army (keeps the ad from ending on a cheap death)
            if (A.units.length <= 3 || ev.budget <= 0) break;
            if (ev.obj.blocks(u.x, u.z)) {
              this.kill(u, C.coat);
              ev.budget--;
              this.fx.debris.emit(u.x, 0.8, u.z, { vx: rnd(-3, 3), vy: rnd(3, 6), vz: rnd(-2, 2), color: 0x8a5a30, sx: 0.1, sy: 0.1, sz: 0.5, life: 1.2 });
              hit++;
            }
          }
          if (hit) {
            sfx.wood();
            this.shake = Math.max(this.shake, 0.12);
            this.relayout();
            if (!this.count) return this.lose();
          }
        }
      } else if (ev.type === 'squad' && !ev.obj.done && A.d + A.front >= ev.d - ev.obj.R - 1.2) {
        this.startBattle(ev.obj);
        return;
      }
    }
    const f = this.finale;
    if (!f.done && A.d + A.front >= f.d - f.R - 1.5) {
      this.startBattle(f);
      return;
    }
    if (f.done && A.d + A.front >= FINALE.castleD - 1.4) this.startSiege();
  }

  startBattle(s) {
    this.state = 'battle';
    this.stateT = 0;
    this.foe = s;
    s.engaged = true;
    this.killT = 0.25;
    this.hud.callout(TEXT.charge, 'red');
    sfx.charge();
    this.shake = 0.2;
  }

  updateBattle(dt) {
    const A = this.army;
    const s = this.foe;
    A.speed = lerp(A.speed, 0, Math.min(1, dt * 6));
    // close the gap
    if (A.d + A.front < s.d - 0.6) A.d += 5 * dt;
    const foes = s.units.filter((e) => e.alive);
    this.killT -= dt;
    if (this.killT <= 0 && foes.length && this.count) {
      const pairs = Math.min(foes.length, this.count);
      this.killT = clamp(1.7 / pairs, 0.03, 0.11);
      // front-most enemy vs closest soldier
      const fz = -A.d;
      foes.sort((a, b) => b.z - a.z);
      const e = foes[0];
      let best = null;
      let bd = 1e9;
      for (const u of A.units) {
        const d = (u.x - e.x) ** 2 + (u.z - e.z) ** 2;
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
      const mx = (e.x + best.x) / 2;
      const mz = (e.z + best.z) / 2;
      this.fx.clash(mx, 1.3, mz);
      sfx.clash();
      this.killEnemy(s, e);
      // akıncı charge: riders cut down an extra foe now and then
      const riders = A.units.filter((u) => u.kind === 'r').length;
      if (riders && Math.random() < (riders / this.count) * 0.9 && foes[1]) this.killEnemy(s, foes[1]);
      this.kill(best);
      this.relayout();
      void fz;
    }
    if (!this.count) return this.lose();
    if (!s.units.some((e) => e.alive)) {
      s.done = true;
      this.foe = null;
      this.hud.hideBubble(s.id);
      this.state = s.finale ? 'march' : 'run';
      this.stateT = 0;
      if (s.finale) this.hud.callout(TEXT.siege, 'gold');
    }
  }

  startSiege() {
    this.state = 'siege';
    this.stateT = 0;
    this.siegeT = 0;
    this.arrowT = 0.4;
    this.army.speed = 0;
    this.army.tx = 0;
    sfx.charge();
  }

  updateSiege(dt) {
    const A = this.army;
    A.x = lerp(A.x, 0, Math.min(1, dt * 3));
    const n = this.count;
    this.gateHp -= Math.min(8 + n * 0.5, 45) * dt;
    this.siegeT -= dt;
    const doorZ = -FINALE.castleD;
    if (this.siegeT <= 0) {
      this.siegeT = 0.34;
      const door = this.castle.door;
      door.position.z = -0.6 - 0.25;
      this.tween(0.18, (k) => (door.position.z = -0.85 + 0.25 * k));
      door.rotation.z = rnd(-0.02, 0.02);
      this.fx.bigDust(rnd(-2.5, 2.5), 0.5, doorZ + 0.6, 4, 1.5);
      this.fx.clash(rnd(-2.4, 2.4), rnd(1, 3), doorZ + 0.4);
      sfx.boom(false);
      this.shake = Math.max(this.shake, 0.18);
    }
    // archers on the walls
    this.arrowT -= dt;
    if (this.arrowT <= 0 && n) {
      this.arrowT = 0.3;
      const live = this.archers.filter((a) => a.alive);
      const a = live[Math.floor(Math.random() * live.length)];
      const u = A.units[Math.floor(Math.random() * A.units.length)];
      if (a && u) {
        const from = new THREE.Vector3(a.x, a.y + 1.6, a.z);
        const to = new THREE.Vector3(u.x, 1.0, u.z);
        sfx.arrow();
        this.fx.arrows.shoot(from, to, 0.55, 2.2, () => {
          if (this.state === 'siege' && A.units.includes(u)) {
            this.kill(u);
            this.relayout();
            if (!this.count) this.lose();
          }
        });
      }
    }
    if (this.gateHp <= 0) this.win();
  }

  win() {
    if (this.ended) return;
    this.ended = true;
    this.state = 'win';
    this.stateT = 0;
    const z = -FINALE.castleD;
    const door = this.castle.door;
    door.visible = false;
    for (let i = 0; i < 40; i++)
      this.fx.debris.emit(rnd(-2.8, 2.8), rnd(0.5, 6), z - 0.5, { vx: rnd(-7, 7), vy: rnd(4, 12), vz: rnd(4, 14), color: i % 3 ? 0x6b4424 : 0x3a3a40, sx: rnd(0.2, 0.9), sy: rnd(0.4, 1.6), sz: 0.25, life: 3 });
    this.castle.merlons.forEach((m, i) => {
      if (Math.abs(m.position.x) < 14 && Math.random() < 0.7) {
        this.tween(0.05 + i * 0.012, () => {}, () => {
          m.visible = false;
          this.fx.debris.emit(m.position.x, m.position.y, z - 0.3, { vx: rnd(-2, 2), vy: rnd(2, 6), vz: rnd(2, 6), color: 0xb8a990, sx: 0.9, sy: 1.1, sz: 0.8, life: 3 });
        });
      }
    });
    this.archers.forEach((a) => {
      a.alive = false;
      this.fx.poof(a.x, a.y, a.z, C.enemyCoat);
    });
    this.fx.bigDust(0, 1, z + 1, 40, 5);
    sfx.boom(true);
    this.shake = 0.9;
    this.hud.doFlash('rgba(255,240,200,0.9)');
    this.tween(0.6, () => {}, () => {
      this.castle.claim();
      sfx.victory();
      this.fx.confetti.burst(0, 6, z + 8, 160);
    });
    for (let i = 0; i < 5; i++)
      this.tween(0.9 + i * 0.35, () => {}, () => this.fx.firework(rnd(-14, 14), rnd(16, 24), z - rnd(2, 10), [0xffd36a, 0xff5a5a, 0x7ad0ff, 0xffffff][i % 4]));
    this.tween(2.7, () => {}, () => this.onEnd(true, this.count));
  }

  lose() {
    if (this.ended) return;
    this.ended = true;
    this.state = 'lose';
    this.stateT = 0;
    sfx.defeat();
    this.hud.siegeBar(0, 0, 0, false);
    this.tween(1.5, () => {}, () => this.onEnd(false, 0));
  }

  updateUnits(dt) {
    const A = this.army;
    const st = this.state;
    const marching = st === 'run' || st === 'march';
    const cx = A.x;
    const cz = -A.d;
    let dustT = (this._dustT = (this._dustT || 0) - dt);
    const B = this.batches;
    B.j.begin();
    B.r.begin();
    const fighting = st === 'battle' || st === 'siege';
    // during the siege the ranks squeeze toward the gate
    const squeeze = st === 'siege' ? 0.6 : 1;
    for (const u of A.units) {
      if (u.spawn < 1) u.spawn = Math.min(1, u.spawn + dt * 3.5);
      const tx = cx + u.ox * squeeze;
      const tz = cz + u.oz * (st === 'siege' ? 0.8 : 1);
      const kx = Math.min(1, dt * (u.spawn < 1 ? 5 : 8));
      const nx = lerp(u.x, tx, kx);
      const vx = (nx - u.x) / Math.max(dt, 1e-4);
      u.x = nx;
      if (marching) u.z = lerp(u.z - A.speed * dt, tz, Math.min(1, dt * 5));
      else u.z = lerp(u.z, tz, Math.min(1, dt * 4));
      const vz = marching ? -A.speed : (tz - u.z) * 4;
      let yaw = yawFor(vx * 0.6, Math.min(vz, -2));
      if (st === 'win') yaw = 0;
      u.yaw = lerp(u.yaw, yaw, Math.min(1, dt * 10));
      const mode = st === 'win' ? 3 : fighting ? 1 : marching || Math.abs(vx) > 1 ? 0 : 2;
      u.ph += dt * (mode === 0 ? (u.kind === 'r' ? 13 : 11) : mode === 1 ? 9 : 7);
      const s = u.spawn < 0 ? 0 : 1 - (1 - u.spawn) ** 3 + Math.sin(u.spawn * Math.PI) * 0.25;
      if (u.spawn > 0) (u.kind === 'r' ? B.r : B.j).push(u.x, 0, u.z, u.yaw, u.ph, mode, s, u.flash);
      u.flash = Math.max(0, u.flash - dt * 4);
    }
    B.j.end();
    B.r.end();
    // the sancak rides in the middle of the janissaries
    const bn = this.banner;
    bn.group.visible = A.units.length > 0;
    bn.group.position.set(lerp(bn.group.position.x, cx, Math.min(1, dt * 8)), 0, cz + 0.4);
    bn.update(this.time, marching ? clamp(A.speed / ARMY.speed, 0, 1) : 0.15);
    if (marching && dustT <= 0 && A.units.length) {
      this._dustT = 0.05;
      const u = A.units[Math.floor(Math.random() * A.units.length)];
      this.fx.dust(u.x, u.z + 0.3, u.kind === 'r' ? 2 : 1);
    }
  }

  updateEnemies(dt) {
    const A = this.army;
    const B = this.batches;
    B.e.begin();
    const camZ = this.camPos.z;
    for (const s of this.squads) {
      if (s.done && !s.units.some((e) => e.alive)) continue;
      // skip squads far behind / far ahead of the camera
      if (-s.d > camZ + 10 || -s.d < camZ - 260) continue;
      const engaged = this.foe === s;
      const lost = this.state === 'lose';
      for (const e of s.units) {
        if (!e.alive) continue;
        let mode = 2;
        let yaw = Math.PI;
        if (engaged) {
          // charge the army's front line
          const tx = A.x + (e.x - A.x) * 0.6;
          const tz = -A.d - A.front - 0.7;
          const dx = tx - e.x;
          const dz = tz - e.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.8) {
            const sp = Math.min(7, dist * 3) * dt;
            e.x += (dx / dist) * sp;
            e.z += (dz / dist) * sp;
            mode = 0;
            yaw = yawFor(dx, dz);
          } else mode = 1;
        }
        if (lost) mode = 3;
        e.ph += dt * (mode === 0 ? 11 : mode === 1 ? 9 : 2.5);
        B.e.push(e.x, 0, e.z, yaw, e.ph, mode === 2 ? 2 : mode, 1, e.flash);
      }
    }
    B.e.end();
    for (const s of this.squads) {
      const alive = s.units.filter((e) => e.alive);
      s.banner.group.visible = alive.length > 0;
      if (!alive.length) continue;
      if (this.foe === s) {
        let x = 0;
        let z = 0;
        for (const e of alive) {
          x += e.x;
          z += e.z;
        }
        s.banner.group.position.x = lerp(s.banner.group.position.x, x / alive.length, Math.min(1, dt * 5));
        s.banner.group.position.z = lerp(s.banner.group.position.z, z / alive.length - 0.5, Math.min(1, dt * 5));
      }
      s.banner.update(this.time, 0.15);
    }
    B.a.begin();
    for (const a of this.archers) if (a.alive) B.a.push(a.x, a.y, a.z, Math.PI, (a.ph += dt * 3), 2);
    B.a.end();
  }

  /* ───────────────────────── camera ───────────────────────── */

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h * 0.9);
  }

  updateCamera(dt) {
    const A = this.army;
    const aspect = this.width / this.height;
    const t = clamp((aspect - 0.6) / 0.9, 0, 1); // 0 portrait … 1 landscape
    const fov = lerp(62, 44, t);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const grow = 1 + clamp((A.hw - 1.5) / 3, 0, 1) * 0.3;
    let pos;
    let look;
    const st = this.state;
    if (st === 'intro' || st === 'ready') {
      const k = ease(clamp(this.stateT / 1.6, 0, 1));
      const k2 = st === 'ready' ? 1 : k;
      pos = new THREE.Vector3(lerp(8, 0, k2), lerp(22, lerp(10.5, 8.2, t), k2), lerp(-22, 12.5, k2) - A.d);
      look = new THREE.Vector3(0, 0, lerp(-2, lerp(-12, -24, t), k2) - A.d);
    } else if (st === 'siege' || st === 'win') {
      const z = -FINALE.castleD;
      const orbit = st === 'win' ? this.stateT * 0.18 : 0;
      const dist = lerp(34, 26, t);
      pos = new THREE.Vector3(Math.sin(orbit) * dist * 0.55, lerp(17, 11, t) + (st === 'win' ? this.stateT * 1.2 : 0), z + Math.cos(orbit) * dist);
      look = new THREE.Vector3(0, lerp(5, 5.5, t), z - 1);
    } else {
      const battle = st === 'battle' ? 1.12 : 1;
      const k = grow * battle;
      const py = lerp(10.5, 8.2, t) * k;
      const pz = lerp(12.5, 12.5, t) * k;
      pos = new THREE.Vector3(A.x * 0.5, py, -A.d + pz);
      look = new THREE.Vector3(A.x * 0.35, 0, -A.d - lerp(12, 24, t) * (st === 'battle' ? 0.8 : 1));
    }
    const kk = Math.min(1, dt * (st === 'intro' ? 6 : 3.2));
    this.camPos.lerp(pos, kk);
    this.camLook.lerp(look, kk);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * this.shake;
    this.camera.position.set(this.camPos.x + rnd(-1, 1) * sh, this.camPos.y + rnd(-1, 1) * sh, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  updateHud() {
    const A = this.army;
    const playing = this.state !== 'intro' && this.state !== 'ready';
    this.hud.setProgress(A.d / FINALE.castleD);
    // army badge
    if (playing && this.count && this.state !== 'win') {
      // in a fight our badge sits over the rear ranks so it never covers the enemy's
      const fight = this.state === 'battle';
      const p = this.project(A.x, fight ? 2.6 : 3.4 + A.hw * 0.15, -A.d + (fight ? A.hw * 0.9 : -A.front * 0.3));
      this.hud.bubble('army', p.x, p.y, this.count, 'red', p.vis);
    } else this.hud.bubble('army', 0, 0, 0, 'red', false);
    // enemy badges
    for (const s of this.squads) {
      const alive = s.units.filter((e) => e.alive);
      if (!alive.length || -s.d > this.camPos.z || -s.d < this.camPos.z - 160) {
        this.hud.bubble(s.id, 0, 0, 0, 'blue', false);
        continue;
      }
      let x = 0;
      let z = 0;
      for (const e of alive) {
        x += e.x;
        z += e.z;
      }
      const p = this.project(x / alive.length, this.foe === s ? 4.4 : 3.6, z / alive.length - (this.foe === s ? s.R * 0.6 : 0));
      this.hud.bubble(s.id, p.x, p.y, alive.length, 'blue', p.vis);
    }
    // gate HP during siege
    if (this.state === 'siege') {
      const p = this.project(0, 8.2, -FINALE.castleD + 0.5);
      this.hud.siegeBar(p.x, p.y, this.gateHp / FINALE.gateHp, true);
    } else this.hud.siegeBar(0, 0, 0, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
