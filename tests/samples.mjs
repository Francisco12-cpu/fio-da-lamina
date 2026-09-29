// Verifica o carregamento de sons gravados (usa o que houver em assets/sounds).
import { viteServer, launch } from './lib/harness.mjs';
const v = await viteServer(5174); const b = await launch();
const pg = await b.newPage();
await pg.goto('http://localhost:5174/?test&q=0');
await pg.waitForFunction(() => window.__game, null, { timeout: 120000 });
const r = await pg.evaluate(async () => {
  const { Samples } = await import('/src/audio/samples.js');
  const ctx = new AudioContext();
  const got = await Samples.load(ctx);
  return { arquivos: Samples.names(), carregados: got, tocou: Samples.play(ctx, ctx.destination, 'aparar') };
});
console.log(JSON.stringify(r));
await b.close(); await v.close();
