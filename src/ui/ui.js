import { fmt } from './glyphs.js';
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
  hpEl: document.querySelector('#vit .hp'), focusEl: document.querySelector('#vit .focus'), hpN: -1, focN: -1, focMax: -1,
  bindEl: document.getElementById('bind'), bindKnot: document.querySelector('#bind .knot'),
  masteryEl: document.getElementById('mastery'), bFocus: document.getElementById('bFocus'),
  // vitalidade em traços de pincel e foco em pingos de tinta (só redesenha quando muda)
  drawVitals(p) {
    const STROKE = '<svg viewBox="0 0 46 14"><path fill-rule="evenodd" d="M1.2 8.1C2.6 4.6 8.4 3 15.8 3.1c9.6.1 18.4 1.5 25.3 3 2.4.5 4.1 1.3 3.6 2-.9 1-4.8 1.1-9.6 1.6-7.6.8-15.4 2.3-23.2 2.4C5.8 12.2 1.6 11.1 1.2 8.1zM9 6.4c6.8-.5 15.2-.3 22.6.6l-.4.6c-7.4-.6-15.3-.7-22.1-.4zM12.5 9.3c5.4-.2 11-.8 16.4-1.4l.2.5c-5.5.8-11.1 1.3-16.5 1.4z"/></svg>';
    const DROP = '<svg viewBox="0 0 13 17"><path d="M6.5 1.2S1.6 7.6 1.6 10.8a4.9 4.9 0 0 0 9.8 0C11.4 7.6 6.5 1.2 6.5 1.2z"/></svg>';
    if (this.hpN !== p.maxHealth) { this.hpN = p.maxHealth; this.hpEl.innerHTML = STROKE.repeat(p.maxHealth); }
    [...this.hpEl.children].forEach((el, i) => el.classList.toggle('lost', i >= p.health));
    const fm = p.focusMax || 0;
    if (this.focMax !== fm) { this.focMax = fm; this.focusEl.innerHTML = DROP.repeat(fm); this.focN = -1; }
    if (this.focN !== p.focus) {
      [...this.focusEl.children].forEach((el, i) => el.classList.toggle('full', i < p.focus));
      if (p.focus > this.focN && this.focN >= 0) { const el = this.focusEl.children[p.focus - 1]; if (el) { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 250); } }
      this.focN = p.focus;
      if (this.bFocus) this.bFocus.classList.toggle('empty', !p.focus);
    }
  },
  focusGain() { this.focN = this.focN; },
  bind(on, v) {
    this.bindEl.classList.toggle('on', on);
    if (on) this.bindKnot.style.left = (50 + clamp(v, -1, 1) * 46).toFixed(1) + '%';
  },
  dying(on) { document.body.classList.toggle('dying', on); },
  // escolha de maestria: dois cartões; 1/2 no teclado, clique ou toque
  mastery(opts, done) {
    const el = this.masteryEl, cards = el.querySelector('.cards');
    cards.innerHTML = '';
    let closed = false;
    const pick = (u) => { if (closed) return; closed = true; el.hidden = true; removeEventListener('keydown', key); done(u); };
    const key = (e) => { const i = e.key === '1' ? 0 : e.key === '2' ? 1 : -1; if (i >= 0 && opts[i]) { e.preventDefault(); pick(opts[i]); } };
    opts.forEach((u, i) => {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = `<kbd>${i + 1}</kbd><b></b><span></span>`;
      b.querySelector('b').textContent = u.name; b.querySelector('span').textContent = u.text;
      b.addEventListener('click', (e) => { e.stopPropagation(); pick(u); });
      cards.appendChild(b);
    });
    addEventListener('keydown', key);
    el.hidden = false;
    setTimeout(() => cards.firstChild && cards.firstChild.focus(), 50);
    this.masteryPick = (i) => opts[i] && pick(opts[i]);
  },
  good() { this.goodT = 0.35; this.bBlock.classList.add('good'); },
  fadeEl: document.getElementById('fade'), fadeText: document.getElementById('fadeText'),
  timer: 0, sticky: false, flashT: 0, hurtK: 0,
  hint(text, dur = 4) { if (this.sticky) return; this.hintEl.innerHTML = fmt(text); this.hintEl.classList.add('on'); this.timer = dur; },
  stick(text, sub) {
    this.sticky = true; this.timer = 0;
    this.hintEl.innerHTML = fmt(text);
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
    this.vitEl.classList.toggle('on', Input.enabled && player.alive && (this.combat || player.wounded));
    this.drawVitals(player);
    document.body.classList.toggle('wounded', player.wounded);
    this.hurtK = Math.max(0, this.hurtK - dt * 2.5);
    const wounded = player.health === 1 && player.alive ? 0.3 + 0.12 * Math.sin(t * 4) : 0;
    this.hurtEl.style.opacity = Math.max(this.hurtK, wounded).toFixed(3);
    // estabilidade do jogador (embaixo) e dos inimigos (sobre a cabeça)
    const ps = player.stab / player.maxStab;
    this.pstabEl.classList.toggle('on', Input.enabled && player.alive && (this.combat || ps < 0.999));
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
