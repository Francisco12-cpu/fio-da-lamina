import { IS_TOUCH } from '../core/config.js';

/* ================================================================
   DESENHO DOS BOTÕES — as dicas mostram o botão, não só o nome dele.
   Texto com marcas {atk}, {block}… vira tecla, botão do mouse ou o ícone do
   botão de toque, conforme o aparelho.
   ================================================================ */
const mouse = (side) => `<svg class="gm" viewBox="0 0 16 22" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="19" rx="6.5"/><path d="M8 1.5v7"/>${
  side === 'l' ? '<path class="f" d="M8 1.5A6.5 6.5 0 0 0 1.5 8v.5H8z"/>' : side === 'r' ? '<path class="f" d="M8 1.5A6.5 6.5 0 0 1 14.5 8v.5H8z"/>' : '<rect class="f" x="6.6" y="3.4" width="2.8" height="4.2" rx="1.4"/>'}</svg>`;
const key = (k, wide) => `<kbd class="gk${wide ? ' w' : ''}">${k}</kbd>`;
// mesmos ícones dos botões de toque
const TOUCH_IC = {
  atk: '<path d="M7 17L20 4"/><path d="M4.5 13.5l6 6"/><path d="M3 21l3.5-3.5"/>',
  block: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/>',
  dodge: '<path d="M4 17c3-7 8-10 15-9"/><path d="M15 4l4 4-4 4"/>',
  focus: '<path d="M12 3c0 0-6.5 8-6.5 12a6.5 6.5 0 0 0 13 0C18.5 11 12 3 12 3z"/>',
  lock: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
};
const touch = (n) => `<span class="gt" aria-hidden="true"><svg viewBox="0 0 24 24">${TOUCH_IC[n]}</svg></span>`;

const PC = {
  atk: mouse('l'), block: mouse('r'), lock: key('Q') + '<span class="go">ou</span>' + mouse('m'),
  dodge: key('Espaço', true), focus: key('F'), run: key('Shift', true), pause: key('Esc', true),
  move: key('W') + key('A') + key('S') + key('D'), look: '<span class="gw">mouse</span>',
};
const TOUCH = {
  atk: touch('atk'), block: touch('block'), dodge: touch('dodge'), focus: touch('focus'), lock: touch('lock'),
  run: '<span class="gw">polegar na borda</span>', pause: '<span class="gw">☰</span>',
  move: '<span class="gw">polegar esquerdo</span>', look: '<span class="gw">polegar direito</span>',
};
// nomes falados, para leitores de tela
const SPOKEN_PC = { atk: 'botão esquerdo', block: 'botão direito', lock: 'Q ou botão do meio', dodge: 'Espaço', focus: 'F', run: 'Shift', pause: 'Esc', move: 'W A S D', look: 'mouse' };
const SPOKEN_TOUCH = { atk: 'botão da espada', block: 'botão do escudo', dodge: 'botão da esquiva', focus: 'botão do foco', lock: 'botão da mira', run: 'polegar na borda', pause: 'menu', move: 'polegar esquerdo', look: 'polegar direito' };

export function glyph(name, touchMode = IS_TOUCH) {
  const g = (touchMode ? TOUCH : PC)[name], s = (touchMode ? SPOKEN_TOUCH : SPOKEN_PC)[name];
  return g ? `<span class="glyph" role="img" aria-label="${s}">${g}</span>` : '';
}
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// texto com marcas → HTML (o texto é escapado; só as marcas viram desenho)
export function fmt(text, touchMode = IS_TOUCH) {
  return esc(text).replace(/\{(\w+)\}/g, (m, n) => glyph(n, touchMode) || m);
}
// escolhe o texto por aparelho quando a frase muda de verdade (não só o botão)
export const T_ = (desk, tch) => (IS_TOUCH ? tch : desk);
