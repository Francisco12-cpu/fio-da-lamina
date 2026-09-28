import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';
import { SKY_GLSL } from '../render/atmosphere.js';
import { scene } from '../render/renderer.js';
import { SH } from './world.js';

// ---------- Grama instanciada com LOD contínuo ----------
// Em vez de "encolher" a grama na borda (o que criava um anel de grama feia), as hastes
// somem aleatoriamente e as que restam ficam mais largas; a camada distante entra
// exatamente onde a próxima rareia. A neblina é calculada por vértice (bem mais barato).
export const GRASS_VS = /* glsl */`
  uniform float uTime, uSize, uRadius, uBladeH, uBladeW, uWorldSize, uNearCam, uFadeStart, uWiden, uIsMid, uNearR, uFarWiden;
  uniform vec3 uCenter, uNearCenter;
  uniform sampler2D uHM;
  uniform vec2 uWindDir, uShadowDir;
  uniform float uShadowLen;
  uniform vec3 uSunCol, uAmb, uSunDirU;
  uniform vec4 uPush[4];
  uniform vec4 uCast[4];
  uniform vec4 uFocus[2];
  attribute vec4 aOffset;
  varying vec3 vCol; varying vec4 vFog;
  ${SKY_GLSL.split('vec3 fogToOutput')[0]}
  void main() {
    vec2 p = aOffset.xy * uSize;
    vec2 wp = uCenter.xz + mod(p - uCenter.xz + 0.5 * uSize, uSize) - 0.5 * uSize;
    float r1 = aOffset.z, r2 = aOffset.w;
    float rk = fract(r1 * 7.13 + r2 * 3.71);
    vec4 hm = texture2D(uHM, wp / uWorldSize + 0.5);

    float d = distance(wp, uCenter.xz);
    float outT = smoothstep(uRadius * uFadeStart, uRadius, d);
    float keep = step(outT, rk * 0.999);
    float widen = 1.0 + outT * uWiden;
    if (uIsMid > 0.5) {
      float inT = smoothstep(uNearR * 0.45, uNearR * 0.95, distance(wp, uNearCenter.xz));
      keep *= step(fract(r2 * 11.3 + r1 * 2.9), inT);
    }
    float camD = distance(wp, cameraPosition.xz);
    keep *= smoothstep(0.25, 0.9, camD);
    float onPath = smoothstep(0.25, 0.7, hm.g);
    float pathTuft = step(0.86, fract(r1 * 91.7)) * 0.22;
    float h0 = uBladeH * mix(0.62, 1.3, r1 * r1) * clamp(hm.b, 0.0, 1.3) * mix(1.0, pathTuft, onPath) * keep;

    // a grama nunca tapa a visão: no cone entre a câmera e cada personagem em foco, a haste
    // baixa até ficar abaixo da linha de visão e se abre para o lado (continua existindo)
    float thin = 0.0; vec2 part = vec2(0.0);
    for (int i = 0; i < 2; i++) {
      vec4 fc = uFocus[i];
      if (fc.w <= 0.0) continue;
      vec2 a = cameraPosition.xz, ab = fc.xz - a;
      float L2 = dot(ab, ab) + 1e-4, sr = dot(wp - a, ab) / L2, s = clamp(sr, 0.0, 1.0);
      vec2 cl = a + ab * s, lv = wp - cl;
      float lat = length(lv), rad = mix(0.45, 0.95, s);
      float cone = (1.0 - smoothstep(rad * 0.55, rad, lat)) * smoothstep(-0.05, 0.02, sr) * (1.0 - smoothstep(0.9, 1.02, sr)) * fc.w;
      float lineY = mix(cameraPosition.y, fc.y, s) - hm.r;
      float allowed = max(lineY - 0.32, 0.06);
      h0 = mix(h0, min(h0, allowed), cone);
      thin = max(thin, cone);
      part += lv / (lat + 1e-3) * cone * 0.35;
    }

    float h = position.y;
    float isPlume = step(0.7, fract(r2 * 17.0));
    float wTaper = 1.0 - h * 0.9;
    float wPlume = h < 0.58 ? 0.4 : 0.4 + sin((h - 0.58) / 0.42 * 3.14159) * 1.75;
    float width = uBladeW * mix(wTaper, wPlume, isPlume) * (1.0 - smoothstep(0.9, 1.0, h) * 0.92) * widen;
    width *= mix(uNearCam, 1.0, smoothstep(4.0, 18.0, camD)) * mix(1.0, uFarWiden, smoothstep(22.0, 100.0, camD)) * (1.0 - 0.45 * thin);

    vec2 toCam = normalize(cameraPosition.xz - wp + 1e-4);
    vec2 camSide = vec2(-toCam.y, toCam.x);
    float ang = r2 * 6.28318;
    vec2 rnd = vec2(cos(ang), sin(ang));
    vec2 side = normalize(mix(rnd, camSide * sign(dot(rnd, camSide) + 1e-4), 0.6));

    vec2 wperp = vec2(-uWindDir.y, uWindDir.x);
    float wave = sin(dot(wp, uWindDir) * 0.11 - uTime * 1.6 + sin(dot(wp, wperp) * 0.05) * 1.6) * 0.5 + 0.5;
    float flutter = sin(uTime * 2.8 + r1 * 31.0 + wp.x * 0.9 + wp.y * 0.6) * 0.5 + 0.5;
    vec2 bend = uWindDir * (0.08 + 0.24 * wave + 0.07 * flutter) + rnd * (r1 - 0.5) * 0.16 + part;

    float shade = 1.0;
    for (int i = 0; i < 4; i++) {
      vec4 pu = uPush[i];
      if (pu.w > 0.0) {
        vec2 dv = wp - pu.xy; float l = length(dv);
        bend += dv / (l + 1e-3) * (1.0 - smoothstep(0.12, pu.z, l)) * pu.w;
      }
      vec4 c = uCast[i];
      if (c.w > 0.0) {
        vec2 rel = wp - c.xy;
        float along = dot(rel, uShadowDir);
        float lat = abs(dot(rel, vec2(-uShadowDir.y, uShadowDir.x)));
        float L = c.z * uShadowLen;
        float sw = mix(0.2, 0.46, clamp(along / L, 0.0, 1.0));
        float s = smoothstep(-0.4, 0.3, along) * (1.0 - smoothstep(L * 0.78, L, along)) * (1.0 - smoothstep(sw * 0.55, sw, lat));
        shade = min(shade, 1.0 - 0.6 * s * c.w);
      }
    }
    float bl = length(bend); if (bl > 1.15) bend *= 1.15 / bl;
    float hh = h * h;
    vec3 local;
    local.xz = side * position.x * width + bend * hh * h0;
    local.y = h * h0 * (1.0 - 0.3 * min(dot(bend, bend), 1.0) * hh);
    vec3 world = vec3(wp.x, hm.r, wp.y) + local;

    vec3 base = vec3(0.11, 0.075, 0.035);
    float cv = fract(r1 * 23.1);
    vec3 tip = cv < 0.5 ? mix(vec3(0.84, 0.55, 0.23), vec3(0.72, 0.57, 0.3), cv * 2.0)
                        : mix(vec3(0.84, 0.55, 0.23), vec3(0.52, 0.35, 0.16), (cv - 0.5) * 2.0);
    vec3 col = mix(base, tip, smoothstep(0.0, 0.78, h));
    col = mix(col, vec3(0.9, 0.78, 0.56), isPlume * smoothstep(0.58, 0.92, h));
    col *= (0.78 + 0.4 * wave) * mix(0.84, 1.1, hm.a);

    // luz por vértice: ambiente + sol + contraluz nas pontas
    float back = pow(max(dot(normalize(world - cameraPosition), uSunDirU), 0.0), 3.0);
    float sgn = dot(side, uSunDirU.xz) >= 0.0 ? 1.0 : -1.0;
    float across = 0.8 + 0.36 * (position.x * sgn + 0.5);
    vec3 lit = (col * (uAmb + uSunCol * 0.5 * shade) + col * uSunCol * back * h * 1.35 * shade) * across;
    lit *= mix(0.32, 1.0, smoothstep(0.0, 0.42, h));
    vCol = lit;
    vFog = fogCalc(world);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }`;
