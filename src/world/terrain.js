import * as THREE from 'three';
import { CFG, CLEARING, PATH_POINTS, SUN_AZ } from '../core/config.js';
import { angDiff, clamp, fbm, lerp, smooth, vnoise } from '../core/util.js';

/* ================================================================
   TERRENO — mapa de altura + máscara da trilha (CPU e GPU)
   ================================================================ */
export class Terrain {
  constructor() {
    const S = CFG.world.size, N = CFG.world.hmRes;
    this.S = S; this.N = N;
    this.h = new Float32Array(N * N);
    this.curve = new THREE.CatmullRomCurve3(PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const M = Math.ceil(this.curve.getLength());
    const raw = [];
    this.ps = [];
    for (let i = 0; i <= M; i++) {
      const p = this.curve.getPointAt(i / M);
      this.ps.push({ x: p.x, z: p.z, h: 0 });
      raw.push(Terrain.rawHeight(p.x, p.z));
    }
    for (let i = 0; i < this.ps.length; i++) {
      let s = 0, n = 0;
      for (let k = -14; k <= 14; k++) { s += raw[clamp(i + k, 0, raw.length - 1)]; n++; }
      this.ps[i].h = s / n;
    }
    CLEARING.h = this.ps[this.nearest(CLEARING.x, CLEARING.z).i].h;
    const data = new Uint16Array(N * N * 4), toH = THREE.DataUtils.toHalfFloat;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N * S - S / 2, z = (j + 0.5) / N * S - S / 2;
      const { d, i: pi } = this.nearest(x, z);
      let h = lerp(this.ps[pi].h, Terrain.rawHeight(x, z), smooth(1.6, 10, d));
      const cd = Math.hypot(x - CLEARING.x, z - CLEARING.z);
      h = lerp(CLEARING.h, h, smooth(CLEARING.r, CLEARING.r + 10, cd));
      let path = 1 - smooth(0.45, 1.25, d);
      path = Math.max(path, (1 - smooth(CLEARING.r - 5, CLEARING.r + 1, cd)) * 0.26);
      let dens = lerp(0.5, 1, smooth(1.0, 3.2, d)) * (0.8 + 0.4 * vnoise(x / 14, z / 14, 5));
      dens *= lerp(0.45, 1, smooth(CLEARING.r - 2, CLEARING.r + 3, cd));
      const k = j * N + i;
      this.h[k] = h;
      data[k * 4] = toH(h); data[k * 4 + 1] = toH(path); data[k * 4 + 2] = toH(dens); data[k * 4 + 3] = toH(vnoise(x / 38, z / 38, 9));
    }
    this.tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
  }
  static rawHeight(x, z) {
    let h = fbm(x / 160, z / 160, 4, 1) * 9 + fbm(x / 55, z / 55, 3, 7) * 2.2;
    const dip = Math.exp(-Math.pow(angDiff(SUN_AZ, Math.atan2(x, -z)) / 0.42, 2));
    return h + smooth(230, 390, Math.hypot(x, z * 0.82)) * 38 * (1 - 0.85 * dip);
  }
  nearest(x, z) {
    const ps = this.ps; let best = Infinity, bi = 0;
    for (let i = 0; i < ps.length; i += 8) { const dx = ps[i].x - x, dz = ps[i].z - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const a = Math.max(0, bi - 9), b = Math.min(ps.length - 1, bi + 9);
    for (let i = a; i <= b; i++) { const dx = ps[i].x - x, dz = ps[i].z - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    return { d: Math.sqrt(best), i: bi };
  }
  heightAt(x, z) {
    const N = this.N;
    let fx = clamp((x / this.S + 0.5) * N - 0.5, 0, N - 1.001), fz = clamp((z / this.S + 0.5) * N - 0.5, 0, N - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, H = this.h;
    return lerp(lerp(H[iz * N + ix], H[iz * N + ix + 1], tx), lerp(H[(iz + 1) * N + ix], H[(iz + 1) * N + ix + 1], tx), tz);
  }
}
