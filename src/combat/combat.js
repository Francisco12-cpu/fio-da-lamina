import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { Director } from './director.js';
import { _up } from './moves.js';
import { Stats, buzz } from './state.js';
import { G, Time } from '../core/time.js';
import { rand } from '../core/util.js';
import { bloodFx, sparks } from '../fx/fx.js';
import { Fx } from '../game/camera.js';
import { UI } from '../ui/ui.js';

/* ================================================================
   RESOLUÇÃO DE CONTATO — um lugar só decide o que cada resultado provoca
   ================================================================ */
export const Combat = {
  resolve(att, def, res, point, t, m) {
    if (res === 'parry') {
      sparks.emit(point, _up, 34, 7, 0.9, 0.5);
      Sound.clang('parry'); Time.freeze(0.09); Time.slow(0.3, 0.32); Fx.shake(def.isPlayer ? 0.45 : 0.3); Fx.punch(def.isPlayer ? 4 : 2);
      def.gainStab(10);
      att.loseStab(45 * (m.rushed ? 1.4 : 1), t);
      if (att.state !== 'broken') att.stagger(att.isPlayer ? 0.6 : 1.0, def.pos);
      if (!att.isPlayer && Director.attacker === att) Director.release(att, t);
      if (def.isPlayer) { UI.flash('Aparado'); UI.good(); def.lastParryT = t; Stats.parries++; buzz(28); } else { UI.flash('Ele aparou'); buzz([20, 30, 20]); }
    } else if (res === 'block') {
      sparks.emit(point, _up, m.strong ? 20 : 12, m.strong ? 5 : 4, 0.8, 0.35);
      Sound.clang(m.strong ? 'heavy' : 'block'); Time.freeze(m.strong ? 0.07 : 0.05); Fx.shake(m.strong ? 0.28 : 0.18);
      def.loseStab(m.guard || 16, t);
      const recoil = att.isPlayer ? !m.strong : att.type.recoil;
      if (recoil) att.recoil(def.pos);
      if (!def.isPlayer && def.alive && def.state !== 'broken' && rand() < def.type.riposte) def.riposteT = t + 0.12;
    } else if (res === 'pdodge') {
      Time.slow(0.35, 0.42); Fx.punch(2); UI.flash('Esquiva perfeita');
      att.loseStab(25, t);
      if (att.alive && att.state !== 'broken') { att.stagger(0.6); att.chainQ && (att.chainQ.length = 0); }
      if (!att.isPlayer && Director.attacker === att) Director.release(att, t);
    } else if (res === 'hit') {
      Sound.slash();
      if (m.counter && def.alive) { def.loseStab(35, t); UI.flash('Contra-golpe'); Fx.punch(3); }
      const dir = new THREE.Vector3(def.pos.x - att.pos.x, 0.5, def.pos.z - att.pos.z).normalize();
      bloodFx.emit(point, dir, def.alive ? 8 : 16, 3, 0.7, 0.6);
      if (!def.alive) {
        if (def.decisive) { Stats.decisive++; Time.freeze(0.16); Time.slow(0.25, 0.6); Fx.shake(0.5); Fx.punch(6); UI.flash('Golpe decisivo'); Sound.gongSoft(); buzz([30, 40, 60]); if (att.isPlayer) G.rig.cut(att, def, 1.1); }
        else { Time.freeze(0.12); Time.slow(0.35, 0.45); Fx.shake(0.5); Fx.punch(3); }
      } else { Time.freeze(0.08); Fx.shake(0.6); if (def.isPlayer) buzz(70); }
    }
  },
};
