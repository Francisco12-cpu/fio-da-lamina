import { Report, Stats } from '../combat/state.js';
import { CFG } from '../core/config.js';
import { Quality, TIERS } from '../core/quality.js';
import { UI } from './ui.js';
import { TOD } from '../world/tod.js';

/* ================================================================
   PAINEL DE AJUSTE E RELATÓRIO — toque no contador de FPS (ou tecla P)
   ================================================================ */
export const Panel = {
  open: false, el: document.getElementById('panel'),
  settings: { tod: -1, fog: 1, glow: 1, rays: 1, exp: 1, parry: 160, q: -1 },
  init() {
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('fio-lamina-ajustes') || '{}')); } catch (e) {}
    const S = this.settings, el = this.el;
    const row = (label, key, min, max, step, fmt) => {
      const w = document.createElement('label'); w.className = 'row';
      w.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
      const inp = w.querySelector('input'), out = w.querySelector('output');
      inp.value = S[key]; out.textContent = fmt(+inp.value);
      inp.addEventListener('input', () => { S[key] = +inp.value; out.textContent = fmt(S[key]); this.apply(); });
      el.querySelector('.sliders').appendChild(w);
    };
    row('Hora do dia (−1 = automática)', 'tod', -1, 1, 0.01, (v) => (v < 0 ? 'automática' : Math.round(v * 100) + '%'));
    row('Neblina', 'fog', 0.3, 2, 0.05, (v) => v.toFixed(2) + '×');
    row('Brilho do sol', 'glow', 0, 2, 0.05, (v) => v.toFixed(2) + '×');
    row('Raios de luz', 'rays', 0, 2.5, 0.05, (v) => v.toFixed(2) + '×');
    row('Exposição', 'exp', 0.7, 1.3, 0.01, (v) => v.toFixed(2) + '×');
    row('Janela de aparar', 'parry', 100, 300, 5, (v) => v + ' ms');
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const q = +b.dataset.q; S.q = q;
      if (q < 0) Quality.auto = true; else { Quality.auto = false; Quality.apply(q); }
      this.save(); this.refreshQ();
    }));
    el.querySelector('#pClose').addEventListener('click', () => this.toggle(false));
    el.querySelector('#pReport').addEventListener('click', () => this.copy(this.report(), 'Relatório copiado'));
    el.querySelector('#pSettings').addEventListener('click', () => this.copy('Ajustes do Fio da Lâmina: ' + JSON.stringify(this.settings), 'Ajustes copiados'));
    el.querySelector('#pReset').addEventListener('click', () => { this.settings = { tod: -1, fog: 1, glow: 1, rays: 1, exp: 1, parry: 160, q: -1 }; this.save(); location.reload(); });
    addEventListener('keydown', (e) => { if (e.code === 'KeyP') this.toggle(); });
    if (S.q >= 0) { Quality.auto = false; Quality.apply(S.q); }
    this.apply(); this.refreshQ();
  },
  refreshQ() { this.el.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', +b.dataset.q === (Quality.auto ? -1 : Quality.tier))); },
  apply() {
    const S = this.settings;
    TOD.auto = S.tod < 0; TOD.override = Math.max(0, S.tod); TOD.fogMul = S.fog; TOD.glowMul = S.glow; TOD.raysMul = S.rays; TOD.expMul = S.exp; TOD.dirty = true;
    CFG.combat.parryWindow = S.parry / 1000;
    this.save();
  },
  save() { try { localStorage.setItem('fio-lamina-ajustes', JSON.stringify(this.settings)); } catch (e) {} },
  toggle(on = !this.open) {
    this.open = on; this.el.hidden = !on;
    if (on) { this.refreshQ(); if (document.pointerLockElement) document.exitPointerLock(); }
  },
  async copy(text, ok) {
    try { await navigator.clipboard.writeText(text); UI.flash(ok); }
    catch (e) { const ta = this.el.querySelector('textarea'); ta.hidden = false; ta.value = text; ta.focus(); ta.select(); UI.flash('Selecione e copie'); }
  },
  report() {
    const C = Report.contacts.filter((c) => c.src !== 'boneco'), all = Report.contacts;
    const by = (r) => all.filter((c) => c.res === r).length;
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '—');
    const parried = all.filter((c) => c.res === 'parry' && c.pressMs !== null).map((c) => c.pressMs);
    const early = all.filter((c) => (c.res === 'block' || c.res === 'hit') && c.pressMs !== null && c.pressMs > CFG.combat.parryWindow * 1000).map((c) => c.pressMs);
    const late = all.filter((c) => c.lateMs !== null).map((c) => c.lateMs);
    const types = [...new Set(C.map((c) => c.src))].map((src) => {
      const x = C.filter((c) => c.src === src);
      return `${src}: ${x.length} golpes, aparou ${x.filter((c) => c.res === 'parry').length}, defendeu ${x.filter((c) => c.res === 'block').length}, esquivou ${x.filter((c) => c.res === 'dodge' || c.res === 'pdodge').length}, levou ${x.filter((c) => c.res === 'hit').length}`;
    });
    return [
      'Fio da Lâmina — relatório de luta',
      `Aparelho: ${navigator.userAgent}`,
      `Qualidade: ${TIERS[Quality.tier].name} (${Quality.auto ? 'automática' : 'fixa'}), ${document.getElementById('stats').textContent}`,
      `Janela de aparar: ${Math.round(CFG.combat.parryWindow * 1000)} ms`,
      `Golpes recebidos: ${all.length} (aparou ${by('parry')}, defendeu ${by('block')}, esquivou ${by('dodge') + by('pdodge')}, perfeitas ${by('pdodge')}, levou ${by('hit')})`,
      `Aparos: apertou em média ${avg(parried)} ms antes do golpe`,
      `Cedo demais: ${early.length} vezes, em média ${avg(early)} ms antes (a janela é ${Math.round(CFG.combat.parryWindow * 1000)} ms)`,
      `Tarde demais: ${late.length} vezes, em média ${avg(late)} ms depois do golpe`,
      ...types,
      `Aparos: ${Stats.parries}, golpes decisivos: ${Stats.decisive}, inimigos vencidos: ${Stats.kills}, quedas: ${Stats.deaths}`,
      `Ajustes: ${JSON.stringify(this.settings)}`,
    ].join('\n');
  },
};
