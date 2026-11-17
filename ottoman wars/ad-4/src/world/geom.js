import * as THREE from '../vendor/three.module.min.js';

// Tiny geometry kit: build a model from primitives, each with its own colour and
// transform, then merge into one vertex-coloured BufferGeometry (one draw call).

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

export class Builder {
  constructor() {
    this.parts = [];
  }

  // geo: BufferGeometry; color: hex; at: [x,y,z]; rot: [rx,ry,rz]; scale: [sx,sy,sz] | number
  add(geo, color, at = [0, 0, 0], rot = [0, 0, 0], scale = 1, shade = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _m.compose(new THREE.Vector3(...at), _q, new THREE.Vector3(...s));
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.setHex(color).convertSRGBToLinear();
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r * shade;
      col[i * 3 + 1] = _c.g * shade;
      col[i * 3 + 2] = _c.b * shade;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    this.parts.push(g);
    return this;
  }

  build() {
    return merge(this.parts);
  }
}

export function merge(geos) {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Shared primitive shapes (low poly but rounded enough to read as "3D toy")
export const P = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg),
  sph: (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs),
  cone: (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg),
  capsule: (r, len, cs = 6, rs = 12) => new THREE.CapsuleGeometry(r, len, cs, rs),
  torus: (r, t, rs = 8, ts = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  halfSph: (r) => new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};

// Soft radial sprite used by particles and glows.
export function radialTexture(size = 64, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
