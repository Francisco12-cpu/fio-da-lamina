import * as THREE from 'three';
import { CFG } from '../core/config.js';
import { rand } from '../core/util.js';
import { scene } from '../render/renderer.js';
import { SH } from '../world/world.js';

/* ================================================================
   EFEITOS — faíscas, lascas, rastro da lâmina
   ================================================================ */
export class Particles {
  constructor(max, { additive, color, size, gravity, drag }) {
    this.max = max; this.g = gravity; this.drag = drag; this.next = 0; this.wind = arguments[1].wind || 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.ml = new Float32Array(max).fill(1); this.l = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.la = new THREE.BufferAttribute(this.l, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa); geo.setAttribute('aL', this.la);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uCol: { value: new THREE.Color(...color) }, uSize: { value: size }, uPx: { value: 1 } },
      vertexShader: `attribute float aL; uniform float uSize, uPx; varying float vL;
        void main() { vL = aL; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aL > 0.0 ? uSize * uPx * 420.0 * (0.45 + 0.55 * aL) / max(-mv.z, 0.2) : 0.0; }`,
      fragmentShader: `uniform vec3 uCol; varying float vL;
        void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d) * vL;
          gl_FragColor = vec4(uCol * a, a); }`,
    });
    this.mesh = new THREE.Points(geo, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
    scene.add(this.mesh);
  }
  emit(pos, dir, count, speed, spread, life) {
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      let vx = dir.x + (rand() - 0.5) * 2 * spread, vy = dir.y + (rand() - 0.5) * 2 * spread, vz = dir.z + (rand() - 0.5) * 2 * spread;
      const l = Math.hypot(vx, vy, vz) || 1, sp = speed * (0.35 + rand() * 0.9);
      this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
      this.v[i * 3] = (vx / l) * sp; this.v[i * 3 + 1] = (vy / l) * sp; this.v[i * 3 + 2] = (vz / l) * sp;
      this.life[i] = this.ml[i] = life * (0.55 + rand() * 0.7);
    }
  }
  update(dt) {
    const fr = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.l[i] = 0; continue; }
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= this.g * dt;
      if (this.wind) { const fl = Math.sin(SH.uTime.value * 2.3 + i) * 0.8; this.v[i * 3] += CFG.wind.x * this.wind * (1 + fl) * dt; this.v[i * 3 + 2] += CFG.wind.y * this.wind * (1 + fl) * dt; this.v[i * 3 + 1] += Math.cos(SH.uTime.value * 3.1 + i * 1.7) * 0.6 * dt; }
      for (let c = 0; c < 3; c++) { this.v[i * 3 + c] *= fr; this.p[i * 3 + c] += this.v[i * 3 + c] * dt; }
      this.l[i] = Math.max(0, this.life[i] / this.ml[i]);
    }
    this.pa.needsUpdate = true; this.la.needsUpdate = true;
  }
}
export const sparks = new Particles(128, { additive: true, color: [5.0, 2.6, 0.9], size: 0.03, gravity: 9, drag: 2.5 });
export const splinters = new Particles(96, { additive: false, color: [0.5, 0.36, 0.18], size: 0.05, gravity: 11, drag: 1.5 });

export class Trail {
  constructor(n = 20) {
    this.n = n; this.b = []; this.t = []; this.alpha = 0;
    this.pos = new Float32Array(n * 2 * 3); this.a = new Float32Array(n * 2);
    const g = new THREE.BufferGeometry(), idx = [];
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aa = new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pa); g.setAttribute('aA', this.aa);
    for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * vA * 1.4, vA); }`,
    });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 15;
    scene.add(this.mesh);
  }
  push(b, t) { this.b.unshift(b.clone()); this.t.unshift(t.clone()); if (this.b.length > this.n) { this.b.pop(); this.t.pop(); } this.alpha = 1; }
  update(dt) {
    this.alpha = Math.max(0, this.alpha - dt * 5.5);
    if (this.alpha === 0) { this.b.length = 0; this.t.length = 0; }
    const L = this.b.length;
    for (let i = 0; i < this.n; i++) {
      const j = Math.min(i, Math.max(L - 1, 0));
      if (L) { const B = this.b[j], T = this.t[j]; this.pos.set([B.x, B.y, B.z], i * 6); this.pos.set([T.x, T.y, T.z], i * 6 + 3); }
      const f = L ? Math.max(0, 1 - i / L) : 0;
      this.a[i * 2] = f * this.alpha * 0.06; this.a[i * 2 + 1] = f * f * this.alpha * 0.5;
    }
    this.pa.needsUpdate = true; this.aa.needsUpdate = true;
  }
}
// folhas vermelhas caindo da árvore do duelo
export const leafFx = new Particles(160, { additive: false, color: [0.55, 0.09, 0.05], size: 0.06, gravity: 0.55, drag: 1.6, wind: 1.3 });
export const bloodFx = new Particles(96, { additive: false, color: [0.32, 0.04, 0.03], size: 0.035, gravity: 9, drag: 2 });
export const dustFx = new Particles(64, { additive: false, color: [0.55, 0.47, 0.34], size: 0.07, gravity: -0.3, drag: 3 });
