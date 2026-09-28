import { IS_TOUCH } from '../core/config.js';
import { Input } from '../core/input.js';
import { UI } from '../ui/ui.js';

/* ================================================================
   TREINO — avança sozinho conforme você executa cada ação
   ================================================================ */
export const T_ = (desk, touch) => (IS_TOUCH ? touch : desk);
export const Training = {
  step: 0, count: 0, hidden: false, doneT: 0,
  steps: [
    { text: 'O boneco de treino está logo à frente, na clareira' },
    { kinds: ['hit'], need: 3, mode: 'off', text: '{atk} golpeia. Em sequência, encadeia até três golpes.' },
    { kinds: ['strong'], need: 1, mode: 'off', text: 'Segure {atk} para um golpe forte: mais lento, mas pressiona muito a guarda.' },
    { kinds: ['block'], need: 2, mode: 'normal', text: 'Fique perto e segure {block} para se defender. Defender gasta sua estabilidade (barra embaixo).' },
    { kinds: ['parry'], need: 2, mode: 'normal', text: 'Agora aperte {block} no instante exato em que o braço chega, para aparar. Aparar não gasta estabilidade.' },
    { kinds: ['counter'], need: 1, mode: 'normal', text: 'Depois de aparar, o boneco fica aberto por um instante. Apare e golpeie {atk} logo em seguida.' },
    { kinds: ['parry', 'dodge'], need: 1, mode: 'blue', text: 'Brilho azul atravessa a defesa: segurar não adianta. Apare {block} no instante certo ou esquive {dodge}.' },
    { kinds: ['dodge'], need: 1, mode: 'red', text: 'Brilho vermelho não pode ser defendido. Esquive {dodge} na hora certa. (Estocadas ainda podem ser aparadas no último instante.)' },
    { kinds: ['pfocus'], need: 1, mode: 'red', text: 'Esquive no último instante: a esquiva perfeita dá um ponto de foco (os pingos de tinta). {focus} respira e recupera a estabilidade — mas respirar deixa você exposto.' },
    { mode: 'mix', text: 'Treino completo. Quebre a estabilidade deles aparando e pressionando: sem equilíbrio, caem com um golpe — e você também. Se os dois golpearem juntos, as espadas podem travar: aperte {atk} sem parar. {lock} trava a mira.' },
  ],
  cur() { return this.steps[Math.min(this.step, this.steps.length - 1)]; },
  add(kind) {
    const s = this.cur();
    if (!s.kinds || !s.kinds.includes(kind)) return;
    this.count++;
    if (this.count >= s.need) this.advance(); else this.show();
  },
  advance() { this.step++; this.count = 0; this.doneT = 0; this.show(); },
  show() {
    if (this.hidden) return;
    const s = this.cur();
    UI.stick(s.text, s.need ? `${this.count} de ${s.need}` : '');
  },
  update(dt, player, dummy) {
    if (!Input.enabled) return;
    const d = Math.hypot(player.pos.x - dummy.pos.x, player.pos.z - dummy.pos.z);
    if (this.step === 0 && d < 6) this.advance();
    dummy.mode = this.cur().mode || 'off';
    const far = d > 18;
    if (far && !this.hidden) { this.hidden = true; UI.clear(); }
    else if (!far && this.hidden) { this.hidden = false; this.show(); }
    if (this.step === this.steps.length - 1 && !this.hidden) { this.doneT += dt; if (this.doneT > 12 && UI.sticky) UI.clear(); }
  },
};
