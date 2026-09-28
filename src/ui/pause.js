import { IS_TOUCH } from '../core/config.js';
import { glyph } from './glyphs.js';

/* ================================================================
   MENU DE PAUSA — continuar, controles, ajustes, reiniciar encontro, créditos.
   PC: Esc (ou perder o controle do mouse). Celular: botão ☰.
   Quem usa o menu passa as ações (continuar, ajustes, reiniciar) no init.
   ================================================================ */
export const CONTROLS = [
  ['move', 'Andar'], ['run', 'Correr (segure)'], ['look', 'Olhar'],
  ['atk', 'Golpear · segure para golpe forte · na trava, aperte sem parar'],
  ['block', 'Defender (segure) · no instante do golpe: aparar'],
  ['dodge', 'Esquivar · no último instante: esquiva perfeita (+1 foco)'],
  ['focus', 'Respirar: gasta 1 foco e recupera estabilidade'],
  ['lock', 'Travar a mira · arraste para o lado para trocar de alvo'],
  ['pause', 'Pausa'],
];
export function controlsHTML(touch = IS_TOUCH) {
  return CONTROLS.filter(([k]) => !(touch && k === 'run' && false))
    .map(([k, txt]) => `<div class="crow"><span class="ck">${glyph(k, touch)}</span><span class="ct">${txt}</span></div>`).join('');
}
export const CREDITS_HTML = `
  <p><b>Fio da Lâmina</b> — protótipo de combate com espada.</p>
  <p>Motor 3D: <b>three.js</b> (licença MIT).</p>
  <p>Fontes: <b>Shippori Mincho</b> e <b>Zen Kaku Gothic New</b> (SIL Open Font License), via Google Fonts.</p>
  <p>Personagem e animações: <b>Universal Animation Library 2</b>, de Quaternius (CC0, domínio público) — quando o modelo 3D está carregado.</p>
  <p>Sons, música, céu, grama, árvores, capas e chapéus: gerados por código neste projeto.</p>`;

export const Pause = {
  isOpen: false, el: null, actions: {},
  init(actions) {
    this.actions = actions;
    const el = (this.el = document.getElementById('pause'));
    el.querySelector('.controls .list').innerHTML = controlsHTML();
    el.querySelector('.credits .list').innerHTML = CREDITS_HTML;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      e.stopPropagation();
      const a = b.dataset.a;
      if (a === 'resume') this.close(true);
      else if (a === 'controls' || a === 'credits') this.section(a);
      else if (a === 'back') this.section('');
      else if (a === 'settings') actions.settings();
      else if (a === 'restart') { actions.restart(); this.close(true); }
    });
  },
  section(name) {
    this.el.querySelectorAll('.sec').forEach((s) => (s.hidden = !s.classList.contains(name)));
    this.el.querySelector('.menu').hidden = !!name;
    const f = this.el.querySelector(name ? `.sec.${name} [data-a="back"]` : '.menu [data-a="resume"]'); if (f) f.focus();
  },
  open() {
    if (this.isOpen || (this.actions.canOpen && !this.actions.canOpen())) return;
    this.isOpen = true; this.el.hidden = false; this.section(''); document.body.classList.add('paused');
    if (document.pointerLockElement) document.exitPointerLock();
  },
  close(resume) {
    if (!this.isOpen) return;
    this.isOpen = false; this.el.hidden = true; document.body.classList.remove('paused');
    if (resume && this.actions.resume) this.actions.resume();
  },
  toggle() { if (this.isOpen) this.close(true); else this.open(); },
};
