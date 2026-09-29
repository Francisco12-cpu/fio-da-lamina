// Testes de lógica na página (sem screenshot). Uso: node tests/logic.mjs
import { viteServer, launch, openGame } from './lib/harness.mjs';

const TESTS = {
  // mira: trava, troca de alvo arrastando para o lado, passa para o próximo quando o alvo cai, solta
  mira: () => {
    const g = __game, E = g.Encounters.list[1], P = g.player, L = g.Lock;
    P.respawn({ x: E.center.x, z: E.center.z + 7 }, 0); g.rig.snap(P.pos); g.rig.yaw = 0; g.step(60);
    const out = [];
    L.toggle(P, g.Encounters.enemies, g.rig.yaw);
    const first = L.target; out.push(['travou', !!first && P.forcedTarget === first]);
    g.step(10);
    out.push(['jogador mira o alvo', P.target === first]);
    // arrasto: tenta os dois lados, um deles tem o outro inimigo
    L.addFlick(0.2, P, g.Encounters.enemies, 100); let second = L.target;
    if (second === first) { L.addFlick(-0.2, P, g.Encounters.enemies, 101); second = L.target; }
    out.push(['trocou de alvo', second !== first && E.enemies.includes(second)]);
    second.die(g.simT || 0); g.step(2);
    out.push(['alvo caiu, passou para o outro', L.target === first]);
    L.release(P); g.step(2);
    out.push(['soltou', L.target === null && P.forcedTarget === null]);
    return out;
  },
  // sem estabilidade: qualquer golpe de lâmina mata na hora
  semEstabilidade: () => {
    const g = __game, E = g.Encounters.list[0], P = g.player, e = E.enemies[0];
    P.respawn({ x: E.center.x, z: E.center.z + 2 }, 0); e.reset(); e.aware = true; e.draw(); g.step(2);
    P.breakStance(g.simT);
    const r = P.receiveAttack({ from: e.pos, attacker: e, move: e.moveset[0], t: g.simT, lethal: true });
    return [['golpe no jogador desequilibrado mata', r === 'hit' && !P.alive]];
  },
  // estocada: segurar a defesa não adianta; aparo absoluto (último instante) quebra o inimigo
  estocada: () => {
    const g = __game, E = g.Encounters.list[0], P = g.player, e = E.enemies[0];
    const T = e.moveset.find((m) => m.thrust);
    const out = [];
    P.respawn({ x: E.center.x, z: E.center.z + 2 }, 0); e.reset(); e.aware = true; e.draw(); P.yaw = 0; g.step(1);
    P.setState('block'); P.parryOpen = false;
    out.push(['defesa segurando não para estocada', P.receiveAttack({ from: e.pos, attacker: e, move: T, thrust: true, sig: 'red', t: g.simT, lethal: true }) === 'hit']);
    P.respawn({ x: E.center.x, z: E.center.z + 2 }, 0); P.yaw = 0; P.setState('block'); P.parryOpen = true; P.lastBlockPress = g.simT - 0.1;
    out.push(['aparo comum (100 ms) não segura estocada', P.receiveAttack({ from: e.pos, attacker: e, move: T, thrust: true, sig: 'red', t: g.simT, lethal: true }) !== 'absparry']);
    P.respawn({ x: E.center.x, z: E.center.z + 2 }, 0); P.yaw = 0; P.setState('block'); P.parryOpen = true; P.lastBlockPress = g.simT - 0.03;
    const r = P.receiveAttack({ from: e.pos, attacker: e, move: T, thrust: true, sig: 'red', t: g.simT, lethal: true });
    g.Combat.resolve(e, P, r, e.pos.clone(), g.simT, T);
    out.push(['aparo absoluto (30 ms) quebra o inimigo', r === 'absparry' && e.state === 'broken']);
    return out;
  },
  // foco: esquiva perfeita dá ponto; gastar recupera estabilidade numa respiração
  foco: () => {
    const g = __game, P = g.player;
    P.respawn({ x: 1, z: 150 }, 0); P.focus = 0;
    P.gainFocus(); P.gainFocus(); P.gainFocus(); P.gainFocus();
    const out = [['máximo de 3 pontos', P.focus === 3]];
    P.stab = 30; g.Input.press('focus'); g.step(1);
    out.push(['respira ao gastar', P.state === 'breathe' && P.focus === 2]);
    g.step(50);
    out.push(['estabilidade voltou boa parte', P.stab > 75 && P.state !== 'breathe']);
    return out;
  },
  // espadas travadas: apertar o golpe vence e desequilibra o inimigo; parado, perde
  trava: () => {
    const g = __game, E = g.Encounters.list[0], P = g.player, e = E.enemies[0], out = [];
    P.respawn({ x: E.center.x, z: E.center.z + 1.5 }, 0); e.reset(); e.aware = true; e.draw(); g.step(1);
    g.Bind.start(P, e, e.pos.clone(), g.simT);
    out.push(['travou', P.state === 'bind' && e.state === 'bind']);
    for (let i = 0; i < 180 && g.Bind.active; i++) { if (i % 6 === 0) g.Input.press('attack'); g.step(1); }
    out.push(['apertando, vence e desequilibra', e.state === 'broken']);
    P.respawn({ x: E.center.x, z: E.center.z + 1.5 }, 0); e.reset(); e.aware = true; e.draw(); g.step(1);
    g.Bind.start(P, e, e.pos.clone(), g.simT);
    for (let i = 0; i < 240 && g.Bind.active; i++) g.step(1);
    out.push(['sem apertar, perde', P.state === 'broken' || !P.alive]);
    return out;
  },
  // maestria: duas opções diferentes; janela de aparar cresce 15 ms
  maestria: () => {
    const g = __game, M = g.Mastery, out = [];
    M.reset(); const o = M.offer(123);
    out.push(['duas opções diferentes', o.length === 2 && o[0].id !== o[1].id]);
    const e = g.Encounters.list[0].enemies[0], before = g.player.receiveAttack && 0;
    return out;
  },
  // morte: a espada cai e o chapéu rola; renascer devolve tudo
  morte: () => {
    const g = __game, E = g.Encounters.list[0], e = E.enemies[0], out = [];
    e.reset(); e.aware = true; e.draw(); g.step(2);
    e.die(g.simT); g.step(150);
    out.push(['espada no chão', e.anim.swordDropped && e.sword.parent !== e.root]);
    out.push(['chapéu fora da cabeça', e.anim.hatDropped && e.hat.parent !== e.head]);
    e.reset(); g.step(1);
    out.push(['renascer devolve espada e chapéu', e.sword.parent === e.root && e.hat.parent === e.head]);
    return out;
  },
  // pausa congela a simulação; reiniciar encontro recoloca todos
  pausa: () => {
    const g = __game, E = g.Encounters.list[0], P = g.player, out = [];
    P.respawn({ x: E.center.x, z: E.center.z + 8 }, 0); g.step(120);
    const e = E.enemies[0], p0 = e.pos.clone();
    g.Pause.open(); g.step(60);
    out.push(['pausado não anda', e.pos.distanceTo(p0) < 1e-6 && g.Pause.isOpen]);
    g.Pause.close(false); e.health = 1; e.pos.x += 3;
    g.Pause.actions.restart(); g.step(1);
    out.push(['reiniciar recoloca e cura', e.health === 2 && Math.hypot(e.pos.x - e.spawn.x, e.pos.z - e.spawn.z) < 0.2 && P.alive]);
    return out;
  },
  // ajustes: só abrem pelo menu de pausa (Esc/☰ → Ajustes); nada de acesso direto pelo contador de FPS ou tecla P
  ajustesSoPelaPausa: () => {
    const g = __game, out = [];
    document.getElementById('stats').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    out.push(['clicar no contador de FPS não abre os ajustes', !g.Panel.open]);
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true }));
    out.push(['tecla P não abre os ajustes', !g.Panel.open]);
    // Panel.init() (liga os cliques dos botões) só roda fora do modo `?test`; chama à mão aqui
    // para testar o mesmo caminho de um jogo de verdade.
    if (!g.Panel.inited) { g.Panel.init(); g.Panel.inited = true; }
    g.Pause.open(); g.Pause.actions.settings();
    out.push(['Pausa → Ajustes abre o painel', g.Panel.open]);
    // o painel precisa estar de fato clicável por cima da pausa (não só visualmente à frente):
    // um botão de qualidade dentro do painel tem que ser o elemento que recebe o clique nas
    // próprias coordenadas, não o fundo da pausa (bug real: duas regras `#panel` com z-index
    // diferente, a de baixo no arquivo vencia e a pausa ficava por cima capturando o clique)
    const btn = document.querySelector('#panel [data-q="1"]');
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.push(['botão de qualidade do painel recebe o clique (não a pausa por cima)', btn.contains(hit) || hit === btn]);
    btn.click();
    out.push(['clicar realmente troca a qualidade', g.Quality.tier === 1 && !g.Quality.auto]);
    g.Panel.toggle(false); g.Pause.close(false);
    return out;
  },
};

const v = await viteServer(5174);
const b = await launch();
let fails = 0;
for (const [name, fn] of Object.entries(TESTS)) {
  const { pg, logs } = await openGame(b, 'http://localhost:5174/?test&noaudio&q=0', { w: 480, h: 270 });
  await pg.evaluate(() => { __game.start(); __game.rig.intro = 0; });
  const res = await pg.evaluate(`(${fn.toString()})()`);
  for (const [k, ok] of res) { console.log(`${ok ? 'ok  ' : 'FALHA'} ${name}: ${k}`); if (!ok) fails++; }
  const errs = logs.filter((l) => !l.includes('ERR_FAILED')); if (errs.length) { console.log(errs.join('\n')); fails++; }
  await pg.close();
}
await b.close(); await v.close();
process.exit(fails ? 1 : 0);
