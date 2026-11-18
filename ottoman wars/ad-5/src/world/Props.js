import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { roundRect } from './Environment.js';
import { withDetail } from './Detail.js';
import { COLORS as C, FONT_UI, TEXT, INFO } from '../config.js';

/* ── Items: sacks, bowls of stew and akçe coins, one InstancedMesh each ── */
const KINDS = ['sack', 'bowl', 'coin', 'meat'];
export class Items {
  constructor(scene) {
    const sack = new Builder()
      .add(P.sph(0.3, 12, 9), C.sack, [0, 0, 0], [0, 0, 0], [1.25, 0.62, 0.95])
      .add(P.sph(0.12, 8, 6), 0xb8996a, [0.3, 0.06, 0], [0, 0, 0], [1, 0.7, 1.1])
      .add(P.torus(0.07, 0.025, 5, 10), 0x7a5a30, [0.25, 0.06, 0], [0, Math.PI / 2, 0])
      .add(P.box(0.3, 0.012, 0.2), 0x9a7a4a, [-0.08, 0.18, 0], [0, 0, 0.05])
      .build();
    const bowlPts = [];
    for (let i = 0; i <= 6; i++) bowlPts.push(new THREE.Vector2(0.1 + Math.sin((i / 6) * Math.PI * 0.5) * 0.17, (i / 6) * 0.17));
    const bowl = new Builder()
      .add(new THREE.LatheGeometry(bowlPts, 14), C.copper, [0, -0.08, 0])
      .add(P.cyl(0.25, 0.25, 0.03, 14), 0xd9883a, [0, 0.09, 0])
      .add(P.cyl(0.235, 0.235, 0.03, 14), C.stew, [0, 0.07, 0])
      .add(P.sph(0.05, 6, 4), 0xf0d080, [0.07, 0.09, 0.03])
      .add(P.sph(0.045, 6, 4), 0x7a9a3a, [-0.06, 0.09, -0.05])
      .build();
    const coin = new Builder()
      .add(P.cyl(0.17, 0.17, 0.06, 14), C.coin, [0, 0, 0])
      .add(P.cyl(0.11, 0.11, 0.07, 10), 0xfff0a0, [0, 0, 0])
      .build();
    // a haunch of venison: a meaty lump on a bone
    const meat = new Builder()
      .add(P.sph(0.24, 10, 8), C.meat, [0, 0, 0.06], [0, 0, 0], [1, 0.72, 1.25])
      .add(P.sph(0.2, 8, 6), 0xc8604a, [0, 0.05, 0.1], [0, 0, 0], [0.9, 0.55, 1.05])
      .add(P.cyl(0.045, 0.045, 0.34, 6), 0xf2ead8, [0, 0, -0.3], [Math.PI / 2, 0, 0])
      .add(P.sph(0.07, 6, 5), 0xf2ead8, [0.03, 0, -0.47])
      .add(P.sph(0.07, 6, 5), 0xf2ead8, [-0.03, 0, -0.47])
      .build();
    const mk = (geo, metal) => {
      const m = new THREE.InstancedMesh(geo, withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: metal ? 0.3 : 0.85, metalness: metal ? 0.55 : 0, side: THREE.DoubleSide }), { strength: metal ? 0 : 0.45, scale: 1.2, ao: 0.3 }), 160);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.mesh = { sack: mk(sack, false), bowl: mk(bowl, true), coin: mk(coin, true), meat: mk(meat, false) };
    this.h = { sack: 0.36, bowl: 0.2, coin: 0.07, meat: 0.3 };
    this.o = new THREE.Object3D();
  }

  begin() {
    this.n = { sack: 0, bowl: 0, coin: 0, meat: 0 };
  }

  put(type, x, y, z, ry = 0, s = 1, rx = 0, rz = 0) {
    const m = this.mesh[type];
    if (this.n[type] >= 160) return;
    const o = this.o;
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz, 'YXZ');
    o.scale.setScalar(s);
    o.updateMatrix();
    m.setMatrixAt(this.n[type]++, o.matrix);
  }

  end() {
    for (const t of KINDS) {
      this.mesh[t].count = this.n[t];
      this.mesh[t].instanceMatrix.needsUpdate = true;
    }
  }
}

