import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { Director } from './director.js';
import { _up, _v } from './moves.js';
import { Mastery } from './rules.js';
import { Stats, buzz } from './state.js';
import { G, Time } from '../core/time.js';
import { rand } from '../core/util.js';
import { bloodFx, dustFx, sparks } from '../fx/fx.js';
import { Fx } from '../game/camera.js';
import { UI } from '../ui/ui.js';

/* ================================================================
   RESOLUÇÃO DE CONTATO — um lugar só decide o que cada resultado provoca
   ================================================================ */
export const Combat = {
  resolve(att, def, res, point, t, m) {
    if (res === 'parry' || res === 'absparry') {
      const abs = res === 'absparry';
      sparks.emit(point, _up, abs ? 50 : 34, abs ? 9 : 7, 0.9, 0.5);
      Sound.clang('parry'); if (abs) Sound.gongSoft();
      Time.freeze(abs ? 0.13 : 0.09); Time.slow(abs ? 0.22 : 0.3, abs ? 0.55 : 0.32); Fx.shake(def.isPlayer ? 0.45 : 0.3); Fx.punch(def.isPlayer ? (abs ? 6 : 4) : 2);
      def.gainStab(abs ? 20 : 10);
      // aparo absoluto (estocada no último instante): quebra o equilíbrio na hora
      if (abs) att.breakStance(t);
      else att.loseStab(45 * (m.rushed ? 1.4 : 1), t);
      if (att.state !== 'broken') att.stagger(att.isPlayer ? 0.6 : 1.0, def.pos);
      if (!att.isPlayer && Director.attacker === att) Director.release(att, t);
      if (def.isPlayer) { UI.flash(abs ? 'Aparo absoluto' : 'Aparado'); UI.good(); def.lastParryT = t; Stats.parries++; if (abs) Stats.absParries = (Stats.absParries || 0) + 1; buzz(abs ? [30, 30, 50] : 28); }
      else { UI.flash('Ele aparou'); buzz([20, 30, 20]); if (def.alive) def.riposteT = t + 0.15; }
    } else if (res === 'block') {
      sparks.emit(point, _up, m.strong ? 20 : 12, m.strong ? 5 : 4, 0.8, 0.35);
      Sound.clang(m.strong ? 'heavy' : 'block'); Time.freeze(m.strong ? 0.07 : 0.05); Fx.shake(m.strong ? 0.28 : 0.18);
      def.loseStab((m.guard || 16) * (def.isPlayer ? 1 - 0.2 * Mastery.lv('guard') : 1), t);
      const recoil = att.isPlayer ? !m.strong : att.type.recoil;
      if (recoil) att.recoil(def.pos);
      if (!def.isPlayer && def.alive && def.state !== 'broken' && rand() < def.type.riposte) def.riposteT = t + 0.12;
    } else if (res === 'shield') {
      // golpe leve no escudo: não gasta nada dele e devolve o tranco
      sparks.emit(point, _up, 5, 2.5, 0.8, 0.25);
      Sound.thunk(1.1); Sound.clang('block'); Time.freeze(0.05); Fx.shake(0.2);
      att.loseStab(4, t); att.recoil(def.pos);
      if (att.isPlayer && (Stats.shieldWarn = (Stats.shieldWarn || 0) + 1) <= 2) UI.flash('O escudo segura golpes leves');
      if (!def.isPlayer && def.alive && rand() < def.type.riposte) def.riposteT = t + 0.1;
    } else if (res === 'bashed') {
      Sound.thunk(1.4); Time.freeze(0.07); Fx.shake(0.45); Fx.punch(2);
      dustFx.emit(_v.set(def.pos.x, def.pos.y + 0.1, def.pos.z).clone(), _up, 8, 1, 1, 0.7);
      if (def.isPlayer) buzz(50);
    } else if (res === 'pdodge') {
      Time.slow(0.35, 0.42); Fx.punch(2);
      att.loseStab(25, t);
      if (att.alive && att.state !== 'broken') { att.stagger(0.6); att.chainQ && (att.chainQ.length = 0); }
      if (!att.isPlayer && Director.attacker === att) Director.release(att, t);
      // esquiva perfeita dá 1 ponto de foco
      if (def.isPlayer) { const had = def.focus; def.gainFocus(); UI.flash(def.focus > had ? 'Esquiva perfeita · foco' : 'Esquiva perfeita'); }
    } else if (res === 'hit') {
      Sound.slash();
      if (m.counter && def.alive) { def.loseStab(20 + 12 * Mastery.lv('counter'), t); UI.flash('Contra-golpe'); Fx.punch(3); }
      const dir = new THREE.Vector3(def.pos.x - att.pos.x, 0.5, def.pos.z - att.pos.z).normalize();
      bloodFx.emit(point, dir, def.alive ? 8 : 16, 3, 0.7, 0.6);
      if (!def.alive) {
        if (def.decisive && att.isPlayer) { Stats.decisive++; Time.freeze(0.16); Time.slow(0.25, 0.6); Fx.shake(0.5); Fx.punch(6); UI.flash('Golpe decisivo'); Sound.gongSoft(); buzz([30, 40, 60]); G.rig.cut(att, def, 1.1); }
        else { Time.freeze(0.12); Time.slow(0.35, 0.45); Fx.shake(0.5); Fx.punch(3); }
      } else { Time.freeze(0.08); Fx.shake(0.6); if (def.isPlayer) buzz(70); }
    }
  },
};
