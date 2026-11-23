import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { ROWS, COLS, TYPES, inside, isSpecial, movable, findGroups, swapCells, listMoves, blastCells, neighbours } from './Board.js';
import { Pieces, ANIMAL_COLORS } from '../world/Pieces.js';
import { Grove, cellX, cellZ, slab } from '../world/Grove.js';
import { Fx } from '../fx/Fx.js';
import { sfx } from '../audio/Sfx.js';
import { LEVEL, TEXT } from '../config.js';

// One short level of Bloop Grove. All timing runs through update(), so pausing the ad pauses the game.

const PY = 0.27; // where a Bloop's feet stand
const rnd = (a, b) => a + (b - a) * Math.random();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const EASE = {
  lin: (t) => t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  in: (t) => t * t,
};
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const HONEY_IDS = Object.keys(LEVEL.honey);

export class Game {
  constructor(renderer, hud, { models, onEnd }) {
    this.renderer = renderer;
    this.hud = hud;
    this.onEnd = onEnd;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe6f2);
    this.scene.fog = new THREE.Fog(0xcdebdc, 26, 62);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 120);
    this.camTarget = new THREE.Vector3(0, 0.3, 0.3);
    this.camDir = new THREE.Vector3();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.25;

    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6d8a4a, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0d6, 1.7);
    sun.position.set(-5, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    this.pieces = new Pieces(models, env);
    this.grove = new Grove(this.scene);
    this.fx = new Fx(this.scene);

    this.views = new Set();
    this.timers = [];
    this.tweens = [];
    this.waiters = [];
    this.pending = [];
    this.bg = [];
    this.time = 0;
    this.step = 0;
    this.shake = 0;
    this.idle = 0;
    this.busy = true;
    this.state = 'intro';
    this.drag = null;
    this.selected = null;
    this.hintMove = null;

    // selection ring
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);

    // bee direction marker (a flat double arrow under the bee)
    const s = new THREE.Shape();
    const L = 0.36;
    const T = 0.05;
    const H = 0.13;
    s.moveTo(-L, 0).lineTo(-L + H, H).lineTo(-L + H, T).lineTo(L - H, T).lineTo(L - H, H).lineTo(L, 0).lineTo(L - H, -H).lineTo(L - H, -T).lineTo(-L + H, -T).lineTo(-L + H, -H).lineTo(-L, 0);
    this.arrowGeo = new THREE.ShapeGeometry(s);
    this.arrowGeo.rotateX(-Math.PI / 2);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });

    this.setupLevel();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PY + 0.35));
    this.start();
  }

  // ---------- timing helpers ----------
  wait(s) {
    return new Promise((res) => this.timers.push({ t: s, res }));
  }
  tween(dur, fn, ease = EASE.out) {
    return new Promise((res) => this.tweens.push({ t: 0, dur, fn, ease, res }));
  }
  until(cond) {
    return new Promise((res) => this.waiters.push({ cond, res }));
  }
  async flushPending() {
    while (this.pending.length) await Promise.all(this.pending.splice(0));
  }

  // ---------- level ----------
  setupLevel() {
    this.moves = LEVEL.moves;
    this.honey = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.honeyMesh = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.honeyMat = new THREE.MeshStandardMaterial({ color: 0xffb21f, roughness: 0.12, metalness: 0, emissive: 0xb85c00, emissiveIntensity: 0.32, transparent: true, opacity: 0.9, envMapIntensity: 1.2 });
    this.honeyGeo1 = slab(0.9, 0.9, 0.2, 0.05, 0.03);
    this.honeyGeo2 = slab(0.74, 0.74, 0.18, 0.05, 0.04);
    const dripGeo = new THREE.SphereGeometry(0.07, 10, 8);
    for (const id of HONEY_IDS) {
      const [r, c] = id.split(',').map(Number);
      const layers = LEVEL.honey[id];
      this.honey[r][c] = layers;
      const g = new THREE.Group();
      g.position.set(cellX(c), 0.26, cellZ(r));
      const l1 = new THREE.Mesh(this.honeyGeo1, this.honeyMat);
      l1.receiveShadow = true;
      g.add(l1);
      const parts = [l1];
      if (layers > 1) {
        const l2 = new THREE.Group();
        const top = new THREE.Mesh(this.honeyGeo2, this.honeyMat);
        top.receiveShadow = true;
        l2.add(top);
        for (const [x, z, s] of [[0.36, 0.2, 1], [-0.3, 0.36, 0.8], [0.1, 0.4, 0.7]]) {
          const d = new THREE.Mesh(dripGeo, this.honeyMat);
          d.position.set(x, 0.04, z);
          d.scale.set(s, s * 0.7, s);
          l2.add(d);
        }
        l2.position.y = 0.07;
        g.add(l2);
        parts.push(l2);
      }
      g.parts = parts;
      this.scene.add(g);
      this.honeyMesh[r][c] = g;
    }
    this.honeyLeft = HONEY_IDS.length;
    this.babies = LEVEL.cocoons.length;
    this.babiesShown = this.babies;

    // a starting board with no matches whose best move makes a special
    const cocoonAt = new Set(LEVEL.cocoons.map(([r, c]) => `${r},${c}`));
    let best = null;
    for (let tries = 0; tries < 300; tries++) {
      const g = this.randomGrid(cocoonAt);
      const mv = listMoves(g);
      const score = mv.length ? mv[0].score : -1;
      if (!best || score > best.score) best = { g, score };
      if (score >= 80 && mv.length >= 8) break;
    }
    this.grid = best.g;
  }

  randomGrid(cocoonAt) {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (cocoonAt.has(`${r},${c}`)) {
          g[r][c] = { kind: 'cocoon', hp: 2 };
          continue;
        }
        let t;
        do t = Math.floor(Math.random() * TYPES);
        while (
          (c >= 2 && g[r][c - 1]?.type === t && g[r][c - 2]?.type === t && g[r][c - 1].kind === 'animal' && g[r][c - 2].kind === 'animal') ||
          (r >= 2 && g[r - 1][c]?.type === t && g[r - 2][c]?.type === t && g[r - 1][c].kind === 'animal' && g[r - 2][c].kind === 'animal')
        );
        g[r][c] = { kind: 'animal', type: t };
      }
    return g;
  }

  // the board drops in, then the logo and the first hint
  async start() {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const p = this.grid[r][c];
        this.attachView(p, r, c);
        const v = p.view;
        v.root.position.z = cellZ(r) - 9;
        v.fall = { to: cellZ(r), vz: 0, delay: 0.35 + (ROWS - 1 - r) * 0.07 + c * 0.015 };
      }
    await this.until(() => ![...this.views].some((v) => v.fall));
    this.hud.show();
    this.hud.setMoves(this.moves);
    this.hud.setGoals(this.babiesShown, this.honeyLeft);
    this.hud.intro(TEXT.intro);
    await this.wait(0.9);
    this.state = 'play';
    this.busy = false;
    this.idle = LEVEL.hintAfter - 0.6;
  }

  // ---------- views ----------
  attachView(p, r, c) {
    const kind = p.kind;
    const v = this.pieces.make(kind, p.type);
    v.root.position.set(cellX(c), PY, cellZ(r));
    v.piece = p;
    p.view = v;
    if (kind === 'bee') {
      const a = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      a.position.y = 0.17;
      a.renderOrder = 2;
      if (p.dir === 'v') a.rotation.y = Math.PI / 2;
      v.root.add(a);
      v.arrow = a;
    }
    if (kind === 'cocoon') v.root.rotation.y = rnd(-0.4, 0.4);
    this.scene.add(v.root);
    this.views.add(v);
    return v;
  }

  newPiece(kind, r, c, { type, dir } = {}) {
    const p = { kind, type: type ?? 0, dir, hp: 2 };
    this.attachView(p, r, c);
    return p;
  }

  removeView(v) {
    this.scene.remove(v.root);
    this.views.delete(v);
  }

  // pop: swell, then vanish in a splash of jelly
  popView(v, color = 0xffffff, delay = 0) {
    if (!v || v.die) return;
    v.die = { t: -delay, dur: 0.24, color };
  }

  splash(x, y, z, color, n = 9) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const s = rnd(1.5, 4);
      this.fx.smoke.emit(x, y, z, { vx: Math.cos(a) * s, vy: rnd(2.5, 6), vz: Math.sin(a) * s, color, size: rnd(0.14, 0.26), life: rnd(0.45, 0.7), grow: 0.5, grav: 16, drag: 1, alpha: 1 });
    }
    for (let i = 0; i < 4; i++)
      this.fx.glow.emit(x + rnd(-0.2, 0.2), y + rnd(0, 0.4), z + rnd(-0.2, 0.2), { vx: rnd(-1, 1), vy: rnd(1, 3), vz: rnd(-1, 1), color: 0xffffff, size: rnd(0.15, 0.3), life: rnd(0.3, 0.5), grow: 0.4, drag: 2 });
    this.fx.glow.emit(x, y, z, { color, size: 1.3, life: 0.16, grow: 1.8, alpha: 0.55 });
  }

  pos(r, c, y = PY) {
    return new THREE.Vector3(cellX(c), y, cellZ(r));
  }

  // ---------- input ----------
  cellAt(x, y) {
    const ndc = new THREE.Vector2((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
    const c = Math.round(hit.x / 1 + (COLS - 1) / 2);
    const r = Math.round(hit.z / 1 + (ROWS - 1) / 2);
    return inside(r, c) ? [r, c] : null;
  }

  pointerDown(x, y) {
    sfx.unlock();
    this.idle = 0;
    this.clearHint();
    if (this.state !== 'play' || this.busy) return;
    const cell = this.cellAt(x, y);
    if (!cell) return;
    this.drag = { cell, x, y, moved: false };
  }

  pointerMove(x, y) {
    const d = this.drag;
    if (!d || d.moved || this.busy) return;
    const dx = x - d.x;
    const dy = y - d.y;
    if (Math.hypot(dx, dy) < Math.max(14, Math.min(this.w, this.h) * 0.035)) return;
    d.moved = true;
    const [r, c] = d.cell;
    const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    this.select(null);
    if (inside(...to)) this.trySwap(d.cell, to);
  }

  pointerUp() {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || this.busy || this.state !== 'play') return;
    this.tap(d.cell);
  }

  tap([r, c]) {
    const p = this.grid[r][c];
    const s = this.selected;
    if (s) {
      if (s[0] === r && s[1] === c) return this.select(null);
      if (Math.abs(s[0] - r) + Math.abs(s[1] - c) === 1) {
        this.select(null);
        return this.trySwap(s, [r, c]);
      }
    }
    if (isSpecial(p)) {
      this.select(null);
      return this.tapSpecial(r, c);
    }
    if (movable(p)) {
      this.select([r, c]);
      this.pieces.squash(p.view, 0.75);
      sfx.swap();
    } else this.select(null);
  }

  select(cell) {
    this.selected = cell;
    this.ring.visible = !!cell;
    if (cell) this.ring.position.set(cellX(cell[1]), 0.33, cellZ(cell[0]));
  }

  // ---------- moves ----------
  useMove() {
    this.moves--;
    this.hud.setMoves(this.moves);
    if (this.moves === 3) this.hud.say(TEXT.lastMoves, 1.3);
  }

  async animateSwap(a, b, back = false) {
    const va = this.grid[a[0]][a[1]].view;
    const vb = this.grid[b[0]][b[1]].view;
    const pa = this.pos(...a);
    const pb = this.pos(...b);
    sfx.swap();
    const go = (from, to) =>
      this.tween(0.17, (k) => {
        va.root.position.lerpVectors(from === 'a' ? pa : pb, from === 'a' ? pb : pa, k);
        vb.root.position.lerpVectors(from === 'a' ? pb : pa, from === 'a' ? pa : pb, k);
        va.root.position.y = PY + Math.sin(k * Math.PI) * 0.35;
        vb.root.position.y = PY + Math.sin(k * Math.PI) * 0.12;
      }, EASE.inOut);
    await go('a');
    this.pieces.squash(va, 0.7);
    this.pieces.squash(vb, 0.78);
    if (back) {
      await this.wait(0.05);
      sfx.bad();
      await go('b');
      this.pieces.squash(va, 0.8);
      this.pieces.squash(vb, 0.8);
    }
  }

  async trySwap(a, b) {
    const A = this.grid[a[0]][a[1]];
    const B = this.grid[b[0]][b[1]];
    if (!movable(A) || !movable(B) || this.busy) return;
    this.busy = true;
    this.idle = 0;
    this.clearHint();
    const sa = isSpecial(A);
    const sb = isSpecial(B);
    if (sa || sb) {
      await this.animateSwap(a, b);
      swapCells(this.grid, a, b);
      this.useMove();
      if (sa && sb) await this.comboSwap(A, B, b);
      else {
        // the special now sits where the other piece was; it fires there
        const [S, at, other] = sa ? [A, b, B] : [B, a, A];
        this.grid[at[0]][at[1]] = null;
        this.pending.push(this.activate(S, at[0], at[1], { type: other.kind === 'animal' ? other.type : undefined }));
      }
      await this.resolve();
      return this.afterMove();
    }
    swapCells(this.grid, a, b);
    if (!findGroups(this.grid).length) {
      swapCells(this.grid, a, b);
      await this.animateSwap(a, b, true);
      this.busy = false;
      return;
    }
    swapCells(this.grid, a, b);
    await this.animateSwap(a, b);
    swapCells(this.grid, a, b);
    this.useMove();
    await this.resolve([a, b]);
    this.afterMove();
  }

  async tapSpecial(r, c) {
    this.busy = true;
    const p = this.grid[r][c];
    this.useMove();
    this.grid[r][c] = null;
    this.pending.push(this.activate(p, r, c));
    await this.resolve();
    this.afterMove();
  }

  async afterMove() {
    if (this.babies <= 0 && this.honeyLeft <= 0) return this.win();
    if (this.moves <= 0) return this.lose();
    if (!listMoves(this.grid).length) await this.shuffle();
    this.busy = false;
    this.idle = 0;
  }

  // ---------- the cascade ----------
  async resolve(swapped = null) {
    let chain = 0;
    for (let guard = 0; guard < 40; guard++) {
      await this.flushPending();
      if (this.hasHoles()) await this.gravity();
      const groups = findGroups(this.grid);
      if (!groups.length) {
        if (this.pending.length || this.hasHoles()) continue;
        break;
      }
      this.step++;
      let big = 0;
      for (const g of groups) big = Math.max(big, this.matchGroup(g, swapped));
      sfx.pop(chain);
      if (chain >= 1 || big >= 2) {
        const i = Math.min(TEXT.combos.length - 1, Math.max(chain - 1, big - 1, 0));
        this.hud.comboText(TEXT.combos[i], css(ANIMAL_COLORS[groups[0].type]));
      }
      swapped = null;
      chain++;
      await this.wait(0.2);
    }
  }

  hasHoles() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!this.grid[r][c]) return true;
    return false;
  }

  // returns how "big" the match was (0 plain, 1 bee, 2 puff, 3 rainbow)
  matchGroup(g, swapped) {
    let spawn = null;
    if (g.special) {
      const inG = (cell) => cell && g.cells.some(([r, c]) => r === cell[0] && c === cell[1]);
      if (swapped) spawn = swapped.find(inG) || null;
      if (!spawn && g.special.kind === 'puff') {
        const h = new Set(g.runs.filter((x) => x.dir === 'h').flatMap((x) => x.cells.map(([r, c]) => `${r},${c}`)));
        spawn = g.runs.filter((x) => x.dir === 'v').flatMap((x) => x.cells).find(([r, c]) => h.has(`${r},${c}`)) || null;
      }
      if (!spawn) {
        const run = g.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
        spawn = run.cells[Math.floor((run.cells.length - 1) / 2)];
      }
    }
    const color = ANIMAL_COLORS[g.type];
    const sp = spawn && this.pos(...spawn);
    for (const [r, c] of g.cells) {
      this.hitHoney(r, c);
      for (const [nr, nc] of neighbours(r, c)) {
        const n = this.grid[nr][nc];
        if (n?.kind === 'cocoon') this.damageCocoon(nr, nc, n, true);
      }
      const p = this.grid[r][c];
      if (!p) continue;
      this.grid[r][c] = null;
      const v = p.view;
      if (sp) {
        // gather into the cell where the special appears
        const from = v.root.position.clone();
        this.tween(0.14, (k) => v.root.position.lerpVectors(from, sp, k), EASE.in).then(() => this.popView(v, color));
      } else {
        this.popView(v, color, Math.random() * 0.04);
      }
    }
    if (!spawn) return 0;
    const kind = g.special.kind;
    const P = { kind, type: g.type, dir: g.special.dir, hp: 2 };
    this.grid[spawn[0]][spawn[1]] = P;
    this.pending.push(
      this.wait(0.13).then(() => {
        const v = this.attachView(P, spawn[0], spawn[1]);
        v.scale = 0.2;
        this.tween(0.32, (k) => (v.scale = 0.2 + 0.8 * k), EASE.back);
        this.pieces.smile(v);
        this.sparkleAt(sp, kind === 'rainbow' ? 0xffffff : 0xfff2a8, 14);
        sfx.play('squish', { gain: 0.5, rate: 1.5 });
      }),
    );
    return kind === 'rainbow' ? 3 : kind === 'puff' ? 2 : 1;
  }

  sparkleAt(p, color, n = 10) {
    for (let i = 0; i < n; i++)
      this.fx.glow.emit(p.x + rnd(-0.4, 0.4), p.y + rnd(0.2, 0.9), p.z + rnd(-0.4, 0.4), { vx: rnd(-1.5, 1.5), vy: rnd(1, 3.5), vz: rnd(-1.5, 1.5), color, size: rnd(0.18, 0.36), life: rnd(0.4, 0.8), grow: 0.5, grav: -1, drag: 1.5 });
  }

  // something hits a cell: honey loses a layer, cocoons crack, Bloops pop, specials fire
  hitCell(r, c) {
    if (!inside(r, c)) return;
    this.hitHoney(r, c);
    const p = this.grid[r][c];
    if (!p) return;
    if (p.kind === 'cocoon') return this.damageCocoon(r, c, p, false);
    this.grid[r][c] = null;
    if (isSpecial(p)) {
      this.pending.push(this.activate(p, r, c));
      return;
    }
    this.popView(p.view, ANIMAL_COLORS[p.type]);
    const q = p.view.root.position;
    this.splash(q.x, q.y + 0.4, q.z, ANIMAL_COLORS[p.type], 6);
  }

  hitHoney(r, c) {
    if (this.honey[r][c] <= 0) return;
    this.honey[r][c]--;
    const g = this.honeyMesh[r][c];
    const part = g.parts.pop();
    const p = this.pos(r, c, 0.4);
    for (let i = 0; i < 7; i++)
      this.fx.smoke.emit(p.x, p.y, p.z, { vx: rnd(-2.5, 2.5), vy: rnd(2, 5), vz: rnd(-2.5, 2.5), color: 0xffb21f, size: rnd(0.14, 0.24), life: rnd(0.4, 0.6), grow: 0.5, grav: 15, drag: 1 });
    this.tween(0.25, (k) => part.scale.set(1 + k * 0.25, Math.max(0.01, 1 - k), 1 + k * 0.25), EASE.in).then(() => g.remove(part));
    if (this.honey[r][c] === 0) {
      this.honeyLeft--;
      this.hud.setGoals(this.babiesShown, this.honeyLeft);
      sfx.play('squish', { gain: 0.5, rate: 0.8 });
    }
  }

  damageCocoon(r, c, p, adjacent) {
    if (adjacent) {
      if (p.hitStep === this.step) return;
      p.hitStep = this.step;
    }
    if (p.hp <= 0) return;
    p.hp--;
    const v = p.view;
    sfx.crack();
    this.pieces.squash(v, 0.8);
    const q = v.root.position;
    for (let i = 0; i < 6; i++)
      this.fx.debris.emit(q.x, q.y + 0.6, q.z, { vx: rnd(-2.5, 2.5), vy: rnd(2, 5), vz: rnd(-2.5, 2.5), color: 0xcdeeb8, sx: 0.08, sy: 0.08, sz: 0.08, life: 0.8 });
    if (p.hp > 0) {
      // a first crack: the halves part a little
      if (v.crack) {
        v.crack.reset().play();
        v.crackStop = 0.16;
      }
      v.shakeT = 0.35;
      return;
    }
    this.grid[r][c] = null;
    this.openCocoon(r, c, v);
  }

  openCocoon(r, c, v) {
    this.babies--;
    if (v.crack) {
      v.crackStop = 0;
      v.crack.paused = false;
      if (!v.crack.isRunning()) v.crack.reset().play();
    }
    const at = v.root.position.clone();
    // the shell halves fade away
    this.wait(0.5).then(() => this.tween(0.25, (k) => (v.scale = Math.max(0.01, 1 - k)), EASE.in).then(() => this.removeView(v)));
    // the baby pops out, bumps its neighbours, and flies up to the goal
    const baby = this.pieces.make('baby');
    baby.root.position.copy(at);
    baby.scale = 0.2;
    this.scene.add(baby.root);
    this.views.add(baby);
    this.sparkleAt(at, 0xfff3b0, 18);
    for (const [nr, nc] of neighbours(r, c)) {
      this.hitHoney(nr, nc);
      const n = this.grid[nr][nc];
      if (n?.kind === 'cocoon') this.damageCocoon(nr, nc, n, false);
    }
    const fly = (async () => {
      this.tween(0.35, (k) => (baby.scale = 0.2 + 1.0 * k), EASE.back);
      await this.tween(0.4, (k) => (baby.root.position.y = at.y + Math.sin(k * Math.PI * 0.5) * 1.0), EASE.out);
      this.pieces.smile(baby);
      this.hud.say(TEXT.free, 0.9);
      sfx.play('rainbow', { gain: 0.35, rate: 1.6 });
      await this.wait(0.45);
      const goal = this.hud.goalPoint('baby');
      const from = baby.root.position.clone();
      const ndc = new THREE.Vector3((goal.x / this.w) * 2 - 1, -(goal.y / this.h) * 2 + 1, 0.5).unproject(this.camera);
      const dir = ndc.sub(this.camera.position).normalize();
      const to = this.camera.position.clone().addScaledVector(dir, 7);
      const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 2, 0));
      const s0 = baby.scale;
      await this.tween(0.7, (k) => {
        const a = from.clone().lerp(mid, k);
        const b = mid.clone().lerp(to, k);
        baby.root.position.copy(a.lerp(b, k));
        baby.scale = s0 * (1 - k * 0.6);
        if (Math.random() < 0.6) this.fx.glow.emit(baby.root.position.x, baby.root.position.y + 0.3, baby.root.position.z, { color: 0xfff3b0, size: 0.3, life: 0.4, grow: 0.3 });
      }, EASE.inOut);
      this.removeView(baby);
      this.babiesShown--;
      this.hud.setGoals(this.babiesShown, this.honeyLeft);
      this.grove.bloom(LEVEL.cocoons.length - 1 - this.babiesShown);
    })();
    this.bg.push(fly);
  }

  // ---------- specials ----------
  mostCommonType() {
    const n = Array(TYPES).fill(0);
    for (const row of this.grid) for (const p of row) if (p?.kind === 'animal') n[p.type]++;
    return n.indexOf(Math.max(...n));
  }

  async activate(p, r, c, { type } = {}) {
    if (p.fired) return;
    p.fired = true;
    if (this.grid[r][c] === p) this.grid[r][c] = null;
    const v = p.view;
    if (p.kind === 'bee') return this.beeLine(r, c, p.dir, v);
    if (p.kind === 'puff') return this.puffBlast(r, c, 1, v);
    if (p.kind === 'rainbow') return this.rainbowBlast(r, c, type ?? this.mostCommonType(), v);
  }

  // two bees zoom away from the cell along a row or column, popping everything they pass
  async beeLine(r, c, dir, view) {
    sfx.bee();
    const per = 0.05;
    const cells = blastCells('bee', r, c, dir);
    let far = 0;
    for (const [rr, cc] of cells) {
      const d = Math.abs(rr - r) + Math.abs(cc - c);
      far = Math.max(far, d);
      if (d === 0) this.hitHoney(rr, cc);
      else this.wait(d * per).then(() => this.hitCell(rr, cc));
    }
    const start = this.pos(r, c);
    const flyers = [];
    for (const s of [1, -1]) {
      let v = s === 1 ? view : null;
      if (!v) {
        v = this.pieces.make('bee');
        this.scene.add(v.root);
        this.views.add(v);
      }
      if (v.arrow) v.arrow.visible = false;
      v.root.position.copy(start);
      v.root.rotation.y = dir === 'h' ? (s * Math.PI) / 2 : s === 1 ? 0 : Math.PI;
      v.trail = true;
      const end = start.clone().add(dir === 'h' ? new THREE.Vector3(s * 9.5, 0.5, 0) : new THREE.Vector3(0, 0.5, s * 9.5));
      flyers.push(
        this.tween(9.5 * per, (k) => v.root.position.lerpVectors(start, end, k), EASE.lin).then(() => {
          v.trail = false;
          this.removeView(v);
        }),
      );
    }
    this.shake = Math.max(this.shake, 0.08);
    await Promise.all(flyers);
    await this.wait(Math.max(0, far * per - 9.5 * per) + 0.02);
  }

  async puffBlast(r, c, rad, view) {
    if (view) {
      this.pieces.squash(view, 0.45);
      await this.wait(0.09);
      this.removeView(view);
    }
    sfx.puff();
    this.shake = Math.max(this.shake, 0.18 + rad * 0.08);
    const p = this.pos(r, c, 0.7);
    for (let i = 0; i < 16 + rad * 10; i++) {
      const a = rnd(0, Math.PI * 2);
      const s = rnd(2, 5) * rad;
      this.fx.smoke.emit(p.x, p.y, p.z, { vx: Math.cos(a) * s, vy: rnd(0.5, 3), vz: Math.sin(a) * s, color: i % 3 ? 0xffe6ef : 0xff9fb8, size: rnd(0.6, 1.1) * (0.7 + rad * 0.3), life: rnd(0.5, 0.9), grow: 1.8, alpha: 0.85, drag: 2.5 });
    }
    this.fx.glow.emit(p.x, p.y, p.z, { color: 0xfff0f5, size: 3 + rad * 2, life: 0.2, grow: 1.6, alpha: 0.8 });
    let far = 0;
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        if (!inside(r + dr, c + dc)) continue;
        const d = Math.max(Math.abs(dr), Math.abs(dc));
        far = Math.max(far, d);
        this.wait(d * 0.06).then(() => this.hitCell(r + dr, c + dc));
      }
    await this.wait(far * 0.06 + 0.05);
  }

  beam(a, b, hue) {
    const col = new THREE.Color().setHSL(hue, 0.9, 0.7).getHex();
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      this.fx.glow.emit(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * 0.8, a.z + (b.z - a.z) * k, { color: col, size: 0.28, life: 0.25 + k * 0.15, grow: 0.4 });
    }
  }

  async rainbowBlast(r, c, type, view) {
    sfx.rainbow();
    const from = this.pos(r, c, 0.8);
    if (view) {
      this.pieces.smile(view);
      this.tween(0.3, (k) => (view.root.position.y = PY + Math.sin(k * Math.PI) * 0.6));
    }
    const targets = [];
    for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) if (this.grid[rr][cc]?.kind === 'animal' && this.grid[rr][cc].type === type) targets.push([rr, cc]);
    targets.sort((a, b) => Math.hypot(a[0] - r, a[1] - c) - Math.hypot(b[0] - r, b[1] - c));
    this.hitHoney(r, c);
    targets.forEach(([rr, cc], i) =>
      this.wait(0.12 + i * 0.035).then(() => {
        this.beam(from, this.pos(rr, cc, 0.7), (i * 0.08) % 1);
        this.hitCell(rr, cc);
      }),
    );
    await this.wait(0.2 + targets.length * 0.035);
    if (view) {
      this.popView(view, 0xffffff);
      this.splash(from.x, from.y, from.z, 0xffffff, 10);
    }
    this.shake = Math.max(this.shake, 0.12);
  }

  // two specials swapped together
  async comboSwap(A, B, at) {
    const [r, c] = at;
    this.grid[at[0]][at[1]] = null;
    for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) if (this.grid[rr][cc] === A || this.grid[rr][cc] === B) this.grid[rr][cc] = null;
    A.fired = B.fired = true;
    const kinds = [A.kind, B.kind].sort().join('+');
    const p = this.pos(r, c);
    // the two specials squeeze together first
    const va = A.view;
    const vb = B.view;
    const fb = vb.root.position.clone();
    await this.tween(0.14, (k) => vb.root.position.lerpVectors(fb, p, k), EASE.in);
    this.pieces.squash(va, 0.6);
    this.hud.comboText(TEXT.combos[Math.min(3, kinds.includes('rainbow') ? 3 : 2)], '#ffb347');
    if (kinds === 'bee+bee') {
      this.removeView(vb);
      await Promise.all([this.beeLine(r, c, 'h', va), this.beeLine(r, c, 'v', null)]);
    } else if (kinds === 'bee+puff') {
      this.removeView(va);
      this.removeView(vb);
      const lines = [];
      for (let d = -1; d <= 1; d++) {
        if (inside(r + d, c)) lines.push(this.beeLine(r + d, c, 'h', null));
        if (inside(r, c + d)) lines.push(this.beeLine(r, c + d, 'v', null));
      }
      await Promise.all(lines);
    } else if (kinds === 'puff+puff') {
      this.removeView(va);
      await this.puffBlast(r, c, 2, vb);
    } else if (kinds === 'rainbow+rainbow') {
      this.removeView(va);
      sfx.rainbow();
      this.shake = 0.35;
      this.pieces.smile(vb);
      for (let rr = 0; rr < ROWS; rr++)
        for (let cc = 0; cc < COLS; cc++) {
          const d = Math.hypot(rr - r, cc - c);
          this.wait(0.1 + d * 0.05).then(() => {
            this.beam(this.pos(r, c, 0.8), this.pos(rr, cc, 0.6), (d * 0.1) % 1);
            this.hitCell(rr, cc);
          });
        }
      await this.wait(0.7);
      this.popView(vb, 0xffffff);
    } else {
      // rainbow + bee / puff: every Bloop of the most common kind turns into that special, then they all fire
      const R = A.kind === 'rainbow' ? A : B;
      const S = R === A ? B : A;
      this.removeView(S.view);
      sfx.rainbow();
      this.pieces.smile(R.view);
      const type = this.mostCommonType();
      const made = [];
      let i = 0;
      for (let rr = 0; rr < ROWS; rr++)
        for (let cc = 0; cc < COLS; cc++) {
          const q = this.grid[rr][cc];
          if (q?.kind !== 'animal' || q.type !== type) continue;
          const kind = S.kind;
          const P = { kind, type, dir: Math.random() < 0.5 ? 'h' : 'v', hp: 2 };
          this.grid[rr][cc] = P;
          made.push([rr, cc, P]);
          const delay = 0.05 + i++ * 0.04;
          this.wait(delay).then(() => {
            this.beam(p, this.pos(rr, cc, 0.6), (i * 0.07) % 1);
            this.removeView(q.view);
            const v = this.attachView(P, rr, cc);
            v.scale = 0.3;
            this.tween(0.25, (k) => (v.scale = 0.3 + 0.7 * k), EASE.back);
          });
        }
      await this.wait(0.35 + i * 0.04);
      this.popView(R.view, 0xffffff);
      for (const [rr, cc, P] of made) {
        if (this.grid[rr][cc] !== P) continue;
        this.grid[rr][cc] = null;
        this.pending.push(this.activate(P, rr, cc));
        await this.wait(0.09);
      }
    }
  }

  // ---------- gravity ----------
  async gravity() {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const p = this.grid[r][c];
        if (!p) continue;
        if (r !== write) {
          this.grid[write][c] = p;
          this.grid[r][c] = null;
          p.view.fall = { to: cellZ(write), vz: p.view.fall?.vz || 0, delay: 0 };
        }
        write--;
      }
      for (let r = write, k = 0; r >= 0; r--, k++) {
        const p = { kind: 'animal', type: this.spawnType(r, c) };
        this.grid[r][c] = p;
        const v = this.attachView(p, r, c);
        v.root.position.z = cellZ(-1 - k) - 0.2;
        v.fall = { to: cellZ(r), vz: 0, delay: k * 0.02 };
      }
    }
    await this.until(() => ![...this.views].some((v) => v.fall));
  }

  // new Bloops are random, with a light nudge away from instant triples
  spawnType(r, c) {
    for (let i = 0; i < 3; i++) {
      const t = Math.floor(Math.random() * TYPES);
      const below = this.grid[r + 1]?.[c];
      const below2 = this.grid[r + 2]?.[c];
      if (below?.type === t && below2?.type === t && below.kind === 'animal' && below2.kind === 'animal' && i < 2) continue;
      return t;
    }
    return Math.floor(Math.random() * TYPES);
  }

  async shuffle() {
    this.hud.say(TEXT.shuffle, 1.2);
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c]?.kind === 'animal') cells.push([r, c]);
    const ps = cells.map(([r, c]) => this.grid[r][c]);
    for (let tries = 0; tries < 100; tries++) {
      for (let i = ps.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ps[i], ps[j]] = [ps[j], ps[i]];
      }
      cells.forEach(([r, c], i) => (this.grid[r][c] = ps[i]));
      if (!findGroups(this.grid).length && listMoves(this.grid).length) break;
    }
    await Promise.all(
      cells.map(([r, c]) => {
        const v = this.grid[r][c].view;
        const from = v.root.position.clone();
        const to = this.pos(r, c);
        return this.tween(0.45, (k) => {
          v.root.position.lerpVectors(from, to, k);
          v.root.position.y = PY + Math.sin(k * Math.PI) * 0.8;
        }, EASE.inOut);
      }),
    );
  }

  // ---------- hints ----------
  // the best move, nudged toward the goals (honey under the match, cocoons next to it)
  bestMove() {
    const list = listMoves(this.grid).slice(0, 24);
    for (const m of list) {
      const A = this.grid[m.a[0]][m.a[1]];
      const B = this.grid[m.b[0]][m.b[1]];
      if (isSpecial(A) || isSpecial(B)) continue;
      swapCells(this.grid, m.a, m.b);
      const groups = findGroups(this.grid);
      swapCells(this.grid, m.a, m.b);
      for (const g of groups)
        for (const [r, c] of g.cells) {
          m.score += this.honey[r][c] * 40;
          for (const [nr, nc] of neighbours(r, c)) if (this.grid[nr][nc]?.kind === 'cocoon') m.score += 16;
        }
    }
    return list.sort((x, y) => y.score - x.score)[0];
  }

  showHint() {
    const m = this.bestMove();
    if (!m) return;
    this.hintMove = m;
    const pa = this.toScreen(this.pos(...m.a, 0.6));
    const pb = this.toScreen(this.pos(...m.b, 0.6));
    this.hud.hint(pa, pb);
  }

  clearHint() {
    if (!this.hintMove) return;
    this.hintMove = null;
    this.hud.hint(null);
  }

  toScreen(p) {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }

  // ---------- end ----------
  async win() {
    this.state = 'win';
    this.busy = true;
    this.clearHint();
    this.select(null);
    await Promise.all(this.bg);
    this.hud.say(TEXT.bonus, 1.6);
    this.grove.bloom(null);
    // every move left becomes a bee
    const n = Math.min(this.moves, 10);
    for (let i = 0; i < n; i++) {
      const cells = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c]?.kind === 'animal') cells.push([r, c]);
      if (!cells.length) break;
      const [r, c] = pick(cells);
      const old = this.grid[r][c];
      const P = { kind: 'bee', type: 0, dir: Math.random() < 0.5 ? 'h' : 'v', hp: 2 };
      this.grid[r][c] = P;
      this.removeView(old.view);
      const v = this.attachView(P, r, c);
      v.scale = 0.2;
      this.tween(0.25, (k) => (v.scale = 0.2 + 0.8 * k), EASE.back);
      this.sparkleAt(this.pos(r, c), 0xfff2a8, 8);
      sfx.play('pop', { gain: 0.5, rate: 1.2 + i * 0.05 });
      this.moves--;
      this.hud.setMoves(this.moves);
      await this.wait(0.12);
    }
    this.moves = 0;
    this.hud.setMoves(0);
    for (let round = 0; round < 3; round++) {
      const specials = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isSpecial(this.grid[r][c])) specials.push([r, c]);
      if (!specials.length) break;
      for (const [r, c] of specials) {
        const p = this.grid[r][c];
        if (!isSpecial(p)) continue;
        this.grid[r][c] = null;
        this.pending.push(this.activate(p, r, c));
        await this.wait(0.14);
      }
      await this.resolve();
    }
    sfx.win();
    for (const [x, z] of [[-2.5, 0], [2.5, 0], [0, -2]]) this.fx.confetti.burst(x, 1, z, 70);
    for (const v of this.views) if (v.piece?.kind !== 'cocoon') this.pieces.smile(v);
    await this.wait(1.8);
    this.onEnd(true);
  }

  async lose() {
    this.state = 'lose';
    this.busy = true;
    this.clearHint();
    await Promise.all(this.bg);
    await this.wait(0.6);
    this.onEnd(false);
  }

  // ---------- frame ----------
  resize(w, h) {
    this.w = w;
    this.h = h;
    const cam = this.camera;
    cam.aspect = w / h;
    cam.clearViewOffset();
    const portrait = h >= w;
    const tilt = portrait ? 0.7 : 0.78; // angle from straight down
    this.camDir.set(0, Math.cos(tilt), Math.sin(tilt));
    // usable band of the screen: below the top bar, above the button
    const topPx = Math.min(130, h * 0.16) + 8;
    const botPx = Math.min(110, h * 0.13);
    const yTop = 1 - (2 * topPx) / h;
    const yBot = -1 + (2 * botPx) / h;
    const corners = [];
    for (const x of [-4.6, 4.6]) for (const z of [-4.6, 4.6]) for (const y of [0.1, z < 0 ? 1.1 : 0.2]) corners.push(new THREE.Vector3(x, y, z));
    const v = new THREE.Vector3();
    const measure = (d) => {
      cam.position.copy(this.camTarget).addScaledVector(this.camDir, d);
      cam.lookAt(this.camTarget);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let x0 = 9;
      let x1 = -9;
      let y0 = 9;
      let y1 = -9;
      for (const p of corners) {
        v.copy(p).project(cam);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      return { x0, x1, y0, y1 };
    };
    const xMax = portrait ? 0.96 : 0.9;
    let lo = 6;
    let hi = 80;
    for (let i = 0; i < 30; i++) {
      const d = (lo + hi) / 2;
      const m = measure(d);
      const ok = m.x0 >= -xMax && m.x1 <= xMax && m.y1 - m.y0 <= yTop - yBot;
      if (ok) hi = d;
      else lo = d;
    }
    const m = measure(hi);
    this.scene.fog.near = hi + 8;
    this.scene.fog.far = hi + 45;
    cam.far = hi + 60;
    const want = (yTop + yBot) / 2;
    const have = (m.y0 + m.y1) / 2;
    cam.setViewOffset(w, h, 0, ((want - have) * h) / 2, w, h);
    cam.updateProjectionMatrix();
    this.fx.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))));
    if (this.hintMove) this.showHint();
  }

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    // timers
    if (this.timers.length) {
      const due = [];
      this.timers = this.timers.filter((t) => ((t.t -= dt) > 0 ? true : (due.push(t), false)));
      for (const t of due) t.res();
    }
    // tweens
    if (this.tweens.length) {
      const done = [];
      for (const tw of this.tweens) {
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn(tw.ease(k));
        if (k >= 1) done.push(tw);
      }
      if (done.length) {
        this.tweens = this.tweens.filter((t) => !done.includes(t));
        for (const t of done) t.res();
      }
    }
    // views: falling, popping, wobbling
    const edge = cellZ(0) - 0.55;
    for (const v of this.views) {
      const f = v.fall;
      if (f) {
        if (f.delay > 0) f.delay -= dt;
        else {
          f.vz = Math.min(f.vz + 40 * dt, 16);
          v.root.position.z += f.vz * dt;
          if (v.root.position.z >= f.to) {
            v.root.position.z = f.to;
            v.fall = null;
            this.pieces.squash(v, 0.68);
            if (this.state !== 'intro' || Math.random() < 0.15) sfx.land();
          }
        }
        // fade in while coming over the far edge of the tray
        const z = v.root.position.z;
        v.scale = z < edge ? Math.max(0.01, 1 - (edge - z) * 1.4) : v.die ? v.scale : 1;
      }
      if (v.die) {
        const d = v.die;
        d.t += dt;
        if (d.t >= 0) {
          const k = d.t / d.dur;
          v.scale = k < 0.4 ? 1 + 0.35 * (k / 0.4) : Math.max(0.01, 1.35 * (1 - (k - 0.4) / 0.6));
          if (!d.splashed) {
            d.splashed = true;
            const q = v.root.position;
            this.splash(q.x, q.y + 0.4, q.z, d.color);
          }
          if (k >= 1) {
            this.removeView(v);
            continue;
          }
        }
      }
      if (v.crack && v.crackStop && v.crack.time >= v.crackStop) v.crack.paused = true;
      if (v.shakeT > 0) {
        v.shakeT -= dt;
        v.inner.rotation.z = Math.sin(this.time * 60) * 0.12 * Math.max(0, v.shakeT / 0.35);
      } else if (this.hintMove && v.piece && this.isHintPiece(v.piece)) {
        v.inner.rotation.z = Math.sin(this.time * 9) * 0.14;
      } else v.inner.rotation.z *= 0.8;
      if (v.kind === 'bee' && !v.trail) {
        const off = Math.sin(this.time * 7 + v.root.id) * 0.05;
        v.inner.position.set(v.piece?.dir === 'h' ? off : 0, 0, v.piece?.dir === 'v' ? off : 0);
      }
      if (v.trail && Math.random() < 0.8) {
        const q = v.root.position;
        this.fx.glow.emit(q.x, q.y + 0.45, q.z, { color: 0xfff2a0, size: rnd(0.25, 0.45), life: 0.3, grow: 0.4, alpha: 0.8 });
      }
      this.pieces.update(v, dt);
    }
    // selected Bloop bobs
    if (this.selected) {
      const p = this.grid[this.selected[0]][this.selected[1]];
      if (p?.view) p.view.root.position.y = PY + Math.abs(Math.sin(this.time * 8)) * 0.15;
      this.ring.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06);
    }
    // waiters
    if (this.waiters.length) {
      const ready = this.waiters.filter((w) => w.cond());
      if (ready.length) {
        this.waiters = this.waiters.filter((w) => !ready.includes(w));
        for (const w of ready) w.res();
      }
    }
    // hints
    if (this.state === 'play' && !this.busy && !this.drag) {
      this.idle += dt;
      if (this.idle > LEVEL.hintAfter && !this.hintMove) this.showHint();
    }
    this.pieces.tick(dt);
    this.grove.update(dt, this.time);
    this.fx.update(dt);
    this.shake *= Math.exp(-dt * 7);
  }

  isHintPiece(p) {
    const m = this.hintMove;
    return this.grid[m.a[0]][m.a[1]] === p || this.grid[m.b[0]][m.b[1]] === p;
  }

  render() {
    const cam = this.camera;
    const s = this.shake;
    const ox = s > 0.002 ? (Math.random() - 0.5) * s : 0;
    const oz = s > 0.002 ? (Math.random() - 0.5) * s : 0;
    cam.position.x += ox;
    cam.position.z += oz;
    this.renderer.render(this.scene, cam);
    cam.position.x -= ox;
    cam.position.z -= oz;
  }
}
