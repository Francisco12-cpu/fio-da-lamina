import * as THREE from 'three';
import { angDiff, yawTo } from '../core/util.js';
import { camera } from '../render/renderer.js';

/* ================================================================
   TRAVAR A MIRA — um inimigo escolhido vira o alvo fixo do jogador e da câmera.
   PC: Q ou botão do meio (liga/desliga), mover o mouse de lado troca de alvo.
   Celular: tocar no inimigo (ou botão da mira), arrastar para o lado troca.
   ================================================================ */
const _p = new THREE.Vector3();
export const Lock = {
  target: null, flick: 0, flickT: 0, switchT: 0,
  RANGE: 16, KEEP: 22,
  candidates(player, enemies) { return enemies.filter((e) => e.alive && e.pos.distanceTo(player.pos) < this.RANGE); },
  // o mais próximo do centro da tela, com peso pela distância
  pick(player, enemies, camYaw) {
    let best = null, bs = Infinity;
    for (const e of this.candidates(player, enemies)) {
      const a = Math.abs(angDiff(camYaw, yawTo(player.pos, e.pos)));
      const s = a * 3 + e.pos.distanceTo(player.pos) * 0.15;
      if (a < 1.4 && s < bs) { bs = s; best = e; }
    }
    return best;
  },
  toggle(player, enemies, camYaw) {
    if (this.target) { this.release(); return false; }
    const e = this.pick(player, enemies, camYaw);
    this.owner = player;
    if (e) this.set(e, player);
    return !!e;
  },
  set(e, player) { this.target = e; this.flick = 0; const p = player || this.owner; if (p) p.forcedTarget = e; },
  release(player) { const p = player || this.owner; this.target = null; this.flick = 0; if (p) p.forcedTarget = null; },
  // troca para o vizinho mais próximo do lado pedido (dir = +1 direita, -1 esquerda)
  switchSide(player, enemies, dir) {
    if (!this.target) return;
    const base = yawTo(player.pos, this.target.pos);
    let best = null, ba = Infinity;
    for (const e of this.candidates(player, enemies)) {
      if (e === this.target) continue;
      const d = angDiff(base, yawTo(player.pos, e.pos)); // positivo = à esquerda (yaw cresce para a esquerda)
      if (Math.sign(-d) !== dir) continue;
      if (Math.abs(d) < ba) { ba = Math.abs(d); best = e; }
    }
    if (best) this.set(best, player);
  },
  // arrasto horizontal acumulado vira troca de alvo (com recarga curta)
  addFlick(dx, player, enemies, t) {
    if (!this.target) return;
    if (t - this.flickT > 0.25) this.flick = 0;
    this.flickT = t; this.flick += dx;
    if (Math.abs(this.flick) > 0.09 && t > this.switchT) { this.switchSide(player, enemies, Math.sign(this.flick)); this.flick = 0; this.switchT = t + 0.3; }
  },
  update(player, enemies) {
    this.owner = player;
    const e = this.target;
    if (!e) return;
    if (!e.alive || e.pos.distanceTo(player.pos) > this.KEEP || !player.alive) {
      // alvo caiu: passa para o mais próximo que ainda luta, senão solta
      const next = player.alive ? this.candidates(player, enemies).filter((x) => x.aware).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos))[0] : null;
      if (next && next.pos.distanceTo(player.pos) < 10) this.set(next, player); else this.release(player);
    }
  },
  // toque na tela: acha o inimigo desenhado mais perto do dedo
  pickAtScreen(x, y, enemies) {
    let best = null, bd = 70;
    camera.updateMatrixWorld();
    for (const e of enemies) {
      if (!e.alive) continue;
      _p.set(e.pos.x, e.pos.y + 1.1, e.pos.z).project(camera);
      if (_p.z > 1) continue;
      const sx = (_p.x * 0.5 + 0.5) * innerWidth, sy = (-_p.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(sx - x, (sy - y) * 0.7);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
};
