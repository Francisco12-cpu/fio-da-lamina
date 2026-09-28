import * as THREE from 'three';
import { clamp, easeIn, easeInOut, easeOut, lerp } from '../core/util.js';

/* ================================================================
   POSES DA ESPADA — dados, não animação (o Mixamo vai só trocar o visual)
   espaço do personagem: frente = -Z, direita = +X
   ================================================================ */
export const P = (hx, hy, hz, yaw, pitch, roll = 0) => ({ hx, hy, hz, yaw, pitch, roll });
export const POSE = {
  guard: P(0.12, 1.08, -0.32, -0.12, 0.55, 0),
  block: P(0.12, 1.34, -0.36, 1.3, 0.3, 1.2),
  parry: P(0.26, 1.46, -0.48, 0.5, 0.95, 1.0),
  draw:  P(-0.24, 0.98, -0.12, -0.2, -0.9, 0),
  hurt:  P(0.2, 1.0, -0.2, -0.5, -0.2, 0),
  stun:  P(0.35, 1.5, 0.05, -1.2, 1.3, 0.4),
  broken: P(0.3, 0.8, -0.1, -0.9, -0.9, 0.3),
  bind: P(0.1, 1.32, -0.5, 0.45, 1.0, 0.9),
  breathe: P(0.22, 0.92, -0.28, -0.35, 0.05, 0),
};
export const K_H = [P(0.42, 1.28, -0.02, -2.1, 0.25, -1.3), P(0.04, 1.2, -0.6, 0.0, 0.06, -1.3), P(-0.4, 1.14, -0.2, 2.0, -0.05, -1.3)];
export const K_D = [P(-0.3, 1.56, -0.04, 1.6, 0.9, 0.9), P(0.0, 1.25, -0.58, 0.1, 0.0, 0.9), P(0.36, 0.92, -0.3, -1.7, -0.7, 0.9)];
export const K_V = [P(0.05, 1.72, 0.02, 0.0, 2.1, 0), P(0.05, 1.42, -0.62, 0.0, 0.35, 0), P(0.05, 0.88, -0.62, 0.0, -0.75, 0)];
export const K_BIG = [P(0.08, 1.9, 0.12, 0.0, 2.45, 0), P(0.05, 1.45, -0.66, 0.0, 0.3, 0), P(0.05, 0.82, -0.66, 0.0, -0.85, 0)];
export const K_THRUST = [P(0.32, 1.2, 0.28, -0.15, -0.05, 1.57), P(0.1, 1.2, -0.7, -0.05, -0.02, 1.57), P(0.08, 1.2, -0.88, 0.0, -0.02, 1.57)];
export const K_GRAB = [P(0.36, 0.95, 0.3, -2.4, -0.7, 0), P(0.3, 1.0, 0.1, -2.2, -0.6, 0), P(0.3, 1.0, 0.1, -2.2, -0.6, 0)];

// jogador: 3 leves encadeáveis, forte (segurar), corte apressado (atacar correndo)
export const PLAYER_MOVES = [
  { w: 0.13, a: 0.09, r: 0.3,  lunge: 0.55, guard: 14, light: true, keys: K_H },
  { w: 0.11, a: 0.09, r: 0.32, lunge: 0.5,  guard: 14, light: true, keys: K_D },
  { w: 0.14, a: 0.1,  r: 0.4,  lunge: 0.7,  guard: 18, light: true, keys: K_V },
  { w: 0.36, a: 0.12, r: 0.5,  lunge: 0.95, guard: 42, strong: true, keys: K_BIG },
  { w: 0.32, a: 0.1,  r: 0.6,  lunge: 1.4,  guard: 16, rushed: true, keys: K_H },
  { w: 0.07, a: 0.09, r: 0.32, lunge: 0.9,  guard: 30, counter: true, keys: K_D },
];
export const STRONG = 3, RUSH = 4, COUNTER = 5;

// lança: a mão segura o meio da haste; a "lâmina" (trecho que acerta) fica bem à frente
export const K_SPEAR = [P(0.2, 1.1, 0.3, -0.05, 0.0, 1.57), P(0.12, 1.12, -0.35, -0.02, 0.0, 1.57), P(0.1, 1.12, -0.62, 0.0, 0.0, 1.57)];
export const K_JAB = [P(0.2, 1.2, 0.1, -0.1, 0.05, 1.57), P(0.12, 1.2, -0.4, -0.03, 0.02, 1.57), P(0.12, 1.2, -0.45, 0.0, 0.02, 1.57)];
export const K_SWEEP = [P(0.45, 0.95, 0.05, -1.9, -0.28, -1.4), P(0.05, 0.7, -0.45, 0.0, -0.3, -1.4), P(-0.4, 0.7, -0.2, 1.8, -0.3, -1.4)];
// escudo: o empurrão é do corpo; a espada fica recolhida ao lado
export const K_BASH = [P(0.3, 1.0, 0.15, -0.6, 0.2, 0), P(0.3, 1.0, 0.0, -0.6, 0.2, 0), P(0.3, 1.0, 0.0, -0.6, 0.2, 0)];

