import { ProceduralController } from './procedural.js';

// fábrica: usa o modelo 3D quando ele estiver carregado (ver anim/skinned.js), senão o boneco
const factories = [];
export function registerAnimFactory(fn) { factories.unshift(fn); }
export function createAnimController(f, look) {
  for (const fn of factories) { const c = fn(f, look); if (c) return c; }
  return new ProceduralController(f, look);
}
