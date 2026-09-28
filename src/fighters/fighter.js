import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { Combat } from '../combat/combat.js';
import { COUNTER, GLINT, P, POSE, RUSH, STRONG, WEAPONS, _b, _c, _down, _e, _m4, _one, _q, _t, _up, _v, _v2, lerpPose, movePose } from '../combat/moves.js';
import { Bind } from '../combat/bind.js';
import { Mastery, Rules } from '../combat/rules.js';
import { FIGHTERS, Habits, Report, Stats } from '../combat/state.js';
import { CFG } from '../core/config.js';
import { angDiff, clamp, damp, easeInOut, easeOut, lerp, segSeg, smooth, yawTo } from '../core/util.js';
import { createAnimController } from '../anim/index.js';
import { Trail, dustFx } from '../fx/fx.js';
import { Fx } from '../game/camera.js';
import { scene } from '../render/renderer.js';
import { UI } from '../ui/ui.js';
import { BLOB_GEO, BLOB_TEX, colliders } from '../world/props.js';
import { terrain, withBacklight, withRim } from '../world/world.js';

/* ================================================================
   LUTADOR — corpo, estabilidade e máquina de estados, comum a todos.
   Quem controla (teclado/toque ou IA) só entrega um "intent" por quadro.
   ================================================================ */
const _cb1 = new THREE.Vector3(), _ct1 = new THREE.Vector3(), _cp1 = new THREE.Vector3(), _pose1 = {};
export class Fighter {
  constructor(o) {
    this.isPlayer = !!o.isPlayer; this.moveset = o.moveset; this.speeds = o.speeds;
    this.maxHealth = o.health; this.health = o.health;
    this.maxStab = o.stab; this.stab = o.stab; this.lastStabLoss = -99; this.brokenDur = o.brokenDur || 1.2;
    this.turnRate = o.turnRate || CFG.player.turnRate;
    this.pos = o.pos.clone(); this.pos.y = terrain.heightAt(this.pos.x, this.pos.z);
    this.vel = new THREE.Vector3(); this.yaw = o.yaw || 0;
    this.turnVel = 0; this.phase = 0; this.lean = 0; this.roll = 0; this.twist = 0;
    this.prevSpeed = 0; this.accelF = 0; this.lastStep = 0;
    this.state = 'move'; this.st = 0; this.staggerDur = 1; this.downDur = 2;
    this.drawn = false; this.drawT = 1; this.lastCombatT = -99;
    this.combo = 0; this.lastAtkEnd = -99; this.queued = false; this.hitSet = new Set(); this.attackId = 0;
    this.lastBlockPress = -99; this.parryOpen = false; this.parryAnim = 0;
    this.dodgeDir = new THREE.Vector2(); this.dodgeReadyAt = 0; this.lastDodgeT = -99; this.pendingAtk = -99; this.dodgeChain = -9;
    this.lastHitT = -99; this.pushDir = new THREE.Vector2();
    this.target = null; this.targetDist = 99; this.glintT = -1; this.ritualT = -1;
    this.swordPose = { ...POSE.draw };
    this.weapon = WEAPONS[o.weapon || 'katana']; this.weaponKind = o.weapon || 'katana'; this.shield = !!o.shield;
    this.bindWith = null; this.hitDir = new THREE.Vector2(); this.prevTip = new THREE.Vector3(); this.hasPrevTip = false;
    this.trail = new Trail();
    // o corpo e a animação ficam no controlador (procedural hoje; modelo 3D quando houver)
    this.anim = createAnimController(this, o.look || {});
    FIGHTERS.push(this);
  }
  get alive() { return this.state !== 'dead'; }
  syncRoot() {
    if (this.anim && this.anim.reset) this.anim.reset();
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; this.body.rotation.x = 0;
    this.root.updateMatrixWorld(true); this.cloth.reset();
  }
  setState(s) { this.state = s; this.st = 0; }
  draw() { if (this.drawn) return; this.drawn = true; this.drawT = 0; this.swordPose = { ...POSE.draw }; if (this.isPlayer) Sound.draw(); }
  sheathe() { if (!this.drawn) return; this.drawn = false; this.ritualT = -1; if (this.isPlayer) Sound.sheath(); }
  ritual() { if (this.drawn && this.alive) { this.ritualT = 0; this.ritualFrom = { ...this.swordPose }; } }
  chainNext() { return -1; }

