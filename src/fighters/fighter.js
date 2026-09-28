import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { Combat } from '../combat/combat.js';
import { COUNTER, GLINT, P, POSE, RUSH, STRONG, _b, _c, _down, _e, _m4, _one, _q, _t, _up, _v, _v2, lerpPose, movePose } from '../combat/moves.js';
import { FIGHTERS, Habits, Report, Stats } from '../combat/state.js';
import { CFG } from '../core/config.js';
import { angDiff, clamp, damp, easeInOut, easeOut, lerp, segSeg, smooth, yawTo } from '../core/util.js';
import { Cloak } from './cloak.js';
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
    this.trail = new Trail();
    this.build(o.look || {});
    FIGHTERS.push(this);
  }
  get alive() { return this.state !== 'dead'; }
  build(look) {
    const L = Object.assign({ cloth: 0x141110, pants: 0x1f1a17, skin: 0x6b4a36, cloak: 0x141110, hat: 'kasa', hatColor: 0x8d7240, band: 0x7a1d12 }, look);
    const M = (c) => withRim(new THREE.MeshLambertMaterial({ color: c }));
    const cloth = M(L.cloth), pants = M(L.pants), skin = M(L.skin);
    const lacquer = M(0x100c0b), wrap = M(0x2a211a), brass = new THREE.MeshStandardMaterial({ color: 0x7a6436, metalness: 0.6, roughness: 0.45 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xd4d7da, metalness: 0.55, roughness: 0.28 });
    const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = 0.92; this.body.add(this.hips);
    this.legs = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.position.set(0.11 * s, 0, 0); this.hips.add(g);
      add(g, new THREE.CapsuleGeometry(0.075, 0.68, 4, 8), pants, 0, -0.46, 0);
      add(g, new THREE.BoxGeometry(0.1, 0.07, 0.24), M(0x0e0b09), 0, -0.88, -0.05);
      return g;
    });
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    add(this.torso, new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), cloth, 0, 0.34, 0);
    this.arms = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.position.set(0.23 * s, 0.56, 0); this.torso.add(g);
      add(g, new THREE.CapsuleGeometry(0.06, 0.5, 4, 8), cloth, 0, -0.3, 0);
      return g;
    });
    this.head = new THREE.Group(); this.head.position.y = 0.74; this.torso.add(this.head);
    add(this.head, new THREE.SphereGeometry(0.11, 16, 12), skin, 0, 0, 0);
    this.hat = new THREE.Group(); this.hat.position.y = 0.09; this.head.add(this.hat);
    if (L.hat === 'kasa') {
      const straw = withBacklight(new THREE.MeshLambertMaterial({ color: L.hatColor, side: THREE.DoubleSide }), 0.5);
      add(this.hat, new THREE.ConeGeometry(0.46, 0.2, 28, 1, true), straw, 0, 0.02, 0);
      add(this.hat, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), straw, 0, 0.13, 0);
    } else if (L.hat === 'jingasa') {
      add(this.hat, new THREE.ConeGeometry(0.36, 0.11, 24, 1, true), new THREE.MeshLambertMaterial({ color: L.hatColor, side: THREE.DoubleSide }), 0, -0.01, 0);
    } else {
      add(this.hat, new THREE.CylinderGeometry(0.035, 0.05, 0.12, 8), M(0x0c0a09), 0, 0.08, 0.03);
      add(this.hat, new THREE.TorusGeometry(0.108, 0.018, 6, 18).rotateX(Math.PI / 2), M(L.band), 0, -0.04, 0);
    }
    this.scab = new THREE.Group(); this.scab.position.set(-0.22, 0.02, 0.02); this.scab.rotation.set(0.42, 0, 0.1); this.hips.add(this.scab);
    add(this.scab, new THREE.CylinderGeometry(0.02, 0.018, 0.78, 8).rotateX(Math.PI / 2), lacquer, 0, 0, 0.32);
    this.hipHilt = new THREE.Group(); this.scab.add(this.hipHilt);
    add(this.hipHilt, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16).rotateX(Math.PI / 2), brass, 0, 0, -0.07);
    add(this.hipHilt, new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8).rotateX(Math.PI / 2), wrap, 0, 0, -0.21);
    this.sword = new THREE.Group(); this.root.add(this.sword);
    const bg = new THREE.BoxGeometry(0.008, 0.032, 0.86, 1, 1, 14); bg.translate(0, 0, -0.43);
    const bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const tt = clamp(-bp.getZ(i) / 0.86, 0, 1), w = tt > 0.9 ? 1 - ((tt - 0.9) / 0.1) * 0.85 : 1;
      bp.setY(i, bp.getY(i) * w + 0.035 * tt * tt);
    }
    bg.computeVertexNormals();
    add(this.sword, bg, steel, 0, 0, 0);
    add(this.sword, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16).rotateX(Math.PI / 2), brass, 0, 0, 0);
    add(this.sword, new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8).rotateX(Math.PI / 2), wrap, 0, 0, 0.14);
    const gm = new THREE.MeshBasicMaterial({ color: GLINT.red.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.glint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gm);
    this.glint.position.set(0, 0.03, -0.95); this.glint.scale.setScalar(0.001); this.sword.add(this.glint);
    this.sword.visible = false;
    scene.add(this.root);
    this.blob = new THREE.Mesh(BLOB_GEO, new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false, opacity: 0.55 }));
    this.blob.renderOrder = 1; scene.add(this.blob);
    this.cloth = new Cloak(this, L.cloak);
    this.syncRoot();
  }
  syncRoot() {
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
    if (!this.alive || ['broken', 'attack', 'hurt', 'stagger', 'recoil', 'down'].includes(this.state)) return;
    if (t - this.lastStabLoss < (this.isPlayer ? 0.9 : 1.4)) return;
    let r;
    if (this.isPlayer) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      r = sp > this.speeds.walk + 0.5 ? 0 : (this.state === 'block' || sp < 0.4) ? 32 : this.drawn && this.target ? 24 : 14;
    } else r = this.type.regen;
    this.stab = Math.min(this.maxStab, this.stab + r * dt);
  }

  startAttack(i, t) {
    this.draw();
    this.combo = i; this.move = this.moveset[i]; this.fromPose = { ...this.swordPose };
    this.hitSet.clear(); this.queued = false; this.swooshed = false; this.glinted = false; this.feinted = false; this.charged = false;
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
  takeHit(from, lethal, t, knock) {
    this.health = Math.max(0, this.health - 1); this.lastHitT = t; this.lastCombatT = t;
    this.push(from, 0);
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
  onHit({ point, attacker, move, t }) {
    const res = this.receiveAttack({ sig: move.sig, grab: move.grab, from: attacker.pos, attacker, src: attacker.type ? attacker.type.label : 'jogador', lethal: true, t });
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
        if (m.feint && !this.feinted && tt >= m.feint.at) { this.feinted = true; Sound.feint(); this.startAttack(this.moveIndex(m.feint.into), t); break; }
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

    this.animate(dt, t, prevYaw);
    this.cloth.update(dt, t);
    if (this.state === 'attack' && this.st > prevSt) this.sampleBlade(prevSt, this.st, targets, t);
    this.trail.update(dt);
    return Math.hypot(this.vel.x, this.vel.z);
  }
  endAttack(t, chained) {
    this.lastAtkEnd = t;
    if (!chained && this.hitSet.size === 0) this.loseStab(this.isPlayer ? 6 : 10, t); // errar o golpe desequilibra um pouco
  }

  bladeWorld(pose, outB, outT) {
    _e.set(pose.pitch, pose.yaw, pose.roll, 'YXZ'); _q.setFromEuler(_e);
    _m4.compose(_v.set(pose.hx, pose.hy, pose.hz), _q, _one).premultiply(this.root.matrixWorld);
    outB.set(0, 0, -0.16).applyMatrix4(_m4); outT.set(0, 0, -0.98).applyMatrix4(_m4);
  }
  sampleBlade(t0, t1, targets, now) {
    const m = this.move, a0 = m.w - 0.015, a1 = m.w + m.a + 0.05;
    if (t1 < a0 || t0 > a1) return;
    this.root.updateMatrixWorld(true);
    if (m.grab) {
      // agarrão: alcance do corpo, não da lâmina
      if (t1 >= m.w && t0 <= m.w + m.a) for (const tg of targets) {
        if (this.hitSet.has(tg) || !tg.alive) continue;
        const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z);
        if (d < 1.45 && Math.abs(angDiff(this.yaw, yawTo(this.pos, tg.pos))) < 0.8) {
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
      movePose(m, tt, this.fromPose, pose);
      this.bladeWorld(pose, _b, _t);
      this.trail.push(_b, _t);
      if (tt < m.w || tt > m.w + m.a || this.state !== 'attack') continue;
      for (const tg of targets) {
        if (this.hitSet.has(tg)) continue;
        const hit = tg.hitTest(_b, _t);
        if (hit) { this.hitSet.add(tg); tg.onHit({ point: hit, from: this.pos, attacker: this, move: m, strong: !!m.strong, t: now }); }
      }
    }
  }
  animate(dt, t, prevYaw) {
    const C = this.speeds;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (dt > 0) {
      this.turnVel = damp(this.turnVel, angDiff(prevYaw, this.yaw) / dt, 10, dt);
      this.accelF = damp(this.accelF, (speed - this.prevSpeed) / dt, 8, dt);
    }
    this.prevSpeed = speed;
    const sn = speed / C.run, walkN = Math.min(1, speed / C.walk);
    const inDodge = this.state === 'dodge', dead = this.state === 'dead';
    this.phase += dt * speed * (speed > C.walk + 0.5 ? 2.0 : 2.5) * (inDodge || dead ? 0.3 : 1);
    const stepIdx = Math.floor(this.phase / Math.PI);
    if (stepIdx !== this.lastStep && speed > 0.6 && !inDodge) {
      this.lastStep = stepIdx;
      if (this.isPlayer) Sound.step(terrain.nearest(this.pos.x, this.pos.z).d < 1.3, speed > C.walk + 0.5);
    }
    const sw = Math.sin(this.phase), amp = dead ? 0 : lerp(0.45, 0.8, smooth(C.walk, C.run, speed)) * walkN;
    this.legs[0].rotation.x = sw * amp; this.legs[1].rotation.x = -sw * amp;

    let crouch = 0, leanX = sn * 0.2 + clamp(this.accelF, -4, 4) * 0.02, rollT = clamp(-this.turnVel * speed * 0.02, -0.18, 0.18), twistT = 0;
    if (this.state === 'attack') {
      const m = this.move, tt = this.st;
      twistT = clamp(this.swordPose.yaw * 0.28, -0.55, 0.55);
      if (tt > m.w && tt < m.w + m.a + 0.1) leanX += 0.22;
      if (tt < m.w && m.heavy) crouch = 0.1 * Math.min(1, tt / m.w); else crouch = 0.05;
    } else if (this.state === 'block') { twistT = 0.2; crouch = 0.06; }
    else if (inDodge) {
      const k = Math.sin(Math.PI * clamp(this.st / CFG.combat.dodge.dur, 0, 1));
      crouch = 0.16 * k;
      const lx = this.dodgeDir.x * Math.cos(this.yaw) - this.dodgeDir.y * Math.sin(this.yaw);
      const lz = this.dodgeDir.x * Math.sin(this.yaw) + this.dodgeDir.y * Math.cos(this.yaw);
      leanX += -lz * 0.35 * k; rollT += -lx * 0.3 * k;
    } else if (this.state === 'hurt' || this.state === 'recoil') { leanX -= 0.35 * Math.max(0, 1 - this.st / 0.4); }
    else if (this.state === 'stagger') { leanX -= 0.3; rollT += Math.sin(this.st * 7) * 0.08; crouch = 0.08; }
    else if (this.state === 'broken') { leanX -= 0.42; rollT += Math.sin(this.st * 5) * 0.14; crouch = 0.18; }
    else if (this.drawn && this.target) crouch = 0.05;

    this.hips.position.y = 0.92 - crouch - Math.abs(Math.cos(this.phase)) * 0.035 * walkN + Math.sin(t * 1.8) * 0.004 * (1 - walkN);
    this.lean = damp(this.lean, leanX, 10, dt); this.roll = damp(this.roll, rollT, 10, dt); this.twist = damp(this.twist, twistT, 18, dt);
    this.torso.rotation.set(-this.lean, this.twist, this.roll);
    this.head.rotation.set(this.lean * 0.6, -this.twist * 0.6, 0);
    this.hat.rotation.set(Math.sin(this.phase * 2) * 0.02 * walkN, 0, Math.sin(this.phase) * 0.015 * walkN);
    let fallT = 0;
    if (this.state === 'down') fallT = this.st < 1.5 ? 1.35 : 1.35 * Math.max(0, 1 - (this.st - 1.5) / 0.45);
    if (dead) fallT = 1.45;
    this.body.rotation.x = damp(this.body.rotation.x, fallT, (this.state === 'down' && this.st < 1.5) || dead ? 7 : 12, dt);

    this.hipHilt.visible = !this.drawn; this.sword.visible = this.drawn && !dead;
    if (this.drawn && this.ritualT >= 0 && this.state === 'move') {
      // sacode o sangue da lâmina, segura, e guarda devagar
      this.ritualT += dt;
      const r = this.ritualT, FLICK = P(0.55, 1.02, -0.38, -2.3, -0.3, -1.3);
      if (r < 0.22) lerpPose(this.ritualFrom, FLICK, easeOut(r / 0.22), this.swordPose);
      else if (r < 0.62) lerpPose(FLICK, FLICK, 0, this.swordPose);
      else lerpPose(FLICK, POSE.draw, easeInOut(Math.min(1, (r - 0.62) / 0.42)), this.swordPose);
      if (r > 0.05 && !this.ritualSw) { this.ritualSw = true; Sound.swoosh(0.55); }
      if (r >= 1.04) { this.ritualSw = false; this.sheathe(); }
    } else if (this.ritualT >= 0 && this.state !== 'move') this.ritualT = -1;
    if (this.drawn) {
      if (this.ritualT >= 0) {}
      else if (this.state === 'attack') movePose(this.move, this.st, this.fromPose, this.swordPose);
      else {
        let tp = POSE.guard;
        if (this.state === 'block') tp = this.parryAnim > 0.16 ? POSE.parry : POSE.block;
        else if (this.state === 'hurt' || this.state === 'down' || this.state === 'recoil') tp = POSE.hurt;
        else if (this.state === 'stagger') tp = POSE.stun;
        else if (this.state === 'broken') tp = POSE.broken;
        const g = { ...tp };
        if (tp === POSE.guard) { g.yaw += Math.sin(t * 1.3 + this.pos.x) * 0.03; g.pitch += Math.sin(t * 0.9) * 0.02; g.hy += Math.sin(this.phase * 2) * 0.012 * walkN; }
        lerpPose(this.swordPose, g, 1 - Math.exp(-dt * (this.parryAnim > 0 ? 40 : 22)), this.swordPose);
      }
      if (this.drawT < 1) this.drawT = Math.min(1, this.drawT + dt / 0.2);
      const sp = this.drawT < 1 ? lerpPose(POSE.draw, this.swordPose, easeOut(this.drawT)) : this.swordPose;
      _e.set(sp.pitch, sp.yaw, sp.roll, 'YXZ');
      this.sword.position.set(sp.hx, sp.hy - (0.92 - this.hips.position.y), sp.hz);
      this.sword.quaternion.setFromEuler(_e);
    }
    const gk = this.glintT >= 0 ? Math.sin(Math.min(1, this.glintT / 0.38) * Math.PI) : 0;
    this.glint.scale.setScalar(Math.max(0.001, gk * 1.1));
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    const lying = dead || this.state === 'down';
    this.blob.position.set(this.pos.x - Math.sin(this.yaw) * (lying ? 0.7 : 0), this.pos.y + 0.03, this.pos.z - Math.cos(this.yaw) * (lying ? 0.7 : 0));
    this.blob.scale.set(lying ? 1.3 : 1.05, 1, lying ? 2.0 : 1.05);
    this.blob.rotation.y = this.yaw;

    if (this.drawn && !dead) {
      const hand = this.sword.getWorldPosition(_v);
      const back = _v2.set(0, 0, 0.17).applyMatrix4(this.sword.matrixWorld);
      [[this.arms[1], hand], [this.arms[0], back]].forEach(([arm, w]) => {
        const local = arm.parent.worldToLocal(_c.copy(w)).sub(arm.position);
        if (local.lengthSq() > 1e-6) arm.quaternion.setFromUnitVectors(_down, local.normalize());
      });
    } else {
      this.arms[0].quaternion.setFromEuler(_e.set(-sw * amp * 0.5, 0, 0, 'XYZ'));
      this.arms[1].quaternion.setFromEuler(_e.set(sw * amp * 0.5, 0, 0, 'XYZ'));
    }
  }
}
