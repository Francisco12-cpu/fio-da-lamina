import { damp } from './util.js';

/* ================================================================
   TEMPO — hitstop (congelamento) e câmera lenta
   ================================================================ */
export const Time = {
  scale: 1, hold: 0, slowT: 0, slowScale: 1,
  freeze(s) { this.hold = Math.max(this.hold, s); },
  slow(scale, dur) { this.slowScale = Math.min(this.slowScale, scale); this.slowT = Math.max(this.slowT, dur); },
  step(realDt) {
    if (this.hold > 0) { this.hold -= realDt; return 0; }
    if (this.slowT > 0) { this.slowT -= realDt; this.scale = this.slowScale; if (this.slowT <= 0) this.slowScale = 1; }
    else this.scale = damp(this.scale, 1, 9, realDt);
    return realDt * this.scale;
  },
};
// relógio real e tempo de simulação (antes eram globais do arquivo único)
export const clock = { elapsed: 0, last: performance.now() };
export let simT = 0;
export function advanceSim(dt) { simT += dt; }
export function resetSim(v = 0) { simT = v; }
// registro das instâncias do topo (jogador, boneco, câmera, encontros): evita ciclos de import
export const G = {};
