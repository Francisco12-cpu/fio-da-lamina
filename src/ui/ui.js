import { Lock } from '../game/lockon.js';
import { _v } from '../combat/moves.js';
import { IS_TOUCH } from '../core/config.js';
import { Input } from '../core/input.js';
import { G, simT } from '../core/time.js';
import { clamp, damp } from '../core/util.js';
import { camera } from '../render/renderer.js';

/* ================================================================
   UI
   ================================================================ */
export const UI = {
  hintEl: document.getElementById('hint'), flashEl: document.getElementById('flash'),
  vitEl: document.getElementById('vit'), hurtEl: document.getElementById('hurt'),
  pstabEl: document.getElementById('pstab'), pstabFill: document.querySelector('#pstab b'), pstabTrail: document.querySelector('#pstab i'), pTrail: 1, goodT: 0,
  bAtk: document.getElementById('bAtk'), bBlock: document.getElementById('bBlock'), bDodge: document.getElementById('bDodge'), ring: document.querySelector('#bAtk .ring'), ringC: document.querySelector('#bAtk .ring circle'),
  lockEl: document.getElementById('lockMark'), bLock: document.getElementById('bLock'),
  good() { this.goodT = 0.35; this.bBlock.classList.add('good'); },
  fadeEl: document.getElementById('fade'), fadeText: document.getElementById('fadeText'),
  timer: 0, sticky: false, flashT: 0, hurtK: 0,
  hint(text, dur = 4) { if (this.sticky) return; this.hintEl.textContent = text; this.hintEl.classList.add('on'); this.timer = dur; },
  stick(text, sub) {
    this.sticky = true; this.timer = 0;
    this.hintEl.textContent = text;
    if (sub) { const s = document.createElement('small'); s.textContent = sub; this.hintEl.appendChild(s); }
    this.hintEl.classList.add('on');
  },
  clear() { this.sticky = false; this.hintEl.classList.remove('on'); },
  flash(text) { this.flashEl.textContent = text; this.flashEl.classList.add('on'); this.flashT = 0.9; },
  hurt() { this.hurtK = 1; },
  fade(on, text = '') { this.fadeText.textContent = text; this.fadeEl.classList.toggle('on', on); },
  update(dt, player, t) {
    if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0 && !this.sticky) this.hintEl.classList.remove('on'); }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flashEl.classList.remove('on'); }
    this.vitEl.classList.toggle('on', Input.enabled && (player.drawn || player.health < player.maxHealth));
    [...this.vitEl.children].forEach((el, i) => el.classList.toggle('lost', i >= player.health));
    this.hurtK = Math.max(0, this.hurtK - dt * 2.5);
    const wounded = player.health === 1 && player.alive ? 0.3 + 0.12 * Math.sin(t * 4) : 0;
    this.hurtEl.style.opacity = Math.max(this.hurtK, wounded).toFixed(3);
    // estabilidade do jogador (embaixo) e dos inimigos (sobre a cabeça)
    const ps = player.stab / player.maxStab;
    this.pstabEl.classList.toggle('on', Input.enabled && player.alive && (player.drawn || ps < 0.999));
    this.pstabEl.classList.toggle('low', ps < 0.3); this.pstabEl.classList.toggle('broken', player.state === 'broken');
    this.pstabFill.style.transform = `scaleX(${clamp(ps, 0, 1).toFixed(3)})`;
    this.pTrail = ps < this.pTrail ? damp(this.pTrail, ps, 2.2, dt) : ps;
    this.pstabTrail.style.transform = `scaleX(${clamp(this.pTrail, 0, 1).toFixed(3)})`;
    // anel de carga do golpe forte e estados dos botões de toque
    if (IS_TOUCH) {
      let ck = 0;
      if (player.state === 'attack' && player.move) ck = player.move.strong ? 1 : Input.atkTouch && player.move.light ? clamp(player.st / 0.09, 0, 1) : 0;
      this.ringC.style.strokeDashoffset = (289 * (1 - ck)).toFixed(0);
      this.ring.classList.toggle('full', ck >= 1);
      this.bDodge.classList.toggle('cool', simT < player.dodgeReadyAt || player.state === 'dodge');
      if (this.goodT > 0) { this.goodT -= dt; if (this.goodT <= 0) this.bBlock.classList.remove('good'); }
    }
    camera.updateMatrixWorld();
    // marcador da mira travada, no peito do alvo
    const lt = Lock.target;
    let lv = false;
    if (lt && lt.alive && Input.enabled) {
      _v.set(lt.pos.x, lt.pos.y + 1.15, lt.pos.z).project(camera);
      lv = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
      if (lv) { this.lockEl.style.transform = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`; }
    }
    this.lockEl.classList.toggle('on', lv);
    if (IS_TOUCH) this.bLock.classList.toggle('active', !!lt);
    for (const e of G.Encounters.enemies) {
      const show = e.aware && e.alive && Input.enabled;
      _v.set(e.pos.x, e.pos.y + 2.15, e.pos.z).project(camera);
      const vis = show && _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && camera.position.distanceTo(e.pos) < 28;
      e.tag.style.opacity = vis ? 1 : 0;
      if (!vis) continue;
      e.tag.style.left = ((_v.x * 0.5 + 0.5) * innerWidth).toFixed(1) + 'px';
      e.tag.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(1) + 'px';
      const k = clamp(e.stab / e.maxStab, 0, 1);
      e.tagFill.style.transform = `scaleX(${k.toFixed(3)})`;
      e.trailK = e.trailK === undefined || k > e.trailK ? k : damp(e.trailK, k, 2.2, dt);
      e.tagTrail.style.transform = `scaleX(${e.trailK.toFixed(3)})`;
      e.tag.classList.toggle('low', k < 0.3); e.tag.classList.toggle('broken', e.state === 'broken');
      e.tagHp.forEach((el, i) => el.classList.toggle('off', i >= e.health));
    }
  },
};
