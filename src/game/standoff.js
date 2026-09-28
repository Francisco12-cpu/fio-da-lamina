import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { Director } from '../combat/director.js';
import { _up, _v } from '../combat/moves.js';
import { buzz } from '../combat/state.js';
import { Input } from '../core/input.js';
import { G, Time, simT } from '../core/time.js';
import { damp, rand, yawTo } from '../core/util.js';
import { bloodFx, dustFx } from '../fx/fx.js';
import { Fx } from './camera.js';
import { T_ } from './training.js';
import { UI } from '../ui/ui.js';

/* ================================================================
   IMPASSE — antes do duelo, os dois se encaram. Segure o ataque e solte
   no instante em que ele avançar. Ele pode tremer para enganar (finta).
   ================================================================ */
export const Standoff = {
  active: false, phase: '', t: 0, e: null, feints: [], goAt: 0, heldOnce: false, it: {}, eit: {}, strikeT: 0, ok: false, why: '',
  begin(e) {
    this.active = true; this.e = e; this.phase = 'approach'; this.t = 0; this.heldOnce = false; this.strikeT = 0;
    e.brain = 'standoff'; e.aware = false;
    G.player.sheathe();
    document.body.classList.add('cine'); UI.clear();
    G.rig.setCine(G.player, e, { side: 1, dist: 5.4, h: 0.25, look: 1.15, back: 0.4 });
    this.goAt = 2.2 + rand() * 2.6;
    this.feints = [];
    const nf = rand() < 0.45 ? 1 : 2;
    for (let i = 0; i < nf; i++) this.feints.push({ at: this.goAt * (0.25 + 0.55 * rand()), done: false });
  },
  blank(it) { it.atk = false; it.dodge = false; it.bPress = false; it.blockHeld = false; it.wx = 0; it.wz = 0; it.mag = 0; it.run = false; it.atkIndex = undefined; it.analog = 1; it.atkHeld = false; return it; },
  update(dt, t) {
    const p = G.player, e = this.e, it = this.blank(this.it), eit = this.blank(this.eit);
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
    e.yaw = yawTo(e.pos, p.pos);
    Input.take('attack'); Input.take('dodge'); Input.take('blockPress'); // ignora toques durante o impasse
    const held = Input.attackHeld;
    switch (this.phase) {
      case 'approach':
        it.wx = dx / d; it.wz = dz / d; it.mag = 1; it.analog = 0.9;
        if (d <= 6.3) { this.phase = 'hold'; UI.stick('Segure {atk}. Solte no instante em que ele avançar.'); }
        break;
      case 'hold':
        p.yaw = damp(p.yaw, yawTo(p.pos, e.pos), 8, dt);
        if (!held) { if (this.heldOnce) this.fail('Cedo demais'); break; }
        if (!this.heldOnce) { this.heldOnce = true; UI.stick('Espere…'); }
        this.t += dt;
        for (const f of this.feints) if (!f.done && this.t >= f.at) {
          // finta: um passo curto e o som da roupa, sem sacar a espada
          f.done = true; this.twitch = 0.16; Sound.feint(); Sound.cloth();
          dustFx.emit(new THREE.Vector3(e.pos.x, e.pos.y + 0.1, e.pos.z), _up, 5, 0.6, 1, 0.6);
        }
        if (this.twitch > 0) { this.twitch -= dt; eit.wx = -dx / d; eit.wz = -dz / d; eit.mag = 1; eit.analog = 0.5; }
        if (this.t >= this.goAt) { this.phase = 'go'; this.goT = 0; e.speeds.run = 11; e.draw(); Sound.draw(); UI.clear(); }
        break;
      case 'go':
        this.goT += dt;
        eit.wx = -dx / d; eit.wz = -dz / d; eit.mag = 1; eit.run = true;
        if (!held) { this.succeed(t); break; }
        if (d < 1.4 || this.goT > 0.6) this.fail('Tarde demais');
        break;
      case 'strike':
        this.strikeT += dt;
        if (this.strikeT > 0.12 && !this.resolved) {
          this.resolved = true;
          if (this.ok) {
            e.takeHit(p.pos, true, t); e.loseStab(40, t); if (e.alive && e.state !== 'broken') e.stagger(1.3, p.pos);
            Sound.slash(); Sound.gongSoft(); UI.flash('Primeiro golpe'); Fx.punch(6); Fx.shake(0.5); buzz([40, 50, 80]);
            bloodFx.emit(_v.set(e.pos.x, e.pos.y + 1.2, e.pos.z).clone(), _up, 14, 3, 0.8, 0.6);
          } else {
            p.takeHit(e.pos, true, t); Sound.slash(); Fx.shake(0.6); buzz(90);
          }
        }
        if (this.strikeT > 1.0) this.end();
        break;
    }
    const speed = p.update(dt, t, it, []);
    e.update(dt, t, eit, []);
    return speed;
  },
  succeed(t) {
    this.phase = 'strike'; this.ok = true; this.resolved = false; this.strikeT = 0;
    Time.slow(0.22, 1.0); G.player.draw(); G.player.startAttack(0, t); G.player.hitSet.add(this.e);
  },
  fail(why) {
    this.phase = 'strike'; this.ok = false; this.resolved = false; this.strikeT = 0;
    UI.clear(); UI.flash(why);
    this.e.draw(); const i = this.e.moveIndex('A'); this.e.startAttack(i >= 0 ? i : 0, simT); this.e.hitSet.add(G.player);
  },
  end() {
    this.active = false; this.phase = '';
    document.body.classList.remove('cine'); G.rig.clearCine();
    const e = this.e; e.speeds.run = 4.6; e.aware = true; e.brain = 'circle'; e.bt = 0; e.nextAtkT = simT + 1.2;
    Director.reset();
    if (G.player.alive) { G.player.draw(); G.rig.yaw = yawTo(G.player.pos, e.pos) + 0.3; }
  },
};
