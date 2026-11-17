import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/SkeletonUtils.js';
import yeniceriUrl from '../assets/yeniceri.glb';

// The Yeniçeri model (.glb, skinned, clips: Idle / Walk / Attack / Die), inlined in the build.
export async function loadJanissary() {
  const b64 = yeniceriUrl.slice(yeniceriUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer, '', resolve, reject));
}

const _e = new THREE.Euler();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// A pool of animated soldiers. Poses on top of the clips: sitting on the heels (diz çökmüş)
// and holding a bowl with both hands.
export class JanissaryCrowd {
  constructor(scene, gltf, count, height = 2.3) {
    this.units = [];
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = height / Math.max(0.01, size.y);
    const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
    for (let i = 0; i < count; i++) {
      const model = cloneSkinned(gltf.scene);
      model.scale.setScalar(scale);
      model.rotation.y = Math.PI; // the model faces +Z, the game uses -Z as forward
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
        }
      });
      const root = new THREE.Group();
      root.add(model);
      root.visible = false;
      scene.add(root);
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const name of ['Idle', 'Walk', 'Attack']) {
        if (!clips[name]) continue;
        const a = mixer.clipAction(clips[name]);
        a.play();
        a.setEffectiveWeight(0);
        a.time = Math.random() * clips[name].duration;
        actions[name] = a;
      }
      const bone = (n) => model.getObjectByName(n);
      const bones = {};
      for (const n of ['Pelvis', 'Spine', 'ThighL', 'ShinL', 'FootL', 'ThighR', 'ShinR', 'FootR', 'UpperArmSword', 'ForearmSword', 'HandSword', 'UpperArmShield', 'ForearmShield', 'HandShield']) bones[n] = bone(n);
      const pelvisY = bones.Pelvis ? bones.Pelvis.position.y : 1;
      this.units.push({ root, model, mixer, actions, bones, pelvisY, cur: null, sit: 0, hold: 0 });
    }
  }

  // mode: 0 walk · 2 idle · 3 cheer (sword up) · 4 sit · 5 sit holding a bowl · 6 sit flipping an empty bowl
  update(i, x, z, yaw, mode, dt, walkSpeed = 3.6) {
    const u = this.units[i];
    if (!u) return;
    u.root.visible = true;
    u.root.position.set(x, 0, z);
    u.root.rotation.y = yaw;
    const want = mode === 0 ? 'Walk' : mode === 3 ? 'Attack' : 'Idle';
    if (want !== u.cur && u.actions[want]) {
      for (const [n, a] of Object.entries(u.actions)) a.setEffectiveWeight(n === want ? 1 : 0);
      if (u.cur) {
        const from = u.actions[u.cur];
        from.setEffectiveWeight(1);
        from.crossFadeTo(u.actions[want], 0.18, false);
        u.actions[want].setEffectiveWeight(1);
      }
      u.cur = want;
    }
    if (u.actions.Walk) u.actions.Walk.timeScale = walkSpeed / 2.6;
    u.mixer.update(dt);
    const sitting = mode >= 4;
    u.sit += ((sitting ? 1 : 0) - u.sit) * Math.min(1, dt * 10);
    u.hold += ((mode === 5 || mode === 6 ? 1 : 0) - u.hold) * Math.min(1, dt * 10);
    this.pose(u, mode, dt);
  }

  pose(u, mode) {
    const B = u.bones;
    const k = u.sit;
    if (k > 0.01 && B.Pelvis) {
      // kneel and sit back on the heels
      B.Pelvis.position.y = u.pelvisY - k * u.pelvisY * 0.62;
      const set = (b, x, y, z) => {
        if (!b) return;
        _e.set(x * k, y * k, z * k);
        const q = new THREE.Quaternion().setFromEuler(_e);
        b.quaternion.slerp(q, k);
      };
      set(B.ThighL, -1.45, 0, 0.08);
      set(B.ThighR, -1.45, 0, -0.08);
      set(B.ShinL, 2.75, 0, 0);
      set(B.ShinR, 2.75, 0, 0);
      set(B.FootL, -0.9, 0, 0);
      set(B.FootR, -0.9, 0, 0);
    }
    const h = u.hold;
    if (h > 0.01) {
      const set = (b, x, y, z) => {
        if (!b) return;
        _e.set(x, y, z);
        b.quaternion.slerp(new THREE.Quaternion().setFromEuler(_e), h);
      };
      set(B.UpperArmSword, -1.0, 0, 0.35);
      set(B.ForearmSword, -0.9, 0, 0);
      set(B.UpperArmShield, -1.0, 0, -0.35);
      set(B.ForearmShield, -0.9, 0, 0);
    }
  }

  // between the two hands, in world space
  hand(i, out) {
    const u = this.units[i];
    if (!u?.bones.HandSword || !u.bones.HandShield) return null;
    u.bones.HandSword.getWorldPosition(_a);
    u.bones.HandShield.getWorldPosition(_b);
    return out.addVectors(_a, _b).multiplyScalar(0.5);
  }

  hideFrom(n) {
    for (let i = n; i < this.units.length; i++) this.units[i].root.visible = false;
  }
}
