import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { GLINT, _up, _v, _v2 } from '../combat/moves.js';
import { Stats, buzz } from '../combat/state.js';
import { Time } from '../core/time.js';
import { angDiff, clamp, damp, easeOut, lerp, rand, segSeg } from '../core/util.js';
import { sparks, splinters } from '../fx/fx.js';
import { Fx } from '../game/camera.js';
import { Training } from '../game/training.js';
import { scene } from '../render/renderer.js';
import { UI } from '../ui/ui.js';
import { colliders } from '../world/props.js';
import { terrain, withBacklight } from '../world/world.js';

/* ================================================================
   BONECO DE TREINO — poste giratório (quintana) com braço de ponta de ferro
   ================================================================ */
export class Dummy {
  constructor(x, z) {
    this.pos = new THREE.Vector3(x, terrain.heightAt(x, z), z);
    this.facing = Math.PI; this.state = 'idle'; this.st = 0; this.timer = 1.5;
    this.armA = -1.0; this.contactA = 0; this.sig = null; this.contactDone = false; this.glinted = false;
    this.wob = { x: 0, z: 0, vx: 0, vz: 0 }; this.mode = 'off';
    colliders.push({ x, z, r: 0.3, top: this.pos.y + 2 });
    this.build();
  }
  build() {
    const M = (c) => new THREE.MeshLambertMaterial({ color: c });
    const wood = M(0x4a3522), straw = withBacklight(new THREE.MeshLambertMaterial({ color: 0x8d7240 }), 0.4), rope = M(0x2a2116), iron = M(0x2d2d2f);
    const add = (p, g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
    this.root = new THREE.Group(); this.root.position.copy(this.pos);
    add(this.root, new THREE.CylinderGeometry(0.5, 0.6, 0.18, 9), M(0x4a4640), 0, 0.02, 0);
    this.tilt = new THREE.Group(); this.root.add(this.tilt);
    add(this.tilt, new THREE.CylinderGeometry(0.09, 0.11, 2.1, 9), wood, 0, 1.05, 0);
    add(this.tilt, new THREE.CylinderGeometry(0.23, 0.25, 0.85, 12), straw, 0, 1.55, 0);
    [1.25, 1.85].forEach((y) => add(this.tilt, new THREE.TorusGeometry(0.245, 0.02, 6, 16).rotateX(Math.PI / 2), rope, 0, y, 0));
    add(this.tilt, new THREE.SphereGeometry(0.16, 10, 8), straw, 0, 2.08, 0);
    this.arm = new THREE.Group(); this.arm.position.y = 1.18; this.tilt.add(this.arm);
    add(this.arm, new THREE.CylinderGeometry(0.035, 0.04, 1.75, 7).rotateX(Math.PI / 2), wood, 0, 0, -0.9);
    this.pad = add(this.arm, new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8).rotateX(Math.PI / 2), iron, 0, 0, -1.72);
    add(this.arm, new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6).rotateX(Math.PI / 2), wood, 0, 0, 0.22);
    add(this.arm, new THREE.SphereGeometry(0.1, 8, 6), M(0x4a4640), 0, 0, 0.45);
    const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 5, 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.glint = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), gm);
    this.glint.position.set(0, 0.02, -1.82); this.glint.scale.setScalar(0.001); this.arm.add(this.glint);
    scene.add(this.root);
  }
  setState(s) { this.state = s; this.st = 0; }
  update(dt, t, player) {
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(-dx, -dz);
    if (this.state === 'idle' || this.state === 'windup') this.facing += clamp(angDiff(this.facing, want), -1.1 * dt, 1.1 * dt);
    const rel = angDiff(this.facing, want);
    const REST = -1.0, COCK = -2.45, END = 2.5;
    this.st += dt;
    switch (this.state) {
      case 'idle':
        this.armA = damp(this.armA, REST, 4, dt);
        this.timer -= dt;
        if (this.mode !== 'off' && this.timer <= 0 && dist < 2.35 && player.alive && player.state !== 'down') {
          const r = rand();
          this.sig = this.mode === 'blue' ? 'blue' : this.mode === 'red' ? 'red' : this.mode === 'mix' ? (r < 0.2 ? 'blue' : r < 0.4 ? 'red' : null) : null;
          this.glint.material.color.copy(GLINT[this.sig || 'red']);
          this.glinted = false; this.contactDone = false;
          Sound.creak(this.sig ? 1.0 : 0.6);
          this.setState('windup');
        }
        break;
      case 'windup': {
        const dur = this.sig ? 1.05 : 0.62;
        this.armA = lerp(REST, COCK, easeOut(Math.min(1, this.st / dur)));
        if (this.sig && !this.glinted && this.st >= dur - 0.36) { this.glinted = true; Sound.glint(this.sig); this.glintT = 0; }
        if (this.st >= dur) { this.setState('swing'); this.prevA = COCK; }
        break;
      }
      case 'swing': {
        const dur = 0.19;
        this.armA = lerp(COCK, END, Math.min(1, this.st / dur));
        if (!this.contactDone && this.prevA < rel && this.armA >= rel) {
          this.contactDone = true;
          if (dist > 0.3 && dist < 2.45) this.contact(player, t);
          else if (this.sig && t - player.lastDodgeT < 0.8) { Training.add('dodge'); UI.flash('Esquivou'); }
        }
        this.prevA = this.armA;
        if (this.st >= dur) this.setState('recover');
        break;
      }
      case 'recover':
        this.armA = damp(this.armA, REST, 3, dt);
        if (this.st > 0.7) { this.timer = 1.1 + rand() * 0.9; this.setState('idle'); }
        break;
      case 'stun': {
        const k = Math.min(1, this.st / 0.35);
        this.armA = lerp(this.contactA, this.contactA - 2.6, easeOut(k)) + Math.sin(this.st * 9) * 0.08 * (1 - k);
        if (this.st > 1.4) this.setState('recover');
        break;
      }
    }
    if (this.glintT !== undefined) {
      this.glintT += dt;
      const g = this.glintT < 0.34 ? Math.sin((this.glintT / 0.34) * Math.PI) : 0;
      this.glint.scale.setScalar(Math.max(0.001, g * 1.4));
      if (this.glintT > 0.4) this.glintT = undefined;
    }
    const w = this.wob;
    w.vx += (-60 * w.x - 5 * w.vx) * dt; w.vz += (-60 * w.z - 5 * w.vz) * dt;
    w.x += w.vx * dt; w.z += w.vz * dt;
    this.root.rotation.y = this.facing;
    this.tilt.rotation.set(w.x, 0, w.z);
    this.arm.rotation.y = this.armA;
  }
  contact(player, t) {
    const res = player.receiveAttack({ sig: this.sig, from: this.pos, lethal: false, src: 'boneco', t });
    const padW = this.pad.getWorldPosition(new THREE.Vector3());
    if (res === 'parry') {
      this.contactA = this.armA; this.setState('stun');
      sparks.emit(padW, _up, 34, 7, 0.9, 0.5);
      Sound.clang('parry'); Time.freeze(0.09); Time.slow(0.3, 0.32); Fx.shake(0.45); Fx.punch(4); player.gainStab(10); buzz(28); UI.good(); player.lastParryT = t;
      this.impulse(player.pos, 0.9); UI.flash('Aparado'); Stats.parries++;
      Training.add('parry'); Training.add('block');
    } else if (res === 'block') {
      this.state = 'recover'; this.st = 0; this.armA -= 0.5;
      sparks.emit(padW, _up, 12, 4, 0.8, 0.35);
      Sound.clang('block'); Time.freeze(0.05); Fx.shake(0.22); player.loseStab(16, t);
      Training.add('block');
    } else if (res === 'dodge' || res === 'pdodge') {
      Time.slow(0.4, 0.3); UI.flash(res === 'pdodge' ? 'Esquiva perfeita' : 'Esquivou');
      if (res === 'pdodge' && player.gainFocus) { player.gainFocus(); Training.add('pfocus'); }
      if (this.sig) Training.add('dodge');
    } else if (res === 'hit') {
      Time.freeze(0.07); Fx.shake(0.6);
    }
  }
  impulse(fromPos, k) {
    const dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z, l = Math.hypot(dx, dz) || 1;
    const c = Math.cos(this.facing), s = Math.sin(this.facing);
    const lx = (dx / l) * c - (dz / l) * s, lz = (dx / l) * s + (dz / l) * c;
    this.wob.vx += -lz * 2.2 * k; this.wob.vz += lx * 2.2 * k;
  }
  hitTest(b, tip) {
    _v.set(this.pos.x, this.pos.y + 0.3, this.pos.z); _v2.set(this.pos.x, this.pos.y + 2.05, this.pos.z);
    const out = new THREE.Vector3();
    return segSeg(b, tip, _v, _v2, out) < 0.26 ? out : null;
  }
  onHit({ point, from, move, t }) {
    const strong = !!move.strong;
    const counter = this.state === 'stun';
    const dir = new THREE.Vector3(this.pos.x - from.x, 0.4, this.pos.z - from.z).normalize();
    splinters.emit(point, dir, counter ? 22 : 10, counter ? 5 : 3.5, 0.8, 0.7);
    Sound.thunk(counter ? 1.5 : strong ? 1.15 : 1);
    this.impulse(from, counter ? 1.4 : strong ? 0.8 : 0.5);
    if (counter) {
      Time.freeze(0.12); Time.slow(0.35, 0.35); Fx.shake(0.55); UI.flash('Contra-ataque');
      this.setState('recover');
      Training.add('counter');
    } else { Time.freeze(strong ? 0.07 : 0.05); Fx.shake(strong ? 0.28 : 0.16); }
    Training.add('hit');
    if (strong) Training.add('strong');
  }
}
