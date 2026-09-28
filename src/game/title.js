import * as THREE from 'three';
import { clamp, damp, smooth } from '../core/util.js';
import { camera } from '../render/renderer.js';
import { terrain } from '../world/world.js';
import { TOD } from '../world/tod.js';

/* ================================================================
   TÍTULO — câmera lenta viajando baixo sobre a trilha, na hora dourada,
   enquanto o jogador escolhe a dificuldade. Ao começar, a câmera de jogo assume.
   ================================================================ */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
export const Title = {
  active: true, t: 0, prev: null,
  SPEED: 1.3, START_Z: 150, END_Z: 30,
  begin() {
    this.active = true; this.t = 0;
    this.prev = { auto: TOD.auto, override: TOD.override };
    TOD.auto = false; TOD.override = 0.42; TOD.dirty = true;
  },
  // ponto da trilha a uma distância s (em metros) a partir do começo do percurso do título
  at(s, out) {
    const ps = terrain.ps;
    let i0 = 0; while (i0 < ps.length - 1 && ps[i0].z > this.START_Z) i0++;
    const i = clamp(i0 + Math.floor(s), 0, ps.length - 2), f = s - Math.floor(s), p = ps[i], q = ps[i + 1];
    return out.set(p.x + (q.x - p.x) * f, 0, p.z + (q.z - p.z) * f);
  },
  update(dt) {
    if (!this.active) return null;
    this.t += dt;
    const len = this.START_Z - this.END_Z, s = (this.t * this.SPEED) % len;
    this.at(s, _a); this.at(s + 1, _b);
    const dx = _b.x - _a.x, dz = _b.z - _a.z, l = Math.hypot(dx, dz) || 1;
    // um pouco ao lado da trilha, baixo, rente ao topo da grama
    const side = 2.6 + Math.sin(this.t * 0.07) * 0.8;
    const px = _a.x - (dz / l) * side, pz = _a.z + (dx / l) * side;
    const py = terrain.heightAt(px, pz) + 1.75 + Math.sin(this.t * 0.11) * 0.2;
    camera.position.set(px, py, pz);
    this.at(s + 14, _b);
    _b.y = terrain.heightAt(_b.x, _b.z) + 1.9 + Math.sin(this.t * 0.05) * 0.3;
    _m.lookAt(camera.position, _b, _up);
    camera.quaternion.setFromRotationMatrix(_m);
    if (Math.abs(camera.fov - 52) > 0.01) { camera.fov = 52; camera.updateProjectionMatrix(); }
    camera.getWorldDirection(_f);
    return _f;
  },
  end() {
    if (!this.active) return;
    this.active = false;
    if (this.prev) { TOD.auto = this.prev.auto; TOD.override = this.prev.override; TOD.dirty = true; TOD.k = -1; }
  },
};
