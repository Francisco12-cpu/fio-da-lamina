// Uma luta com detalhes. Uso: node tests/one.mjs <encontro> <bot> [runs]
import fs from 'node:fs';
import { ROOT, viteServer, launch, openGame } from './lib/harness.mjs';
const [enc, bot, runs = 3] = process.argv.slice(2);
const v = await viteServer(5174); const b = await launch();
const { pg, logs } = await openGame(b, 'http://localhost:5174/?test&noaudio&q=0', { w: 320, h: 180 });
await pg.addScriptTag({ content: fs.readFileSync(ROOT + '/tests/lib/bots.page.js', 'utf8') });
await pg.evaluate(() => { const orig = g.Encounters.enemies; for (const e of orig) { const r = e.receiveAttack.bind(e); e.receiveAttack = (o) => { e._stBefore = e.state + (e.move ? '@' + e.st.toFixed(2) + '/' + e.move.w.toFixed(2) : ''); return r(o); }; } });
for (let r = 0; r < +runs; r++) console.log(JSON.stringify(await pg.evaluate(([e, bn, r]) => { botSeed(1000 + r * 7919); return fight(+e, bots[bn], 60); }, [enc, bot, r])));
console.log(logs.filter((l) => !l.includes('ERR_FAILED')).join('\n'));
await b.close(); await v.close();
