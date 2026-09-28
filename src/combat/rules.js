import { CFG } from '../core/config.js';

/* ================================================================
   REGRAS — dificuldade, maestria (melhorias entre encontros) e janelas.
   A dificuldade sobe encurtando a janela de aparar e o intervalo entre ataques,
   nunca dando vida extra aos inimigos.
   ================================================================ */
export const DIFFS = {
  facil:   { label: 'Fácil',   pw: 1.3,  interval: 1.3,  bind: 0.8, text: 'Janela de aparar mais larga, inimigos mais pacientes.' },
  normal:  { label: 'Normal',  pw: 1.0,  interval: 1.0,  bind: 1.0, text: 'Como o duelo foi pensado.' },
  dificil: { label: 'Difícil', pw: 0.78, interval: 0.78, bind: 1.2, text: 'Janela curta, ataques em sequência. Cada erro custa caro.' },
};
export const Rules = {
  diff: 'normal',
  get D() { return DIFFS[this.diff] || DIFFS.normal; },
  ABS_PARRY: 0.05,      // "aparo absoluto" contra estocadas (s antes do contato)
  PDODGE: 0.26,         // esquiva perfeita: contato até este tempo depois de começar
  FOCUS_MAX: 3,
  FOCUS_GAIN: 0.55,     // fração da estabilidade recuperada por ponto de foco
  BREATHE: 0.75,        // duração da respiração (exposto)
};

// melhorias pequenas; o jogador escolhe 1 de 2 ao vencer cada encontro
export const UPGRADES = [
  { id: 'parry',   name: 'Olho atento',  text: 'Janela de aparar +15 ms',                       max: 4 },
  { id: 'regen',   name: 'Fôlego',       text: 'Estabilidade volta 30% mais rápido',             max: 2 },
  { id: 'focus',   name: 'Mente calma',  text: 'Começa cada luta com 1 foco e guarda até 4',      max: 1 },
  { id: 'counter', name: 'Resposta',     text: 'Contra-golpe tira +12 de estabilidade',          max: 2 },
  { id: 'guard',   name: 'Guarda firme', text: 'Defender gasta 20% menos estabilidade',          max: 2 },
  { id: 'pdodge',  name: 'Passo leve',   text: 'Esquiva perfeita mais fácil (+40 ms)',           max: 2 },
];
export const Mastery = {
  taken: {}, history: [],
  lv(id) { return this.taken[id] || 0; },
  take(id) { this.taken[id] = this.lv(id) + 1; this.history.push(id); },
  reset() { this.taken = {}; this.history = []; },
  // duas opções diferentes que ainda não chegaram ao máximo (gerador próprio: não mexe na IA)
  offer(seed) {
    let s = seed | 0;
    const r = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pool = UPGRADES.filter((u) => this.lv(u.id) < u.max);
    const out = [];
    while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  },
  get focusMax() { return Rules.FOCUS_MAX + this.lv('focus'); },
};

// janela de aparar contra um golpe: do tipo de inimigo, ajustada pelo golpe, pela dificuldade,
// pelo painel de ajustes (padrão 160 ms = 1×) e pelas melhorias
export function parryWindow(move, attacker) {
  const base = CFG.combat.parryWindow;
  let w = attacker && attacker.type && attacker.type.pw ? attacker.type.pw : base;
  if (move && move.pwK) w *= move.pwK;
  return w * (base / 0.16) * Rules.D.pw + 0.015 * Mastery.lv('parry');
}
export const absParryWindow = () => Rules.ABS_PARRY * Math.sqrt(Rules.D.pw);
export const pdodgeWindow = () => Rules.PDODGE + 0.04 * Mastery.lv('pdodge');
