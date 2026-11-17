import * as THREE from '../vendor/three.module.min.js';
import { Builder, P, radialTexture } from '../world/geom.js';

// Effects: soft particles (smoke/dust/sparks), physical debris, arrows and confetti.

const rnd = (a, b) => a + (b - a) * Math.random();

class Particles {
  constructor(scene, max, { additive = false, texture } = {}) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.ttl = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: texture }, scale: { value: 600 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, vA * t.a); if (gl_FragColor.a < 0.01) discard;
        #include <colorspace_fragment>
        }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(x, y, z, { vx = 0, vy = 0, vz = 0, color = 0xffffff, size = 1, life = 1, grow = 1, grav = 0, drag = 1.5, alpha = 1 }) {
    let i = this.n;
    if (i >= this.max) {
      // recycle the oldest-ish slot
      i = Math.floor(Math.random() * this.max);
    } else this.n++;
    this.p.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    const c = new THREE.Color(color);
    this.col.set([c.r, c.g, c.b], i * 3);
    this.size[i] = size;
    this.life[i] = life;
    this.ttl[i] = life;
    this.grow[i] = grow;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.a0[i] = alpha;
    this.alpha[i] = alpha;
  }

  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i] - dt;
      if (l <= 0) continue;
      // compact live particles to the front
      if (w !== i) {
        for (let k = 0; k < 3; k++) {
          this.p[w * 3 + k] = this.p[i * 3 + k];
          this.v[w * 3 + k] = this.v[i * 3 + k];
          this.col[w * 3 + k] = this.col[i * 3 + k];
        }
        this.size[w] = this.size[i];
        this.ttl[w] = this.ttl[i];
        this.grow[w] = this.grow[i];
        this.grav[w] = this.grav[i];
        this.drag[w] = this.drag[i];
        this.a0[w] = this.a0[i];
      }
      this.life[w] = l;
      const d = Math.max(0, 1 - this.drag[w] * dt);
      this.v[w * 3] *= d;
      this.v[w * 3 + 1] = this.v[w * 3 + 1] * d - this.grav[w] * dt;
      this.v[w * 3 + 2] *= d;
      this.p[w * 3] += this.v[w * 3] * dt;
      this.p[w * 3 + 1] += this.v[w * 3 + 1] * dt;
      this.p[w * 3 + 2] += this.v[w * 3 + 2] * dt;
      if (this.p[w * 3 + 1] < 0.05) {
        this.p[w * 3 + 1] = 0.05;
        this.v[w * 3 + 1] *= -0.3;
      }
      this.size[w] *= 1 + (this.grow[w] - 1) * dt;
      const k = l / this.ttl[w];
      this.alpha[w] = this.a0[w] * Math.min(1, k * 2.2) * Math.min(1, (1 - k) * 12 + 0.2);
      w++;
    }
    this.n = w;
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

class Debris {
  constructor(scene, max) {
    this.max = max;
    this.items = [];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.o = new THREE.Object3D();
    this.c = new THREE.Color();
  }

