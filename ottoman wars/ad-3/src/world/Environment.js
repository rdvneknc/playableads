import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { MAP } from '../config.js';
import { T, tent, tree, field } from './Town.js';

// Green Anatolian countryside around the fortress: grass and packed earth,
// a dirt road to the north gate, fields, tents, scattered trees and far hills.

let seed = 5;
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

export const SUN_DIR = new THREE.Vector3(-0.45, 0.85, 0.3).normalize();

export class Environment {
  constructor(scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xcfe0ea, 70, 210);
    this.sky();
    this.lights();
    this.ground();
    this.countryside();
  }

  sky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(0x6aa8e0) }, hor: { value: new THREE.Color(0xdbe9ef) } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; varying vec3 vDir;
        void main(){ vec3 c = mix(hor, top, smoothstep(0.0, 0.5, vDir.y)); gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
    this.scene.add(this.skyMesh);
  }

  lights() {
    this.scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x8a8a62, 1.25));
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -26;
    sc.right = 26;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 1;
    sc.far = 120;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  follow(x, z) {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 60);
    this.sun.target.updateMatrixWorld();
  }

  ground() {
    // grass with gentle colour variation
    const geo = new THREE.PlaneGeometry(400, 400, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color(T.grass);
    const b = new THREE.Color(0x86a055);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.max(Math.abs(x), Math.abs(z));
      pos.setY(i, d > 40 ? (d - 40) * 0.06 * (1 + Math.sin(x * 0.05) * Math.sin(z * 0.04)) : -0.02);
      c.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.07) * Math.sin(z * 0.11 - x * 0.05));
      c.convertSRGBToLinear();
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const g = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    g.receiveShadow = true;
    this.scene.add(g);
    // packed earth inside the walls (soft-edged canvas texture) + the road north
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
    grad.addColorStop(0, 'rgba(214,194,152,1)');
    grad.addColorStop(0.82, 'rgba(208,188,146,0.95)');
    grad.addColorStop(1, 'rgba(208,188,146,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${150 + rnd() * 40},${130 + rnd() * 30},${90 + rnd() * 30},0.25)`;
      ctx.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dirtMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false });
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(MAP.half * 2.3, MAP.half * 2.3), dirtMat);
    yard.rotation.x = -Math.PI / 2;
    yard.position.y = 0.01;
    yard.receiveShadow = true;
    this.scene.add(yard);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), new THREE.MeshLambertMaterial({ color: 0xcdb48a, transparent: true, opacity: 0.85, depthWrite: false }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.012, -MAP.half - 30);
    road.receiveShadow = true;
    this.scene.add(road);
  }

  countryside() {
    const add = (o, x, z, ry = 0) => {
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      this.scene.add(o);
    };
    // fields to the south & east
    add(field(7, 5), -8, 22);
    add(field(7, 5), 1, 22, 0.05);
    add(field(6, 6), 22, 6, Math.PI / 2);
    add(field(6, 6), 22, -3, Math.PI / 2);
    // a few tents of the army camp to the west
    for (const [x, z] of [[-21, -4], [-23, 3], [-20, 9], [-25, -10]]) add(tent(), x, z, rr(0, 3));
    // trees (instanced copies of one mesh)
    const t = tree();
    const spots = [];
    for (let i = 0; i < 70; i++) {
      const a = rr(0, Math.PI * 2);
      const r = rr(20, 60);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 4 && z < -15) continue; // keep the road clear
      if (z < -18 && Math.abs(x) < 20) continue; // and the battlefield
      if (Math.abs(x + 9) < 6 && Math.abs(z - 22) < 5) continue;
      spots.push([x, z]);
    }
    const im = new THREE.InstancedMesh(t.geometry, t.material, spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z);
      o.rotation.y = rr(0, 6);
      o.scale.setScalar(rr(0.8, 1.4));
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = im.receiveShadow = true;
    this.scene.add(im);
    // distant hills
    const b = new Builder();
    for (let i = 0; i < 18; i++) {
      const a = rr(0, Math.PI * 2);
      const r = rr(130, 190);
      const h = rr(14, 30);
      b.add(P.sph(1, 12, 8), i % 2 ? 0x8fb070 : 0x9cbc7a, [Math.cos(a) * r, 0, Math.sin(a) * r], [0, 0, 0], [rr(40, 70), h, rr(40, 70)]);
    }
    this.scene.add(new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  }

  update(t, camX, camZ) {
    this.skyMesh.position.set(camX, 0, camZ);
  }
}