  // ---------- estabilidade ----------
  loseStab(n, t) {
    if (!this.alive || this.state === 'broken' || n <= 0) return;
    this.stab -= n; this.lastStabLoss = t;
    if (this.stab <= 0) this.breakStance(t);
  }
  gainStab(n) { this.stab = Math.min(this.maxStab, this.stab + n); }
  breakStance(t) {
    this.stab = 0; this.setState('broken');
    Sound.breakGuard(); Fx.shake(0.3);
    UI.flash(this.isPlayer ? 'Sem equilíbrio' : 'Desequilibrado');
    this.onBroken(t);
  }
  onBroken() {}
  regenStab(dt, t) {
    if (!this.alive || ['broken', 'attack', 'hurt', 'stagger', 'recoil', 'down', 'bind', 'breathe'].includes(this.state)) return;
    if (t - this.lastStabLoss < (this.isPlayer ? 0.9 : 1.4)) return;
    let r;
    if (this.isPlayer) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      r = sp > this.speeds.walk + 0.5 ? 0 : (this.state === 'block' || sp < 0.4) ? 32 : this.drawn && this.target ? 24 : 14;
      r *= 1 + 0.3 * Mastery.lv('regen');
    } else r = this.type.regen;
    if (this.wounded) r *= 0.6; // ferido: respira pesado e se recompõe mais devagar
    this.stab = Math.min(this.maxStab, this.stab + r * dt);
  }

  startAttack(i, t) {
    this.draw();
    this.combo = i; this.move = this.moveset[i]; this.fromPose = { ...this.swordPose };
    this.fromFeint = false; this.hitSet.clear(); this.queued = false; this.swooshed = false; this.glinted = false; this.feinted = false; this.charged = false;
    this.lastCombatT = t; this.attackId++;
    if (this.move.sig) this.glint.material.color.copy(GLINT[this.move.sig]);
    if (!this.isPlayer) Sound.cloth();
    this.setState('attack');
  }
  startDodge(wx, wz, hasInput, t) {
    if (hasInput) this.dodgeDir.set(wx, wz); else this.dodgeDir.set(Math.sin(this.yaw), Math.cos(this.yaw));
    if (t - this.dodgeChain < 0.55) this.loseStab(12, t); // esquivar sem parar cansa
    this.dodgeChain = t; this.lastDodgeT = t; this.lastCombatT = t;
    Sound.dodge();
    dustFx.emit(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z), _up, 6, 0.8, 1, 0.7);
    this.setState('dodge');
  }
  push(from, k) {
    const bx = this.pos.x - from.x, bz = this.pos.z - from.z, bl = Math.hypot(bx, bz) || 1;
    this.pushDir.set(bx / bl, bz / bl); this.vel.x += (bx / bl) * k; this.vel.z += (bz / bl) * k;
  }
  stagger(dur, from) { if (!this.alive || this.state === 'broken') return; this.staggerDur = dur; if (from) this.push(from, 1.5); this.setState('stagger'); }
  recoil(from) { if (!this.alive || this.state === 'broken') return; this.push(from, 1.8); this.setState('recoil'); }
  get wounded() { return this.alive && this.health < this.maxHealth; }
  // empurrão na direção do golpe: mistura "para longe do atacante" com o movimento da lâmina
  pushBlow(from, dir, k) {
    const bx = this.pos.x - from.x, bz = this.pos.z - from.z, bl = Math.hypot(bx, bz) || 1;
    let px = bx / bl, pz = bz / bl;
    if (dir && (dir.x || dir.y)) { px = px * 0.45 + dir.x * 0.55; pz = pz * 0.45 + dir.y * 0.55; const l = Math.hypot(px, pz) || 1; px /= l; pz /= l; }
    this.pushDir.set(px, pz); this.vel.x += px * k; this.vel.z += pz * k;
  }
  takeHit(from, lethal, t, knock, dir) {
    this.health = Math.max(0, this.health - 1); this.lastHitT = t; this.lastCombatT = t;
    this.pushBlow(from, dir, 1.4);
    if (this.health <= 0) {
      if (lethal) { this.die(t); return; }
      this.downDur = 2; this.downRestore = true; this.setState('down');
      if (this.isPlayer) UI.flash('Derrubado');
    } else {
      this.loseStab(30, t);
      if (knock) { this.downDur = 1.1; this.downRestore = false; this.setState('down'); }
      else if (this.state !== 'broken') this.setState('hurt');
    }
    if (this.isPlayer) { Sound.hurt(); UI.hurt(); }
  }
  die(t) { this.setState('dead'); this.trail.alpha = 0; Sound.fall(); }
  hitTest(b, tip) {
    if (!this.alive || this.state === 'down') return null;
    _v.set(this.pos.x, this.pos.y + 0.25, this.pos.z); _v2.set(this.pos.x, this.pos.y + 1.65, this.pos.z);
    const out = new THREE.Vector3();
    return segSeg(b, tip, _v, _v2, out) < 0.3 ? out : null;
  }
  onHit({ point, attacker, move, t, dir }) {
    const res = this.receiveAttack({ sig: move.sig, grab: move.grab, bash: move.bash, thrust: move.thrust, sweep: move.sweep, move, dir, from: attacker.pos, attacker, src: attacker.type ? attacker.type.label : 'jogador', lethal: true, t });
    Combat.resolve(attacker, this, res, point, t, move);
  }

  update(dt, t, it, targets) {
    const C = this.speeds, K = CFG.combat;
    if (it.bPress) { if (this.isPlayer) Report.latePress(t); this.parryOpen = t - this.lastBlockPress > K.parryRearm; this.lastBlockPress = t; this.lastCombatT = t; }
    if (it.atk && this.state === 'dodge') this.pendingAtk = t;

    this.target = null; this.targetDist = K.stanceRange;
    for (const tg of targets) {
      if (tg.alive === false) continue;
      const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z);
      if (d < this.targetDist) { this.targetDist = d; this.target = tg; }
    }
    // mira travada: o alvo escolhido manda, mesmo mais longe que o alcance normal
    const ft = this.forcedTarget;
    if (ft && ft.alive !== false) { this.target = ft; this.targetDist = Math.hypot(ft.pos.x - this.pos.x, ft.pos.z - this.pos.z); }
    const wx = it.wx, wz = it.wz, hasDir = it.mag > 0.05;
    const prevSt = this.st;
    this.st += dt;
    let tvx = 0, tvz = 0, faceYaw = null, turnK = 1, accelK = CFG.player.accel;
    const speedNow = Math.hypot(this.vel.x, this.vel.z);

    switch (this.state) {
      case 'move':
      case 'block': {
        if (this.state === 'move' && it.blockHeld) { this.draw(); this.setState('block'); }
        else if (this.state === 'block' && !it.blockHeld) this.setState('move');
        if (it.atk || t - this.pendingAtk < 0.2) {
          this.pendingAtk = -99;
          let i;
          if (it.atkIndex !== undefined) i = it.atkIndex;
          else if (this.isPlayer && t - (this.lastParryT || -9) < 0.65) { i = COUNTER; this.lastParryT = -9; }
          else if (this.isPlayer && it.run && speedNow > this.speeds.walk + 0.6) { i = RUSH; this.loseStab(22, t); if ((Stats.rushWarn = (Stats.rushWarn || 0) + 1) <= 2) UI.flash('Corte apressado'); }
          else i = t - this.lastAtkEnd < 0.45 && this.chainNext() >= 0 ? this.chainNext() : 0;
          if (this.state !== 'broken') { this.startAttack(i, t); if (this.isPlayer) Habits.onAttack(); }
          break;
        }
        if (it.dodge && t >= this.dodgeReadyAt) { this.startDodge(wx, wz, hasDir, t); if (this.isPlayer) Habits.onDodge(); break; }
        const blocking = this.state === 'block';
        const stance = this.drawn && this.target && !it.run;
        let sp = blocking ? C.block : it.run ? C.run : stance ? C.stance : C.walk;
        sp *= it.analog === undefined ? 1 : it.analog;
        tvx = hasDir ? wx * sp : 0; tvz = hasDir ? wz * sp : 0;
        accelK = Math.hypot(tvx, tvz) > speedNow ? CFG.player.accel : CFG.player.decel;
        if ((stance || blocking) && this.target) faceYaw = yawTo(this.pos, this.target.pos);
        else if (speedNow > 0.15) faceYaw = Math.atan2(-this.vel.x, -this.vel.z);
        break;
      }
      case 'attack': {
        const m = this.move, T = m.w + m.a + m.r, tt = this.st;
        if (it.atk && tt > 0.04) this.queued = true;
        // segurar o botão durante um golpe leve vira golpe forte
        if (this.isPlayer && m.light && !this.charged && tt >= 0.09 && tt < m.w && it.atkHeld) { this.charged = true; this.startAttack(STRONG, t); break; }
        // finta: sai de um golpe e entra em outro, com tremor como aviso
        if (m.feint && !this.feinted && tt >= m.feint.at) { this.feinted = true; Sound.feint(); this.startAttack(this.moveIndex(m.feint.into), t); this.fromFeint = true; break; }
        if (tt < m.w && this.target) { faceYaw = yawTo(this.pos, this.target.pos); turnK = this.isPlayer ? 3 : (tt < m.w * 0.6 ? 1.3 : 0.25); }
        const ls = m.w * (m.hold ? 0.8 : 0.4), le = m.w + m.a;
        if (tt > ls && tt < le) {
          let L = m.lunge;
          if (this.target && this.targetDist < 1.7) L *= clamp((this.targetDist - 0.9) / 0.8, 0, 1);
          const v = L / (le - ls);
          tvx = -Math.sin(this.yaw) * v; tvz = -Math.cos(this.yaw) * v; accelK = 30;
        } else accelK = 14;
        if (m.sig && !this.glinted && tt >= m.w - 0.38) { this.glinted = true; this.glintT = 0; Sound.glint(m.sig); }
        if (!this.swooshed && tt >= m.w * 0.85) { this.swooshed = true; Sound.swoosh(this.isPlayer ? (m.strong ? 1.3 : 1) : 0.85); }
        if (tt >= m.w + m.a) {
          if (it.dodge) { this.endAttack(t); this.startDodge(wx, wz, hasDir, t); break; }
          if (it.bPress) { this.endAttack(t); this.setState('block'); break; }
          const nx = this.chainNext();
          if (this.queued && nx >= 0 && tt >= m.w + m.a + 0.07) { this.endAttack(t, true); this.startAttack(nx, t); break; }
        }
        if (tt >= T) { this.endAttack(t); this.setState(it.blockHeld ? 'block' : 'move'); }
        break;
      }
      case 'dodge': {
        const D = K.dodge, v = ((D.dist * 2) / D.dur) * Math.max(0, 1 - this.st / D.dur);
        tvx = this.dodgeDir.x * v; tvz = this.dodgeDir.y * v; accelK = 60;
        if (this.st >= D.dur) { this.dodgeReadyAt = t + D.cooldown; this.setState(it.blockHeld ? 'block' : 'move'); }
        break;
      }
      case 'hurt': case 'stagger': case 'recoil': case 'broken': {
        const dur = this.state === 'hurt' ? 0.45 : this.state === 'recoil' ? 0.32 : this.state === 'broken' ? this.brokenDur : this.staggerDur;
        const k = Math.max(0, 1 - this.st / Math.min(dur, 0.45));
        tvx = this.pushDir.x * 2.6 * k; tvz = this.pushDir.y * 2.6 * k; accelK = 20;
        if (this.st >= dur) {
          if (this.state === 'broken') this.stab = this.maxStab * 0.45;
          this.setState(it.blockHeld ? 'block' : 'move');
        }
        break;
      }
      case 'down': {
        const k = Math.max(0, 1 - this.st / 0.4);
        tvx = this.pushDir.x * 3 * k; tvz = this.pushDir.y * 3 * k; accelK = 20;
        if (this.st >= this.downDur) { if (this.downRestore) { this.health = this.maxHealth; this.stab = this.maxStab; } this.setState('move'); }
        break;
      }
      case 'bind': {
        // espadas travadas: parado, encarando, empurrando (quem decide é o Bind)
        accelK = 20;
        if (this.bindWith) { faceYaw = yawTo(this.pos, this.bindWith.pos); turnK = 2; }
        if (this.isPlayer && it.atk) Bind.press(this);
        break;
      }
      case 'breathe': {
        // foco: uma respiração curta que devolve estabilidade, mas deixa exposto
        accelK = 16;
        this.gainStab((this.maxStab * Rules.FOCUS_GAIN * dt) / Rules.BREATHE);
        if (this.st >= Rules.BREATHE) this.setState(it.blockHeld ? 'block' : 'move');
        break;
      }
      case 'dead': {
        const k = Math.max(0, 1 - this.st / 0.5);
        tvx = this.pushDir.x * 2 * k; tvz = this.pushDir.y * 2 * k; accelK = 20;
        break;
      }
    }

    if (dt > 0) {
      this.vel.x = damp(this.vel.x, tvx, accelK, dt);
      this.vel.z = damp(this.vel.z, tvz, accelK, dt);
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const pr = CFG.player.radius;
      for (const c of colliders) {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z, rr = c.r + pr, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), p = rr - d; this.pos.x += (dx / d) * p; this.pos.z += (dz / d) * p; }
      }
      if (this.alive) for (const f of FIGHTERS) {
        if (f === this || !f.alive) continue;
        const dx = this.pos.x - f.pos.x, dz = this.pos.z - f.pos.z, rr = 0.72, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), p = (rr - d) * 0.5; this.pos.x += (dx / d) * p; this.pos.z += (dz / d) * p; }
      }
      const R = Math.hypot(this.pos.x, this.pos.z * 0.82);
      if (R > 300) { this.pos.x *= 300 / R; this.pos.z *= 300 / R; }
      this.pos.y = terrain.heightAt(this.pos.x, this.pos.z);
    }
    const prevYaw = this.yaw;
    if (faceYaw !== null && dt > 0) {
      const d = angDiff(this.yaw, faceYaw), tr = this.turnRate * turnK;
      this.yaw += clamp(d, -tr * dt, tr * dt) * Math.min(1, dt * 14 * turnK);
    }
    if (this.parryAnim > 0) this.parryAnim -= dt;
    if (this.glintT >= 0) { this.glintT += dt; if (this.glintT > 0.42) this.glintT = -1; }
    this.regenStab(dt, t);

    this.anim.update(dt, t, prevYaw);
    this.cloth.update(dt, t);
    if (this.state === 'attack' && this.st > prevSt) this.sampleBlade(prevSt, this.st, targets, t);
    this.trail.update(dt);
    return Math.hypot(this.vel.x, this.vel.z);
  }
  endAttack(t, chained) {
    this.lastAtkEnd = t;
    if (!chained && this.hitSet.size === 0) this.loseStab(this.isPlayer ? 6 : 10, t); // errar o golpe desequilibra um pouco
  }

  movePoseAt(m, st, from, o) { return movePose(m, st, from, o); }
  bladeWorld(pose, outB, outT) {
    _e.set(pose.pitch, pose.yaw, pose.roll, 'YXZ'); _q.setFromEuler(_e);
    _m4.compose(_v.set(pose.hx, pose.hy, pose.hz), _q, _one).premultiply(this.root.matrixWorld);
    outB.set(0, 0, -this.weapon.base).applyMatrix4(_m4); outT.set(0, 0, -this.weapon.tip).applyMatrix4(_m4);
  }
  sampleBlade(t0, t1, targets, now) {
    const m = this.move, a0 = m.w - 0.015, a1 = m.w + m.a + 0.05;
    if (t1 < a0 || t0 > a1) { this.hasPrevTip = false; return; }
    this.root.updateMatrixWorld(true);
    if (m.grab || m.bash) {
      // agarrão e empurrão de escudo: alcance do corpo, não da lâmina
      if (t1 >= m.w && t0 <= m.w + m.a) for (const tg of targets) {
        if (this.hitSet.has(tg) || !tg.alive) continue;
        const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z);
        if (d < (m.bash ? 1.55 : 1.45) && Math.abs(angDiff(this.yaw, yawTo(this.pos, tg.pos))) < 0.8) {
          this.hitSet.add(tg);
          tg.onHit({ point: _v.set(tg.pos.x, tg.pos.y + 1.2, tg.pos.z).clone(), attacker: this, move: m, t: now });
        }
      }
      return;
    }
    const n = clamp(Math.ceil((t1 - t0) / 0.005), 1, 16), pose = {};
    for (let k = 1; k <= n; k++) {
      const tt = t0 + ((t1 - t0) * k) / n;
      if (tt < a0 || tt > a1) continue;
      this.anim.bladeAt(m, tt, this.fromPose, _b, _t, pose);
      this.trail.push(_b, _t);
      // direção do golpe (movimento da ponta), usada para empurrar quem for atingido
      if (this.hasPrevTip) { const dx = _t.x - this.prevTip.x, dz = _t.z - this.prevTip.z, l = Math.hypot(dx, dz); if (l > 1e-4) this.hitDir.set(dx / l, dz / l); }
      this.prevTip.copy(_t); this.hasPrevTip = true;
      if (tt < m.w || tt > m.w + m.a || this.state !== 'attack') continue;
      for (const tg of targets) {
        if (this.hitSet.has(tg)) continue;
        // lâminas que se cruzam no meio de dois golpes travam (antes de chegar ao corpo)
        if (this.clashTest(tg, now)) { this.hitSet.add(tg); return; }
        const hit = tg.hitTest(_b, _t);
        // os dois golpes no mesmo instante, de frente: as lâminas se encontram e travam
        if (hit && this.simultaneous(tg) && Bind.start(this, tg, hit, now)) { this.hitSet.add(tg); tg.hitSet.add(this); return; }
        if (hit) { this.hitSet.add(tg); tg.onHit({ point: hit, from: this.pos, attacker: this, move: m, strong: !!m.strong, t: now, dir: this.hitDir }); }
      }
      if (this.state !== 'attack') return;
    }
  }
  simultaneous(tg) {
    const om = tg.move;
    if (tg.state !== 'attack' || !om || om.grab || om.bash || om.thrust || tg.hitSet.has(this)) return false;
    if (tg.st < om.w - 0.06 || tg.st > om.w + om.a) return false;
    return Math.abs(angDiff(tg.yaw, yawTo(tg.pos, this.pos))) < 0.9;
  }
  clashTest(tg, now) {
    const om = tg.move;
    if (tg.state !== 'attack' || !om || !tg.anim || om.grab || om.bash || tg.hitSet.has(this)) return false;
    if (tg.st < om.w * 0.8 || tg.st > om.w + om.a) return false;
    tg.anim.bladeAt(om, tg.st, tg.fromPose, _cb1, _ct1, _pose1);
    // as lâminas se cruzam de frente (tolerância de 30 cm: as duas estão em movimento)
    if (Math.abs(angDiff(tg.yaw, yawTo(tg.pos, this.pos))) > 1.0) return false;
    if (segSeg(_b, _t, _cb1, _ct1, _cp1) > 0.3) return false;
    tg.hitSet.add(this);
    return Bind.start(this, tg, _cp1, now);
  }

}
