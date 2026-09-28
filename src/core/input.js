import * as THREE from 'three';
import { CFG, IS_TOUCH } from './config.js';
import { clock } from './time.js';
import { canvas } from '../render/renderer.js';
import { UI } from '../ui/ui.js';

/* ================================================================
   INPUT — ações com buffer curto, teclado/mouse e toque
   ================================================================ */
export const Input = {
  keys: new Set(),
  move: new THREE.Vector2(), run: false,
  lookDX: 0, lookDY: 0, lastLookTime: -99,
  locked: false, noLock: false, enabled: false,
  buf: { attack: -9, dodge: -9, blockPress: -9, lock: -9, focus: -9 },
  tap: null,
  blockKey: false, blockMouse: false, blockTouch: false, atkKey: false, atkMouse: false, atkTouch: false,
  joy: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
  look: { id: null, x: 0, y: 0 },
  drag: { active: false, x: 0, y: 0, moved: 0 },
  get blockHeld() { return this.enabled && (this.blockKey || this.blockMouse || this.blockTouch); },
  get attackHeld() { return this.enabled && (this.atkKey || this.atkMouse || this.atkTouch); },
  press(a) { if (this.enabled) this.buf[a] = clock.elapsed; },
  take(a) { if (clock.elapsed - this.buf[a] <= 0.16) { this.buf[a] = -9; return true; } return false; },
  init() {
    const joyEl = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code);
      if (e.code === 'Space') { this.press('dodge'); e.preventDefault(); }
      if (e.code === 'KeyJ') { this.atkKey = true; this.press('attack'); }
      if (e.code === 'KeyK') { this.blockKey = true; this.press('blockPress'); }
      if (e.code === 'KeyQ' || e.code === 'KeyL') this.press('lock');
      if (e.code === 'KeyF' || e.code === 'KeyR') this.press('focus');
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'KeyK') this.blockKey = false; if (e.code === 'KeyJ') this.atkKey = false; });
    addEventListener('blur', () => { this.keys.clear(); this.blockKey = this.blockMouse = this.blockTouch = this.atkKey = this.atkMouse = this.atkTouch = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.blockMouse = false;
      if (!this.locked && this.enabled && !IS_TOUCH && !this.noLock) UI.hint('Clique na tela para voltar a controlar a câmera', 3.5);
    });
    document.addEventListener('pointerlockerror', () => { this.noLock = true; });
    document.addEventListener('mousemove', (e) => {
      if (this.enabled && this.locked) this.addLook(e.movementX * CFG.camera.mouseSens, e.movementY * CFG.camera.mouseSens);
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.enabled || !this.locked) return;
      if (e.button === 0) { this.atkMouse = true; this.press('attack'); }
      if (e.button === 2) { this.blockMouse = true; this.press('blockPress'); }
      if (e.button === 1) { this.press('lock'); e.preventDefault(); }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) this.blockMouse = false; if (e.button === 0) this.atkMouse = false; });

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      canvas.focus();
      if (e.pointerType === 'mouse') {
        if (this.locked) return;
        if (e.button === 1) { this.press('lock'); return; }
        if (e.button === 2) { this.blockMouse = true; this.press('blockPress'); return; }
        if (!this.noLock) { const p = canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => { this.noLock = true; }); }
        this.drag = { active: true, x: e.clientX, y: e.clientY, moved: 0 };
        return;
      }
      canvas.setPointerCapture?.(e.pointerId);
      if (e.clientX < innerWidth * 0.45 && this.joy.id === null) {
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        joyEl.style.display = 'block'; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
        knob.style.transform = 'translate(0px, 0px)';
      } else if (this.look.id === null) {
        this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse') {
        if (this.drag.active && !this.locked) {
          const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
          this.drag.moved += Math.abs(dx) + Math.abs(dy);
          this.addLook(dx * CFG.camera.mouseSens * 1.4, dy * CFG.camera.mouseSens * 1.4);
          this.drag.x = e.clientX; this.drag.y = e.clientY;
        }
        return;
      }
      if (e.pointerId === this.joy.id) {
        const R = 58; let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
        this.joy.x = dx / R; this.joy.y = dy / R;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        joyEl.classList.toggle('run', Math.hypot(this.joy.x, this.joy.y) > 0.92);
      } else if (e.pointerId === this.look.id) {
        this.addLook((e.clientX - this.look.x) * CFG.camera.touchSens, (e.clientY - this.look.y) * CFG.camera.touchSens);
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    const end = (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 2) this.blockMouse = false;
        if (this.drag.active && this.noLock && this.drag.moved < 6 && e.button === 0) this.press('attack');
        this.drag.active = false; return;
      }
      if (e.pointerId === this.joy.id) { this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }; joyEl.style.display = 'none'; joyEl.classList.remove('run'); }
      if (e.pointerId === this.look.id) {
        // toque curto e parado na metade direita: trava a mira no inimigo tocado
        const L = this.look;
        if (e.type === 'pointerup' && Math.hypot(e.clientX - L.x0, e.clientY - L.y0) < 12 && performance.now() - L.t0 < 300) this.tap = { x: e.clientX, y: e.clientY };
        this.look = { id: null, x: 0, y: 0 };
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    addEventListener('contextmenu', (e) => e.preventDefault());

    // botões de toque
    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.classList.add('on'); down(); });
      const off = () => { el.classList.remove('on'); up && up(); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    };
    btn('bAtk', () => { this.atkTouch = true; this.press('attack'); }, () => { this.atkTouch = false; });
    btn('bDodge', () => this.press('dodge'));
    btn('bLock', () => this.press('lock'));
    btn('bFocus', () => this.press('focus'));
    btn('bBlock', () => { this.blockTouch = true; this.press('blockPress'); }, () => { this.blockTouch = false; });
  },
  addLook(dx, dy) { this.lookDX += dx; this.lookDY += dy; this.lastLookTime = clock.elapsed; },
  update() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    this.run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.joy.id !== null) {
      x = this.joy.x; y = -this.joy.y;
      const m = Math.hypot(x, y);
      this.run = m > 0.92;
      if (m < 0.12) { x = 0; y = 0; }
    }
    this.move.set(x, y);
    if (this.move.lengthSq() > 1) this.move.normalize();
    if (!this.enabled) { this.move.set(0, 0); this.run = false; }
  },
  consumeLook() { const r = [this.lookDX, this.lookDY]; this.lookDX = this.lookDY = 0; return r; },
};
