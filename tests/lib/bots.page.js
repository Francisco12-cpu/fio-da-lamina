// Injetado na página de teste (?test). Lutas simuladas por bots, determinísticas.
// Baseado em tools/sim_bots_referencia.py, com o bot "humano" (erro de tempo de ±120 ms)
// e bots para as mecânicas novas (esquiva perfeita + foco, espadas travadas).
(() => {
  const g = window.__game;
  window.g = g;
  g.start(); g.rig.intro = 0;
  g.Game.autoMastery = true;
  // gerador próprio dos bots (não mexe no aleatório do jogo)
  let seed = 12345;
  const brand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.botSeed = (s) => { seed = s; };

  // progressão simulada: melhorias que um jogador teria ao chegar a cada encontro
  const PROG = ['parry', 'regen', 'pdodge', 'counter', 'guard', 'parry'];
  window.fight = (encIdx, bot, secs, opts = {}) => {
    const E = g.Encounters.list[encIdx];
    g.Encounters.list.forEach((x, i) => { if (i !== encIdx) { x.cleared = true; x.enemies.forEach((e) => { e.reset(); e.die(0); }); } });
    E.enemies.forEach((e) => e.reset()); E.active = false; E.cleared = false; g.Director.reset(); g.Bind.reset();
    if (g.Standoff.active) g.Standoff.active = false;
    g.Mastery.reset();
    const ups = opts.upgrades === undefined ? PROG.slice(0, encIdx) : opts.upgrades;
    ups.forEach((u) => g.Mastery.take(u));
    if (opts.diff) g.Rules.diff = opts.diff;
    g.player.respawn({ x: E.center.x, z: E.center.z + 6 }, 0); g.rig.snap(g.player.pos); g.rig.yaw = 0;
    g.Stats.parries = 0; g.Stats.decisive = 0; g.Stats.binds = 0; g.Stats.absParries = 0; if (g.Later) g.Later.clear(); g.UI.fade(false);
    const log = { playerHits: 0, parries: 0, broken: 0, blockedByEnemy: 0, enemyParried: 0, pdodges: 0, focusUsed: 0, binds: 0, bindWon: 0, time: 0, result: 'timeout' };
    let lastH = g.player.health, pState = '', lastFocus = g.player.focus;
    const P = g.player, I = g.Input;
    window._pp = {};
    // registra cada contato: quem atacou, resultado e estado do defensor
    const res = (log.res = {});
    if (!g.Combat._orig) g.Combat._orig = g.Combat.resolve;
    g.Combat.resolve = function (att, def, r, pt, t, m) { const k = (att.isPlayer ? 'P>' : 'E>') + r + (r === 'hit' && !att.isPlayer ? '' : r === 'hit' ? ':' + (def._stBefore || '') : ''); res[k] = (res[k] || 0) + 1; return g.Combat._orig.call(this, att, def, r, pt, t, m); };
    // duelo: pula o impasse (os bots testam a luta em si)
    if (E.duel) { E.active = true; E.enemies.forEach((e) => (e.aware = true)); }
    for (let f = 0; f < secs * 60; f++) {
      I.keys.clear(); I.blockKey = false; I.atkKey = false;
      bot(P, E.enemies.filter((e) => e.alive), I, f);
      const wasBind = P.state === 'bind';
      g.update(1 / 60);
      g.Game.paused = false;
      if (g.Standoff.active) { g.Standoff.active = false; document.body.classList.remove('cine'); g.rig.clearCine(); const e = E.enemies[0]; e.aware = true; e.brain = 'circle'; }
      if (P.health < lastH) log.playerHits++; lastH = P.health;
      if (P.state === 'broken' && pState !== 'broken') { log.broken++; if (wasBind) log.bindLost = (log.bindLost || 0) + 1; }
      if (P.state === 'stagger' && pState !== 'stagger') log.enemyParried++;
      if (P.state === 'recoil' && pState !== 'recoil') log.blockedByEnemy++;
      if (P.state === 'breathe' && pState !== 'breathe') log.focusUsed++;
      if (P.focus > lastFocus) log.pdodges++;
      lastFocus = P.focus;
      if (wasBind && P.state !== 'bind' && P.state !== 'broken' && E.enemies.some((e) => e.state === 'broken')) log.bindWon++;
      pState = P.state;
      if (!P.alive) { log.result = 'died'; log.time = +(f / 60).toFixed(1); break; }
      if (E.enemies.every((e) => !e.alive)) { log.result = 'won'; log.time = +(f / 60).toFixed(1); break; }
    }
    log.parries = g.Stats.parries; log.decisive = g.Stats.decisive; log.binds = g.Stats.binds || 0; log.abs = g.Stats.absParries || 0;
    log.enemy = E.enemies.map((e) => Math.round(e.stab) + '/' + e.health + (e.alive ? '' : 'x'));
    g.Game.respawnT = -1; g.Time.hold = 0; g.Time.slowT = 0; g.Time.scale = 1; g.Rules.diff = 'normal';
    return log;
  };

  const nearest = (P, en) => { let b = null, bd = 1e9; for (const e of en) { const d = P.pos.distanceTo(e.pos); if (d < bd) { bd = d; b = e; } } return b; };
  const mash = (I, f) => { if (f % 8 === 0) I.press('attack'); };
  const bots = {
    spammer(P, en, I, f) { if (P.state === 'bind') return mash(I, f); const e = nearest(P, en); if (!e) return; const d = P.pos.distanceTo(e.pos); if (d > 2.0) I.keys.add('KeyW'); if (d < 2.6 && f % 9 === 0) I.press('attack'); },
    turtle(P, en, I, f) { const e = nearest(P, en); if (!e) return; const d = P.pos.distanceTo(e.pos); if (d > 2.4) I.keys.add('KeyW'); I.blockKey = true; if (f === 0) I.press('blockPress'); },
  };
  // bot habilidoso com erro de tempo configurável (0 = perfeito; 0.12 = humano ±120 ms)
  //   mode 'dodge': esquiva tudo no tempo certo e usa foco, nunca ataca (testa esquiva perfeita + foco)
  //   mode 'bind': ataca junto com o inimigo para provocar a trava e aperta o golpe sem parar
  const skilledWith = (err, mode = '') => (P, en, I, f) => {
    if (P.state === 'bind') return mash(I, f);
    const e = nearest(P, en); if (!e) return;
    const d = P.pos.distanceTo(e.pos);
    const att = en.find((x) => x.state === 'attack' && P.pos.distanceTo(x.pos) < 4.5);
    // foco: recupera o fôlego quando ninguém está atacando
    if (!att && P.focus > 0 && P.stab < 45 && (P.state === 'move' || P.state === 'block')) { I.press('focus'); return; }
    if (att) {
      const m = att.move, k = att.attackId + ':' + att.combo;
      // finta: um humano reage de novo, com atraso (o bot perfeito não se engana)
      if (_pp[k] === undefined) _pp[k] = { off: (brand() * 2 - 1) * err + (att.fromFeint && err > 0 ? 0.1 + brand() * 0.1 : 0), done: false };
      const pp = _pp[k];
      const contact = m.w;
      if (mode === 'bind' && !m.sig && !pp.done && att.st >= contact - 0.2 && d < 2.4) { pp.done = true; I.press('attack'); return; }
      if (mode === 'dodge' || m.sig === 'red') {
        if (!pp.done && att.st >= contact - 0.1 + pp.off) { pp.done = true; I.press('dodge'); I.keys.add('KeyA'); }
      } else {
        I.blockKey = true;
        if (!pp.done && att.st >= contact - 0.07 + pp.off) { pp.done = true; I.press('blockPress'); }
      }
      return;
    }
    if (mode === 'dodge') { if (d > 3) I.keys.add('KeyW'); return; }
    const open = en.find((x) => ['stagger', 'broken', 'hurt'].includes(x.state) || (x.state === 'recoil' && !x.shield) || (x.state === 'attack' && x.st > x.move.w + x.move.a));
    if (open && P.pos.distanceTo(open.pos) < 2.6) { if (f % 8 === 0) I.press('attack'); return; }
    I.blockKey = true; if (d > 2.6) I.keys.add('KeyW');
  };
  bots.skilled = skilledWith(0);
  bots.human = skilledWith(0.12);
  bots.dodger = skilledWith(0.03, 'dodge');
  bots.binder = skilledWith(0.12, 'bind');
  window.bots = bots;
})();
