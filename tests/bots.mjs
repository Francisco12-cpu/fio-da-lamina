// Lutas simuladas por bots. Uso: node tests/bots.mjs [--legacy] [--runs N] [--bots a,b] [--enc 0,1] [--out arquivo.json]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, viteServer, staticServer, launch, openGame } from './lib/harness.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const legacy = process.argv.includes('--legacy');
const runs = +arg('--runs', 4);
const botNames = arg('--bots', 'spammer,turtle,skilled,human').split(',');
const secs = +arg('--secs', 60);
const noUps = process.argv.includes('--noups');
const out = arg('--out', path.join(ROOT, 'tests/out', legacy ? 'bots-legacy.json' : 'bots.json'));

const srv = legacy ? await staticServer(5175) : await viteServer(5174);
const url = legacy ? 'http://localhost:5175/legacy/index.html?test&noaudio&q=0' : 'http://localhost:5174/?test&noaudio&q=0';
const b = await launch();
const { pg, logs } = await openGame(b, url, { w: 320, h: 180 });
await pg.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'tests/lib/bots.page.js'), 'utf8') });
const names = await pg.evaluate(() => g.Encounters.list.map((E) => E.enemies.map((e) => e.type.label).join('+')));
const encs = arg('--enc', names.map((_, i) => i).join(',')).split(',').map(Number);
const results = {};
for (const enc of encs) {
  for (const bot of botNames) {
    const rs = [];
    for (let r = 0; r < runs; r++) rs.push(await pg.evaluate(([e, bn, s, r, nu]) => { botSeed(1000 + r * 7919); return fight(e, bots[bn], s, nu ? { upgrades: [] } : {}); }, [enc, bot, secs, r, noUps]));
    const won = rs.filter((x) => x.result === 'won');
    const noParryWins = won.filter((x) => x.parries === 0).length;
    results[`${names[enc]}|${bot}`] = rs;
    console.log(`${names[enc].padEnd(22)} ${bot.padEnd(8)} venceu ${won.length}/${runs}  morreu ${rs.filter((x) => x.result === 'died').length}  sem-aparo ${noParryWins}  t=${won.map((x) => x.time).join(',')}`);
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 1));
if (logs.filter((l) => !l.includes('ERR_FAILED')).length) console.log(logs.join('\n'));
await b.close(); await srv.close();
