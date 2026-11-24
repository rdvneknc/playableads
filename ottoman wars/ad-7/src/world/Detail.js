import * as THREE from '../vendor/three.module.min.js';

// Surface realism without UVs: a world-space (triplanar) detail texture that adds
// stone courses / tile rows / grain to the flat vertex colours, plus a soft
// contact-shadow darkening near the ground.

let blocks = null;

function makeBlocks() {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  // value noise grain
  for (let i = 0; i < N * N; i++) {
    const v = 150 + Math.random() * 40;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // soft blotches
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    const r = 8 + Math.random() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const l = Math.random() < 0.5 ? 255 : 0;
    g.addColorStop(0, `rgba(${l},${l},${l},0.12)`);
    g.addColorStop(1, `rgba(${l},${l},${l},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // block courses with staggered joints (reads as masonry on walls, tile rows on roofs)
  const rows = 8;
  const h = N / rows;
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = 'rgba(40,30,20,0.32)';
    ctx.fillRect(0, r * h, N, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, r * h + 2, N, 1);
    const off = (r % 2) * (N / 8);
    for (let x = off; x < N + 1; x += N / 4) {
      ctx.fillStyle = 'rgba(40,30,20,0.26)';
      ctx.fillRect(x % N, r * h, 2, h);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function withDetail(mat, { scale = 0.42, strength = 0.55, ao = 1 } = {}) {
  blocks ||= makeBlocks();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: blocks };
    sh.uniforms.detailScale = { value: scale };
    sh.uniforms.detailStrength = { value: strength };
    sh.uniforms.aoStrength = { value: ao };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 dWp = vec4(transformed, 1.0);
        vec3 dN = objectNormal;
        #ifdef USE_INSTANCING
          dWp = instanceMatrix * dWp;
          dN = mat3(instanceMatrix) * dN;
        #endif
        dWp = modelMatrix * dWp;
        vWP = dWp.xyz;
        vWN = normalize(mat3(modelMatrix) * dN);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nuniform sampler2D detailMap;\nuniform float detailScale;\nuniform float detailStrength;\nuniform float aoStrength;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 bw = pow(abs(normalize(vWN)), vec3(4.0));
          bw /= (bw.x + bw.y + bw.z);
          float dx = texture2D(detailMap, vWP.zy * detailScale).r;
          float dy = texture2D(detailMap, vWP.xz * detailScale).r;
          float dz = texture2D(detailMap, vWP.xy * detailScale).r;
          float d = dx * bw.x + dy * bw.y + dz * bw.z;
          diffuseColor.rgb *= 1.0 + (d - 0.62) * detailStrength;
          // contact shadow near the ground
          diffuseColor.rgb *= mix(1.0, mix(0.58, 1.0, smoothstep(0.0, 0.85, vWP.y)), aoStrength);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `detail-${scale}-${strength}-${ao}`;
  return mat;
}
