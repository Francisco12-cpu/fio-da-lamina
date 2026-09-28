import './style.css';
import './core/config.js';
import './core/util.js';
import './render/atmosphere.js';
import './world/terrain.js';
import './render/renderer.js';
import './world/world.js';
import './world/grass.js';
import './world/props.js';
import './fx/fx.js';
import './audio/sound.js';
import './core/input.js';
import './core/time.js';
import './combat/moves.js';
import './fighters/cloak.js';
import './combat/state.js';
import './fighters/fighter.js';
import './fighters/player.js';
import './fighters/enemy.js';
import './combat/director.js';
import './combat/combat.js';
import './fighters/dummy.js';
import './game/training.js';
import './game/camera.js';
import './ui/ui.js';
import './game/encounters.js';
import './game/standoff.js';
import './game/game.js';
import './world/tod.js';
import './core/quality.js';
import './ui/panel.js';
import * as THREE from 'three';
import { Sound } from './audio/sound.js';
import { Director } from './combat/director.js';
import { Habits, Report, Stats } from './combat/state.js';
import { CLEARING, DUMMY_POS, IS_TOUCH, SUN, URLP } from './core/config.js';
import { Input } from './core/input.js';
import { Quality, TIERS } from './core/quality.js';
import { G, Later, Time, advanceSim, clock, simT } from './core/time.js';
import { damp } from './core/util.js';
import { Dummy } from './fighters/dummy.js';
import { Player } from './fighters/player.js';
import { bloodFx, dustFx, leafFx, sparks, splinters } from './fx/fx.js';
import { CameraRig } from './game/camera.js';
import { Encounters } from './game/encounters.js';
import { Game } from './game/game.js';
import { Standoff } from './game/standoff.js';
import { Training } from './game/training.js';
import { Lock } from './game/lockon.js';
import { camera, canvas, composer, renderer, scene } from './render/renderer.js';
import { Panel } from './ui/panel.js';
import { UI } from './ui/ui.js';
import { grassMid, grassNear } from './world/grass.js';
import { Glare, TOD, grainEl } from './world/tod.js';
import { SH, sunLight, terrain } from './world/world.js';

/* ================================================================
   LOOP
   ================================================================ */
const player = (G.player = new Player(new THREE.Vector3(CLEARING.x, 0, CLEARING.z + 5)));
const dummy = (G.dummy = new Dummy(DUMMY_POS.x, DUMMY_POS.z));
G.Encounters = Encounters; G.Game = Game; G.Standoff = Standoff; G.Training = Training;
Encounters.init();
const rig = (G.rig = new CameraRig());
rig.snap(player.pos);
Input.init();

const stats = document.getElementById('stats');
let fpsAcc = 0, fpsN = 0, fpsT = 0;
stats.addEventListener('click', (e) => { e.stopPropagation(); Panel.toggle(); });
document.getElementById('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); Panel.toggle(); });

const startEl = document.getElementById('start');
document.getElementById('ctlText').textContent = IS_TOUCH
  ? 'Polegar esquerdo anda (empurre até a borda para correr), polegar direito olha. Botões à direita: golpe, defesa e esquiva.'
  : 'WASD anda, Shift corre, mouse olha. Botão esquerdo golpeia, direito defende, Espaço esquiva.';
document.getElementById('goText').textContent = IS_TOUCH ? 'Toque para começar' : 'Clique para começar';

function start() {
  if (Input.enabled || Game.ended) return;
  Input.enabled = true; Stats.startT = clock.elapsed;
  Sound.init();
  startEl.classList.add('gone');
  if (IS_TOUCH) {
    document.getElementById('touchUI').hidden = false;
    const fs = document.documentElement.requestFullscreen?.();
    if (fs && fs.then) fs.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } else {
    const p = canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => { Input.noLock = true; });
  }
  canvas.focus();
  Later.after(0.9, () => Training.show());
}
startEl.addEventListener('click', start);
startEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); } });

