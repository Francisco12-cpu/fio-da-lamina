// FPS por nível de qualidade na GPU real da máquina (ANGLE/D3D11), em "celular" (tela pequena,
// toque, densidade 2,6) e opcionalmente com a CPU limitada (4× e 6×, simulando Android médio).
// Uso: node tests/perf.mjs [--throttle 1,4,6] [--tiers 0,1,2,3] [--secs 8] [--pc]
import { chromium } from 'playwright';
import { chromePath, viteServer } from './lib/harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const throttles = arg('--throttle', '1,4').split(',').map(Number), tiers = arg('--tiers', '0,1,2,3').split(',').map(Number);
const enc = +arg('--enc', 4), secs = +arg('--secs', 8), pc = process.argv.includes('--pc'), url0 = arg('--url', 'http://localhost:5174/');
const v = url0.includes('5174') ? await viteServer(5174) : url0.includes('5175') ? await (await import('./lib/harness.mjs')).staticServer(5175) : null;
const b = await chromium.launch({ executablePath: chromePath(), args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-frame-rate-limit=false'] });
const rows = [];
for (const thr of throttles) for (const q of tiers) {
  const ctx = await b.newContext(pc ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 800, height: 370 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await pg.goto(`${url0}?q=${q}&noaudio&perf${arg('--extra', '')}`);
  await pg.waitForFunction(() => window.__game, null, { timeout: 120000 });
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
  const r = await pg.evaluate(async ([secs, enc]) => {
    const g = __game; g.start();
    // luta em grupo: o pior caso típico (3 personagens, capas, partículas, grama)
    const E = g.Encounters.list[enc];
    g.player.respawn({ x: E.center.x, z: E.center.z + 8 }, 0); g.rig.snap(g.player.pos);
    await new Promise((ok) => setTimeout(ok, 2500));
    if (window.__perf) __perf.length = 0; else window.__perf = [];
    const times = []; let last = performance.now(); const t0 = last;
    await new Promise((ok) => { const tick = (now) => { times.push(now - last); last = now; if (now - t0 < secs * 1000) requestAnimationFrame(tick); else ok(); }; requestAnimationFrame(tick); });
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length, p95 = times[Math.floor(times.length * 0.95)];
    const up = __perf.map((x) => x[0]), rd = __perf.map((x) => x[1]), m = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    return { fps: +(1000 / avg).toFixed(1), p95ms: +p95.toFixed(1), updMs: +m(up).toFixed(2), renderMs: +m(rd).toFixed(2), tier: g.Quality.tier, touch: matchMedia('(pointer: coarse)').matches, px: [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio] };
  }, [secs, enc]);
  rows.push({ cpu: thr + '×', ...r });
  console.log(`CPU ${thr}×  nível ${q}  ${String(r.fps).padStart(5)} fps  p95 ${r.p95ms} ms  simulação ${r.updMs} ms  desenho ${r.renderMs} ms`);
  await ctx.close();
}
await b.close(); if (v) await v.close();
