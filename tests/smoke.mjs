import { viteServer, launch, openGame } from './lib/harness.mjs';
const v = await viteServer(5174);
const b = await launch();
const { pg, logs } = await openGame(b, 'http://localhost:5174/?test&noaudio&q=1');
await pg.evaluate(() => { __game.start(); __game.step(30); });
await pg.screenshot({ path: 'tests/out/smoke.png' });
console.log(logs.join('\n') || 'sem erros');
await b.close(); await v.close();
