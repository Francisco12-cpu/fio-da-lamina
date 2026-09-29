import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { renderer, scene } from '../render/renderer.js';

/* ================================================================
   CÉU EM HDRI (opcional) — se houver .hdr em assets/hdri/, vira o ambiente de
   reflexos dos metais (katana, guarda, lança). O céu desenhado continua o mesmo
   (tarde → pôr do sol); o HDRI troca junto: arquivo com "por", "sol" ou "sunset"
   no nome é o do pôr do sol, o outro é o da tarde. Sem arquivos: nada muda.
   Desligado nas qualidades "baixa" e "mínima".
   ================================================================ */
const FILES = import.meta.glob('../../assets/hdri/*.hdr', { query: '?url', import: 'default', eager: true });
export const Hdri = {
  maps: { tarde: null, por: null }, enabled: true, cur: null,
  count() { return Object.keys(FILES).length; },
  async load() {
    const entries = Object.entries(FILES);
    if (!entries.length) return false;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const loader = new RGBELoader();
    for (const [path, url] of entries) {
      try {
        const tex = await loader.loadAsync(url);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const env = pmrem.fromEquirectangular(tex).texture; tex.dispose();
        const key = /por|sol|sunset|dusk/i.test(path) ? 'por' : 'tarde';
        if (!this.maps[key]) this.maps[key] = env;
      } catch (e) { console.warn('HDRI não carregou', path, e); }
    }
    pmrem.dispose();
    if (!this.maps.tarde) this.maps.tarde = this.maps.por;
    if (!this.maps.por) this.maps.por = this.maps.tarde;
    return !!this.maps.tarde;
  },
  // chamado a cada quadro com a hora do dia (0 tarde → 1 pôr do sol)
  update(k) {
    const want = !this.enabled || !this.maps.tarde ? null : k > 0.55 ? this.maps.por : this.maps.tarde;
    if (want !== this.cur) { this.cur = want; scene.environment = want; }
  },
};
