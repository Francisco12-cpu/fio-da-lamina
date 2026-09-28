import * as THREE from 'three';
import { _v } from '../combat/moves.js';
import { ATMO, SUN, SUN_AZ } from '../core/config.js';
import { clamp, damp, lerp, smooth } from '../core/util.js';
import { bloom, camera, finalPass, raysHi, raysLo, renderer } from '../render/renderer.js';
import { SH, hemi, skyMat, sunLight } from './world.js';

/* ================================================================
   HORA DO DIA — a tarde vira pôr do sol conforme você avança na trilha
   ================================================================ */
export const TOD_KEYS = [
  { k: 0,    elev: 14,  zen: [0.25, 0.37, 0.54], hor: [0.76, 0.66, 0.5],  haze: [1.32, 0.96, 0.58], sun: [1.0, 0.86, 0.7],  sunI: 2.7, gsun: [1.2, 1.03, 0.74],  amb: [0.42, 0.37, 0.31], hemiI: 1.05, fog: 0.0024, exp: 0.97, size: 1.0,  rim: [1.0, 0.85, 0.65] },
  { k: 0.55, elev: 8,   zen: [0.22, 0.31, 0.48], hor: [0.86, 0.63, 0.41], haze: [1.45, 0.9, 0.45],  sun: [1.0, 0.74, 0.5],  sunI: 2.5, gsun: [1.35, 0.92, 0.56], amb: [0.4, 0.33, 0.26],  hemiI: 0.95, fog: 0.0026, exp: 0.96, size: 1.25, rim: [1.2, 0.8, 0.5] },
  { k: 1,    elev: 3.2, zen: [0.15, 0.19, 0.33], hor: [0.96, 0.5, 0.26],  haze: [1.75, 0.72, 0.28],  sun: [1.0, 0.56, 0.3],  sunI: 2.1, gsun: [1.55, 0.72, 0.37], amb: [0.33, 0.25, 0.22], hemiI: 0.8,  fog: 0.003,  exp: 0.95, size: 1.7,  rim: [1.5, 0.7, 0.35] },
];
export const TOD = {
  k: -1, auto: true, override: 0, fogMul: 1, expMul: 1, glowMul: 1, raysMul: 1, cur: {},
  progress(p) { return clamp((150 - p.z) / 250, 0, 1); },
  apply(k) {
    let a = TOD_KEYS[0], b = TOD_KEYS[TOD_KEYS.length - 1];
    for (let i = 0; i < TOD_KEYS.length - 1; i++) if (k >= TOD_KEYS[i].k && k <= TOD_KEYS[i + 1].k) { a = TOD_KEYS[i]; b = TOD_KEYS[i + 1]; }
    const t = b.k > a.k ? smooth(0, 1, (k - a.k) / (b.k - a.k)) : 0, c = this.cur;
    for (const key in a) c[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], t)) : lerp(a[key], b[key], t);
    const e = (c.elev * Math.PI) / 180;
    SUN.set(Math.sin(SUN_AZ) * Math.cos(e), Math.sin(e), -Math.cos(SUN_AZ) * Math.cos(e));
    ATMO.uSkyZen.value.setRGB(...c.zen); ATMO.uSkyHor.value.setRGB(...c.hor); ATMO.uSkyHaze.value.setRGB(...c.haze);
    ATMO.uFogDen.value = c.fog * this.fogMul; ATMO.uLow.value = smooth(0.35, 1, k); ATMO.uRimCol.value.setRGB(...c.rim);
    sunLight.color.setRGB(...c.sun); sunLight.intensity = c.sunI; hemi.intensity = c.hemiI;
    SH.uSunCol.value.setRGB(...c.gsun); SH.uAmb.value.setRGB(...c.amb);
    skyMat.uniforms.uSunSize.value = c.size;
    const hl = Math.hypot(SUN.x, SUN.z);
    SH.uShadowDir.value.set(-SUN.x / hl, -SUN.z / hl); SH.uShadowLen.value = Math.min(hl / SUN.y, 7);
  },
  update(dt, player) {
    const target = this.auto ? Math.max(this.k < 0 ? 0 : this.k, this.progress(player.pos)) : this.override;
    const k = this.k < 0 ? target : damp(this.k, target, 1.5, dt);
    if (Math.abs(k - this.k) > 1e-4 || this.dirty) { this.k = k; this.dirty = false; this.apply(k); }
  },
};
// ofuscamento: olhar para o sol estoura a imagem (raios, halo, véu) e o olho se adapta aos poucos
export const veilEl = document.getElementById('veil');
// granulação fina de filme (textura gerada uma vez, só desloca por quadro)
export const grainEl = document.getElementById('grain');
{
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const x = c.getContext('2d'), img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0); grainEl.style.backgroundImage = `url(${c.toDataURL()})`;
}
export const Glare = {
  k: 0, adapt: 0, dir: new THREE.Vector3(),
  update(dt) {
    camera.getWorldDirection(this.dir);
    const dot = this.dir.dot(SUN);
    const above = smooth(-0.01, 0.03, SUN.y);
    this.k = damp(this.k, smooth(0.72, 0.985, dot) * above, 6, dt);
    this.adapt = damp(this.adapt, this.k, 0.7, dt);
    camera.updateMatrixWorld();
    _v.copy(camera.position).addScaledVector(SUN, 1000).project(camera);
    const front = dot > 0 && _v.z < 1;
    const edge = front ? 1 - smooth(0.7, 1.35, Math.max(Math.abs(_v.x), Math.abs(_v.y))) : 0;
    const amt = TOD.raysMul * smooth(0.1, 0.55, dot) * edge * above * (0.9 + 0.8 * ATMO.uLow.value);
    for (const r of [raysHi, raysLo]) {
      const u = r.material.uniforms;
      u.uSunUv.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5); u.uAmt.value = amt; u.uAspect.value = innerWidth / innerHeight;
      u.uTint.value.setRGB(...TOD.cur.sun);
    }
    const low = ATMO.uLow.value;
    bloom.strength = 0.3 + this.k * (0.12 + 0.25 * low) * TOD.glowMul;
    const ex = TOD.cur.exp * TOD.expMul * (1 - (0.08 + 0.14 * low) * this.adapt);
    renderer.toneMappingExposure = ex; finalPass.material.uniforms.toneMappingExposure.value = ex;
    veilEl.style.opacity = (front ? (0.02 + 0.24 * this.k) * edge * above * TOD.glowMul * (0.25 + 0.75 * low) : 0).toFixed(3);
    if (front) { veilEl.style.left = ((_v.x * 0.5 + 0.5) * innerWidth).toFixed(0) + 'px'; veilEl.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(0) + 'px'; }
  },
};
