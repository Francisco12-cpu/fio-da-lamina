// Folhas de contato dos clipes. Uso: node tests/clips.mjs Clip1,Clip2 [n] [side]
import { viteServer, launch } from './lib/harness.mjs';
const [names, n = 8, side = 0] = process.argv.slice(2);
const v = await viteServer(5174); const b = await launch();
for (const c of names.split(',')) {
  const pg = await b.newPage({ viewport: { width: 1600, height: 420 } });
  await pg.goto(`http://localhost:5174/tools/viewer/index.html?clip=${c}&n=${n}&side=${side}`);
  await pg.waitForFunction(() => window.__done, null, { timeout: 120000 });
  if (c === 'list') console.log(await pg.evaluate(() => window.__clips.join(' ')));
  await pg.screenshot({ path: `tests/out/clip-${c}${side ? '-lado' : ''}.png` }); await pg.close();
}
await b.close(); await v.close();
