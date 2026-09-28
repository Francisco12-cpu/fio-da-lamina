// Screenshots de posições fixas. Uso: node tests/screens.mjs [--legacy] [--dir pasta] [--q 2] [--only nome]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, viteServer, staticServer, launch, openGame } from './lib/harness.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const legacy = process.argv.includes('--legacy');
const dir = path.resolve(ROOT, arg('--dir', 'tests/screens/atual'));
const q = arg('--q', '2');
const only = arg('--only', '');
fs.mkdirSync(dir, { recursive: true });

// cada cena: função executada na página (depois de __game.start()); deve deixar a cena pronta
export const SCENES = {
  clareira: () => { const g = __game; g.step(90); },
  trilha: () => {
    const g = __game, p = g.terrain.ps.reduce((a, b) => (Math.abs(b.z - 72) < Math.abs(a.z - 72) ? b : a));
    g.player.respawn({ x: p.x, z: p.z }, 0); g.rig.snap(g.player.pos); g.rig.yaw = 0.15; g.TOD.k = -1; g.step(120);
  },
  duelo: () => {
    const g = __game, E = g.Encounters.list[g.Encounters.list.length - 1];
    g.Encounters.list.forEach((x) => { if (x !== E) { x.cleared = true; x.enemies.forEach((e) => { e.reset(); e.die(0); }); } });
    g.player.respawn({ x: E.center.x, z: E.center.z + 13 }, 0); g.rig.snap(g.player.pos); g.rig.yaw = 0; g.TOD.k = -1; g.step(200);
  },
  grupo: () => {
    const g = __game, E = g.Encounters.list[1];
    g.player.respawn({ x: E.center.x, z: E.center.z + 8 }, 0); g.rig.snap(g.player.pos); g.rig.yaw = 0; g.TOD.k = -1; g.step(240);
  },
};

const srv = legacy ? await staticServer(5175) : await viteServer(5174);
const base = legacy ? 'http://localhost:5175/legacy/index.html' : 'http://localhost:5174/';
const b = await launch();
for (const [name, fn] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(name)) continue;
  const { pg, logs } = await openGame(b, `${base}?test&noaudio&q=${q}`);
  await pg.addStyleTag({ content: '#grain{display:none!important} #stats{visibility:hidden} *{transition:none!important}' });
  await pg.evaluate(() => { __game.start(); __game.rig.intro = 0; });
  await pg.evaluate(`(${fn.toString()})()`);
  await pg.evaluate(() => __game.render());
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: path.join(dir, name + '.png') });
  const errs = logs.filter((l) => !l.includes('ERR_FAILED'));
  console.log(name, errs.length ? errs.join(' | ') : 'ok');
  await pg.close();
}
await b.close(); await srv.close();
