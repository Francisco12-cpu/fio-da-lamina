import { chromium } from 'playwright';
import { chromePath } from './lib/harness.mjs';
for (const args of [['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'], ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']]) {
  const b = await chromium.launch({ executablePath: chromePath(), args, headless: true });
  const pg = await b.newPage();
  await pg.setContent('<canvas id=c></canvas>');
  console.log(args[0], await pg.evaluate(() => { const gl = document.getElementById('c').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL); }));
  await b.close();
}
