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
// agendador no tempo real do loop (antes era setTimeout): mesmo efeito no jogo, e nos testes
// determinísticos o momento depende só dos quadros simulados, não da velocidade da máquina
export const Later = {
  q: [],
  after(sec, fn) { this.q.push({ t: clock.elapsed + sec, fn }); },
  run() {
    if (!this.q.length) return;
    const now = clock.elapsed, due = this.q.filter((x) => x.t <= now);
    if (!due.length) return;
    this.q = this.q.filter((x) => x.t > now);
    for (const x of due) x.fn();
  },
  clear() { this.q.length = 0; },
};
