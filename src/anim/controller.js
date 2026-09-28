/* ================================================================
   CONTROLADOR DE ANIMAÇÃO — um por lutador.
   O combate é guiado por dados (preparação, ativo, recuperação em PLAYER_MOVES e
   ENEMY_LIB): os tempos mandam, a animação obedece. O controlador traduz o estado
   de combate em "ações" em duas camadas:
     - full:  corpo inteiro (andar, esquiva, reação, queda, morte)
     - upper: parte de cima (guarda, defesa, golpes), para golpear e defender andando
   Cada troca de ação tem um crossfade curto. Implementações:
     - ProceduralController (boneco de cápsulas, sempre disponível)
     - SkinnedController (modelo com esqueleto + AnimationMixer, quando houver arquivo)
   ================================================================ */
export const FADE = { full: 0.14, upper: 0.08 };

class Layer {
  constructor(name) { this.name = name; this.action = ''; this.prev = ''; this.t = 0; this.fade = 1; this.opts = {}; }
  set(action, opts = {}) {
    if (action === this.action && !opts.restart) { this.opts = opts; return false; }
    this.prev = this.action; this.action = action; this.t = 0; this.fade = 0; this.opts = opts;
    return true;
  }
  tick(dt, fadeDur) { this.t += dt; this.fade = Math.min(1, this.fade + (fadeDur > 0 ? dt / fadeDur : 1)); }
}

// fase normalizada do golpe por trechos: [0..w] preparação → 0..1, [w..w+a] ativo → 1..2,
// [w+a..fim] recuperação → 2..3. Uma animação de golpe só precisa mapear esses três trechos.
export function movePhase(m, st) {
  if (st < m.w) return st / m.w;
  if (st < m.w + m.a) return 1 + (st - m.w) / m.a;
  return 2 + Math.min(1, (st - m.w - m.a) / Math.max(m.r, 1e-3));
}

export class AnimationController {
  constructor(f, look) {
    this.f = f;
    this.layers = { full: new Layer('full'), upper: new Layer('upper') };
    this.build(look);
  }
  build() {}
  // decide as ações das camadas a partir do estado (igual para todas as implementações)
  select() {
    const f = this.f, s = f.state;
    const speed = Math.hypot(f.vel.x, f.vel.z);
    let full = 'idle';
    if (s === 'dead') full = 'death';
    else if (s === 'down') full = 'down';
    else if (s === 'dodge') full = 'dodge';
    else if (s === 'broken' || s === 'stagger') full = 'stagger';
    else if (s === 'hurt' || s === 'recoil') full = 'hit';
    else if (speed > f.speeds.walk + 0.5) full = 'run';
    else if (speed > 0.3) full = 'walk';
    let upper = f.drawn ? 'guard' : 'none';
    if (s === 'attack' && f.move) upper = 'attack';
    else if (s === 'block') upper = f.parryAnim > 0.16 ? 'parry' : 'block';
    else if (full !== 'idle' && full !== 'walk' && full !== 'run') upper = 'none'; // reações usam o corpo todo
    const L = this.layers;
    if (L.full.set(full)) this.onAction('full', full);
    // cada golpe novo reinicia a camada de cima, mesmo que o anterior também fosse ataque
    const restart = upper === 'attack' && this.lastAttackId !== f.attackId;
    if (restart) this.lastAttackId = f.attackId;
    if (L.upper.set(upper, { restart, move: f.move })) this.onAction('upper', upper);
  }
  onAction() {}
  update(dt, t, prevYaw) {
    this.select();
    this.layers.full.tick(dt, FADE.full); this.layers.upper.tick(dt, FADE.upper);
    this.pose(dt, t, prevYaw);
  }
  pose() {}
  // segmento da lâmina (base e ponta, em coordenadas do mundo) num instante do golpe;
  // usado no teste de acerto em sub-passos. O padrão usa as poses de dados.
  bladeAt(m, st, from, outB, outT, pose = {}) {
    const f = this.f;
    f.bladeWorld(f.movePoseAt(m, st, from, pose), outB, outT);
  }
}
