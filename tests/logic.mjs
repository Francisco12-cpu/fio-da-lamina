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
