import { IS_TOUCH } from '../core/config.js';
import { clock } from '../core/time.js';
import { clamp } from '../core/util.js';

export const buzz = (p) => { try { if (IS_TOUCH && navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
// relatório: registra cada golpe que chega em você e quando você apertou a defesa
export const Report = {
  contacts: [], deaths: [], last: null,
  contact(src, sig, res, t, pressAgo) {
    const c = { src, sig: sig || '-', res, pressMs: pressAgo < 0.8 ? Math.round(pressAgo * 1000) : null, lateMs: null, t };
    this.contacts.push(c); this.last = c; if (this.contacts.length > 400) this.contacts.shift();
  },
  latePress(t) { const c = this.last; if (c && c.lateMs === null && c.res !== 'parry' && t - c.t < 0.35) c.lateMs = Math.round((t - c.t) * 1000); },
};
export const FIGHTERS = [];
export const Stats = { parries: 0, kills: 0, deaths: 0, decisive: 0, startT: -1 };

/* ================================================================
   HÁBITOS DO JOGADOR — o que a IA adaptativa observa (nunca adivinha)
   ================================================================ */
export const Habits = {
  early: 0, turtle: 0, dodge: 0, chain: 0, lastAtkT: -9,
  get spam() { return clamp((this.chain - 1) * 0.12, 0, 0.36); },
  update(dt, player, near) {
    const k = Math.exp(-dt / 10);
    this.early *= k; this.turtle *= k; this.dodge *= k;
    if (near && player.state === 'block') this.turtle = Math.min(1, this.turtle + dt * 0.22);
    if (clock.elapsed - this.lastAtkT > 0.9) this.chain = 0;
  },
  onAttack() { this.chain = clock.elapsed - this.lastAtkT < 0.9 ? this.chain + 1 : 1; this.lastAtkT = clock.elapsed; },
  onEarlyBlock() { this.early = Math.min(1, this.early + 0.35); },
  onDodge() { this.dodge = Math.min(1, this.dodge + 0.25); },
};
