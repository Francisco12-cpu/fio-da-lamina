import { URLP } from '../core/config.js';
import { damp } from '../core/util.js';

/* ================================================================
   ÁUDIO — tudo sintetizado com Web Audio (sem arquivos)
   ================================================================ */
export const Sound = {
  ctx: null,
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    if (URLP.has('noaudio')) return; // testes automáticos
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC(), sr = ctx.sampleRate;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.out = ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(comp); comp.connect(ctx.destination);
    const nb = ctx.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    const irLen = Math.floor(sr * 2.2), ir = ctx.createBuffer(2, irLen, sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.4); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir;
    const rg = ctx.createGain(); rg.gain.value = 0.32; this.rev.connect(rg); rg.connect(this.out);
    this.wind();
  },
  now() { return this.ctx.currentTime; },
  bus(send = 0) {
    const g = this.ctx.createGain(); g.connect(this.out);
    if (send > 0) { const s = this.ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.rev); }
    return g;
  },
  env(node, t, a, peak, dec) {
    const g = this.ctx.createGain(); node.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    return g;
  },
  src(t, dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; },
  osc(type, f, t, dur) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; },
  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
  wind() {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const lp = this.filt('lowpass', 420, 0.6), g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.03;
    lfo.connect(lg); lg.connect(g.gain); s.connect(lp); lp.connect(g); g.connect(this.out);
    const s2 = ctx.createBufferSource(); s2.buffer = this.noise; s2.loop = true;
    const hp = this.filt('bandpass', 2600, 0.7), g2 = ctx.createGain(); g2.gain.value = 0.012;
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.11; lg2.gain.value = 0.009;
    lfo2.connect(lg2); lg2.connect(g2.gain); s2.connect(hp); hp.connect(g2); g2.connect(this.out);
    s.start(); s2.start(); lfo.start(); lfo2.start();
  },
  swoosh(p = 1) {
    if (!this.ctx) return; const t = this.now();
    const n = this.src(t, 0.25), bp = this.filt('bandpass', 500, 1.3);
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.07); bp.frequency.exponentialRampToValueAtTime(700, t + 0.22);
    n.connect(bp); this.env(bp, t, 0.035, 0.34 * p, 0.2).connect(this.bus(0.08));
  },
  clang(kind) {
    if (!this.ctx) return; const t = this.now();
    const parry = kind === 'parry', heavy = kind === 'heavy', pow = parry ? 1 : heavy ? 0.75 : 0.5, ring = parry ? 1.7 : heavy ? 0.8 : 0.5;
    const out = this.bus(parry ? 0.6 : 0.2);
    [523, 1247, 1987, 2890, 3960, 5210].forEach((f, i) => {
      if (!parry && i > (heavy ? 4 : 3)) return;
      const o = this.osc('sine', f * (0.985 + Math.random() * 0.03), t, ring * 1.6);
      this.env(o, t, 0.002, (pow * 0.17) / Math.sqrt(i + 1), ring * (1.25 - i * 0.14)).connect(out);
    });
    const n = this.src(t, 0.06), hp = this.filt('highpass', 1500); n.connect(hp);
    this.env(hp, t, 0.001, 0.5 * pow, 0.05).connect(out);
    if (parry) {
      const th = this.osc('sine', 120, t, 0.35); th.frequency.exponentialRampToValueAtTime(42, t + 0.28);
      this.env(th, t, 0.004, 0.6, 0.32).connect(out);
      const ti = this.osc('sine', 6300, t, 1.6); this.env(ti, t, 0.003, 0.045, 1.4).connect(out);
    }
  },
  thunk(p = 1) {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.15);
    const o = this.osc('triangle', 190, t, 0.2); o.frequency.exponentialRampToValueAtTime(70, t + 0.13);
    this.env(o, t, 0.003, 0.45 * p, 0.16).connect(out);
    const n = this.src(t, 0.1), bp = this.filt('bandpass', 850, 1.8); n.connect(bp);
    this.env(bp, t, 0.002, 0.4 * p, 0.08).connect(out);
    if (p > 1.1) { const l = this.osc('sine', 60, t, 0.3); this.env(l, t, 0.005, 0.5, 0.28).connect(out); }
  },
  hurt() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.1);
    const o = this.osc('sine', 95, t, 0.3); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    this.env(o, t, 0.004, 0.7, 0.26).connect(out);
    const n = this.src(t, 0.25), lp = this.filt('lowpass', 700); n.connect(lp);
    this.env(lp, t, 0.003, 0.45, 0.2).connect(out);
  },
  draw() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.3);
    const n = this.src(t, 0.4), bp = this.filt('bandpass', 3000, 3);
    bp.frequency.setValueAtTime(2500, t); bp.frequency.exponentialRampToValueAtTime(7500, t + 0.3); n.connect(bp);
    this.env(bp, t, 0.04, 0.14, 0.3).connect(out);
    const o = this.osc('sine', 4200, t + 0.25, 0.7); this.env(o, t + 0.25, 0.005, 0.03, 0.6).connect(out);
  },
  sheath() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.1);
    const n = this.src(t, 0.35), bp = this.filt('bandpass', 2200, 2);
    bp.frequency.setValueAtTime(2400, t); bp.frequency.exponentialRampToValueAtTime(1200, t + 0.28); n.connect(bp);
    this.env(bp, t, 0.05, 0.08, 0.25).connect(out);
    const c = this.src(t + 0.32, 0.05), hp = this.filt('bandpass', 1400, 2); c.connect(hp);
    this.env(hp, t + 0.32, 0.001, 0.25, 0.04).connect(out);
  },
  creak(dur) {
    if (!this.ctx) return; const t = this.now();
    const o = this.osc('sawtooth', 62, t, dur); o.frequency.linearRampToValueAtTime(92, t + dur * 0.5); o.frequency.linearRampToValueAtTime(58, t + dur);
    const bp = this.filt('bandpass', 520, 6); o.connect(bp);
    this.env(bp, t, dur * 0.3, 0.1, dur * 0.7).connect(this.bus(0.1));
  },
  glint(kind = 'red') {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.5);
    if (kind === 'blue') [3600, 5400].forEach((f) => { const o = this.osc('sine', f, t, 0.6); this.env(o, t, 0.01, 0.055, 0.45).connect(out); });
    else {
      [1400, 2210].forEach((f) => { const o = this.osc('sawtooth', f, t, 0.5); const lp = this.filt('lowpass', 3000); o.connect(lp); this.env(lp, t, 0.02, 0.03, 0.4).connect(out); });
      const d = this.osc('sine', 180, t, 0.5); this.env(d, t, 0.02, 0.12, 0.4).connect(out);
    }
  },
  breakGuard() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.4);
    [310, 690, 1130].forEach((f, i) => { const o = this.osc('triangle', f, t, 0.9); this.env(o, t, 0.003, 0.2 / (i + 1), 0.7).connect(out); });
    const th = this.osc('sine', 90, t, 0.5); th.frequency.exponentialRampToValueAtTime(35, t + 0.4); this.env(th, t, 0.005, 0.6, 0.45).connect(out);
  },
  feint() {
    if (!this.ctx) return; const t = this.now();
    const n = this.src(t, 0.08), hp = this.filt('highpass', 2500); n.connect(hp);
    this.env(hp, t, 0.003, 0.12, 0.05).connect(this.bus(0.1));
  },
  gongSoft() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.6);
    [147, 233, 350].forEach((f, i) => { const o = this.osc('sine', f, t, 3); this.env(o, t, 0.01, 0.12 / (i + 1), 2.4).connect(out); });
  },
  dodge() {
    if (!this.ctx) return; const t = this.now();
    const n = this.src(t, 0.3), lp = this.filt('lowpass', 900); n.connect(lp);
    this.env(lp, t, 0.04, 0.16, 0.22).connect(this.bus(0));
  },
  slash() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.2);
    const n = this.src(t, 0.12), hp = this.filt('highpass', 1800); n.connect(hp);
    this.env(hp, t, 0.002, 0.3, 0.1).connect(out);
    const o = this.osc('sine', 110, t, 0.3); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    this.env(o, t, 0.004, 0.55, 0.25).connect(out);
  },
  cloth() {
    if (!this.ctx) return; const t = this.now();
    const n = this.src(t, 0.2), bp = this.filt('bandpass', 1100, 0.9); n.connect(bp);
    this.env(bp, t, 0.03, 0.07, 0.15).connect(this.bus(0));
  },
  fall() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.1);
    const o = this.osc('sine', 70, t + 0.35, 0.3); this.env(o, t + 0.35, 0.005, 0.5, 0.25).connect(out);
    const n = this.src(t + 0.35, 0.3), lp = this.filt('lowpass', 500); n.connect(lp);
    this.env(lp, t + 0.35, 0.005, 0.35, 0.25).connect(out);
  },
  gong() {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.7);
    [98, 147, 233, 311, 467].forEach((f, i) => { const o = this.osc('sine', f, t, 5); this.env(o, t, 0.01, 0.2 / (i + 1), 4.5 - i * 0.6).connect(out); });
  },
  // ---------- música e ambiente ----------
  // corda dedilhada (Karplus-Strong): parecida com koto/shamisen, gerada uma vez por nota
  plucks: {},
  pluckBuf(f) {
    const key = f.toFixed(1); if (this.plucks[key]) return this.plucks[key];
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 2.4), N = Math.max(2, Math.round(sr / f));
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (let k = 0; k < 2; k++) for (let i = 0; i < N; i++) ring[i] = (ring[i] + ring[(i + 1) % N]) * 0.5;
    let idx = 0;
    for (let i = 0; i < len; i++) { const a = ring[idx], c = ring[(idx + 1) % N]; ring[idx] = (a + c) * 0.5 * 0.9968; d[i] = a; idx = (idx + 1) % N; }
    return (this.plucks[key] = b);
  },
  pluck(f, vol = 0.1, delay = 0) {
    if (!this.ctx) return; const t = this.now() + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.pluckBuf(f);
    const lp = this.filt('lowpass', 2600, 0.5), g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(lp); lp.connect(g); g.connect(this.bus(0.6)); src.start(t);
  },
  taiko(vol = 0.5, rim = false) {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0.25);
    if (rim) { const n = this.src(t, 0.06), bp = this.filt('bandpass', 1900, 3); n.connect(bp); this.env(bp, t, 0.001, vol * 0.4, 0.05).connect(out); return; }
    const o = this.osc('sine', 78, t, 0.5); o.frequency.exponentialRampToValueAtTime(44, t + 0.3);
    this.env(o, t, 0.004, vol, 0.42).connect(out);
    const n = this.src(t, 0.12), lp = this.filt('lowpass', 220); n.connect(lp); this.env(lp, t, 0.002, vol * 0.5, 0.1).connect(out);
  },
  heart(vol = 0.35) {
    if (!this.ctx) return; const t = this.now(), out = this.bus(0);
    [0, 0.16].forEach((dt, i) => { const o = this.osc('sine', 52, t + dt, 0.25); this.env(o, t + dt, 0.01, vol * (i ? 0.7 : 1), 0.18).connect(out); });
  },
  scale: [146.83, 196.0, 220.0, 233.08, 293.66, 311.13, 392.0, 440.0, 466.16, 587.33],
  mTimer: 2, beat: 0, beatT: 0, combatK: 0, heartT: 0,
  ambience() {
    const ctx = this.ctx;
    // cigarras: ruído agudo com tremolo rápido
    const s1 = ctx.createBufferSource(); s1.buffer = this.noise; s1.loop = true;
    const bp = this.filt('bandpass', 5400, 7); this.cicadaG = ctx.createGain(); this.cicadaG.gain.value = 0;
    const trem = ctx.createGain(); trem.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(trem.gain); s1.connect(bp); bp.connect(trem); trem.connect(this.cicadaG); this.cicadaG.connect(this.out);
    s1.start(); lfo.start();
    // grilos: tom agudo em pulsos
    const o = ctx.createOscillator(); o.frequency.value = 4700; this.cricketG = ctx.createGain(); this.cricketG.gain.value = 0;
    const pulse = ctx.createGain(); pulse.gain.value = 0; const l1 = ctx.createOscillator(); l1.type = 'square'; l1.frequency.value = 22; const l1g = ctx.createGain(); l1g.gain.value = 0.5;
    const l2 = ctx.createOscillator(); l2.type = 'square'; l2.frequency.value = 0.7; const l2g = ctx.createGain(); l2g.gain.value = 0.5;
    const gate = ctx.createGain(); gate.gain.value = 0.5;
    l1.connect(l1g); l1g.connect(pulse.gain); l2.connect(l2g); l2g.connect(gate.gain);
    o.connect(pulse); pulse.connect(gate); gate.connect(this.cricketG); this.cricketG.connect(this.out);
    o.start(); l1.start(); l2.start();
  },
  music(dt, mode, tod) {
    if (!this.ctx) return;
    if (!this.cicadaG) this.ambience();
    const T = this.now();
    this.cicadaG.gain.setTargetAtTime(0.02 * (1 - tod) * (mode === 'standoff' ? 0.3 : 1), T, 0.5);
    this.cricketG.gain.setTargetAtTime(0.006 * tod * (mode === 'standoff' ? 0.3 : 1), T, 0.5);
    this.combatK = damp(this.combatK, mode === 'combat' ? 1 : 0, mode === 'combat' ? 2 : 0.4, dt);
    if (mode === 'explore' && this.combatK < 0.2) {
      this.mTimer -= dt;
      if (this.mTimer <= 0) {
        this.mTimer = 3.5 + Math.random() * 4;
        const sc = this.scale, i = Math.floor(Math.random() * (sc.length - 3)) + 1;
        this.pluck(sc[i], 0.09);
        if (Math.random() < 0.35) this.pluck(sc[i + (Math.random() < 0.5 ? 1 : 2)], 0.07, 0.28);
        if (Math.random() < 0.12) { this.pluck(sc[i + 2], 0.06, 0.55); this.pluck(sc[i], 0.05, 0.9); }
      }
    }
    if (this.combatK > 0.05) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT += 60 / 88 / 2;
        const pat = [1, 0, 0, 0.55, 0, 0.8, 0.3, 0], v = pat[this.beat % 8];
        if (v > 0) this.taiko(0.42 * v * this.combatK, v < 0.5);
        this.beat++;
      }
    } else { this.beatT = 0; this.beat = 0; }
    if (mode === 'standoff') { this.heartT -= dt; if (this.heartT <= 0) { this.heartT = 1.05; this.heart(0.32); } }
  },
  step(onPath, run) {
    if (!this.ctx) return; const t = this.now();
    const n = this.src(t, 0.12), bp = this.filt('bandpass', onPath ? 750 : 2300, 0.8); n.connect(bp);
    this.env(bp, t, 0.006, run ? 0.1 : 0.055, 0.08).connect(this.bus(0));
  },
};
