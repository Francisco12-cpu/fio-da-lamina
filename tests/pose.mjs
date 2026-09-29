// Poses do personagem de perto, sem grama: frente e lado. Uso: node tests/pose.mjs [--boneco] [--nocloak]
import path from 'node:path';
import { ROOT, viteServer, launch, openGame } from './lib/harness.mjs';
const boneco = process.argv.includes('--boneco'), nocloak = process.argv.includes('--nocloak');
const v = await viteServer(5174); const b = await launch();
const { pg, logs } = await openGame(b, `http://localhost:5174/?test&noaudio&q=2${boneco ? '&boneco' : ''}`, { w: 1400, h: 520 });
await pg.addStyleTag({ content: '#grain,#hint,#flash,#vit,#pstab,#tags,#menuBtn,#stats{display:none!important}' });
await pg.evaluate((nc) => {
  const g = __game; g.start(); g.rig.intro = 0; g.grass.forEach((m) => (m.visible = false));
  const P = g.player; P.respawn({ x: 1, z: 164 }, 0); P.draw(); g.step(30);
  if (nc) P.cloth.mesh.visible = false;
  window.shot = async (label, setup, frames) => {};
}, nocloak);
const states = [
  ['guarda', 'P.drawn = true; P.setState("move"); P.target = g.dummy; g.step(20);'],
  ['guardada', 'P.sheathe(); P.setState("move"); P.target = null; g.step(20);'],
  ['preparo', 'P.draw(); P.startAttack(0, g.simT); g.step(6);'],
  ['golpe', 'P.draw(); P.startAttack(0, g.simT); g.step(12);'],
  ['forte', 'P.draw(); P.startAttack(3, g.simT); g.step(28);'],
  ['defesa', 'P.draw(); P.setState("block"); g.step(20);'],
  ['esquiva', 'P.draw(); P.startDodge(1, 0, true, g.simT); g.step(8);'],
  ['trava', 'P.draw(); P.setState("bind"); g.step(20);'],
  ['ferido', 'P.draw(); P.setState("move"); P.health = 1; g.step(30); P.health = 2;'],
  ['morte', 'P.draw(); P.die(g.simT); g.step(80);'],
];
const cams = [['frente', [0, 1.3, -3.2]], ['lado', [3.2, 1.3, 0]]];
for (const [cn, off] of cams) {
  const imgs = [];
  for (const [sn, code] of states) {
    await pg.evaluate(([code, off]) => {
      const g = __game, P = g.player; P.pos.set(1, g.terrain.heightAt(1, 164), 164); P.yaw = 0; P.vel.set(0, 0, 0);
      P.lastCombatT = 1e9; g.UI.fade(false); g.UI.dying(false); g.Later.clear(); if (!P.alive) P.respawn({ x: 1, z: 164 }, 0); new Function('g', 'P', code)(g, P);
      P.root.position.copy(P.pos); P.root.rotation.y = 0;
      const c = g.camera; c.position.set(P.pos.x + off[0], P.pos.y + off[1], P.pos.z + off[2]); c.lookAt(P.pos.x, P.pos.y + 1.0, P.pos.z); c.fov = 40; c.updateProjectionMatrix();
      g.render();
    }, [code, off]);
    const f = path.join(ROOT, `tests/out/pose-${cn}-${sn}.png`);
    await pg.screenshot({ path: f, clip: { x: 500, y: 20, width: 400, height: 500 }, timeout: 120000 });
    imgs.push(f);
  }
}
console.log(logs.filter((l) => !l.includes('ERR_FAILED')).join('\n'));
await b.close(); await v.close();
