import { PLAYER_MOVES } from '../combat/moves.js';
import { Habits, Report, Stats } from '../combat/state.js';
import { CFG } from '../core/config.js';
import { Input } from '../core/input.js';
import { angDiff, yawTo } from '../core/util.js';
import { Fighter } from './fighter.js';
import { Game } from '../game/game.js';
import { UI } from '../ui/ui.js';
import { terrain } from '../world/world.js';

/* ================================================================
   JOGADOR — traduz teclado/mouse/toque em intent
   ================================================================ */
export class Player extends Fighter {
  constructor(pos) {
    super({ isPlayer: true, pos, health: 2, stab: 100, brokenDur: 1.0, moveset: PLAYER_MOVES,
      speeds: { walk: CFG.player.walk, run: CFG.player.run, stance: CFG.player.stanceSpeed, block: CFG.player.blockSpeed } });
    this.it = {};
  }
  chainNext() { return this.move && this.move.light && this.combo < 2 ? this.combo + 1 : -1; }
  intentFromInput(camYaw) {
    const it = this.it, mv = Input.move, mag = Math.min(1, mv.length());
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x;
    const wl = Math.hypot(wx, wz); if (wl > 1e-3) { wx /= wl; wz /= wl; }
    it.wx = wx; it.wz = wz; it.mag = mag; it.run = Input.run && !Input.blockHeld;
    it.analog = Input.joy.id !== null && !Input.run ? Math.min(1, mag / 0.92) : 1;
    it.atk = Input.take('attack'); it.dodge = Input.take('dodge'); it.bPress = Input.take('blockPress');
    it.blockHeld = Input.blockHeld; it.atkHeld = Input.attackHeld; it.atkIndex = undefined;
    return it;
  }
  tick(dt, t, camYaw, targets) {
    if (this.health < this.maxHealth && this.alive && this.state !== 'down' && t - this.lastHitT > CFG.combat.regen) this.health = this.maxHealth;
    if (this.drawn && this.state === 'move' && !this.target && t - this.lastCombatT > 6) this.sheathe();
    return this.update(dt, t, this.intentFromInput(camYaw), targets);
  }
  receiveAttack(o) {
    const res = this.resolveIncoming(o);
    if (res !== 'miss') Report.contact(o.src || 'boneco', o.sig, res, o.t, o.t - this.lastBlockPress);
    return res;
  }
  resolveIncoming({ sig, grab, from, lethal, t }) {
    if (this.state === 'dead' || this.state === 'down') return 'miss';
    const K = CFG.combat;
    if (this.state === 'dodge' && this.st >= K.dodge.iStart && this.st <= K.dodge.iEnd) return t - this.lastDodgeT <= 0.26 ? 'pdodge' : 'dodge';
    const frontal = Math.abs(angDiff(this.yaw, yawTo(this.pos, from))) < 1.5;
    if (this.state === 'block' && frontal) {
      this.lastCombatT = t;
      const inWindow = this.parryOpen && t - this.lastBlockPress <= K.parryWindow;
      if (inWindow && sig !== 'red') { this.parryOpen = false; this.parryAnim = 0.3; return 'parry'; }
      if (sig === 'red') UI.flash('Vermelho: só esquiva');
      else if (sig === 'blue') UI.flash('Azul atravessa a defesa');
      else {
        if (t - this.lastBlockPress < 0.6) Habits.onEarlyBlock();
        this.push(from, 2.2);
        return 'block';
      }
    }
    this.takeHit(from, lethal, t, grab);
    return 'hit';
  }
  die(t) { super.die(t); Stats.deaths++; UI.flash('Você caiu'); Game.onPlayerDeath(); }
  respawn(p, yaw) {
    this.pos.set(p.x, terrain.heightAt(p.x, p.z), p.z); this.vel.set(0, 0, 0); this.yaw = yaw;
    this.health = this.maxHealth; this.stab = this.maxStab; this.lastHitT = -99; this.setState('move'); this.syncRoot();
  }
}
