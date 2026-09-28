// Ferramenta de uso único (Fase 1): divide legacy/index.html em módulos ES sem mudar o código.
// Cada faixa de linhas vira um arquivo; os imports entre módulos são gerados pela análise
// dos identificadores (acorn). Instâncias do topo do grafo (jogador, boneco, câmera) passam
// pelo registro G para evitar ciclos de import com `extends`.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'legacy/index.html'), 'utf8').split('\n');
const L = (a, b) => src.slice(a - 1, b).join('\n');

// [arquivo, [faixas de linhas]]
const MODS = [
  ['core/config.js', [[230, 273]]],
  ['core/util.js', [[275, 320]]],
  ['render/atmosphere.js', [[322, 394]]],
  ['world/terrain.js', [[396, 457]]],
  ['render/renderer.js', [[459, 516]]],
  ['world/world.js', [[518, 653]]],
  ['world/grass.js', [[655, 805]]],
  ['world/props.js', [[807, 1066]]],
  ['fx/fx.js', [[1068, 1155]]],
  ['audio/sound.js', [[1157, 1394]]],
  ['core/input.js', [[1396, 1524]]],
  ['core/time.js', [[1526, 1539]]],
  ['combat/moves.js', [[1541, 1603]]],
  ['fighters/cloak.js', [[1604, 1714]]],
  ['combat/state.js', [[1716, 1745]]],
  ['fighters/fighter.js', [[1747, 2191]]],
  ['fighters/player.js', [[2193, 2249]]],
  ['fighters/enemy.js', [[2251, 2281], [2292, 2423]]],
  ['combat/director.js', [[2282, 2291]]],
  ['combat/combat.js', [[2425, 2461]]],
  ['fighters/dummy.js', [[2462, 2606]]],
  ['game/training.js', [[2608, 2648]]],
  ['game/camera.js', [[2650, 2740]]],
  ['ui/ui.js', [[2742, 2805]]],
  ['game/encounters.js', [[2807, 2853]]],
  ['game/standoff.js', [[2855, 2938]]],
  ['game/game.js', [[2940, 2983]]],
  ['world/tod.js', [[2985, 3052]]],
  ['core/quality.js', [[3054, 3102]]],
  ['ui/panel.js', [[3104, 3181]]],
  ['main.js', [[3183, 3295]]],
];

const code = {};
for (const [f, rs] of MODS) code[f] = rs.map(([a, b]) => L(a, b)).join('\n');

// ajustes manuais (poucos e explícitos)
code['core/time.js'] += `
// relógio real e tempo de simulação (antes eram globais do arquivo único)
const clock = { elapsed: 0, last: performance.now() };
let simT = 0;
function advanceSim(dt) { simT += dt; }
function resetSim(v = 0) { simT = v; }
// registro das instâncias do topo (jogador, boneco, câmera, encontros): evita ciclos de import
const G = {};`;
code['main.js'] = code['main.js']
  .replace("const clock = { elapsed: 0, last: performance.now() };\nlet simT = 0;\n", '')
  .replace('const player = new Player(', 'const player = (G.player = new Player(')
  .replace('CLEARING.z + 5));', 'CLEARING.z + 5)));')
  .replace('const dummy = new Dummy(DUMMY_POS.x, DUMMY_POS.z);', 'const dummy = (G.dummy = new Dummy(DUMMY_POS.x, DUMMY_POS.z));')
  .replace('const rig = new CameraRig();', 'const rig = (G.rig = new CameraRig());')
  .replace('  simT += dt;\n', '  advanceSim(dt);\n');
for (const f of ['game/encounters.js', 'game/standoff.js', 'game/game.js']) code[f] = code[f].replace(/(?<![.\w])player\b/g, 'G.player').replace(/(?<![.\w])rig\b/g, 'G.rig');
code['game/camera.js'] = code['game/camera.js'].replace('const Fx = { shake: (a) => rig.shake(a), punch: (d) => rig.punch(d) };', 'const Fx = { shake: (a) => G.rig.shake(a), punch: (d) => G.rig.punch(d) };');
code['combat/combat.js'] = code['combat/combat.js'].replace('rig.cut(', 'G.rig.cut(');
code['ui/ui.js'] = code['ui/ui.js'].replace('for (const e of Encounters.enemies)', 'for (const e of G.Encounters.enemies)');
code['ui/panel.js'] = code['ui/panel.js'].replace('${stats.textContent}', "${document.getElementById('stats').textContent}");
code['main.js'] = code['main.js'].replace('Encounters.init();', 'G.Encounters = Encounters; G.Game = Game; G.Standoff = Standoff; G.Training = Training;\nEncounters.init();');

