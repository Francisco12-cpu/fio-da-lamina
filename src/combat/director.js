import { lerp, rand } from '../core/util.js';

export const Director = {
  attacker: null, lastEnd: -9,
  canAttack(e, t) { return !this.attacker && t - this.lastEnd > 0.6 && t >= e.nextAtkT; },
  take(e) { this.attacker = e; },
  release(e, t) {
    if (this.attacker === e) { this.attacker = null; this.lastEnd = t; }
    e.nextAtkT = t + lerp(e.type.interval[0], e.type.interval[1], rand());
  },
  reset() { this.attacker = null; this.lastEnd = -9; },
};
