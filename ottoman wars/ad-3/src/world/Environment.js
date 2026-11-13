import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { COLORS as C, MAP } from '../config.js';

// Warm desert steppe: sand with dunes, red-rock mesas, date palms and dry shrubs,
// an Ottoman camp of striped tents, crates and banners.

let seed = 11;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rr = (a, b) => a + (b - a) * rnd();

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export const SUN_DIR = new THREE.Vector3(-0.5, 0.82, 0.35).normalize();

// keep clear: the camp and the approach path in front of the wall
const inCamp = (x, z) => Math.abs(x) < 17 && z > -9 && z < 17;
const onPath = (x, z) => Math.abs(x) < 16 && z < -6 && z > -70;

export class Environment {
  constructor(scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xf2d3a2, 55, 190);
    this.sky();
    this.lights();
    this.ground();
    this.decor();
    this.camp();
    this.mesas();
  }

  sky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x5aa2e6) },
        mid: { value: new THREE.Color(0xa9d4f2) },
        hor: { value: new THREE.Color(0xf7d9a8) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = mix(hor, mid, smoothstep(-0.02, 0.2, h)); c = mix(c, top, smoothstep(0.2, 0.7, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
    this.scene.add(this.skyMesh);
  }

  lights() {
    this.scene.add(new THREE.HemisphereLight(0xfff4e6, 0x9a8a72, 1.15));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -24;
    sc.right = 24;
    sc.top = 24;
    sc.bottom = -24;
    sc.near = 1;
    sc.far = 110;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  follow(x, z) {
    this.sun.target.position.set(x, 0, z - 4);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 60);
    this.sun.target.updateMatrixWorld();
  }

  ground() {
    const geo = new THREE.PlaneGeometry(420, 420, 110, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color(C.sand);
    const b = new THREE.Color(C.sandDark);
    const l = new THREE.Color(C.sandLight);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 40;
      pos.setZ(i, z);
      // dunes rise away from the camp & path
      const d = Math.max(0, Math.hypot(x / 1.3, (z - 4) / 1.0) - 26);
      const dune = Math.min(1, d / 30) * (3 + 2.5 * Math.sin(x * 0.07 + z * 0.05) + 1.8 * Math.sin(z * 0.13 - x * 0.04));
      const flat = Math.abs(x) < 15 && z < -6 ? 0.15 : 1;
      pos.setY(i, Math.max(0, dune * flat) + Math.sin(x * 0.6) * Math.sin(z * 0.5) * 0.04);
      const n = 0.5 + 0.5 * Math.sin(x * 0.17 + z * 0.11) * Math.sin(z * 0.09 - x * 0.07);
      c.copy(a).lerp(b, n * 0.5);
      if (rnd() < 0.3) c.lerp(l, 0.25);
      c.convertSRGBToLinear();
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    this.scene.add(m);
    // a beaten-earth yard inside the camp
    const yard = new THREE.Mesh(new THREE.CircleGeometry(15.5, 40), new THREE.MeshLambertMaterial({ color: 0xd8b98a, transparent: true, opacity: 0.45, depthWrite: false }));
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(0, 0.02, 4);
    yard.scale.set(1, 0.85, 1);
    yard.receiveShadow = true;
    this.scene.add(yard);
  }

  decor() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const scatter = (geo, n, minR, maxR, sMin, sMax, shadow = true, avoid = true) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      const o = new THREE.Object3D();
      let i = 0;
      let guard = 0;
      while (i < n && guard++ < n * 20) {
        const a = rr(0, Math.PI * 2);
        const r = rr(minR, maxR);
        const x = Math.cos(a) * r;
        const z = 2 + Math.sin(a) * r;
        if (avoid && (inCamp(x, z) || onPath(x, z))) continue;
        o.position.set(x, 0, z);
        o.rotation.set(0, rr(0, 6.28), 0);
        o.scale.setScalar(rr(sMin, sMax));
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
      m.count = i;
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    const palm = new Builder();
    for (let k = 0; k < 6; k++) palm.add(P.cyl(0.17 - k * 0.012, 0.19 - k * 0.012, 0.75, 7), k % 2 ? 0x8a6238 : 0x7a5530, [k * 0.07, 0.37 + k * 0.72, 0], [0, 0, -0.06]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      palm.add(P.box(0.5, 0.06, 2.4), k % 2 ? 0x4f8a2e : 0x3f7a26, [0.42 + Math.cos(a) * 1.0, 4.35, Math.sin(a) * 1.0], [0.45, -a + Math.PI / 2, 0]);
    }
    palm.add(P.sph(0.22, 8, 6), 0x8a4a1c, [0.45, 4.25, 0]);
    const shrub = new Builder()
      .add(P.sph(0.5, 7, 5), 0x8a8a3a, [0, 0.3, 0], [0, 0, 0], [1, 0.6, 1])
      .add(P.sph(0.35, 7, 5), 0x9a9a46, [0.35, 0.25, 0.2], [0, 0, 0], [1, 0.6, 1])
      .build();
    const rock = new Builder().add(new THREE.DodecahedronGeometry(0.7, 0), C.rock, [0, 0.3, 0], [0, 0, 0], [1.3, 0.75, 1]).build();
    scatter(palm.build(), 26, 20, 60, 0.85, 1.25);
    scatter(shrub, 120, 12, 70, 0.6, 1.4, false);
    scatter(rock, 70, 14, 80, 0.5, 2.2);
  }

  camp() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // striped tents behind the camp
    const tent = new Builder();
    tent.add(P.cyl(2.0, 2.0, 1.6, 16), 0xf3ead8, [0, 0.8, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      tent.add(P.box(0.48, 1.62, 0.06), C.red, [Math.cos(a) * 2.01, 0.81, Math.sin(a) * 2.01], [0, -a + Math.PI / 2, 0]);
    }
    tent.add(P.cone(2.4, 2.1, 16), C.red, [0, 2.65, 0]);
    tent.add(P.cyl(2.42, 2.42, 0.16, 16), C.gold, [0, 1.65, 0]);
    tent.add(P.cyl(0.05, 0.05, 1.0, 6), 0x5a3c22, [0, 4.0, 0]);
    tent.add(P.sph(0.15, 8, 6), C.gold, [0, 4.5, 0]);
    tent.add(P.box(0.9, 1.25, 0.05), 0x3a1a10, [0, 0.62, -2.01]);
    const spots = [
      [-14, 15], [-7, 18.5], [0, 20], [7, 18.5], [14, 15], [-17.5, 8], [17.5, 8],
    ];
    const tm = new THREE.InstancedMesh(tent.build(), mat, spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z);
      o.rotation.set(0, Math.atan2(x, z - 4) + Math.PI, 0);
      o.scale.setScalar(rr(0.72, 0.85));
      o.updateMatrix();
      tm.setMatrixAt(i, o.matrix);
    });
    tm.castShadow = tm.receiveShadow = true;
    this.scene.add(tm);
    // crates, barrels, sacks
    const crate = new Builder()
      .add(P.box(0.9, 0.9, 0.9), 0xa8743c, [0, 0.45, 0])
      .add(P.box(0.94, 0.12, 0.94), 0x6b4424, [0, 0.82, 0])
      .add(P.box(0.94, 0.12, 0.94), 0x6b4424, [0, 0.08, 0])
      .build();
    const barrel = new Builder()
      .add(P.cyl(0.38, 0.38, 0.9, 12), 0x9a6232, [0, 0.45, 0])
      .add(P.cyl(0.4, 0.4, 0.08, 12), 0x3a3a40, [0, 0.2, 0])
      .add(P.cyl(0.4, 0.4, 0.08, 12), 0x3a3a40, [0, 0.7, 0])
      .build();
    const props = [
      [crate, [[-15.5, 2], [-15, 3.2], [15.5, 2.6], [-3.5, 15.5], [12.5, 13]]],
      [barrel, [[-14.5, 0.6], [15, 1.1], [3.8, 15.5], [-12, 12.8], [14.6, 4.2]]],
    ];
    for (const [geo, list] of props) {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z], i) => {
        o.position.set(x, 0, z);
        o.rotation.set(0, rr(0, 3), 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
    }
    // campfire ring
    const fire = new Builder();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      fire.add(new THREE.DodecahedronGeometry(0.22, 0), 0x8a7a6a, [Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7]);
    }
    fire.add(P.cyl(0.08, 0.08, 1.1, 6), 0x5a3a1e, [0, 0.18, 0], [0, 0.5, Math.PI / 2]);
    fire.add(P.cyl(0.08, 0.08, 1.1, 6), 0x5a3a1e, [0, 0.22, 0], [0, -0.7, Math.PI / 2]);
    const fm = new THREE.Mesh(fire.build(), mat);
    fm.position.set(-2.5, 0, 15);
    this.scene.add(fm);
    this.firePos = new THREE.Vector3(-2.5, 0.4, 15);
  }

  // red-rock mesas on the horizon
  mesas() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const b = new Builder();
    for (let i = 0; i < 16; i++) {
      const a = rr(-Math.PI * 0.95, -Math.PI * 0.05);
      const r = rr(120, 190);
      const x = Math.cos(a) * r;
      const z = 2 + Math.sin(a) * r;
      const h = rr(14, 34);
      const w = rr(14, 32);
      b.add(P.cyl(w * 0.8, w, h, 7), i % 2 ? 0xc98a58 : 0xb8784a, [x, h / 2 - 1, z], [0, rr(0, 3), 0]);
      b.add(P.cyl(w * 0.82, w * 0.8, 1.4, 7), 0xe0a878, [x, h, z], [0, rr(0, 3), 0]);
    }
    this.scene.add(new THREE.Mesh(b.build(), mat));
  }

  update(t, camX, camZ) {
    this.skyMesh.position.set(camX, 0, camZ);
  }
}

export { MAP };