// análise: nomes declarados no topo e identificadores usados
const parse = (s) => acorn.parse(s, { ecmaVersion: 2022, sourceType: 'module' });
const info = {};
for (const [f] of MODS) {
  const ast = parse(code[f]);
  const decl = [];
  for (const n of ast.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) decl.push(d.id.name);
    else if ((n.type === 'ClassDeclaration' || n.type === 'FunctionDeclaration') && n.id) decl.push(n.id.name);
  }
  const used = new Set();
  walk.fullAncestor(ast, (node, st, anc) => {
    if (node.type !== 'Identifier') return;
    const p = anc[anc.length - 2];
    if (p && p.type === 'MemberExpression' && p.property === node && !p.computed) return;
    if (p && p.type === 'Property' && p.key === node && !p.computed && !p.shorthand) return;
    if (p && (p.type === 'MethodDefinition' || p.type === 'PropertyDefinition') && p.key === node) return;
    used.add(node.name);
  });
  info[f] = { ast, decl, used };
}
if (!info['core/time.js'].decl.includes('G')) throw new Error('G ausente');

const owner = {};
for (const [f] of MODS) for (const n of info[f].decl) { if (owner[n]) throw new Error('duplicado ' + n + ' em ' + f + ' e ' + owner[n]); owner[n] = f; }
// nomes que ficam só no main (instâncias) não são exportados
const MAIN_ONLY = new Set(Object.keys(owner).filter((n) => owner[n] === 'main.js'));

const THREE_ADDONS = {
  EffectComposer: 'three/addons/postprocessing/EffectComposer.js',
  RenderPass: 'three/addons/postprocessing/RenderPass.js',
  UnrealBloomPass: 'three/addons/postprocessing/UnrealBloomPass.js',
  ShaderPass: 'three/addons/postprocessing/ShaderPass.js',
  mergeGeometries: 'three/addons/utils/BufferGeometryUtils.js',
};

for (const [f] of MODS) {
  const { ast, decl, used } = info[f];
  // exporta as declarações do topo (menos no main)
  let s = code[f];
  if (f !== 'main.js') {
    const starts = ast.body.filter((n) => ['VariableDeclaration', 'ClassDeclaration', 'FunctionDeclaration'].includes(n.type)).map((n) => n.start).sort((a, b) => b - a);
    for (const st of starts) s = s.slice(0, st) + 'export ' + s.slice(st);
  }
  const imports = [];
  if (used.has('THREE')) imports.push("import * as THREE from 'three';");
  for (const [n, p] of Object.entries(THREE_ADDONS)) if (used.has(n)) imports.push(`import { ${n} } from '${p}';`);
  const byMod = {};
  for (const n of used) {
    const o = owner[n];
    if (!o || o === f || MAIN_ONLY.has(n)) continue;
    (byMod[o] = byMod[o] || []).push(n);
  }
  const rel = (to) => { let r = path.posix.relative(path.posix.dirname(f), to); if (!r.startsWith('.')) r = './' + r; return r; };
  for (const o of Object.keys(byMod).sort()) imports.push(`import { ${byMod[o].sort().join(', ')} } from '${rel(o)}';`);
  if (f === 'main.js') {
    // ordem de avaliação igual à do arquivo único (importa a sequência do gerador aleatório)
    const order = MODS.map(([m]) => m).filter((m) => m !== 'main.js');
    imports.unshift("import './style.css';", ...order.map((m) => `import '${rel(m)}';`));
  }
  const out = path.join(ROOT, 'src', f);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, imports.join('\n') + '\n\n' + s.replace(/^\n+/, '') + '\n');
}

// CSS e HTML
const html = src.join('\n');
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
fs.writeFileSync(path.join(ROOT, 'src/style.css'), css.replace(/^\n/, '').replace(/^  /gm, ''));
const body = html.slice(html.indexOf('<body>'), html.indexOf('<script type="module">'));
const head = html.slice(0, html.indexOf('<style>'));
fs.writeFileSync(path.join(ROOT, 'index.html'), head + '</head>\n' + body + '<script type="module" src="./src/main.js"></script>\n</body>\n</html>\n');
console.log('ok', MODS.length, 'módulos');
