import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { GLINT, P, POSE, _c, _down, _e, _v, _v2, lerpPose, movePose } from '../combat/moves.js';
import { CFG } from '../core/config.js';
import { angDiff, clamp, damp, easeInOut, easeOut, lerp, smooth } from '../core/util.js';
import { Cloak } from '../fighters/cloak.js';
import { scene } from '../render/renderer.js';
import { BLOB_GEO, BLOB_TEX } from '../world/props.js';
import { terrain, withBacklight, withRim } from '../world/world.js';
import { AnimationController } from './controller.js';

/* ================================================================
   BONECO PROCEDURAL — uma implementação do AnimationController.
   Corpo feito de cápsulas; pernas, tronco e braços posicionados por código a partir
   do estado de combate. A espada segue as poses de dados (POSE / MOVES) e os braços
   seguem a espada (IK de um osso). É o corpo de reserva quando não há modelo 3D.
   ================================================================ */
export class ProceduralController extends AnimationController {
  build(look) {
    const f = this.f;
    const L = Object.assign({ cloth: 0x141110, pants: 0x1f1a17, skin: 0x6b4a36, cloak: 0x141110, hat: 'kasa', hatColor: 0x8d7240, band: 0x7a1d12 }, look);
    const M = (c) => withRim(new THREE.MeshLambertMaterial({ color: c }));
    const cloth = M(L.cloth), pants = M(L.pants), skin = M(L.skin);
    const lacquer = M(0x100c0b), wrap = M(0x2a211a), brass = new THREE.MeshStandardMaterial({ color: 0x7a6436, metalness: 0.6, roughness: 0.45 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xd4d7da, metalness: 0.55, roughness: 0.28 });
    const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    f.root = new THREE.Group();
    f.body = new THREE.Group(); f.root.add(f.body);
    f.hips = new THREE.Group(); f.hips.position.y = 0.92; f.body.add(f.hips);
    f.legs = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.position.set(0.11 * s, 0, 0); f.hips.add(g);
      add(g, new THREE.CapsuleGeometry(0.075, 0.68, 4, 8), pants, 0, -0.46, 0);
      add(g, new THREE.BoxGeometry(0.1, 0.07, 0.24), M(0x0e0b09), 0, -0.88, -0.05);
      return g;
    });
    f.torso = new THREE.Group(); f.hips.add(f.torso);
    add(f.torso, new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), cloth, 0, 0.34, 0);
    f.arms = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.position.set(0.23 * s, 0.56, 0); f.torso.add(g);
      add(g, new THREE.CapsuleGeometry(0.06, 0.5, 4, 8), cloth, 0, -0.3, 0);
      return g;
    });
    f.head = new THREE.Group(); f.head.position.y = 0.74; f.torso.add(f.head);
    add(f.head, new THREE.SphereGeometry(0.11, 16, 12), skin, 0, 0, 0);
    f.hat = new THREE.Group(); f.hat.position.y = 0.09; f.head.add(f.hat);
    if (L.hat === 'kasa') {
      const straw = withBacklight(new THREE.MeshLambertMaterial({ color: L.hatColor, side: THREE.DoubleSide }), 0.5);
      add(f.hat, new THREE.ConeGeometry(0.46, 0.2, 28, 1, true), straw, 0, 0.02, 0);
      add(f.hat, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), straw, 0, 0.13, 0);
    } else if (L.hat === 'jingasa') {
      add(f.hat, new THREE.ConeGeometry(0.36, 0.11, 24, 1, true), new THREE.MeshLambertMaterial({ color: L.hatColor, side: THREE.DoubleSide }), 0, -0.01, 0);
    } else {
      add(f.hat, new THREE.CylinderGeometry(0.035, 0.05, 0.12, 8), M(0x0c0a09), 0, 0.08, 0.03);
      add(f.hat, new THREE.TorusGeometry(0.108, 0.018, 6, 18).rotateX(Math.PI / 2), M(L.band), 0, -0.04, 0);
    }
    f.scab = new THREE.Group(); f.scab.position.set(-0.22, 0.02, 0.02); f.scab.rotation.set(0.42, 0, 0.1); f.hips.add(f.scab);
    add(f.scab, new THREE.CylinderGeometry(0.02, 0.018, 0.78, 8).rotateX(Math.PI / 2), lacquer, 0, 0, 0.32);
    f.hipHilt = new THREE.Group(); f.scab.add(f.hipHilt);
    add(f.hipHilt, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16).rotateX(Math.PI / 2), brass, 0, 0, -0.07);
    add(f.hipHilt, new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8).rotateX(Math.PI / 2), wrap, 0, 0, -0.21);
    f.sword = new THREE.Group(); f.root.add(f.sword);
    const bg = new THREE.BoxGeometry(0.008, 0.032, 0.86, 1, 1, 14); bg.translate(0, 0, -0.43);
    const bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const tt = clamp(-bp.getZ(i) / 0.86, 0, 1), w = tt > 0.9 ? 1 - ((tt - 0.9) / 0.1) * 0.85 : 1;
      bp.setY(i, bp.getY(i) * w + 0.035 * tt * tt);
    }
    bg.computeVertexNormals();
    add(f.sword, bg, steel, 0, 0, 0);
    add(f.sword, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16).rotateX(Math.PI / 2), brass, 0, 0, 0);
    add(f.sword, new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8).rotateX(Math.PI / 2), wrap, 0, 0, 0.14);
    const gm = new THREE.MeshBasicMaterial({ color: GLINT.red.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    f.glint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gm);
    f.glint.position.set(0, 0.03, -0.95); f.glint.scale.setScalar(0.001); f.sword.add(f.glint);
    f.sword.visible = false;
    scene.add(f.root);
    f.blob = new THREE.Mesh(BLOB_GEO, new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false, opacity: 0.55 }));
    f.blob.renderOrder = 1; scene.add(f.blob);
    f.cloth = new Cloak(f, L.cloak);
    f.syncRoot();
  }
  pose(dt, t, prevYaw) {
    const f = this.f;
    const C = f.speeds;
    const speed = Math.hypot(f.vel.x, f.vel.z);
    if (dt > 0) {
      f.turnVel = damp(f.turnVel, angDiff(prevYaw, f.yaw) / dt, 10, dt);
      f.accelF = damp(f.accelF, (speed - f.prevSpeed) / dt, 8, dt);
    }
    f.prevSpeed = speed;
    const sn = speed / C.run, walkN = Math.min(1, speed / C.walk);
    const inDodge = f.state === 'dodge', dead = f.state === 'dead';
    f.phase += dt * speed * (speed > C.walk + 0.5 ? 2.0 : 2.5) * (inDodge || dead ? 0.3 : 1);
    const stepIdx = Math.floor(f.phase / Math.PI);
    if (stepIdx !== f.lastStep && speed > 0.6 && !inDodge) {
      f.lastStep = stepIdx;
      if (f.isPlayer) Sound.step(terrain.nearest(f.pos.x, f.pos.z).d < 1.3, speed > C.walk + 0.5);
    }
    const sw = Math.sin(f.phase), amp = dead ? 0 : lerp(0.45, 0.8, smooth(C.walk, C.run, speed)) * walkN;
    f.legs[0].rotation.x = sw * amp; f.legs[1].rotation.x = -sw * amp;

    let crouch = 0, leanX = sn * 0.2 + clamp(f.accelF, -4, 4) * 0.02, rollT = clamp(-f.turnVel * speed * 0.02, -0.18, 0.18), twistT = 0;
    if (f.state === 'attack') {
      const m = f.move, tt = f.st;
      twistT = clamp(f.swordPose.yaw * 0.28, -0.55, 0.55);
      if (tt > m.w && tt < m.w + m.a + 0.1) leanX += 0.22;
      if (tt < m.w && m.heavy) crouch = 0.1 * Math.min(1, tt / m.w); else crouch = 0.05;
    } else if (f.state === 'block') { twistT = 0.2; crouch = 0.06; }
    else if (inDodge) {
      const k = Math.sin(Math.PI * clamp(f.st / CFG.combat.dodge.dur, 0, 1));
      crouch = 0.16 * k;
      const lx = f.dodgeDir.x * Math.cos(f.yaw) - f.dodgeDir.y * Math.sin(f.yaw);
      const lz = f.dodgeDir.x * Math.sin(f.yaw) + f.dodgeDir.y * Math.cos(f.yaw);
      leanX += -lz * 0.35 * k; rollT += -lx * 0.3 * k;
    } else if (f.state === 'hurt' || f.state === 'recoil') { leanX -= 0.35 * Math.max(0, 1 - f.st / 0.4); }
    else if (f.state === 'stagger') { leanX -= 0.3; rollT += Math.sin(f.st * 7) * 0.08; crouch = 0.08; }
    else if (f.state === 'broken') { leanX -= 0.42; rollT += Math.sin(f.st * 5) * 0.14; crouch = 0.18; }
    else if (f.drawn && f.target) crouch = 0.05;

    f.hips.position.y = 0.92 - crouch - Math.abs(Math.cos(f.phase)) * 0.035 * walkN + Math.sin(t * 1.8) * 0.004 * (1 - walkN);
    f.lean = damp(f.lean, leanX, 10, dt); f.roll = damp(f.roll, rollT, 10, dt); f.twist = damp(f.twist, twistT, 18, dt);
    f.torso.rotation.set(-f.lean, f.twist, f.roll);
    f.head.rotation.set(f.lean * 0.6, -f.twist * 0.6, 0);
    f.hat.rotation.set(Math.sin(f.phase * 2) * 0.02 * walkN, 0, Math.sin(f.phase) * 0.015 * walkN);
    let fallT = 0;
    if (f.state === 'down') fallT = f.st < 1.5 ? 1.35 : 1.35 * Math.max(0, 1 - (f.st - 1.5) / 0.45);
    if (dead) fallT = 1.45;
    f.body.rotation.x = damp(f.body.rotation.x, fallT, (f.state === 'down' && f.st < 1.5) || dead ? 7 : 12, dt);

    f.hipHilt.visible = !f.drawn; f.sword.visible = f.drawn && !dead;
    if (f.drawn && f.ritualT >= 0 && f.state === 'move') {
      // sacode o sangue da lâmina, segura, e guarda devagar
      f.ritualT += dt;
      const r = f.ritualT, FLICK = P(0.55, 1.02, -0.38, -2.3, -0.3, -1.3);
      if (r < 0.22) lerpPose(f.ritualFrom, FLICK, easeOut(r / 0.22), f.swordPose);
      else if (r < 0.62) lerpPose(FLICK, FLICK, 0, f.swordPose);
      else lerpPose(FLICK, POSE.draw, easeInOut(Math.min(1, (r - 0.62) / 0.42)), f.swordPose);
      if (r > 0.05 && !f.ritualSw) { f.ritualSw = true; Sound.swoosh(0.55); }
      if (r >= 1.04) { f.ritualSw = false; f.sheathe(); }
    } else if (f.ritualT >= 0 && f.state !== 'move') f.ritualT = -1;
    if (f.drawn) {
      if (f.ritualT >= 0) {}
      else if (f.state === 'attack') movePose(f.move, f.st, f.fromPose, f.swordPose);
      else {
        let tp = POSE.guard;
        if (f.state === 'block') tp = f.parryAnim > 0.16 ? POSE.parry : POSE.block;
        else if (f.state === 'hurt' || f.state === 'down' || f.state === 'recoil') tp = POSE.hurt;
        else if (f.state === 'stagger') tp = POSE.stun;
        else if (f.state === 'broken') tp = POSE.broken;
        const g = { ...tp };
        if (tp === POSE.guard) { g.yaw += Math.sin(t * 1.3 + f.pos.x) * 0.03; g.pitch += Math.sin(t * 0.9) * 0.02; g.hy += Math.sin(f.phase * 2) * 0.012 * walkN; }
        lerpPose(f.swordPose, g, 1 - Math.exp(-dt * (f.parryAnim > 0 ? 40 : 22)), f.swordPose);
      }
      if (f.drawT < 1) f.drawT = Math.min(1, f.drawT + dt / 0.2);
      const sp = f.drawT < 1 ? lerpPose(POSE.draw, f.swordPose, easeOut(f.drawT)) : f.swordPose;
      _e.set(sp.pitch, sp.yaw, sp.roll, 'YXZ');
      f.sword.position.set(sp.hx, sp.hy - (0.92 - f.hips.position.y), sp.hz);
      f.sword.quaternion.setFromEuler(_e);
    }
    const gk = f.glintT >= 0 ? Math.sin(Math.min(1, f.glintT / 0.38) * Math.PI) : 0;
    f.glint.scale.setScalar(Math.max(0.001, gk * 1.1));
    f.root.position.copy(f.pos);
    f.root.rotation.y = f.yaw;
    f.root.updateMatrixWorld(true);
    const lying = dead || f.state === 'down';
    f.blob.position.set(f.pos.x - Math.sin(f.yaw) * (lying ? 0.7 : 0), f.pos.y + 0.03, f.pos.z - Math.cos(f.yaw) * (lying ? 0.7 : 0));
    f.blob.scale.set(lying ? 1.3 : 1.05, 1, lying ? 2.0 : 1.05);
    f.blob.rotation.y = f.yaw;

    if (f.drawn && !dead) {
      const hand = f.sword.getWorldPosition(_v);
      const back = _v2.set(0, 0, 0.17).applyMatrix4(f.sword.matrixWorld);
      [[f.arms[1], hand], [f.arms[0], back]].forEach(([arm, w]) => {
        const local = arm.parent.worldToLocal(_c.copy(w)).sub(arm.position);
        if (local.lengthSq() > 1e-6) arm.quaternion.setFromUnitVectors(_down, local.normalize());
      });
    } else {
      f.arms[0].quaternion.setFromEuler(_e.set(-sw * amp * 0.5, 0, 0, 'XYZ'));
      f.arms[1].quaternion.setFromEuler(_e.set(sw * amp * 0.5, 0, 0, 'XYZ'));
    }
  }
}