/* ── Build pad: dashed square on the ground with an icon, label and counter ── */
export class Pad {
  constructor(scene, def) {
    this.def = def;
    const need = def.need || {};
    this.type = need.stone ? 'stone' : need.wood ? 'wood' : need.gold ? 'gold' : null;
    this.total = need.stone || need.wood || need.gold || 1;
    this.paid = 0;
    this.done = false;
    this.active = false;
    this.cv = document.createElement('canvas');
    this.cv.width = this.cv.height = 256;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    // the pad = a raised golden frame + a soft glow + the painted face, drawn on top of the ground decals
    this.plane = new THREE.Group();
    this.plane.position.set(def.x, 0.06, def.z);
    const glowCv = document.createElement('canvas');
    glowCv.width = glowCv.height = 128;
    const gctx = glowCv.getContext('2d');
    const gg = gctx.createRadialGradient(64, 64, 20, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,200,60,0.55)');
    gg.addColorStop(1, 'rgba(255,200,60,0)');
    gctx.fillStyle = gg;
    gctx.fillRect(0, 0, 128, 128);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCv), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.renderOrder = 5;
    this.glow = glow;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.02;
    face.renderOrder = 6;
    const fmat = new THREE.MeshBasicMaterial({ color: 0xffc83a, toneMapped: false });
    const edge = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), fmat);
      m.position.set(x, 0.08, z);
      return m;
    };
    this.plane.add(glow, face, edge(3.7, 0.16, 0, -1.78), edge(3.7, 0.16, 0, 1.78), edge(0.16, 3.7, -1.78, 0), edge(0.16, 3.7, 1.78, 0));
    this.plane.visible = false;
    scene.add(this.plane);
    this.draw();
  }

  draw() {
    const ctx = this.cv.getContext('2d');
    const k = this.paid / this.total;
    ctx.clearRect(0, 0, 256, 256);
    ctx.shadowColor = 'rgba(255,200,60,0.9)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(22,12,4,0.95)';
    roundRect(ctx, 10, 10, 236, 236, 34);
    ctx.shadowBlur = 0;
    // progress fill from the bottom
    ctx.save();
    ctx.beginPath();
    ctx.rect(8, 248 - 240 * k, 240, 240 * k);
    ctx.clip();
    ctx.fillStyle = { stone: 'rgba(120,200,90,0.75)', wood: 'rgba(200,140,70,0.8)', gold: 'rgba(255,200,60,0.8)' }[this.type] || 'rgba(220,40,50,0.8)';
    roundRect(ctx, 8, 8, 240, 240, 34);
    ctx.restore();
    // dashed border
    ctx.setLineDash([22, 12]);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(40, 12);
    ctx.arcTo(244, 12, 244, 244, 30);
    ctx.arcTo(244, 244, 12, 244, 30);
    ctx.arcTo(12, 244, 12, 12, 30);
    ctx.arcTo(12, 12, 244, 12, 30);
    ctx.stroke();
    ctx.setLineDash([]);
    // label + icon + count
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `40px ${FONT_UI}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(40,20,6,0.9)';
    if (this.def.zone) return this.drawZone(ctx);
    if (!this.type) return this.drawBattle(ctx);
    const label = (INFO[this.def.kind] || { short: '' }).short;
    ctx.strokeText(label, 128, 62);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(label, 128, 62);
    ctx.fillStyle = '#ffcf3a';
    ctx.strokeStyle = '#7a4a06';
    ctx.lineWidth = 5;
    for (const [x, y] of [[62, 112], [88, 92], [74, 132]]) {
      ctx.beginPath();
      ctx.ellipse(x + 22, y + 8, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const left = this.total - this.paid;
    ctx.font = `64px ${FONT_UI}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(40,20,6,0.95)';
    ctx.strokeText(String(left), 178, 118);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(left), 178, 118);
    ctx.font = `30px ${FONT_UI}`;
    ctx.lineWidth = 6;
    const word = 'AKÇE';
    ctx.strokeText(word, 128, 196);
    ctx.fillStyle = '#ffd84a';
    ctx.fillText(word, 128, 196);
    this.tex.needsUpdate = true;
  }

  // "ATEŞLE!" pad behind the cannon
  drawBattle(ctx) {
    ctx.fillStyle = '#ffffff';
    // crossed swords
    ctx.save();
    ctx.translate(128, 104);
    for (const a of [-0.7, 0.7]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = '#e8eef4';
      ctx.strokeStyle = '#3a1a08';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.rect(-7, -62, 14, 92);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8b33a';
      ctx.beginPath();
      ctx.rect(-24, 28, 48, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.font = `46px ${FONT_UI}`;
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(60,8,8,0.95)';
    const label = this.def.label || TEXT.attack;
    ctx.font = `${label.length > 7 ? 38 : 46}px ${FONT_UI}`;
    ctx.strokeText(label, 128, 196);
    ctx.fillStyle = '#ffe2a0';
    ctx.fillText(label, 128, 196);
    this.tex.needsUpdate = true;
  }

  // a work zone: big label + icon (meat / bowl / coin), no payment
  drawZone(ctx) {
    const icon = this.def.icon;
    ctx.save();
    ctx.translate(128, 104);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#3a1a08';
    if (icon === 'meat') {
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(-56, -8, 50, 16);
      ctx.strokeRect(-56, -8, 50, 16);
      ctx.fillStyle = '#b8503a';
      ctx.beginPath();
      ctx.ellipse(20, 0, 46, 34, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (icon === 'bowl') {
      ctx.fillStyle = '#c8742e';
      ctx.beginPath();
      ctx.arc(0, -8, 56, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e09a50';
      ctx.fillRect(-56, -16, 112, 10);
    } else {
      ctx.fillStyle = '#ffcf3a';
      for (const [x, y] of [[-22, 10], [20, 0], [-2, -20]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 34, 17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.font = `50px ${FONT_UI}`;
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(40,20,6,0.95)';
    ctx.strokeText(this.def.label, 128, 200);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(this.def.label, 128, 200);
    this.tex.needsUpdate = true;
  }

  // battle pad progress while the player stands on it (0..1)
  setFill(k) {
    const v = Math.round(k * 20) / 20;
    if (v === this.fillShown) return;
    this.fillShown = v;
    this.paid = v;
    this.total = 1;
    this.draw();
  }

  show() {
    this.active = true;
    this.plane.visible = true;
    this.plane.scale.setScalar(0.01);
  }

  update(t, dt) {
    if (!this.plane.visible) return;
    const target = this.done ? 0.01 : 1 + Math.sin(t * 4) * 0.03;
    if (this.glow) this.glow.material.opacity = 0.65 + Math.sin(t * 4) * 0.35;
    const s = this.plane.scale.x + (target - this.plane.scale.x) * Math.min(1, dt * 10);
    this.plane.scale.setScalar(s);
    if (this.done && s < 0.05) this.plane.visible = false;
  }

  pay() {
    this.paid++;
    this.draw();
    if (this.paid >= this.total) this.done = true;
    return this.done;
  }
}

/* ── Buildings ── */
export class Guide {
  constructor(scene) {
    const b = new Builder()
      .add(P.cone(0.55, 0.9, 4), 0xffd23f, [0, 0.45, 0], [Math.PI, Math.PI / 4, 0])
      .add(P.box(0.45, 0.8, 0.45), 0xffd23f, [0, 1.25, 0], [0, Math.PI / 4, 0]);
    this.mesh = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    this.mesh.visible = false;
    scene.add(this.mesh);
    const glow = (r0, r1, op) =>
      new THREE.Mesh(
        new THREE.RingGeometry(r0, r1, 48),
        new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: op, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      );
    this.ring = glow(1.55, 1.85, 0.95);
    this.ring2 = glow(1.2, 2.3, 0.35);
    for (const r of [this.ring, this.ring2]) {
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      r.renderOrder = 5;
      scene.add(r);
    }
    this.dots = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.17, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
      40,
    );
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 4;
    scene.add(this.dots);
    this.o = new THREE.Object3D();
    this.target = null;
    this.from = null;
  }

  set(x, z) {
    this.target = x == null ? null : new THREE.Vector3(x, 0, z);
    this.mesh.visible = !!this.target;
    this.ring.visible = this.ring2.visible = !!this.target;
    if (!this.target) this.dots.count = 0;
  }

  // player position for the trail
  origin(x, z) {
    this.from = new THREE.Vector3(x, 0, z);
  }

  update(t) {
    if (!this.target) return;
    const T = this.target;
    this.mesh.position.set(T.x, 3.4 + Math.abs(Math.sin(t * 4)) * 0.9, T.z);
    this.mesh.rotation.y = t * 2;
    const k = (t * 1.2) % 1;
    this.ring.position.set(T.x, 0.06, T.z);
    this.ring2.position.set(T.x, 0.05, T.z);
    this.ring.scale.setScalar(0.9 + Math.sin(t * 5) * 0.06);
    this.ring2.scale.setScalar(0.6 + k * 0.8);
    this.ring2.material.opacity = 0.45 * (1 - k);
    // dots from the player to the goal, flowing toward it
    let n = 0;
    if (this.from) {
      const d = this.from.distanceTo(T);
      if (d > 3.2) {
        const step = 0.95;
        const off = (t * 2.2) % step;
        for (let s = 1.0 + off; s < d - 1.8 && n < 40; s += step) {
          const f = s / d;
          this.o.position.set(this.from.x + (T.x - this.from.x) * f, 0.05, this.from.z + (T.z - this.from.z) * f);
          this.o.rotation.set(-Math.PI / 2, 0, 0);
          this.o.scale.setScalar(0.75 + 0.35 * Math.sin(f * Math.PI));
          this.o.updateMatrix();
          this.dots.setMatrixAt(n++, this.o.matrix);
        }
      }
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
  }
}

