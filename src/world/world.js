import * as THREE from 'three';
import { ATMO, CFG, injectAtmo } from '../core/config.js';
import { SKY_GLSL } from '../render/atmosphere.js';
import { camera, scene } from '../render/renderer.js';
import { Terrain } from './terrain.js';

/* ================================================================
   MUNDO
   ================================================================ */
export const terrain = new Terrain();
export const SH = {
  uTime:    { value: 0 },
  uHM:      { value: terrain.tex },
  uWorldSize: { value: CFG.world.size },
  uWindDir: { value: CFG.wind.clone() },
  uSunDirU: ATMO.uSunDir,
  uSunCol:  { value: new THREE.Color(1.0, 0.84, 0.62).multiplyScalar(1.2) },
  uAmb:     { value: new THREE.Color(0.42, 0.37, 0.31) },
  uPush:    { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  uCast:    { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  // linha de visão câmera → personagem (x, altura do olhar, z, ativo): a grama no caminho baixa
  uFocus:   { value: [new THREE.Vector4(), new THREE.Vector4()] },
  uShadowDir: { value: new THREE.Vector2(-CFG.sun.x, -CFG.sun.z).normalize() },
  uShadowLen: { value: Math.hypot(CFG.sun.x, CFG.sun.z) / CFG.sun.y },
};

// Lambert com brilho de contraluz (folhas, partes finas)
export function withBacklight(mat, k) {
  mat.onBeforeCompile = (sh) => {
    injectAtmo(sh);
    sh.uniforms.uSunDirU = SH.uSunDirU; sh.uniforms.uSunCol = SH.uSunCol;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBW; uniform vec3 uSunDirU; uniform vec3 uSunCol;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float bl = pow(max(dot(normalize(vBW - cameraPosition), uSunDirU), 0.0), 5.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSunCol * bl * ${k.toFixed(2)};`);
  };
  return mat;
}

// Contorno de luz: com o sol atrás do personagem, as bordas da silhueta acendem (marca da referência)
export function withRim(mat, k = 1.3) {
  mat.onBeforeCompile = (sh) => {
    injectAtmo(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRimCol;\n#ifndef USE_FOG\nuniform vec3 uSunDir;\n#endif').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 vd = normalize(vViewPosition);
        vec3 sv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        float rim = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 5.0);
        float back = pow(max(dot(-vd, sv), 0.0), 2.0);
        totalEmissiveRadiance += uRimCol * rim * back * ${k.toFixed(2)};
      }`);
  };
  mat.customProgramCacheKey = () => 'rim' + k;
  return mat;
}
export const hemi = new THREE.HemisphereLight(0xa9bccf, 0x5a4428, 1.05);

// ---------- Céu ----------
export let skyMat;
{
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    uniforms: { uGlow: { value: 0 }, uSunSize: { value: 1 } },
    fragmentShader: `varying vec3 vDir; uniform float uGlow, uSunSize;
      ${SKY_GLSL.split('vec4 fogCalc')[0]}
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        float s = max(dot(d, uSunDir), 0.0);
        float r0 = 1.0 - 0.00045 * uSunSize, r1 = 1.0 - 0.00022 * uSunSize;
        col += mix(vec3(1.0, 0.88, 0.7), vec3(1.0, 0.62, 0.32), uLow) * smoothstep(r0, r1, s) * 26.0 * smoothstep(-0.02, 0.01, d.y);
        // sem bloom (celular), o próprio céu desenha o halo do sol
        col += uSkyHaze * (pow(s, 40.0) * 0.8 + pow(s, 700.0) * 2.5) * uGlow;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  skyMat = mat;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 20), mat);
  sky.renderOrder = -1000; sky.frustumCulled = false;
  sky.onBeforeRender = () => sky.position.copy(camera.position);
  scene.add(sky);
}

// ---------- Luz ----------
export const sunLight = new THREE.DirectionalLight(0xffdcb4, 2.7);
sunLight.castShadow = true;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.03;
Object.assign(sunLight.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 220 });
scene.add(sunLight, sunLight.target);
scene.add(hemi);

// ---------- Terreno ----------
{
  const S = CFG.world.size;
  const geo = new THREE.PlaneGeometry(S, S, 256, 256).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrain.heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial();
  mat.onBeforeCompile = (sh) => {
    injectAtmo(sh);
    Object.assign(sh.uniforms, { uHM: SH.uHM, uWorldSize: SH.uWorldSize, uTime: SH.uTime, uWindDir: SH.uWindDir, uSunDirU: SH.uSunDirU, uSunCol: SH.uSunCol });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        varying vec3 vTW;
        uniform sampler2D uHM; uniform float uWorldSize; uniform float uTime; uniform vec2 uWindDir;
        uniform vec3 uSunDirU; uniform vec3 uSunCol;
        float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float tNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y); }`)
      .replace('#include <color_fragment>', /* glsl */`
        vec4 thm = texture2D(uHM, vTW.xz / uWorldSize + 0.5);
        float n1 = tNoise(vTW.xz * 0.35), n2 = tNoise(vTW.xz * 2.3), n3 = tNoise(vTW.xz * 0.045);
        float pathM = smoothstep(0.32, 0.72, thm.g + (n2 - 0.5) * 0.34 + (n1 - 0.5) * 0.22);
        vec3 dirt = mix(vec3(0.33, 0.26, 0.18), vec3(0.44, 0.36, 0.26), n2 * 0.7 + n1 * 0.3);
        float pc = smoothstep(0.55, 0.98, thm.g);
        dirt = mix(dirt * vec3(0.72, 0.68, 0.64), dirt * vec3(1.08, 1.05, 1.0), pc);
        dirt *= 0.9 + 0.2 * tNoise(vTW.xz * 9.0);
        float tFar = smoothstep(30.0, 70.0, distance(vTW.xz, cameraPosition.xz));
        float twave = sin(dot(vTW.xz, uWindDir) * 0.11 - uTime * 1.5) * 0.5 + 0.5;
        float streak = tNoise(vec2(dot(vTW.xz, uWindDir) * 0.08, dot(vTW.xz, vec2(-uWindDir.y, uWindDir.x)) * 0.9));
        vec3 tGold = mix(vec3(0.36, 0.25, 0.11), vec3(0.64, 0.46, 0.22), clamp(n3 * 0.45 + streak * 0.3 + twave * 0.3, 0.0, 1.0));
        tGold *= mix(0.55, 1.08, smoothstep(0.25, 0.75, streak)) * mix(0.8, 1.0, n1);
        // sob a grama: palha seca (não terra escura), assim falhas na grama não "furam" o campo
        vec3 thatch = mix(vec3(0.2, 0.14, 0.07), vec3(0.34, 0.25, 0.12), n2 * 0.6 + n1 * 0.4);
        vec3 ground = mix(thatch, tGold * 0.35, tFar * clamp(thm.b, 0.0, 1.0));
        diffuseColor.rgb = mix(ground, dirt, pathM * (1.0 - tFar * 0.6));`)
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
        float tBack = pow(max(dot(normalize(vTW - cameraPosition), uSunDirU), 0.0), 3.0);
        totalEmissiveRadiance += tGold * tFar * (1.0 - pathM) * (vec3(0.3, 0.27, 0.23) + uSunCol * (0.22 + tBack * 0.75));
        totalEmissiveRadiance += thatch * (1.0 - tFar) * (1.0 - pathM) * uSunCol * tBack * 0.35;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
