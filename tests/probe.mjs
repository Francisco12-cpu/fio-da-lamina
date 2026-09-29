import { viteServer, launch, openGame } from './lib/harness.mjs';
const v = await viteServer(5174); const b = await launch();
const { pg, logs } = await openGame(b, 'http://localhost:5174/?test&noaudio&q=0', { w: 320, h: 180 });
const reqs = []; pg.on('requestfailed', (r) => reqs.push(r.url()));
console.log(await pg.evaluate(process.argv[2]));
console.log(logs.join('\n'));
await b.close(); await v.close();