  emit(x, y, z, { vx = 0, vy = 0, vz = 0, color = 0x8a6a40, sx = 0.2, sy = 0.2, sz = 0.2, life = 2.5 }) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({
      p: new THREE.Vector3(x, y, z),
      v: new THREE.Vector3(vx, vy, vz),
      r: new THREE.Euler(rnd(0, 3), rnd(0, 3), rnd(0, 3)),
      w: new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)),
      s: new THREE.Vector3(sx, sy, sz),
      color,
      life,
    });
  }

  update(dt) {
    const o = this.o;
    let i = 0;
    this.items = this.items.filter((d) => (d.life -= dt) > 0);
    for (const d of this.items) {
      d.v.y -= 22 * dt;
      d.p.addScaledVector(d.v, dt);
      const half = d.s.y / 2;
      if (d.p.y < half) {
        d.p.y = half;
        d.v.y *= -0.35;
        d.v.x *= 0.7;
        d.v.z *= 0.7;
        d.w.multiplyScalar(0.6);
      }
      d.r.x += d.w.x * dt;
      d.r.y += d.w.y * dt;
      d.r.z += d.w.z * dt;
      o.position.copy(d.p);
      o.rotation.copy(d.r);
      const k = Math.min(1, d.life * 2);
      o.scale.copy(d.s).multiplyScalar(k);
      o.updateMatrix();
      this.mesh.setMatrixAt(i, o.matrix);
      this.mesh.setColorAt(i, this.c.setHex(d.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

class Arrows {
  constructor(scene, max = 60, customGeo = null, orient = true) {
    this.orient = orient;
    const geo = customGeo || new Builder()
      .add(P.cyl(0.025, 0.025, 1.1, 5), 0x6b4424, [0, 0, 0], [Math.PI / 2, 0, 0])
      .add(P.cone(0.06, 0.18, 5), 0xcfd6de, [0, 0, -0.62], [-Math.PI / 2, 0, 0])
      .add(P.box(0.14, 0.01, 0.2), 0xf2f2f2, [0, 0, 0.48])
      .add(P.box(0.01, 0.14, 0.2), 0xd8333a, [0, 0, 0.48])
      .build();
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.list = [];
    this.o = new THREE.Object3D();
  }

  // flies from a to b (Vector3) in `time` seconds along an arc, then calls onHit
  shoot(a, b, time, arc, onHit) {
    this.list.push({ a: a.clone(), b: b.clone(), t: 0, time, arc, onHit });
  }

  update(dt) {
    const o = this.o;
    const prev = new THREE.Vector3();
    let i = 0;
    this.list = this.list.filter((r) => {
      r.t += dt;
      if (r.t >= r.time) {
        r.onHit?.();
        return false;
      }
      return true;
    });
    for (const r of this.list) {
      const k = r.t / r.time;
      const pos = (kk, out) => out.lerpVectors(r.a, r.b, kk).setY(r.a.y + (r.b.y - r.a.y) * kk + Math.sin(kk * Math.PI) * r.arc);
      pos(k, o.position);
      pos(Math.max(0, k - 0.02), prev);
      if (this.orient) o.lookAt(prev);
      else o.rotation.set(r.t * 6, r.t * 4, 0);
      o.updateMatrix();
      this.mesh.setMatrixAt(i++, o.matrix);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class Confetti {
  constructor(scene, max = 260) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.22, 0.34),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      max,
    );
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.max = max;
    this.list = [];
    this.o = new THREE.Object3D();
    this.c = new THREE.Color();
  }

  burst(x, y, z, n = 120) {
    const cols = [0xe8b33a, 0xc8202a, 0xffffff, 0x2fa8ff, 0x37c46b, 0xff7a2f];
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = rnd(0, Math.PI * 2);
      const s = rnd(4, 13);
      this.list.push({
        p: new THREE.Vector3(x, y, z),
        v: new THREE.Vector3(Math.cos(a) * s, rnd(8, 18), Math.sin(a) * s),
        r: new THREE.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)),
        w: rnd(4, 12),
        c: cols[i % cols.length],
        life: rnd(3, 5),
      });
    }
  }

  update(dt) {
    const o = this.o;
    let i = 0;
    this.list = this.list.filter((c) => (c.life -= dt) > 0);
    for (const c of this.list) {
      c.v.y = Math.max(c.v.y - 18 * dt, -3.2);
      c.v.x *= 1 - dt * 1.5;
      c.v.z *= 1 - dt * 1.5;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < 0.05) c.p.y = 0.05;
      c.r.x += c.w * dt;
      c.r.z += c.w * 0.7 * dt;
      o.position.copy(c.p);
      o.rotation.copy(c.r);
      o.scale.setScalar(Math.min(1, c.life));
      o.updateMatrix();
      this.mesh.setMatrixAt(i, o.matrix);
      this.mesh.setColorAt(i, this.c.setHex(c.c));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (i) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Fx {
  constructor(scene) {
    const soft = radialTexture(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.smoke = new Particles(scene, 900, { texture: soft });
    this.glow = new Particles(scene, 700, { additive: true, texture: soft });
    this.debris = new Debris(scene, 260);
    this.arrows = new Arrows(scene);
    this.boulders = new Arrows(scene, 16, new Builder().add(new THREE.DodecahedronGeometry(0.45, 0), 0x8a6a4a).build(), false);
    this.boulders.mesh.castShadow = true;
    this.balls = new Arrows(scene, 16, new Builder().add(new THREE.SphereGeometry(0.22, 10, 8), 0x2a2a2e).build(), false);
    this.confetti = new Confetti(scene);
  }

  setScale(px) {
    this.smoke.mat.uniforms.scale.value = px;
    this.glow.mat.uniforms.scale.value = px;
  }

  // footstep dust behind the army
  dust(x, z, n = 1) {
    for (let i = 0; i < n; i++)
      this.smoke.emit(x + rnd(-0.3, 0.3), 0.2, z + rnd(0, 0.4), { vx: rnd(-0.4, 0.4), vy: rnd(0.3, 0.9), vz: rnd(0.5, 1.5), color: 0xd9c49a, size: rnd(0.5, 0.9), life: rnd(0.5, 0.9), grow: 1.9, alpha: 0.35 });
  }

  // unit vanishes: puff of smoke + coloured shards
  poof(x, y, z, color) {
    for (let i = 0; i < 5; i++)
      this.smoke.emit(x + rnd(-0.3, 0.3), y + rnd(0.3, 1.2), z + rnd(-0.3, 0.3), { vx: rnd(-1.5, 1.5), vy: rnd(0.5, 2.5), vz: rnd(-1.5, 1.5), color: 0xf4efe6, size: rnd(0.7, 1.2), life: rnd(0.4, 0.7), grow: 2.2, alpha: 0.8 });
    for (let i = 0; i < 3; i++)
      this.debris.emit(x, y + 1, z, { vx: rnd(-4, 4), vy: rnd(3, 7), vz: rnd(-4, 4), color, sx: 0.16, sy: 0.16, sz: 0.16, life: 0.9 });
  }

  clash(x, y, z) {
    for (let i = 0; i < 6; i++)
      this.glow.emit(x, y, z, { vx: rnd(-6, 6), vy: rnd(1, 7), vz: rnd(-6, 6), color: i % 2 ? 0xffe9a0 : 0xffffff, size: rnd(0.2, 0.4), life: rnd(0.15, 0.35), grow: 0.5, grav: 12, drag: 2 });
    this.glow.emit(x, y, z, { color: 0xfff1c0, size: 1.6, life: 0.12, grow: 3, alpha: 0.8 });
  }

  sparkle(x, y, z, color = 0xffffff, n = 10) {
    for (let i = 0; i < n; i++)
      this.glow.emit(x + rnd(-1.2, 1.2), y + rnd(0, 2.5), z + rnd(-0.3, 0.3), { vx: rnd(-1, 1), vy: rnd(1, 4), vz: rnd(-1, 1), color, size: rnd(0.25, 0.55), life: rnd(0.4, 0.9), grow: 0.6, grav: -1, drag: 1 });
  }

  bigDust(x, y, z, n = 30, spread = 4, color = 0xcdb894) {
    for (let i = 0; i < n; i++)
      this.smoke.emit(x + rnd(-spread, spread), y + rnd(0, spread * 0.6), z + rnd(-1, 1), { vx: rnd(-3, 3), vy: rnd(0.5, 4), vz: rnd(-2, 3), color, size: rnd(2, 4), life: rnd(1, 2.2), grow: 1.6, alpha: 0.75, drag: 1.2 });
  }

  firework(x, y, z, color) {
    for (let i = 0; i < 46; i++) {
      const a = rnd(0, Math.PI * 2);
      const b = rnd(-1, 1);
      const s = rnd(8, 12);
      const r = Math.sqrt(1 - b * b);
      this.glow.emit(x, y, z, { vx: Math.cos(a) * r * s, vy: b * s, vz: Math.sin(a) * r * s, color, size: rnd(0.4, 0.7), life: rnd(0.9, 1.4), grow: 0.7, grav: 5, drag: 1.6 });
    }
    this.glow.emit(x, y, z, { color: 0xffffff, size: 6, life: 0.2, grow: 2, alpha: 0.9 });
  }

  update(dt) {
    this.smoke.update(dt);
    this.glow.update(dt);
    this.debris.update(dt);
    this.arrows.update(dt);
    this.boulders.update(dt);
    this.balls.update(dt);
    this.confetti.update(dt);
  }
}
