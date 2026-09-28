// Compara duas pastas de screenshots. Uso: node tests/diff.mjs pastaA pastaB
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const [a, b] = process.argv.slice(2);
let bad = 0;
for (const f of fs.readdirSync(a).filter((x) => x.endsWith('.png'))) {
  if (!fs.existsSync(path.join(b, f))) { console.log(f, 'ausente'); bad++; continue; }
  const A = PNG.sync.read(fs.readFileSync(path.join(a, f))), B = PNG.sync.read(fs.readFileSync(path.join(b, f)));
  const D = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
  const pct = (100 * n) / (A.width * A.height);
  console.log(f.padEnd(16), n ? `${pct.toFixed(3)}% diferente` : 'idêntico');
  if (n) fs.writeFileSync(path.join(b, f.replace('.png', '.diff.png')), PNG.sync.write(D));
  if (pct > 0.5) bad++;
}
process.exit(bad ? 1 : 0);
