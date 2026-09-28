import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { Director } from '../combat/director.js';
import { Mastery } from '../combat/rules.js';
import { Bind } from '../combat/bind.js';
import { G, Later } from '../core/time.js';
import { yawTo } from '../core/util.js';
import { Enemy } from '../fighters/enemy.js';
import { Game } from './game.js';
import { Standoff } from './standoff.js';
import { UI } from '../ui/ui.js';
import { pathAtZ } from '../world/props.js';

/* ================================================================
   ENCONTROS — seis lutas e o duelo na trilha, cada uma com checkpoint
   ================================================================ */
export const Encounters = {
  list: [], enemies: [], checkpoint: null, cpYaw: 0, finished: false,
  init() {
    // um tipo novo de cada vez; os grupos crescem até 3 (o diretor deixa só um atacar por vez)
    const defs = [
      { z: 116, spawn: [[0, 0, 'recruta']], hint: 'Inimigos se defendem de frente. Apare e pressione a guarda para quebrar a estabilidade deles. Sem estabilidade, um golpe mata — vale para você também.' },
      { z: 84, spawn: [[-1.6, 0, 'recruta'], [1.8, -2.0, 'agressivo']], hint: 'O de laranja ataca sem parar. Só defender vai quebrar você: apare ou esquive.' },
      { z: 52, spawn: [[0, 0, 'paciente'], [2.2, -2.4, 'recruta']], hint: 'O de azul espera e apara. Golpes em sequência são punidos: seja paciente também.' },
      { z: 20, spawn: [[0, -1.5, 'lanceiro'], [-2.0, 0.5, 'agressivo']], hint: 'A lança alcança longe e estoca (vermelho): esquive, ou apare no último instante. De perto, a lança não defende.' },
      { z: -12, spawn: [[0, 0, 'escudeiro'], [2.4, -2.0, 'lanceiro'], [-2.2, -1.5, 'recruta']], hint: 'O escudo segura golpes leves. Use o golpe forte, ataque pelo lado, ou apare o ataque dele.' },
      { z: -46, spawn: [[0, 0, 'esquivo'], [-2.2, -1.8, 'escudeiro'], [2.3, -1.2, 'agressivo']], hint: 'O de verde foge dos golpes e pune quem ataca à toa. Espere o ataque dele e apare.' },
      { z: -100, spawn: [[0, 0, 'duelista']], duel: true },
    ];
    for (const d of defs) {
      const c = pathAtZ(d.z), back = pathAtZ(d.z + 15);
      const enemies = d.spawn.map(([ox, oz, type]) => new Enemy(new THREE.Vector3(c.x + ox, 0, c.z + oz), type));
      this.enemies.push(...enemies);
      this.list.push({ ...d, center: c, cp: back, enemies, active: false, cleared: false });
    }
    this.checkpoint = { x: G.player.pos.x, z: G.player.pos.z }; this.cpYaw = 0;
  },
  update(dt, t) {
    for (let i = 0; i < this.list.length; i++) {
      const E = this.list[i];
      if (E.cleared) continue;
      const d = Math.hypot(G.player.pos.x - E.center.x, G.player.pos.z - E.center.z);
      if (!E.active && d < 15 && G.player.alive) {
        E.active = true;
        this.checkpoint = { x: E.cp.x, z: E.cp.z }; this.cpYaw = yawTo(E.cp, E.center);
        if (E.duel) { Sound.gong(); Game.dusk = true; Standoff.begin(E.enemies[0]); }
        else E.enemies.forEach((e) => (e.aware = true));
        if (Mastery.lv('focus')) G.player.focus = Math.max(G.player.focus, 1);
        if (E.duel) {}
        else if (E.hint && !E.hinted) { E.hinted = true; UI.clear(); UI.hint(E.hint, 7); }
      }
      if (E.active && E.enemies.every((e) => !e.alive)) {
        E.cleared = true; G.player.health = G.player.maxHealth;
        Later.after(0.9, () => { if (!G.player.target) G.player.ritual(); });
        if (i === this.list.length - 1) Game.finish();
        else { Later.after(1.9, () => Game.offerMastery(i)); }
      }
    }
  },
  resetActive() {
    if (Standoff.active) { Standoff.active = false; document.body.classList.remove('cine'); G.rig.clearCine(); }
    for (const E of this.list) if (E.active && !E.cleared) { E.active = false; E.enemies.forEach((e) => e.reset()); }
    Director.reset(); Bind.reset();
  },
};
