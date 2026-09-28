import { Sound } from '../audio/sound.js';
import { Director } from './director.js';
import { _up } from './moves.js';
import { Rules } from './rules.js';
import { Stats, buzz } from './state.js';
import { Time } from '../core/time.js';
import { sparks } from '../fx/fx.js';
import { Fx } from '../game/camera.js';
import { UI } from '../ui/ui.js';

/* ================================================================
   ESPADAS TRAVADAS — quando as lâminas se cruzam no meio de dois golpes.
   Os dois ficam parados empurrando; o jogador aperta o golpe repetidamente,
   o inimigo empurra com força própria do tipo. Quem vencer desequilibra o outro.
   ================================================================ */
export const Bind = {
  active: false, p: null, e: null, v: 0, t: 0, point: null, sparkT: 0,
  PRESS: 0.12, LIMIT: 3.0,
  start(a, b, point, t) {
    if (this.active) return false;
    const p = a.isPlayer ? a : b.isPlayer ? b : null;
    if (!p) return false;
    const e = p === a ? b : a;
    if (!e.alive || !p.alive) return false;
    this.active = true; this.p = p; this.e = e; this.v = 0; this.t = 0; this.point = point.clone(); this.sparkT = 0;
    for (const f of [p, e]) { f.setState('bind'); f.bindWith = f === p ? e : p; f.vel.set(0, 0, 0); }
    if (Director.attacker !== e) { if (Director.attacker) Director.release(Director.attacker, t); Director.take(e); }
    sparks.emit(point, _up, 40, 6, 1, 0.5);
    Sound.clang('heavy'); Sound.grind(this.LIMIT);
    Time.freeze(0.08); Fx.punch(3); Fx.shake(0.35); buzz([20, 20, 20]);
    UI.flash('Espadas travadas'); UI.bind(true, 0);
    Stats.binds = (Stats.binds || 0) + 1;
    return true;
  },
  press(f) { if (this.active && f === this.p) this.v += this.PRESS; },
  update(dt, t) {
    if (!this.active) return;
    const p = this.p, e = this.e;
    if (p.state !== 'bind' || e.state !== 'bind') { this.stop(); return; }
    this.t += dt;
    // o inimigo empurra em ondas (sem sorteio): dá para sentir quando ele pesa mais
    this.v -= (e.type.bind || 0.35) * Rules.D.bind * (1 + 0.45 * Math.sin(this.t * 5.5)) * dt;
    this.sparkT -= dt;
    if (this.sparkT <= 0 && dt > 0) { this.sparkT = 0.12; sparks.emit(this.point, _up, 4, 2.5, 1, 0.3); }
    UI.bind(true, this.v);
    if (this.v >= 1) this.end(p, t);
    else if (this.v <= -1) this.end(e, t);
    else if (this.t > this.LIMIT) this.end(null, t);
  },
  end(winner, t) {
    const p = this.p, e = this.e;
    this.stop();
    for (const f of [p, e]) if (f.state === 'bind') f.setState('move');
    Sound.clang('parry'); Fx.shake(0.4); sparks.emit(this.point, _up, 30, 7, 1, 0.5);
    if (winner) {
      const loser = winner === p ? e : p;
      loser.breakStance(t); loser.push(winner.pos, 3.2);
      Time.slow(0.4, 0.35);
      UI.flash(winner === p ? 'Você venceu a trava' : 'Ele venceu a trava');
      if (winner === p) buzz(40);
    } else { p.recoil(e.pos); e.recoil(p.pos); UI.flash('As lâminas se soltam'); }
    if (Director.attacker === e) Director.release(e, t);
  },
  stop() { this.active = false; if (this.p) this.p.bindWith = null; if (this.e) this.e.bindWith = null; UI.bind(false, 0); Sound.grindStop(); },
  reset() { if (this.active) { for (const f of [this.p, this.e]) if (f.state === 'bind') f.setState('move'); this.stop(); } },
};
