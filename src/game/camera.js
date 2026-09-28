import * as THREE from 'three';
import { _up, _v } from '../combat/moves.js';
import { CFG } from '../core/config.js';
import { Input } from '../core/input.js';
import { G, clock } from '../core/time.js';
import { angDiff, clamp, damp, easeInOut, rand, vnoise, yawTo } from '../core/util.js';
import { camera } from '../render/renderer.js';
import { colliders } from '../world/props.js';
import { terrain } from '../world/world.js';
import { Lock } from './lockon.js';

/* ================================================================
   CÂMERA — terceira pessoa baixa, enquadra o alvo em combate, tremor
   ================================================================ */
export class CameraRig {
  constructor() {
    this.yaw = 0; this.pitch = CFG.camera.pitch;
    this.pivot = new THREE.Vector3();
    this.dist = CFG.camera.dist; this.runK = 0; this.stanceK = 0; this.trauma = 0;
    this.intro = 1; this.punchK = 0;
    this.cine = null; this.blend = 0; this.cineUntil = 0;
    this.cPos = new THREE.Vector3(); this.cQuat = new THREE.Quaternion(); this.cMat = new THREE.Matrix4(); this.hasCine = false;
  }
  setCine(a, b, o) { this.cine = { a, b, side: 1, dist: 5, h: 0.4, look: 1.1, back: 0, ...o }; this.cineUntil = 0; }
  clearCine() { this.cine = null; }
  cut(a, b, dur) { this.setCine(a, b, { side: rand() < 0.5 ? 1 : -1, dist: 2.7, h: -0.3, look: 1.05, back: -0.6 }); this.blend = 1; this.cineUntil = clock.elapsed + dur; }
  punch(deg) { this.punchK = Math.min(8, this.punchK + deg); }
  snap(p) { this.pivot.set(p.x, p.y + CFG.camera.pivotH, p.z); }
  shake(a) { this.trauma = Math.min(1, this.trauma + a); }
  update(dt, t, player, speed, enemies = []) {
    const C = CFG.camera;
    const lock = Lock.target;
    const [dx, dy] = Input.consumeLook();
    // mira travada: arrastar de lado troca de alvo em vez de girar a câmera
    if (lock) Lock.addFlick(dx, player, enemies, t); else this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, C.pitchMin, C.pitchMax);
    // grupo: inimigos atentos por perto entram no enquadramento, não só o mais próximo
    const group = player.alive ? enemies.filter((e) => e.alive && e.aware && e.pos.distanceTo(player.pos) < C.groupRange) : [];
    let tg = lock || (player.drawn ? player.target : null);
    if (!tg && group.length) tg = group.reduce((a, b) => (a.pos.distanceTo(player.pos) < b.pos.distanceTo(player.pos) ? a : b));
    const idle = t - Input.lastLookTime;
    if (lock) {
      const d = angDiff(this.yaw, yawTo(player.pos, lock.pos) + C.lockOffset), ex = Math.abs(d) - 0.03;
      if (ex > 0) this.yaw += Math.sign(d) * ex * (1 - Math.exp(-dt * 6.0));
    } else if (tg && idle > 0.7) {
      // mantém o alvo (ou o centro do grupo) no quadro sem "grudar" a câmera nele
      // câmera gira um pouco para a esquerda da linha até o alvo: jogador à esquerda, oponentes à direita da tela
      let ax = tg.pos.x * 2, az = tg.pos.z * 2, n = 2;
      for (const e of group) if (e !== tg) { ax += e.pos.x; az += e.pos.z; n++; }
      const aim = _v.set(ax / n, 0, az / n);
      const off = n > 2 ? 0.38 : 0.55;
      const d = angDiff(this.yaw, yawTo(player.pos, aim) + off), ex = Math.abs(d) - 0.14;
      if (ex > 0) this.yaw += Math.sign(d) * ex * (1 - Math.exp(-dt * 3.0));
    } else if (!tg && speed > 0.5 && idle > 1.6) {
      const d = angDiff(this.yaw, player.yaw);
      if (Math.abs(d) < 1.9) this.yaw += d * (1 - Math.exp(-dt * 0.55 * Math.min(1, speed / CFG.player.walk)));
    }
    this.stanceK = damp(this.stanceK, tg ? 1 : 0, 2.5, dt);
    this.pivot.x = damp(this.pivot.x, player.pos.x, 14, dt);
    this.pivot.z = damp(this.pivot.z, player.pos.z, 14, dt);
    this.pivot.y = damp(this.pivot.y, player.pos.y + C.pivotH + this.stanceK * 0.12, 7, dt);
    this.runK = damp(this.runK, clamp((speed - CFG.player.walk) / (CFG.player.run - CFG.player.walk), 0, 1), 3, dt);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const base = this.pivot.clone().addScaledVector(right, C.shoulder + this.stanceK * 0.22);
    // recua o suficiente para todos do grupo caberem na largura da tela (com margem)
    let groupD = 0;
    if (group.length) {
      const tanH = Math.tan(Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)) * 0.78;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      let need = 0;
      for (const e of group) {
        const vx = e.pos.x - base.x, vz = e.pos.z - base.z;
        const lat = Math.abs(vx * right.x + vz * right.z) + 0.5, dep = vx * fx + vz * fz;
        need = Math.max(need, lat / tanH - dep);
      }
      groupD = clamp(need - (C.dist + C.stanceDist), 0, C.groupMax);
    }
    this.groupK = damp(this.groupK || 0, groupD, 1.6, dt);
    const want = C.dist + this.runK * 0.35 + this.intro * 2.2 + this.stanceK * C.stanceDist + this.groupK;
    let dist = want;
    for (let step = 0; step < 16; step++) {
      const cx = base.x - fwd.x * dist, cy = base.y - fwd.y * dist, cz = base.z - fwd.z * dist;
      let hit = false;
      for (const c of colliders) {
        const ddx = cx - c.x, ddz = cz - c.z;
        if (ddx * ddx + ddz * ddz < (c.r + 0.3) ** 2 && cy < c.top + 0.3) { hit = true; break; }
      }
      if (!hit) break;
      dist -= 0.3;
    }
    dist = Math.max(dist, 0.9);
    this.dist = dist < this.dist ? dist : damp(this.dist, dist, 3, dt);
    const pos = base.clone().addScaledVector(fwd, -this.dist);
    pos.y += this.intro * 1.2;
    pos.y = Math.max(pos.y, terrain.heightAt(pos.x, pos.z) + C.minClear);

    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    const s = this.trauma * this.trauma;
    const shY = (vnoise(t * 32, 0.5, 3) - 0.5) * s * 0.06, shP = (vnoise(0.5, t * 32, 4) - 0.5) * s * 0.06, shR = (vnoise(t * 26, t * 26, 5) - 0.5) * s * 0.05;
    const breathe = Math.sin(t * 0.9) * 0.0035, sway = Math.sin(t * 0.6 + 1.3) * 0.0025;
    camera.position.copy(pos);
    camera.rotation.set(this.pitch - this.intro * 0.12 + breathe + shP, this.yaw + sway + shY, shR);
    this.punchK = Math.max(0, this.punchK - dt * 9 * Math.max(1, this.punchK * 0.4));
    // plano cinematográfico por cima do enquadramento normal, com transição suave
    if (this.cineUntil && clock.elapsed > this.cineUntil) { this.cine = null; this.cineUntil = 0; }
    this.blend = this.cine ? Math.min(1, this.blend + dt * 2.2) : Math.max(0, this.blend - dt * 1.8);
    if (this.cine) {
      const A = this.cine.a.pos, B = this.cine.b.pos, c = this.cine;
      const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, my = (A.y + B.y) / 2;
      const px = mx - uz * c.side * c.dist + ux * c.back, pz = mz + ux * c.side * c.dist + uz * c.back;
      const py = Math.max(terrain.heightAt(px, pz) + 0.55, my + 1.2 + c.h);
      this.cPos.set(px, py, pz);
      this.cMat.lookAt(this.cPos, _v.set(mx, my + c.look, mz), _up);
      this.cQuat.setFromRotationMatrix(this.cMat); this.hasCine = true;
    }
    if (this.blend > 0 && this.hasCine) {
      const k = easeInOut(this.blend);
      camera.position.lerp(this.cPos, k); camera.quaternion.slerp(this.cQuat, k);
    }
    const fov = C.fov + this.runK * (C.fovRun - C.fov) - this.punchK;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    return fwd;
  }
}
export const Fx = { shake: (a) => G.rig.shake(a), punch: (d) => G.rig.punch(d) };
