import { Director } from '../combat/director.js';
import { ENEMY_LIB } from '../combat/moves.js';
import { Habits, Stats } from '../combat/state.js';
import { CFG } from '../core/config.js';
import { angDiff, rand, yawTo } from '../core/util.js';
import { Fighter } from './fighter.js';
import { terrain } from '../world/world.js';

/* ================================================================
   INIMIGOS — quatro temperamentos com o mesmo corpo.
   Parecem espertos por ritmo, leitura e posicionamento, nunca por trapaça:
   só acertam se a lâmina encostar, e só reagem ao que você já fez.
   ================================================================ */
export const ETYPES = {
  recruta: {
    label: 'Recruta', stab: 70, regen: 16, turn: 4.5, broken: 1.5, windup: 1.1,
    interval: [1.8, 3.0], parry: 0.05, dodge: 0.04, adapt: 0.2, riposte: 0.15, chain: 0, recoil: true, circle: 2.8,
    moves: { A: 0.55, B: 0.3, T: 0.15 },
    look: { cloth: 0x2a1511, cloak: 0x3d1a13, pants: 0x231d19, hat: 'jingasa', hatColor: 0x161412 },
  },
  agressivo: {
    label: 'Agressivo', stab: 60, regen: 14, turn: 5.5, broken: 1.4, windup: 0.85,
    interval: [0.6, 1.3], parry: 0.08, dodge: 0.08, adapt: 0.3, riposte: 0.2, chain: 0.75, recoil: false, circle: 2.3,
    moves: { A: 0.45, Q: 0.35, T: 0.2 },
    look: { cloth: 0x3a2012, cloak: 0x9a4a17, pants: 0x2a2018, hat: 'jingasa', hatColor: 0x241a12 },
  },
  paciente: {
    label: 'Paciente', stab: 110, regen: 30, turn: 5, broken: 1.3, windup: 1.0,
    interval: [1.8, 3.0], parry: 0.45, dodge: 0.2, adapt: 0.6, riposte: 0.6, chain: 0.1, recoil: true, circle: 3.0,
    moves: { A: 0.3, O: 0.4, G: 0.3 },
    look: { cloth: 0x151c28, cloak: 0x1f3450, pants: 0x151820, hat: 'jingasa', hatColor: 0x10141c },
  },
  duelista: {
    label: 'Duelista', stab: 100, regen: 22, turn: 6, broken: 1.1, windup: 0.85,
    interval: [1.0, 1.8], parry: 0.3, dodge: 0.15, adapt: 1.0, riposte: 0.4, chain: 0.5, recoil: true, circle: 2.7,
    moves: { A: 0.25, B: 0.12, Q: 0.15, O: 0.1, T: 0.1, G: 0.1, F: 0.18 },
    look: { cloth: 0x2b2b2e, cloak: 0x8f897d, pants: 0x1c1c1f, hat: 'topknot', band: 0x7a1d12, skin: 0x5e4232 },
  },
};
export class Enemy extends Fighter {
  constructor(pos, typeName) {
    const type = ETYPES[typeName];
    const names = Object.keys(type.moves);
    const moves = names.map((n) => { const m = ENEMY_LIB[n]; return { ...m, name: n, w: m.w * type.windup, hold: m.hold ? m.hold * type.windup : 0, feint: m.feint ? { ...m.feint, at: m.feint.at * type.windup } : null }; });
    // a finta precisa do golpe de destino no repertório
    if (names.includes('F') && !names.includes('A')) { const m = ENEMY_LIB.A; moves.push({ ...m, name: 'A', w: m.w * type.windup }); names.push('A'); }
    super({ pos, yaw: Math.PI, health: 2, stab: type.stab, brokenDur: type.broken, turnRate: type.turn, moveset: moves, look: type.look,
      speeds: { walk: 2.0, run: 4.6, stance: 1.6, block: 1.3 } });
    this.type = type; this.names = names; this.spawn = pos.clone();
    this.it = {}; this.brain = 'idle'; this.bt = 0; this.aware = false;
    this.circleDir = rand() < 0.5 ? 1 : -1; this.flipT = 2; this.nextAtkT = 0;
    this.riposteT = -1; this.chainQ = []; this.readId = -1; this.parryIntent = -1;
    this.tag = document.createElement('div'); this.tag.className = 'tag';
    this.tag.innerHTML = '<div class="bar"><i class="tr"></i><b></b></div><div class="hp"><i></i><i></i></div>';
    document.getElementById('tags').appendChild(this.tag);
    this.tagFill = this.tag.querySelector('b'); this.tagTrail = this.tag.querySelector('.tr'); this.tagHp = [...this.tag.querySelectorAll('.hp i')];
  }
  moveIndex(name) { return this.names.indexOf(name); }
  chainNext() { return this.chainQ.length ? this.moveIndex(this.chainQ.shift()) : -1; }
  onBroken(t) { if (Director.attacker === this) Director.release(this, t); this.chainQ.length = 0; }
  die(t) { super.die(t); Stats.kills++; if (Director.attacker === this) Director.release(this, t); }
  receiveAttack({ from, attacker, t }) {
    if (!this.alive) return 'miss';
    const K = CFG.combat;
    if (this.state === 'dodge' && this.st >= K.dodge.iStart && this.st <= K.dodge.iEnd) return 'dodge';
    if (this.state === 'broken') { this.decisive = true; this.health = 0; this.die(t); return 'hit'; }
    const frontal = Math.abs(angDiff(this.yaw, yawTo(this.pos, from))) < 1.35;
    const windup = this.state === 'attack' && this.st < this.move.w;
    // ter o golpe defendido (recoil) não abre a guarda: a abertura vem de aparar, esquivar ou quebrar a estabilidade
    const guarded = frontal && this.drawn && (this.state === 'move' || this.state === 'block' || this.state === 'recoil' || windup);
    if (guarded) {
      if (attacker && this.parryIntent === attacker.attackId) { this.parryIntent = -1; this.parryAnim = 0.3; return 'parry'; }
      this.push(from, 1.6);
      return 'block';
    }
    this.takeHit(from, true, t);
    return 'hit';
  }
  reset() {
    this.pos.copy(this.spawn); this.pos.y = terrain.heightAt(this.pos.x, this.pos.z); this.vel.set(0, 0, 0); this.yaw = Math.PI;
    this.health = this.maxHealth; this.stab = this.maxStab; this.decisive = false; this.setState('move'); this.syncRoot();
    this.brain = 'idle'; this.aware = false; this.drawn = false; this.riposteT = -1; this.nextAtkT = 0; this.chainQ.length = 0;
  }
  // escolha de golpe: pesos do tipo + correção pelos hábitos do jogador
  pickMove() {
    const a = this.type.adapt, w = {};
    for (const n of this.names) w[n] = this.type.moves[n] || 0;
    if (w.B !== undefined) w.B += Habits.early * 0.9 * a;      // quem apara cedo: golpes atrasados
    if (w.F !== undefined) w.F += Habits.early * 0.7 * a;
    if (w.G !== undefined) w.G += Habits.turtle * 1.2 * a;     // quem só defende: agarrão
    if (w.T !== undefined) w.T += Habits.turtle * 0.5 * a;
    const tot = Object.values(w).reduce((x, y) => x + y, 0);
    let r = rand() * tot;
    for (const n of this.names) { r -= w[n]; if (r <= 0) return n; }
    return this.names[0];
  }
  planChain(first) {
    this.chainQ.length = 0;
    if (first === 'A' && rand() < this.type.chain + Habits.dodge * 0.4 * this.type.adapt) {
      this.chainQ.push(this.names.includes('Q') && rand() < 0.5 ? 'Q' : 'A');
      if (this.type.label === 'Agressivo' && rand() < 0.5) this.chainQ.push('A');
    }
  }
  think(dt, t, player) {
    const it = this.it;
    it.atk = false; it.dodge = false; it.bPress = false; it.blockHeld = false; it.wx = 0; it.wz = 0; it.mag = 0; it.run = false; it.atkIndex = undefined; it.analog = 1;
    if (!this.alive) return it;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1, tx = dx / d, tz = dz / d;

    // lê a preparação do golpe do jogador e decide UMA vez: aparar, recuar ou só defender
    if (this.aware && player.state === 'attack' && player.attackId !== this.readId && d < 3.4) {
      this.readId = player.attackId;
      if ((this.state === 'move' || this.state === 'block') && this.drawn) {
        const m = player.move;
        const pc = this.type.parry * (m.rushed ? 3 : 1) * (m.strong ? 0.7 : 1) + Habits.spam * this.type.adapt;
        if (rand() < pc) this.parryIntent = player.attackId;
        else if (rand() < this.type.dodge) { it.dodge = true; it.wx = -tx; it.wz = -tz; it.mag = 1; return it; }
      }
    }
    const busy = ['attack', 'stagger', 'recoil', 'hurt', 'dodge', 'broken', 'down'].includes(this.state);
    if (this.brain !== 'attack' && busy) return it;
    this.bt += dt;
    if (!player.alive) { it.blockHeld = this.drawn; return it; }

    // jogador sem equilíbrio: quem estiver perto pune
    if (player.state === 'broken' && d < 3.3 && this.brain !== 'attack' && !Director.attacker) {
      Director.take(this); this.brain = 'attack'; this.bt = 0; this.attacked = false; this.chosen = this.moveIndex(this.names.includes('A') ? 'A' : this.names[0]); this.chainQ.length = 0;
    }
    switch (this.brain) {
      case 'idle':
        if (this.aware) { this.draw(); this.brain = 'approach'; this.bt = 0; }
        break;
      case 'approach':
        it.wx = tx; it.wz = tz; it.mag = 1; it.run = d > 8; it.blockHeld = d < 5.5 && !it.run;
        if (d < this.type.circle + 0.5) { this.brain = 'circle'; this.bt = 0; }
        break;
      case 'circle': {
        if (this.bt > this.flipT) { this.circleDir *= -1; this.flipT = this.bt + 1.4 + rand() * 1.8; }
        const R = this.type.circle, radial = d > R + 0.3 ? 0.9 : d < R - 0.5 ? -0.9 : 0;
        let wx = -tz * this.circleDir * 0.6 + tx * radial, wz = tx * this.circleDir * 0.6 + tz * radial;
        const l = Math.hypot(wx, wz) || 1; it.wx = wx / l; it.wz = wz / l; it.mag = 1;
        it.blockHeld = true;
        if (d > 7) { this.brain = 'approach'; break; }
        const riposte = this.riposteT > 0 && t >= this.riposteT && !Director.attacker;
        if (riposte || Director.canAttack(this, t)) {
          Director.take(this); this.brain = 'attack'; this.bt = 0; this.attacked = false;
          const name = riposte ? (this.names.includes('Q') ? 'Q' : this.names.includes('A') ? 'A' : this.names[0]) : this.pickMove();
          this.chosen = this.moveIndex(name); this.riposteT = -1;
          this.planChain(name);
        }
        break;
      }
      case 'attack': {
        if (['stagger', 'recoil', 'hurt', 'broken', 'down'].includes(this.state)) { Director.release(this, t); this.brain = 'circle'; this.bt = 0; this.chainQ.length = 0; break; }
        if (this.state === 'attack') { if (this.chainQ.length && this.st > this.move.w) it.atk = true; break; }
        if (this.attacked) { Director.release(this, t); this.brain = 'reposition'; this.bt = 0; break; }
        const mv = this.moveset[this.chosen];
        const reach = mv.sig === 'red' && !mv.grab ? 3.4 : mv.grab ? 1.9 : 2.15;
        if (d > reach && this.bt < 1.6) { it.wx = tx; it.wz = tz; it.mag = 1; it.blockHeld = true; }
        else { it.atk = true; it.atkIndex = this.chosen; this.attacked = true; }
        break;
      }
      case 'reposition':
        it.wx = -tx; it.wz = -tz; it.mag = 0.8; it.blockHeld = this.bt > 0.3;
        if (this.bt > 0.6) { this.brain = 'circle'; this.bt = 0; }
        break;
    }
    return it;
  }
  tick(dt, t, player) { return this.update(dt, t, this.think(dt, t, player), [player]); }
}
