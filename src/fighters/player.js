import { PLAYER_MOVES } from '../combat/moves.js';
import { Mastery, Rules, absParryWindow, parryWindow, pdodgeWindow } from '../combat/rules.js';
import { Sound } from '../audio/sound.js';
import { Time } from '../core/time.js';
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
    this.focus = 0;
  }
  get focusMax() { return Mastery.focusMax; }
  // foco: gasta 1 ponto numa respiração curta que devolve boa parte da estabilidade (exposto)
  useFocus(t) {
    if (this.focus < 1 || !(this.state === 'move' || this.state === 'block') || this.stab >= this.maxStab - 1) return false;
    this.focus--; this.setState('breathe'); this.lastCombatT = t;
    Sound.breath(true); UI.flash('Respira');
    return true;
  }
  gainFocus() { if (this.focus < this.focusMax) { this.focus++; UI.focusGain(); } }
  chainNext() { return this.move && this.move.light && this.combo < 2 ? this.combo + 1 : -1; }
  intentFromInput(camYaw) {
    const it = this.it, mv = Input.move, mag = Math.min(1, mv.length());
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x;
    const wl = Math.hypot(wx, wz); if (wl > 1e-3) { wx /= wl; wz /= wl; }
    it.wx = wx; it.wz = wz; it.mag = mag; it.run = Input.run && !Input.blockHeld;
    it.analog = Input.joy.id !== null && !Input.run ? Math.min(1, mag / 0.92) : 1;
    it.atk = Input.take('attack'); it.dodge = Input.take('dodge'); it.bPress = Input.take('blockPress');
    it.blockHeld = Input.blockHeld; it.atkHeld = Input.attackHeld; it.atkIndex = undefined; it.focus = Input.take('focus');
    return it;
  }
  tick(dt, t, camYaw, targets) {
    if (this.health < this.maxHealth && this.alive && this.state !== 'down' && t - this.lastHitT > CFG.combat.regen) this.health = this.maxHealth;
    if (this.drawn && this.state === 'move' && !this.target && t - this.lastCombatT > 6) this.sheathe();
    const it = this.intentFromInput(camYaw);
    if (it.focus) this.useFocus(t);
    return this.update(dt, t, it, targets);
  }
  receiveAttack(o) {
    const res = this.resolveIncoming(o);
    if (res !== 'miss') Report.contact(o.src || 'boneco', o.sig, res, o.t, o.t - this.lastBlockPress);
    return res;
  }
  resolveIncoming({ sig, grab, bash, thrust, sweep, move, attacker, from, lethal, t, dir }) {
    if (this.state === 'dead' || this.state === 'down') return 'miss';
    const K = CFG.combat;
    if (this.state === 'dodge' && this.st >= K.dodge.iStart && this.st <= K.dodge.iEnd) return t - this.lastDodgeT <= pdodgeWindow() ? 'pdodge' : 'dodge';
    // sem estabilidade, qualquer golpe de lâmina mata na hora
    const blade = !grab && !bash && attacker;
    if (this.state === 'broken' && blade) { this.health = 0; this.lastHitT = t; this.decisive = true; this.pushBlow(from, dir, 1.6); this.die(t); if (this.isPlayer) { Sound.hurt(); UI.hurt(); } return 'hit'; }
    const frontal = Math.abs(angDiff(this.yaw, yawTo(this.pos, from))) < 1.5;
    if (this.state === 'block' && frontal) {
      this.lastCombatT = t;
      const since = t - this.lastBlockPress;
      // estocada: só o "aparo absoluto", no último instante, segura (e quebra o equilíbrio dele)
      if (thrust && this.parryOpen && since <= absParryWindow()) { this.parryOpen = false; this.parryAnim = 0.3; return 'absparry'; }
      const inWindow = this.parryOpen && since <= parryWindow(move, attacker);
      if (inWindow && sig !== 'red') { this.parryOpen = false; this.parryAnim = 0.3; return 'parry'; }
      if (thrust) UI.flash('Estocada: esquive, ou apare no último instante');
      else if (sweep) UI.flash('Varredura: só esquiva');
      else if (sig === 'red') UI.flash('Vermelho: só esquiva');
      else if (sig === 'blue') UI.flash(bash ? 'O escudo atravessa a defesa' : 'Azul atravessa a defesa');
      else {
        if (since < 0.6) Habits.onEarlyBlock();
        this.push(from, 2.2);
        return 'block';
      }
    }
    // empurrão de escudo: não corta, mas derruba o equilíbrio
    if (bash) { this.pushBlow(from, dir, 3.4); this.loseStab(38, t); if (this.state !== 'broken') this.stagger(0.55); this.lastCombatT = t; return 'bashed'; }
    this.takeHit(from, lethal, t, grab, dir);
    return 'hit';
  }
  die(t) { super.die(t); Stats.deaths++; UI.flash('Você caiu'); Time.slow(0.28, 1.5); UI.dying(true); Sound.breath(false); Game.onPlayerDeath(); }
  respawn(p, yaw) {
    this.pos.set(p.x, terrain.heightAt(p.x, p.z), p.z); this.vel.set(0, 0, 0); this.yaw = yaw;
    this.health = this.maxHealth; this.stab = this.maxStab; this.lastHitT = -99; this.decisive = false; this.setState('move'); this.syncRoot();
    this.focus = Mastery.lv('focus') ? 1 : 0; UI.dying(false);
  }
}
