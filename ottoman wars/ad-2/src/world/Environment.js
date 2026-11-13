import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { COLORS as C, ROAD, FINALE } from '../config.js';

// Golden-hour battlefield: gradient sky with sun glow, rolling grass, a cobbled
// military road lined with Ottoman banners, cypress groves, a war camp at the start
// and blue mountains on the horizon.

let seed = 7;
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

export const SUN_DIR = new THREE.Vector3(-0.55, 0.75, 0.45).normalize();

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.flags = null;
    this.flagData = [];
    this.roadEnd = -(FINALE.castleD + 80);
    scene.fog = new THREE.Fog(C.fog, 70, 330);
    this.sky();
    this.lights();
    this.ground();
    this.road();
    this.decor();
    this.camp();
    this.banners();
    this.mountains();
    // (clouds removed — read as artefacts at portrait FOV)
  }

  sky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x4f97ea) },
        mid: { value: new THREE.Color(0x9fd0ff) },
        hor: { value: new THREE.Color(0xffd7a0) },
        sun: { value: SUN_DIR.clone().multiplyScalar(-1).setY(0.18).normalize() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sun; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = mix(hor, mid, smoothstep(-0.02, 0.22, h));
          c = mix(c, top, smoothstep(0.2, 0.75, h));
          float s = max(dot(normalize(vDir), normalize(sun)), 0.0);
          c += vec3(1.0, 0.8, 0.5) * pow(s, 18.0) * 0.55 + vec3(1.0, 0.95, 0.8) * pow(s, 400.0) * 1.2;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
    this.scene.add(this.skyMesh);
  }

  lights() {
    const hemi = new THREE.HemisphereLight(0xd8ecff, 0x7a6a40, 1.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -26;
    sc.right = 26;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 1;
    sc.far = 120;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    // warm rim light from the front so silhouettes pop against the road
    const rim = new THREE.DirectionalLight(0xffc98a, 0.7);
    rim.position.set(6, 6, -20);
    this.scene.add(rim);
  }

  // keep the shadow box centred on the action
  follow(x, z) {
    this.sun.target.position.set(x, 0, z - 6);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 60);
    this.sun.target.updateMatrixWorld();
  }

  ground() {
    const W = 700;
    const L = 1100;
    const geo = new THREE.PlaneGeometry(W, L, 70, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color(C.grass);
    const b = new THREE.Color(C.grassDark);
    const y = new THREE.Color(0xa7b34a);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - L / 2 + 80;
      pos.setZ(i, z);
      const ax = Math.abs(x);
      // gentle hills away from the road
      const hill = Math.max(0, ax - 22) * 0.05 * (1.2 + Math.sin(z * 0.03) * 0.6 + Math.sin(x * 0.05) * 0.4);
      pos.setY(i, ax < 9 ? -0.02 : hill * (1 + 0.3 * Math.sin(z * 0.011 + x * 0.02)));
      const n = 0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.07 - x * 0.05);
      c.copy(a).lerp(b, n * 0.7);
      if (rnd() < 0.25) c.lerp(y, 0.35);
      c.convertSRGBToLinear();
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  road() {
    // cobblestone texture painted on a canvas
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#9c8a72';
    ctx.fillRect(0, 0, 256, 256);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const h = 256 / rows;
      const off = (r % 2) * 16;
      for (let x = -32 + off; x < 256; x += 32) {
        const w = 28 + rr(-3, 3);
        const l = rr(70, 92);
        ctx.fillStyle = `hsl(${rr(28, 40)}, ${rr(16, 26)}%, ${l}%)`;
        roundRect(ctx, x + 2, r * h + 2, w, h - 4, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        roundRect(ctx, x + 5, r * h + 4, w - 8, (h - 4) * 0.35, 5);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const len = -this.roadEnd + 60;
    tex.repeat.set(3, len / 4);
    tex.anisotropy = 4;
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD.width, len),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, color: 0xd9c4a6 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 60 - len / 2);
    road.receiveShadow = true;
    this.scene.add(road);
    // stone curbs
    const curb = new THREE.MeshStandardMaterial({ color: 0xe5d7bd, roughness: 0.85 });
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, len), curb);
      m.position.set(s * (ROAD.half + 0.27), 0.14, 60 - len / 2);
      m.castShadow = false;
      m.receiveShadow = true;
      this.scene.add(m);
      const dirt = new THREE.Mesh(new THREE.PlaneGeometry(1.6, len), new THREE.MeshLambertMaterial({ color: 0x8f7a4e }));
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(s * (ROAD.half + 1.2), 0.005, 60 - len / 2);
      dirt.receiveShadow = true;
      this.scene.add(dirt);
    }
  }

  decor() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const place = (geo, n, xMin, xMax, sMin, sMax, zMin = this.roadEnd - 60, zMax = 70, shadow = true) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      const o = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const x = side * rr(xMin, xMax);
        o.position.set(x, 0, rr(zMin, zMax));
        const ax = Math.abs(x);
        o.position.y = ax < 22 ? 0 : Math.max(0, ax - 22) * 0.05;
        o.rotation.set(0, rr(0, Math.PI * 2), 0);
        o.scale.setScalar(rr(sMin, sMax));
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      }
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    const cypress = new Builder()
      .add(P.cyl(0.12, 0.16, 1.2, 6), 0x5a3c22, [0, 0.6, 0])
      .add(P.sph(1, 10, 10), 0x3d7a34, [0, 3.6, 0], [0, 0, 0], [0.85, 3.0, 0.85])
      .add(P.sph(0.8, 9, 8), 0x4a8a3c, [0.15, 4.6, -0.1], [0, 0, 0], [0.62, 2.2, 0.62])
      .build();
    const tree = new Builder()
      .add(P.cyl(0.2, 0.3, 2.2, 7), 0x6a4527, [0, 1.1, 0])
      .add(P.sph(1.5, 9, 8), 0x4f8a32, [0, 3.0, 0])
      .add(P.sph(1.1, 9, 8), 0x5d9b38, [0.9, 3.4, 0.3])
      .add(P.sph(1.0, 9, 8), 0x467c2c, [-0.8, 3.2, -0.4])
      .build();
    const bush = new Builder()
      .add(P.sph(0.6, 8, 6), 0x4a7f2c, [0, 0.35, 0])
      .add(P.sph(0.45, 8, 6), 0x5a9234, [0.4, 0.3, 0.2])
      .add(P.sph(0.12, 6, 4), 0xe3423f, [0.1, 0.8, -0.3])
      .add(P.sph(0.1, 6, 4), 0xf4d03f, [0.5, 0.6, 0.3])
      .build();
    const rock = new Builder().add(new THREE.DodecahedronGeometry(0.6, 0), 0x9c968a, [0, 0.25, 0], [0, 0, 0], [1.2, 0.7, 1]).build();
    const flower = new Builder()
      .add(P.cone(0.06, 0.4, 4), 0x4f8a32, [0, 0.2, 0])
      .add(P.sph(0.09, 6, 4), 0xd8333a, [0, 0.42, 0])
      .add(P.cone(0.05, 0.3, 4), 0x4f8a32, [0.15, 0.15, 0.1])
      .add(P.sph(0.07, 6, 4), 0xf2c23a, [0.15, 0.32, 0.1])
      .build();
    place(cypress, 150, 10, 70, 0.9, 1.5);
    place(tree, 70, 14, 80, 0.8, 1.3);
    place(bush, 160, 8.2, 30, 0.7, 1.4);
    place(rock, 90, 8, 45, 0.5, 1.6, undefined, undefined, false);
    place(flower, 500, 7.4, 16, 0.8, 1.5, undefined, undefined, false);
  }

  // Ottoman war camp: striped tents around the starting line
  camp() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const tent = new Builder();
    tent.add(P.cyl(2.2, 2.2, 1.7, 16), 0xf3ead8, [0, 0.85, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      tent.add(P.box(0.5, 1.72, 0.06), C.coat, [Math.cos(a) * 2.21, 0.86, Math.sin(a) * 2.21], [0, -a + Math.PI / 2, 0]);
    }
    tent.add(P.cone(2.6, 2.3, 16), C.coat, [0, 2.85, 0]);
    tent.add(P.cyl(2.62, 2.62, 0.18, 16), C.gold, [0, 1.75, 0]);
    tent.add(P.cyl(0.05, 0.05, 1.2, 6), 0x5a3c22, [0, 4.3, 0]);
    tent.add(P.sph(0.16, 8, 6), C.gold, [0, 4.9, 0]);
    tent.add(P.box(0.9, 1.3, 0.05), 0x3a1a10, [0, 0.65, -2.21]);
    const geo = tent.build();
    const spots = [
      [-13, 6], [13, 2], [-19, -8], [18, -14], [-12, -22], [14, 18], [-20, 18], [22, 6],
    ];
    const m = new THREE.InstancedMesh(geo, mat, spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z);
      o.rotation.set(0, Math.atan2(-x, 4), 0);
      o.scale.setScalar(rr(0.9, 1.25));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
  }

  // red banners on poles along the road (they flutter in update)
  banners() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const pole = new Builder()
      .add(P.cyl(0.07, 0.09, 4.6, 6), 0x5a3c22, [0, 2.3, 0])
      .add(P.sph(0.14, 8, 6), C.gold, [0, 4.68, 0])
      .add(P.cyl(0.03, 0.03, 1.3, 5), 0x5a3c22, [0, 4.35, 0], [0, 0, Math.PI / 2])
      .build();
    const flag = new Builder()
      .add(P.box(1.25, 1.9, 0.04), C.coat, [0, -0.95, 0])
      .add(P.box(1.25, 0.12, 0.05), C.gold, [0, -0.06, 0])
      .add(P.cone(0.63, 0.5, 3), C.coat, [0, -2.1, 0], [Math.PI, Math.PI / 6, 0], [1, 1, 0.07])
      .add(P.sph(0.2, 10, 8), C.gold, [0, -0.85, -0.03], [0, 0, 0], [1, 1, 0.2])
      .build();
    const spots = [];
    for (let z = 20; z > this.roadEnd + 40; z -= 26) for (const s of [-1, 1]) spots.push([s * (ROAD.half + 1.4), z]);
    const pm = new THREE.InstancedMesh(pole, mat, spots.length);
    const fm = new THREE.InstancedMesh(flag, mat, spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(1);
      o.updateMatrix();
      pm.setMatrixAt(i, o.matrix);
      this.flagData.push({ x: x - Math.sign(x) * 0.0, z, ph: rnd() * 6 });
    });
    pm.castShadow = fm.castShadow = true;
    this.scene.add(pm);
    this.scene.add(fm);
    this.flags = fm;
    this.updateFlags(0);
  }

  updateFlags(t) {
    const o = this._o || (this._o = new THREE.Object3D());
    this.flagData.forEach((f, i) => {
      o.position.set(f.x, 4.35, f.z);
      o.rotation.set(Math.sin(t * 2.2 + f.ph) * 0.12, Math.sin(t * 1.7 + f.ph) * 0.35 + (f.x < 0 ? 0.3 : -0.3), 0);
      o.updateMatrix();
      this.flags.setMatrixAt(i, o.matrix);
    });
    this.flags.instanceMatrix.needsUpdate = true;
  }

  mountains() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
    const b = new Builder();
    for (let i = 0; i < 18; i++) {
      const x = rr(-420, 420);
      const z = rr(-760, -600);
      const h = rr(45, 110);
      const r = rr(80, 140);
      b.add(P.cone(r, h, 7), i % 3 ? 0xa9bfd2 : 0x98b0c6, [x, h / 2 - 5, z], [0, 0.3, 0]);
      b.add(P.cone(r * 0.26, h * 0.26, 7), 0xf6f4ef, [x, h * 0.87 - 5, z], [0, 0.3, 0]);
    }
    for (let i = 0; i < 14; i++) {
      const s = i % 2 ? 1 : -1;
      const x = s * rr(110, 300);
      const z = rr(-500, 0);
      const h = rr(14, 30);
      b.add(P.sph(1, 12, 8), 0x8fb06a, [x, 0, z], [0, rr(0, 3), 0], [rr(60, 110), h, rr(60, 110)]);
    }
    const m = new THREE.Mesh(b.build(), mat);
    this.scene.add(m);
  }

  clouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffe9d0, emissiveIntensity: 0.35, fog: false, transparent: true, opacity: 0.92 });
    const b = new Builder();
    for (let i = 0; i < 14; i++) {
      const x = rr(-500, 500);
      const y = rr(140, 230);
      const z = rr(-700, -250);
      for (let k = 0; k < 5; k++) b.add(P.sph(rr(14, 26), 10, 7), 0xffffff, [x + k * rr(12, 20), y + rr(-4, 6), z + rr(-8, 8)], [0, 0, 0], [1, 0.55, 1]);
    }
    this.cloudMesh = new THREE.Mesh(b.build(), mat);
    this.scene.add(this.cloudMesh);
  }

  update(t, camZ) {
    this.updateFlags(t);
    this.skyMesh.position.z = camZ;

  }
}
