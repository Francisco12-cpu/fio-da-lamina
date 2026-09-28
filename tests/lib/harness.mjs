// Infra comum dos testes: servidor (Vite para o projeto, estático para o legado) e navegador headless.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// servidor estático simples; o legado usa CDN, então reescrevemos o importmap para o three local
export function staticServer(port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json', '.bin': 'application/octet-stream' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(f);
    if (p === '/legacy/index.html') {
      body = body.toString().replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/', '/node_modules/three/').replace(/<link href="https:\/\/fonts.googleapis[^>]*>/, '');
    }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}

export async function viteServer(port = 5174) {
  const { createServer } = await import('vite');
  const s = await createServer({ root: ROOT, server: { port, strictPort: true }, logLevel: 'error' });
  await s.listen();
  return s;
}

export function chromePath() {
  const base = path.join(os.homedir(), 'AppData/Local/ms-playwright');
  if (fs.existsSync(base)) {
    const d = fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort().pop();
    if (d) { const e = path.join(base, d, 'chrome-win64/chrome.exe'); if (fs.existsSync(e)) return e; }
  }
  return undefined;
}

export async function launch() {
  return chromium.launch({ executablePath: chromePath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

// abre a página de teste, com pointer lock desligado e fontes externas bloqueadas
export async function openGame(browser, url, { w = 960, h = 540 } = {}) {
  const pg = await browser.newPage({ viewport: { width: w, height: h } });
  const logs = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', (e) => logs.push('ERR: ' + e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await pg.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
  await pg.goto(url);
  await pg.waitForFunction(() => window.__game, null, { timeout: 120000 });
  return { pg, logs };
}
