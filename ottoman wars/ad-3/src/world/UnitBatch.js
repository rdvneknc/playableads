import * as THREE from '../vendor/three.module.min.js';

// Draws N animated characters of one model with one InstancedMesh per part.
// Usage per frame: begin(); push(...) for every visible unit; end().

const _base = new THREE.Matrix4();
const _tmp = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

export class UnitBatch {
  constructor(scene, model, capacity, material, { scale = 1, shadows = true } = {}) {
    this.model = model;
    this.capacity = capacity;
    this.scale = scale;
    this.count = 0;
    const mk = (geo) => {
      const m = new THREE.InstancedMesh(geo, material, capacity);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadows;
      m.receiveShadow = false;
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.rigid = mk(model.rigid);
    this.limbs = model.limbs.map((l) => ({
      ...l,
      mesh: mk(l.geo),
      to: new THREE.Matrix4().makeTranslation(l.pivot[0], l.pivot[1], l.pivot[2]),
      back: new THREE.Matrix4().makeTranslation(-l.pivot[0], -l.pivot[1], -l.pivot[2]),
    }));
    // per-instance tint (hit flash)
    this.tints = [this.rigid, ...this.limbs.map((l) => l.mesh)];
    for (const m of this.tints) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
  }

  begin() {
    this.count = 0;
  }

  // yaw: radians (0 = facing -Z); phase drives the gait; mode 0 run / 1 fight / 2 idle / 3 cheer
  // flash: 0..1 white flash; s: extra scale (spawn pop); tilt: lean (falling)
  push(x, y, z, yaw, phase, mode, s = 1, flash = 0, tilt = 0) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    const bob = mode === 0 ? Math.abs(Math.sin(phase)) * 0.08 : mode === 3 ? Math.abs(Math.sin(phase * 0.9)) * 0.45 : 0;
    _q.setFromAxisAngle(_up, yaw);
    if (tilt) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    _p.set(x, y + bob, z);
    const k = this.scale * s;
    _s.set(k, k, k);
    _base.compose(_p, _q, _s);
    this.rigid.setMatrixAt(i, _base);
    for (const l of this.limbs) {
      const a = l.anim(phase, mode);
      _rot.makeRotationX(a);
      _tmp.multiplyMatrices(_base, l.to).multiply(_rot).multiply(l.back);
      l.mesh.setMatrixAt(i, _tmp);
    }
    const f = 1 + flash * 2.2;
    _c.setRGB(f, f, f);
    for (const m of this.tints) m.setColorAt(i, _c);
  }

  end() {
    for (const m of this.tints) {
      m.count = this.count;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