// armas: trecho da arma (distância da mão, ao longo de -Z) que conta como lâmina no acerto
export const WEAPONS = {
  katana: { base: 0.16, tip: 0.98 },
  spear: { base: 1.25, tip: 2.02 },
  short: { base: 0.14, tip: 0.8 },
};

// biblioteca de golpes dos inimigos (cada tipo usa um subconjunto)
//   sem sinal: pode defender ou aparar | azul: só aparar ou esquivar | vermelho: só esquivar
//   thrust: estocada (vermelha) — só esquiva, ou o "aparo absoluto" no último instante
//   sweep: varredura baixa (vermelha) — só esquiva, nada de aparo
//   pw: janela de aparar deste golpe (senão vale a do tipo de inimigo)
export const ENEMY_LIB = {
  A: { w: 0.42, a: 0.1,  r: 0.55, lunge: 1.1, guard: 18, keys: K_H },
  B: { w: 0.9,  a: 0.12, r: 0.6,  lunge: 1.2, guard: 24, hold: 0.5, keys: K_V, pwK: 1.1 },
  Q: { w: 0.5,  a: 0.1,  r: 0.5,  lunge: 1.2, guard: 20, sig: 'blue', keys: K_D, pwK: 0.85 },
  O: { w: 0.78, a: 0.12, r: 0.65, lunge: 1.3, guard: 30, sig: 'blue', keys: K_BIG },
  T: { w: 0.92, a: 0.13, r: 0.75, lunge: 2.3, sig: 'red', thrust: true, keys: K_THRUST },
  G: { w: 0.62, a: 0.14, r: 0.7,  lunge: 1.8, sig: 'red', grab: true, keys: K_GRAB },
  F: { w: 0.9,  a: 0.12, r: 0.6,  lunge: 1.2, guard: 24, hold: 0.5, feint: { at: 0.64, into: 'A' }, keys: K_V, pwK: 1.1 },
  // lanceiro
  S: { w: 0.82, a: 0.13, r: 0.75, lunge: 1.5, sig: 'red', thrust: true, keys: K_SPEAR, reach: 3.3 },
  W: { w: 0.78, a: 0.16, r: 0.7,  lunge: 0.5, sig: 'red', sweep: true, keys: K_SWEEP, reach: 2.9 },
  J: { w: 0.46, a: 0.1,  r: 0.5,  lunge: 0.6, guard: 16, keys: K_JAB, reach: 2.9, pwK: 0.9 },
  // escudeiro: empurrão de escudo (azul: defender não segura; aparar ou esquivar)
  H: { w: 0.55, a: 0.12, r: 0.6,  lunge: 1.7, sig: 'blue', bash: true, keys: K_BASH, reach: 1.9 },
  // esquivo: contra-ataque rápido logo depois de esquivar
  E: { w: 0.3,  a: 0.09, r: 0.45, lunge: 1.4, guard: 18, keys: K_D, pwK: 0.85 },
};
export const lerpPose = (a, b, t, o = {}) => {
  o.hx = lerp(a.hx, b.hx, t); o.hy = lerp(a.hy, b.hy, t); o.hz = lerp(a.hz, b.hz, t);
  o.yaw = lerp(a.yaw, b.yaw, t); o.pitch = lerp(a.pitch, b.pitch, t); o.roll = lerp(a.roll, b.roll, t);
  return o;
};
export function movePose(m, t, from, o = {}) {
  const W = m.w, A = m.a, wr = m.hold ? m.w - m.hold : m.w;
  if (t < W) {
    lerpPose(from, m.keys[0], easeOut(Math.min(1, t / wr)), o);
    if (m.hold && t > wr) o.pitch += Math.sin(t * (m.feint ? 55 : 40)) * (m.feint ? 0.05 : 0.015); // tremor (finta treme mais: sinal honesto)
    return o;
  }
  if (t < W + A * 0.5) return lerpPose(m.keys[0], m.keys[1], easeIn((t - W) / (A * 0.5)), o);
  if (t < W + A) return lerpPose(m.keys[1], m.keys[2], (t - W - A * 0.5) / (A * 0.5), o);
  return lerpPose(m.keys[2], POSE.guard, easeInOut(clamp((t - W - A) / m.r, 0, 1)), o);
}
export const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
export const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _down = new THREE.Vector3(0, -1, 0);
export const _b = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export const GLINT = { blue: new THREE.Color(1.2, 2.6, 9), red: new THREE.Color(9, 1.2, 0.5) };
