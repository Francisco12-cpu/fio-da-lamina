import { Sound } from '../audio/sound.js';
import { _up, _v } from '../combat/moves.js';
import { Stats } from '../combat/state.js';
import { Input } from '../core/input.js';
import { G, Later, clock } from '../core/time.js';
import { rand } from '../core/util.js';
import { leafFx } from '../fx/fx.js';
import { Encounters } from './encounters.js';
import { UI } from '../ui/ui.js';
import { DUEL_TREE } from '../world/props.js';

/* ================================================================
   JOGO — morte, retorno ao checkpoint, fim da demonstração
   ================================================================ */
export const Game = {
  respawnT: -1, ended: false, dusk: false, leafAcc: 0,
  atmosphere(dt) {
    // folhas caindo da árvore do duelo quando o jogador está por perto
    if (G.player.pos.distanceTo(DUEL_TREE) < 70) {
      this.leafAcc += dt * (this.dusk ? 26 : 12);
      while (this.leafAcc > 1) {
        this.leafAcc--;
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 3.6;
        _v.set(DUEL_TREE.x + Math.cos(a) * r, DUEL_TREE.y + (rand() - 0.5) * 1.6, DUEL_TREE.z + Math.sin(a) * r);
        leafFx.emit(_v, _up, 1, 0.3, 1, 7);
      }
    }
  },
  onPlayerDeath() { this.respawnT = 3.0; Later.after(1.1, () => UI.fade(true, 'Você caiu')); },
  update(dt) {
    if (this.respawnT < 0) return;
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = -1;
      Encounters.resetActive();
      G.player.respawn(Encounters.checkpoint, Encounters.cpYaw);
      G.rig.snap(G.player.pos); G.rig.yaw = Encounters.cpYaw;
      UI.fade(false);
    }
  },
  finish() {
    if (this.ended) return; this.ended = true;
    const secs = Math.round(clock.elapsed - Stats.startT), m = Math.floor(secs / 60), s = secs % 60;
    Later.after(2.2, () => {
      Sound.gong();
      document.getElementById('endStats').textContent =
        `Tempo: ${m} min ${String(s).padStart(2, '0')} s. Aparos perfeitos: ${Stats.parries}. Golpes decisivos: ${Stats.decisive}. Inimigos vencidos: ${Stats.kills}. Quedas: ${Stats.deaths}.`;
      document.getElementById('end').classList.add('on');
      document.getElementById('touchUI').hidden = true;
      Input.enabled = false; UI.clear();
      if (document.pointerLockElement) document.exitPointerLock();
    });
  },
};
document.getElementById('again').addEventListener('click', () => location.reload());
