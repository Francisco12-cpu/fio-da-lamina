import { IS_TOUCH, URLP } from './config.js';
import { clamp } from './util.js';
import { bloodFx, dustFx, leafFx, sparks, splinters } from '../fx/fx.js';
import { bloom, camera, composer, raysHi, raysLo, renderer } from '../render/renderer.js';
import { Panel } from '../ui/panel.js';
import { GRASS_MAX_MID, GRASS_MAX_NEAR, grassMid, grassNear } from '../world/grass.js';
import { MOTES_MAX, motes } from '../world/props.js';
import { skyMat, sunLight } from '../world/world.js';

/* ================================================================
   QUALIDADE — no celular, 30 fps é aceitável: só desce abaixo de ~26
   ================================================================ */
export const TIERS = [
  { name: 'mínima', dpr: 0.8,  near: 18000, nearR: 11, mid: 14000, midR: 52,  shadow: 1024, post: false, rays: '',   bloom: false, motes: 90 },
  { name: 'baixa',  dpr: 1.0,  near: 32000, nearR: 14, mid: 20000, midR: 64,  shadow: 1024, post: true,  rays: 'lo', bloom: false, motes: 160 },
  { name: 'média',  dpr: 1.25, near: 55000, nearR: 18, mid: 26000, midR: 80,  shadow: 2048, post: true,  rays: 'lo', bloom: true,  motes: 240 },
  { name: 'alta',   dpr: 1.75, near: GRASS_MAX_NEAR, nearR: 22, mid: GRASS_MAX_MID, midR: 110, shadow: 2048, post: true, rays: 'hi', bloom: true, motes: MOTES_MAX },
];
export const Quality = {
  tier: 3, auto: !URLP.has('q'), maxAuto: IS_TOUCH ? 2 : 3, acc: 0, n: 0, cool: 3, good: 0, upBlock: 0,
  down: IS_TOUCH ? 26 : 44, up: IS_TOUCH ? 52 : 57,
  apply(i) {
    this.tier = clamp(i, 0, TIERS.length - 1);
    const T = TIERS[this.tier], dpr = Math.min(devicePixelRatio || 1, T.dpr);
    renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr);
    resize();
    const un = grassNear.material.uniforms, um = grassMid.material.uniforms;
    grassNear.geometry.instanceCount = T.near; un.uSize.value = T.nearR * 2; un.uRadius.value = T.nearR;
    grassMid.geometry.instanceCount = T.mid; um.uSize.value = T.midR * 2; um.uRadius.value = T.midR; um.uNearR.value = T.nearR;
    this.post = T.post; bloom.enabled = T.bloom; raysHi.enabled = T.rays === 'hi'; raysLo.enabled = T.rays === 'lo';
    skyMat.uniforms.uGlow.value = T.bloom ? 0 : 1;
    sunLight.castShadow = T.shadow > 0;
    if (T.shadow > 0 && sunLight.shadow.mapSize.x !== T.shadow) {
      sunLight.shadow.mapSize.set(T.shadow, T.shadow);
      if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    }
    motes.geometry.setDrawRange(0, T.motes);
    [motes.material, sparks.mat, splinters.mat, bloodFx.mat, dustFx.mat, leafFx.mat].forEach((m) => (m.uniforms.uPx.value = dpr));
  },
  frame(dt) {
    if (!this.auto) return;
    this.cool -= dt; this.upBlock -= dt; this.acc += dt; this.n++;
    if (this.acc < 2) return;
    const fps = this.n / this.acc; this.acc = 0; this.n = 0;
    if (this.cool > 0) return;
    if (fps < this.down * 0.6 && this.tier > 0) { this.apply(Math.max(0, this.tier - 2)); this.cool = 3; this.upBlock = 30; this.good = 0; }
    else if (fps < this.down && this.tier > 0) { this.apply(this.tier - 1); this.cool = 3; this.upBlock = 30; this.good = 0; }
    else if (fps > this.up && this.tier < this.maxAuto && this.upBlock <= 0) { if (++this.good >= 3) { this.apply(this.tier + 1); this.cool = 3; this.good = 0; } }
    if (Panel.open) Panel.refreshQ();
    else this.good = 0;
  },
};
export function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
