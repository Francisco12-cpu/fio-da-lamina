import * as THREE from 'three';
import { Sound } from '../audio/sound.js';
import { Director } from '../combat/director.js';
import { G, Later } from '../core/time.js';
import { yawTo } from '../core/util.js';
import { Enemy } from '../fighters/enemy.js';
import { Game } from './game.js';
import { Standoff } from './standoff.js';
import { UI } from '../ui/ui.js';
import { pathAtZ } from '../world/props.js';

/* ================================================================
   ENCONTROS — três lutas na trilha, cada uma com checkpoint
   ================================================================ */
export const Encounters = {
  list: [], enemies: [], checkpoint: null, cpYaw: 0, finished: false,
  init() {
    const defs = [
      { z: 108, spawn: [[0, 0, 'recruta']], hint: 'Inimigos se defendem de frente. Apare e pressione a guarda para quebrar a estabilidade deles.' },
      { z: 38, spawn: [[-1.6, 0, 'recruta'], [1.8, -2.0, 'agressivo']], hint: 'O de laranja ataca sem parar. Só defender vai quebrar você: apare ou esquive.' },
      { z: -35, spawn: [[0, 0, 'paciente']], hint: 'O de azul espera e apara. Golpes em sequência são punidos: seja paciente também.' },
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
        if (E.duel) {}
        else if (E.hint && !E.hinted) { E.hinted = true; UI.clear(); UI.hint(E.hint, 7); }
      }
      if (E.active && E.enemies.every((e) => !e.alive)) {
        E.cleared = true; G.player.health = G.player.maxHealth;
        Later.after(0.9, () => { if (!G.player.target) G.player.ritual(); });
        if (i === this.list.length - 1) Game.finish();
        else Later.after(1.2, () => UI.hint('Siga a trilha', 4));
      }
    }
  },
  resetActive() {
    if (Standoff.active) { Standoff.active = false; document.body.classList.remove('cine'); G.rig.clearCine(); }
    for (const E of this.list) if (E.active && !E.cleared) { E.active = false; E.enemies.forEach((e) => e.reset()); }
    Director.reset();
  },
};