export const GRASS_FS = /* glsl */`
  varying vec3 vCol; varying vec4 vFog;
  void main() {
    gl_FragColor = vec4(vCol, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 fc = vFog.rgb;
    #ifdef TONE_MAPPING
      fc = toneMapping(fc);
    #endif
    fc = linearToOutputTexel(vec4(fc, 1.0)).rgb;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, vFog.a);
  }`;

export function makeGrass({ max, segs, bladeH, bladeW, nearCam, fadeStart, widen, isMid, farWiden, seed }) {
  const g = new THREE.InstancedBufferGeometry();
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) { const y = i / segs; pos.push(-0.5, y, 0, 0.5, y, 0); }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const r = mulberry32(seed), off = new Float32Array(max * 4);
  for (let i = 0; i < max * 4; i++) off[i] = r();
  const nClumps = Math.floor(max / 14);
  const cx = new Float32Array(nClumps), cz = new Float32Array(nClumps);
  for (let c = 0; c < nClumps; c++) { cx[c] = r(); cz[c] = r(); }
  for (let i = 0; i < max; i++) {
    if (r() > 0.62) continue;
    const c = Math.floor(r() * nClumps), a = r() * Math.PI * 2, d = Math.sqrt(-2 * Math.log(r() + 1e-6)) * 0.006;
    off[i * 4] = (cx[c] + Math.cos(a) * d + 1) % 1; off[i * 4 + 1] = (cz[c] + Math.sin(a) * d + 1) % 1;
  }
  g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 4));
  g.instanceCount = max;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: SH.uTime, uHM: SH.uHM, uWorldSize: SH.uWorldSize, uWindDir: SH.uWindDir,
      uPush: SH.uPush, uCast: SH.uCast, uFocus: SH.uFocus, uShadowDir: SH.uShadowDir, uShadowLen: SH.uShadowLen,
      uSunCol: SH.uSunCol, uAmb: SH.uAmb, uSunDirU: SH.uSunDirU,
      uCenter: { value: new THREE.Vector3() }, uNearCenter: { value: new THREE.Vector3() }, uNearR: { value: 20 },
      uSize: { value: 50 }, uRadius: { value: 25 }, uFadeStart: { value: fadeStart }, uWiden: { value: widen },
      uIsMid: { value: isMid ? 1 : 0 }, uFarWiden: { value: farWiden },
      uBladeH: { value: bladeH }, uBladeW: { value: bladeW }, uNearCam: { value: nearCam },
    },
    vertexShader: GRASS_VS, fragmentShader: GRASS_FS, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
export const GRASS_MAX_NEAR = 90000, GRASS_MAX_MID = 42000;
export const grassNear = makeGrass({ max: GRASS_MAX_NEAR, segs: 6, bladeH: 1.12, bladeW: 0.042, nearCam: 0.65, fadeStart: 0.5, widen: 1.3, isMid: false, farWiden: 1, seed: 11 });
export const grassMid  = makeGrass({ max: GRASS_MAX_MID,  segs: 4, bladeH: 1.15, bladeW: 0.085, nearCam: 0.5, fadeStart: 0.6, widen: 1.5, isMid: true, farWiden: 2.1, seed: 23 });