const tmpV = new THREE.Vector3();
const TEST = URLP.has('test');
function render() { if (Quality.post) composer.render(); else renderer.render(scene, camera); }
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - clock.last) / 1000; clock.last = now;
  dt = Math.min(dt, 0.05);
  update(dt);
  render();
  Quality.frame(dt);
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 0.5) { stats.textContent = `${Math.round(fpsN / fpsAcc)} fps, qualidade ${TIERS[Quality.tier].name}`; fpsAcc = 0; fpsN = 0; fpsT = 0; }
}
function update(realDt) {
  clock.elapsed += realDt;
  const t = clock.elapsed;
  const dt = Panel.open ? 0 : Time.step(realDt);
  advanceSim(dt);
  Later.run();
  SH.uTime.value = simT;

  Input.update();
  const targets = [dummy];
  for (const e of Encounters.enemies) if (e.alive) targets.push(e);
  const speed = Standoff.active ? Standoff.update(dt, simT) : player.tick(dt, simT, rig.yaw, targets);
  for (const e of Encounters.enemies) if (!(Standoff.active && e === Standoff.e)) e.tick(dt, simT, player);
  dummy.update(dt, simT, player);
  Training.update(realDt, player, dummy);
  Encounters.update(realDt, simT);
  Game.update(realDt);
  Habits.update(realDt, player, Encounters.enemies.some((e) => e.alive && e.aware && e.pos.distanceTo(player.pos) < 5));
  sparks.update(dt); splinters.update(dt); bloodFx.update(dt); dustFx.update(dt); leafFx.update(dt);
  Game.atmosphere(dt);
  if (Input.enabled) rig.intro = damp(rig.intro, 0, 1.6, realDt);
  // mira travada: tecla/botão, toque no inimigo, e alvo que cai passa para o próximo
  if (Standoff.active) { if (Lock.target) Lock.release(player); Input.take('lock'); Input.tap = null; }
  else {
    if (Input.take('lock')) {
      if (Lock.target) Lock.release(player);
      else if (!Lock.toggle(player, Encounters.enemies, rig.yaw)) UI.flash('Nenhum alvo à vista');
    }
    if (Input.tap) {
      const e = Lock.pickAtScreen(Input.tap.x, Input.tap.y, Encounters.enemies);
      if (e) { Lock.owner = player; if (Lock.target === e) Lock.release(player); else Lock.set(e, player); }
      Input.tap = null;
    }
    if (Lock.target) { Lock.update(player, Encounters.enemies); if (Lock.target) player.draw(); }
  }
  const fwd = rig.update(realDt, t, player, speed, Encounters.enemies);

  const T = TIERS[Quality.tier], f2 = tmpV.set(fwd.x, 0, fwd.z).normalize();
  const nc = grassNear.material.uniforms.uCenter.value.set(camera.position.x + f2.x * T.nearR * 0.55, 0, camera.position.z + f2.z * T.nearR * 0.55);
  grassMid.material.uniforms.uCenter.value.set(camera.position.x + f2.x * T.midR * 0.5, 0, camera.position.z + f2.z * T.midR * 0.5);
  grassMid.material.uniforms.uNearCenter.value.copy(nc);
  // grama afastada e sombra longa: jogador, câmera e os 2 inimigos vivos mais próximos
  SH.uPush.value[0].set(player.pos.x, player.pos.z, player.drawn ? 1.5 : 0.95, player.drawn ? 1.1 : 0.9);
  SH.uPush.value[1].set(camera.position.x, camera.position.z, 1.3, camera.position.y - terrain.heightAt(camera.position.x, camera.position.z) < 2.2 ? 0.9 : 0);
  SH.uCast.value[0].set(player.pos.x, player.pos.z, player.alive && player.state !== 'down' ? 1.75 : 0.5, 1);
  const near = Encounters.enemies.filter((e) => e.alive).sort((a, b) => a.pos.distanceToSquared(player.pos) - b.pos.distanceToSquared(player.pos));
  for (let k = 0; k < 2; k++) {
    const e = near[k];
    if (e) { SH.uPush.value[2 + k].set(e.pos.x, e.pos.z, e.drawn ? 1.5 : 0.95, e.drawn ? 1.1 : 0.9); SH.uCast.value[2 + k].set(e.pos.x, e.pos.z, 1.75, 1); }
    else { SH.uPush.value[2 + k].w = 0; SH.uCast.value[2 + k].w = 0; }
  }
  // linha de visão para a grama: jogador e o alvo dele (se perto)
  SH.uFocus.value[0].set(player.pos.x, player.pos.y + 1.15, player.pos.z, 1);
  const ft = player.target && player.target.alive !== false && player.target.pos.distanceTo(player.pos) < 10 ? player.target : null;
  if (ft) SH.uFocus.value[1].set(ft.pos.x, ft.pos.y + 1.15, ft.pos.z, 1); else SH.uFocus.value[1].w = 0;
  const dd = Math.hypot(dummy.pos.x - player.pos.x, dummy.pos.z - player.pos.z);
  SH.uCast.value[1].set(dummy.pos.x, dummy.pos.z, 2.1, dd < 60 ? 1 : 0);

  const snapStep = 44 / Math.max(sunLight.shadow.mapSize.x, 1);
  const sx = Math.round(player.pos.x / snapStep) * snapStep, sz = Math.round(player.pos.z / snapStep) * snapStep;
  sunLight.target.position.set(sx, player.pos.y, sz);
  sunLight.position.set(sx + SUN.x * 90, player.pos.y + SUN.y * 90, sz + SUN.z * 90);

  TOD.update(realDt, player);
  Glare.update(realDt);
  const fighting = Encounters.enemies.some((e) => e.alive && e.aware && e.pos.distanceTo(player.pos) < 12);
  Sound.music(realDt, Standoff.active && Standoff.phase !== 'strike' ? 'standoff' : fighting ? 'combat' : 'explore', Math.max(0, TOD.k));
  grainEl.style.transform = `translate(${(Math.random() * 160) | 0}px, ${(Math.random() * 160) | 0}px)`;
  UI.update(realDt, player, t);
}

Quality.apply(URLP.has('q') ? +URLP.get('q') : (IS_TOUCH ? 1 : 3));
if (!URLP.has('test')) Panel.init();
if (!TEST) requestAnimationFrame((n) => { clock.last = n; frame(n); });
document.getElementById('loading').classList.add('gone');
window.__game = { Standoff, Panel, TOD, Report, update, render, player, dummy, rig, Input, Quality, Training, Time, Encounters, Director, Stats, Game, Habits, terrain, camera, start, Lock, Later, UI,
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt); render(); } };
