import * as THREE from 'three';
import { CFG } from '../core/config.js';
import { clamp, lerp } from '../core/util.js';
import { rt, scene } from '../render/renderer.js';
import { withRim } from '../world/world.js';

/* ================================================================
   CAPA COM FÍSICA DE PANO — partículas (verlet) presas nos ombros,
   com gravidade, vento e colisão com tronco, pernas e chão.
   Congela junto com o hitstop (dt = 0), o que realça o impacto.
   ================================================================ */
export const _ca = new THREE.Vector3(), _cb = new THREE.Vector3();
// iterações do pano (4 em média/alta; 2 em baixa/mínima, definido pela qualidade)
export class Cloak {
  static iters = 4;
  static half = false;
  constructor(f, color) {
    this.f = f;
    const C = (this.C = 14), R = (this.R = 6), n = (this.n = C * (R + 1));
    this.rest = [];
    for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) {
      const a = (c / C) * Math.PI * 2, k = r / R, rad = lerp(0.235, 0.58, Math.pow(k, 0.85));
      this.rest.push(new THREE.Vector3(Math.sin(a) * rad, 0.62 - k * 1.0, Math.cos(a) * rad * 0.84 + 0.03));
    }
    this.cons = [];
    const add = (i, j, st) => this.cons.push([i, j, this.rest[i].distanceTo(this.rest[j]), st]);
    for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) {
      const i = r * C + c, rt = r * C + ((c + 1) % C);
      add(i, rt, 1);
      if (r < R) { add(i, i + C, 1); add(i, (r + 1) * C + ((c + 1) % C), 0.45); add(rt, i + C, 0.45); }
      if (r < R - 1) add(i, i + 2 * C, 0.25);
    }
    this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3);
    const idx = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const a = r * C + c, b = r * C + ((c + 1) % C), d = (r + 1) * C + c, e = (r + 1) * C + ((c + 1) % C);
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, withRim(new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }), 1.1));
    this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this.caps = new Float32Array(3 * 7);
    scene.add(this.mesh);
  }
  reset() {
    const m = this.f.torso.matrixWorld;
    for (let i = 0; i < this.n; i++) {
      _ca.copy(this.rest[i]).applyMatrix4(m);
      this.p[i * 3] = this.q[i * 3] = _ca.x; this.p[i * 3 + 1] = this.q[i * 3 + 1] = _ca.y; this.p[i * 3 + 2] = this.q[i * 3 + 2] = _ca.z;
    }
    this.flush();
  }
  capsules() {
    const f = this.f, c = this.caps;
    const put = (k, a, b, r) => { c.set([a.x, a.y, a.z, b.x, b.y, b.z, r], k * 7); };
    put(0, f.hips.localToWorld(_ca.set(0, 0.05, 0)), f.torso.localToWorld(_cb.set(0, 0.52, 0)), 0.22);
    f.legs.forEach((leg, i) => put(1 + i, leg.localToWorld(_ca.set(0, -0.05, 0)), leg.localToWorld(_cb.set(0, -0.86, -0.04)), 0.12));
  }
  update(dt, t) {
    if (dt <= 0) return;
    // celular: o pano é simulado a 30 Hz (a cada 2 quadros, com o passo somado)
    if (Cloak.half) { this.acc = (this.acc || 0) + dt; if ((this.tick = (this.tick || 0) + 1) % 2) return; dt = this.acc; this.acc = 0; }
    if (dt > 0.1) { this.reset(); return; }
    const steps = dt > 1 / 40 ? 2 : 1, h = dt / steps, h2 = h * h;
    const m = this.f.torso.matrixWorld, p = this.p, q = this.q, C = this.C, n = this.n;
    for (let c = 0; c < C; c++) {
      _ca.copy(this.rest[c]).applyMatrix4(m);
      p[c * 3] = q[c * 3] = _ca.x; p[c * 3 + 1] = q[c * 3 + 1] = _ca.y; p[c * 3 + 2] = q[c * 3 + 2] = _ca.z;
    }
    this.capsules();
    const wx = CFG.wind.x, wz = CFG.wind.y, gust = 0.8 + Math.sin(t * 1.3 + this.f.pos.x) * 0.45 + Math.sin(t * 3.1) * 0.2;
    const ground = this.f.pos.y + 0.03;
    for (let s = 0; s < steps; s++) {
      for (let i = C; i < n; i++) {
        const k = i * 3, fl = Math.sin(t * 7 + i * 1.7) * 0.35, w = (gust + fl) * (0.3 + (i / n) * 0.7);
        // pano pesado: amortecimento alto + mola suave puxando para o formato de repouso
        // (mais firme perto dos ombros), evita o vai-e-volta desengonçado
        _cb.copy(this.rest[i]).applyMatrix4(m);
        const row = Math.floor(i / C), shape = lerp(0.3, 0.07, row / this.R) * (h * 60);
        for (let d = 0; d < 3; d++) {
          const cur = p[k + d], v = (cur - q[k + d]) * 0.93;
          q[k + d] = cur;
          const tgt = d === 0 ? _cb.x : d === 1 ? _cb.y : _cb.z;
          p[k + d] = cur + v + (d === 0 ? wx * w : d === 1 ? -9.8 : wz * w) * h2 + (tgt - cur) * shape;
        }
      }
      for (let it = 0; it < Cloak.iters; it++) {
        for (const [i, j, L, st] of this.cons) {
          const wi = i < C ? 0 : 1, wj = j < C ? 0 : 1, ws = wi + wj;
          if (!ws) continue;
          const ki = i * 3, kj = j * 3;
          const dx = p[kj] - p[ki], dy = p[kj + 1] - p[ki + 1], dz = p[kj + 2] - p[ki + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < 1e-6) continue;
          const diff = ((d - L) / d) * st;
          const a = (diff * wi) / ws, b = (diff * wj) / ws;
          p[ki] += dx * a; p[ki + 1] += dy * a; p[ki + 2] += dz * a;
          p[kj] -= dx * b; p[kj + 1] -= dy * b; p[kj + 2] -= dz * b;
        }
        this.collide(ground);
      }
    }
    this.flush();
  }
  collide(ground) {
    const p = this.p, c = this.caps;
    for (let i = this.C; i < this.n; i++) {
      const k = i * 3;
      for (let j = 0; j < 3; j++) {
        const o = j * 7, ax = c[o], ay = c[o + 1], az = c[o + 2], bx = c[o + 3] - ax, by = c[o + 4] - ay, bz = c[o + 5] - az, r = c[o + 6];
        const px = p[k] - ax, py = p[k + 1] - ay, pz = p[k + 2] - az;
        const tt = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz + 1e-9), 0, 1);
        const ex = px - bx * tt, ey = py - by * tt, ez = pz - bz * tt, dd = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (dd < r && dd > 1e-6) { const s = (r - dd) / dd; p[k] += ex * s; p[k + 1] += ey * s; p[k + 2] += ez * s; }
      }
      if (p[k + 1] < ground) p[k + 1] = ground;
    }
  }
  flush() { this.attr.needsUpdate = true; this.mesh.geometry.computeVertexNormals(); }
}
