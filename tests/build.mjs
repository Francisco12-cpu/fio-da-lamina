// Testa os builds de produção: dist/ por HTTP e o arquivo único aberto do disco.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, staticServer, launch, openGame } from './lib/harness.mjs';
const srv = await staticServer(5176);
const b = await launch();
let fails = 0;
for (const [nome, url] of [['dist (HTTP)', 'http://localhost:5176/dist/index.html'], ['arquivo único (file://)', pathToFileURL(path.join(ROOT, 'dist-arquivo/index.html')).href]]) {
  try {
    const { pg, logs } = await openGame(b, url + '?test&noaudio&q=1', { w: 640, h: 360 });
    const r = await pg.evaluate(() => { const g = __game; g.start(); g.step(30); return { corpo: g.player.anim.model ? 'modelo 3D' : 'boneco', inimigos: g.Encounters.enemies.length }; });
    const erros = logs.filter((l) => !l.includes('ERR_FAILED') && !l.includes('fonts'));
    console.log(nome.padEnd(26), JSON.stringify(r), erros.length ? erros.join(' | ') : 'sem erros');
    if (r.corpo !== 'modelo 3D' || erros.length) fails++;
    await pg.screenshot({ path: path.join(ROOT, `tests/out/build-${nome.split(' ')[0]}.png`) });
    await pg.close();
  } catch (e) { console.log(nome, 'FALHOU', e.message.slice(0, 300)); fails++; }
}
await b.close(); srv.close();
process.exit(fails ? 1 : 0);
