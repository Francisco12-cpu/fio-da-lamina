// Injetado na página de teste (?test). Lutas simuladas por bots, determinísticas.
// Baseado em tools/sim_bots_referencia.py, com o bot "humano" (erro de tempo de ±120 ms).
(() => {
  const g = window.__game;
  window.g = g;
  g.start(); g.rig.intro = 0;
  // gerador próprio dos bots (não mexe no aleatório do jogo)
  let seed = 12345;
  const brand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.botSeed = (s) => { seed = s; };

  window.fight = (encIdx, bot, secs) => {
    const E = g.Encounters.list[encIdx];
    g.Encounters.list.forEach((x, i) => { if (i !== encIdx) { x.cleared = true; x.enemies.forEach((e) => { e.reset(); e.die(0); }); } });
    E.enemies.forEach((e) => e.reset()); E.active = false; E.cleared = false; g.Director.reset();
    if (g.Standoff.active) g.Standoff.active = false;
    g.player.respawn({ x: E.center.x, z: E.center.z + 6 }, 0); g.rig.snap(g.player.pos); g.rig.yaw = 0;
    g.Stats.parries = 0; g.Stats.decisive = 0;
    if (g.onFightStart) g.onFightStart(E);
    const log = { playerHits: 0, parries: 0, broken: 0, blockedByEnemy: 0, enemyParried: 0, time: 0, result: 'timeout' };
    let lastH = g.player.health, pState = '';
    const P = g.player, I = g.Input;
    window._pp = {};
    // duelo: pula o impasse (os bots testam a luta em si)
    if (E.duel) { E.active = true; E.enemies.forEach((e) => (e.aware = true)); }
    for (let f = 0; f < secs * 60; f++) {
      I.keys.clear(); I.blockKey = false; I.atkKey = false;
      bot(P, E.enemies.filter((e) => e.alive), I, f);
      g.update(1 / 60);
      if (g.Standoff.active) { g.Standoff.active = false; document.body.classList.remove('cine'); g.rig.clearCine(); const e = E.enemies[0]; e.aware = true; e.brain = 'circle'; }
      if (P.health < lastH) log.playerHits++; lastH = P.health;
      if (P.state === 'broken' && pState !== 'broken') log.broken++;
      if (P.state === 'stagger' && pState !== 'stagger') log.enemyParried++;
      if (P.state === 'recoil' && pState !== 'recoil') log.blockedByEnemy++;
      pState = P.state;
      if (!P.alive) { log.result = 'died'; log.time = +(f / 60).toFixed(1); break; }
      if (E.enemies.every((e) => !e.alive)) { log.result = 'won'; log.time = +(f / 60).toFixed(1); break; }
    }
    log.parries = g.Stats.parries; log.decisive = g.Stats.decisive;
    log.enemy = E.enemies.map((e) => Math.round(e.stab) + '/' + e.health + (e.alive ? '' : 'x'));
    // deixa a vida do jogador cheia para a próxima luta
    g.Game.respawnT = -1; g.Time.hold = 0; g.Time.slowT = 0; g.Time.scale = 1;
    return log;
  };

  const nearest = (P, en) => { let b = null, bd = 1e9; for (const e of en) { const d = P.pos.distanceTo(e.pos); if (d < bd) { bd = d; b = e; } } return b; };
  const bots = {
    spammer(P, en, I, f) { const e = en[0]; if (!e) return; const d = P.pos.distanceTo(e.pos); if (d > 2.0) I.keys.add('KeyW'); if (d < 2.6 && f % 9 === 0) I.press('attack'); },
    turtle(P, en, I, f) { const e = en[0]; if (!e) return; const d = P.pos.distanceTo(e.pos); if (d > 2.4) I.keys.add('KeyW'); I.blockKey = true; if (f === 0) I.press('blockPress'); },
  };
  // bot habilidoso com erro de tempo configurável (0 = perfeito; 0.12 = humano ±120 ms)
  const skilledWith = (err) => (P, en, I, f) => {
    const e = nearest(P, en); if (!e) return;
    const d = P.pos.distanceTo(e.pos);
    const att = en.find((x) => x.state === 'attack' && P.pos.distanceTo(x.pos) < 4.5);
    if (att) {
      const m = att.move, k = att.attackId + ':' + att.combo;
      if (_pp[k] === undefined) _pp[k] = { off: (brand() * 2 - 1) * err, done: false };
      const pp = _pp[k];
      const contact = g.botContactTime ? g.botContactTime(att, P) : m.w;
      if (m.sig === 'red' || m.unblockable) {
        if (!pp.done && att.st >= contact - 0.1 + pp.off) { pp.done = true; I.press('dodge'); I.keys.add('KeyA'); }
      } else {
        I.blockKey = true;
        if (!pp.done && att.st >= contact - 0.07 + pp.off) { pp.done = true; I.press('blockPress'); }
      }
      return;
    }
    const open = en.find((x) => ['stagger', 'broken', 'recoil', 'hurt'].includes(x.state) || (x.state === 'attack' && x.st > x.move.w + x.move.a));
    if (open && P.pos.distanceTo(open.pos) < 2.6) { if (f % 8 === 0) I.press('attack'); return; }
    I.blockKey = true; if (d > 2.6) I.keys.add('KeyW');
  };
  bots.skilled = skilledWith(0);
  bots.human = skilledWith(0.12);
  window.bots = bots;
})();
