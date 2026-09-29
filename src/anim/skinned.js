import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CFG, injectAtmo } from '../core/config.js';
import { clamp, damp, lerp, smooth } from '../core/util.js';
import { movePhase } from './controller.js';
import { ProceduralController } from './procedural.js';
import { registerAnimFactory } from './index.js';
import charUrl from '../../assets/characters/personagem.glb?url';

/* ================================================================
   PERSONAGEM COM ESQUELETO — manequim da Universal Animation Library 2
   (Quaternius, CC0). Mesma interface do boneco procedural:
   - pernas e corpo: clipes da biblioteca (andar, guarda, pés dos golpes, esquiva,
     queda, levantar), misturados com crossfade e com a velocidade ajustada ao tempo
     do golpe (os tempos de PLAYER_MOVES / ENEMY_LIB mandam);
   - braços: IK de dois ossos até a empunhadura; a espada fica presa ao osso da mão
     direita e segue as poses de dados (o combate não muda nada com o modelo);
   - tronco: inclinação, torção e respiração por cima do clipe (camada de cima);
   - chapéu, capa com física de pano, contorno de luz e sombra de contato: os mesmos.
   ================================================================ */
const LOWER = new Set(['root', 'pelvis', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'ball_leaf_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'ball_leaf_r']);
const SCALE = 0.96; // 1,83 m → 1,76 m, a altura do boneco
let ASSET = null;

// parte do corpo por osso dominante: 0 roupa, 1 calça, 2 pele, 3 sandália
function partOf(name) {
  if (/^(Head|neck)/.test(name) || /(hand|index|middle|pinky|ring|thumb)_/.test(name)) return 2;
  if (/^(foot|ball)/.test(name)) return 3;
  if (/^(pelvis|thigh|calf|root)/.test(name)) return 1;
  return 0;
}
function prepare(gltf) {
  const scene = gltf.scene;
  let skeleton = null;
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    skeleton = o.skeleton;
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
    const part = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      part[i] = o.material && /Joint/i.test(o.material.name) ? 4 : partOf(o.skeleton.bones[best].name);
    }
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  });
  const clips = {};
  for (const c of gltf.animations) {
    // pernas: rotação das pernas e altura do quadril; a rotação da pelve fica de fora, senão o
    // tronco (que vem de outro clipe) herdaria a inclinação sem a compensação da coluna
    const isLower = (t) => { const [b, prop] = t.name.split('.'); return LOWER.has(b) && !(b === 'pelvis' && prop === 'quaternion'); };
    const lower = c.tracks.filter(isLower);
    const upper = c.tracks.filter((t) => !LOWER.has(t.name.split('.')[0]));
    clips[c.name] = c;
    clips[c.name + ':L'] = new THREE.AnimationClip(c.name + ':L', c.duration, lower);
    clips[c.name + ':U'] = new THREE.AnimationClip(c.name + ':U', c.duration, upper);
  }
  return { scene, clips, skeleton };
}

export function loadCharacter(onProgress) {
  return new Promise((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(charUrl, (g) => {
      ASSET = prepare(g);
      registerAnimFactory((f, look) => new SkinnedController(f, look));
      ok(true);
    }, (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); }, fail);
  });
}
export const hasCharacter = () => !!ASSET;

// material com cor por parte do corpo (sem textura) + contorno de luz, como o boneco
function partMaterial(cols) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uCols = { value: cols.map((c) => new THREE.Color(c)) };
  mat.onBeforeCompile = (sh) => {
    injectAtmo(sh);
    sh.uniforms.uPartCol = uCols;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPart; varying float vPart;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = aPart;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPart; uniform vec3 uPartCol[5]; uniform vec3 uRimCol;\n#ifndef USE_FOG\nuniform vec3 uSunDir;\n#endif')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { int pi = int(vPart + 0.5); vec3 pc = uPartCol[0];
          if (pi == 1) pc = uPartCol[1]; else if (pi == 2) pc = uPartCol[2]; else if (pi == 3) pc = uPartCol[3]; else if (pi == 4) pc = uPartCol[4];
          diffuseColor.rgb *= pc; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 vd = normalize(vViewPosition);
          vec3 sv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          float rim = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 5.0);
          float back = pow(max(dot(-vd, sv), 0.0), 2.0);
          totalEmissiveRadiance += uRimCol * rim * back * 1.3;
        }`);
  };
  mat.customProgramCacheKey = () => 'skinparts';
  return mat;
}

const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3(), _d = new THREE.Vector3(), _pole = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _ax = new THREE.Vector3(), _s = new THREE.Vector3();
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

// gira um osso em torno de um eixo do mundo (mantendo a hierarquia)
function rotateWorld(bone, axisW, ang) {
  if (Math.abs(ang) < 1e-5) return;
  bone.parent.getWorldQuaternion(_qp);
  _q.setFromAxisAngle(axisW, ang);
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q);
  bone.quaternion.copy(_qp.invert().multiply(_q2));
  bone.updateMatrixWorld(true);
}
function setWorldQuat(bone, qW) {
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(qW));
  bone.updateMatrixWorld(true);
}
// gira o osso para que o ponto "from" (filho) aponte para "to"
function aimBone(bone, from, to) {
  bone.getWorldPosition(_p3);
  const a = _d.subVectors(from, _p3).normalize(), b = _s.subVectors(to, _p3).normalize();
  if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return;
  _q.setFromUnitVectors(a, b);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q);
  setWorldQuat(bone, _q2);
}

export class SkinnedController extends ProceduralController {
  buildBody(L) {
    const f = this.f;
    f.root = new THREE.Group();
    f.body = new THREE.Group(); f.root.add(f.body);
    const model = (this.model = SkeletonUtils.clone(ASSET.scene));
    model.rotation.y = Math.PI; model.scale.setScalar(SCALE);
    f.body.add(model);
    const mat = partMaterial([L.cloth, L.pants, L.skin, 0x0e0b09, new THREE.Color(L.cloth).multiplyScalar(0.6)]);
    this.bones = {};
    model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) { o.material = mat; o.castShadow = true; o.frustumCulled = false; }
    });
    const B = this.bones;
    // ações: pernas, parte de cima e corpo inteiro
    const mixer = (this.mixer = new THREE.AnimationMixer(model));
    this.acts = {};
    const act = (key, clip, loop = true) => {
      const a = mixer.clipAction(ASSET.clips[clip]);
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
      a.enabled = true; a.setEffectiveWeight(0); a.play();
      if (!loop) a.paused = true;
      this.acts[key] = { a, w: 0, tw: 0, dur: ASSET.clips[clip].duration };
    };
    act('idle', 'Idle_Shield_Loop:L'); act('walk', 'Walk_Carry_Loop:L');
    act('guard', 'Sword_Block:L', false); act('relax', 'Sword_Block:U', false);
    act('atkA', 'Sword_Regular_A:L', false); act('atkB', 'Sword_Regular_B:L', false); act('atkC', 'Sword_Regular_C:L', false);
    act('dash', 'Sword_Dash', false); act('knock', 'Hit_Knockback', false); act('lay', 'LayToIdle', false);
    this.acts.relax.a.time = this.acts.relax.dur * 0.98; this.acts.guard.a.time = 0.3;
    this.acts.relax.w = this.acts.relax.tw = 1;
    // pose de repouso (T): mede braços e prende os "encaixes" usados pela capa, chapéu e bainha
    f.root.updateMatrixWorld(true);
    const proxy = (bone, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); f.root.add(o); o.updateMatrixWorld(true); bone.attach(o); return o; };
    f.hips = proxy(B.pelvis, 0, 0.92, 0);
    f.torso = proxy(B.spine_02, 0, 0.92, 0);
    f.legs = [proxy(B.thigh_r, -0.11, 0.92, 0), proxy(B.thigh_l, 0.11, 0.92, 0)];
    f.head = proxy(B.Head, 0, 1.66, 0.01);
    f.arms = [];
    this.arm = {};
    for (const side of ['r', 'l']) {
      const up = B['upperarm_' + side], lo = B['lowerarm_' + side], ha = B['hand_' + side];
      const a = up.getWorldPosition(new THREE.Vector3()), b = lo.getWorldPosition(new THREE.Vector3()), c = ha.getWorldPosition(new THREE.Vector3());
      // eixos da mão medidos no próprio esqueleto: dedos (até o nó do dedo médio) e polegar.
      // Na empunhadura a lâmina sai do lado do polegar e o fio fica do lado dos nós dos dedos.
      const fingers = B['middle_01_' + side].getWorldPosition(new THREE.Vector3()).sub(c).normalize();
      const thumb = B['thumb_02_' + side].getWorldPosition(new THREE.Vector3()).sub(c);
      const blade = thumb.addScaledVector(fingers, -thumb.dot(fingers)).normalize();
      const yAx = fingers.clone().negate(), zAx = blade.clone().negate(), xAx = new THREE.Vector3().crossVectors(yAx, zAx).normalize();
      const fist = c.clone().addScaledVector(fingers, 0.07);
      // mão direita perto da guarda; esquerda no fim do cabo
      const origin = fist.clone().addScaledVector(blade, side === 'r' ? 0.05 : 0.19);
      const swordW = new THREE.Matrix4().makeBasis(xAx, yAx, zAx).setPosition(origin);
      const T = ha.matrixWorld.clone().invert().multiply(swordW); // espada no espaço da mão
      const out = side === 'r' ? 1 : -1;
      this.arm[side] = { up, lo, ha, l1: a.distanceTo(b), l2: b.distanceTo(c), T, Tinv: T.clone().invert(), out };
    }
    this.errR = 0; this.offs = new THREE.Vector3(); this.baseY = 0;
    // ossos que recebem ajustes por cima do clipe (tronco, cabeça, braços do IK)
    this.snap = ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_r', 'lowerarm_r', 'hand_r', 'upperarm_l', 'lowerarm_l', 'hand_l']
      .map((n) => [B[n], B[n].quaternion.clone(), B[n].position.clone()]);
    // direção do rosto e do alto da cabeça no espaço do osso (medidas na pose de repouso)
    const hq = B.Head.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.headFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(hq);
    this.headUp = new THREE.Vector3(0, 1, 0).applyQuaternion(hq);
  }
  // mantém o olhar perto do horizonte (o chapéu não tomba com o tronco)
  levelHead(k, amount) {
    const B = this.bones, f = this.f;
    const q = B.Head.getWorldQuaternion(_q2);
    const fw = _p.copy(this.headFwd).applyQuaternion(q), upv = _p2.copy(this.headUp).applyQuaternion(q);
    const ax = _ax.set(1, 0, 0).applyQuaternion(f.root.quaternion), az = _pole.set(0, 0, 1).applyQuaternion(f.root.quaternion);
    const pitch = Math.asin(clamp(fw.y, -1, 1)) + 0.12; // um pouco para baixo, olhando o oponente
    rotateWorld(B.Head, ax, -pitch * amount);
    const roll = Math.asin(clamp(upv.dot(ax), -1, 1));
    rotateWorld(B.Head, az, roll * amount * 0.8);
  }
  // corpo: clipes + inclinação por cima
  bodyPose(k, dt, t) {
    const f = this.f, A = this.acts, B = this.bones, s = f.state;
    const set = (key, tw) => { A[key].tw = tw; };
    for (const key in A) A[key].tw = 0;
    let full = null;
    const speed = k.speed, C = f.speeds;
    if (s === 'dead') full = 'lay';
    else if (s === 'down') full = f.st < f.downDur - 0.9 ? 'knock' : 'lay';
    else if (s === 'dodge') full = 'dash';
    if (full) set(full, 1);
    else {
      set('relax', 1);
      // pernas: parado, andando/correndo, guarda agachada, pés do golpe
      const mv = clamp((speed - 0.15) / 0.6, 0, 1);
      if (s === 'attack' && f.move) {
        const name = this.atkClip(f.move);
        // os pés do golpe da biblioteca, suavizados pela guarda (o avanço original é longo demais para o ritmo daqui)
        const wk = f.move.strong ? 0.4 : 0.55;
        set(name, wk); set('guard', 0.25); set('idle', 0.75 - wk);
        const ph = movePhase(f.move, f.st), d = A[name].dur;
        A[name].a.time = ph < 1 ? ph * 0.32 * d : ph < 2 ? (0.32 + (ph - 1) * 0.23) * d : (0.55 + (ph - 2) * 0.43) * d;
      } else {
        const guardK = s === 'block' || s === 'bind' || s === 'broken' || s === 'stagger' ? 0.55 : f.drawn && f.target ? 0.35 : 0;
        set('walk', mv); set('idle', (1 - mv) * (1 - guardK)); set('guard', (1 - mv) * guardK);
      }
      // velocidade do passo acompanha a velocidade real; de costas, o clipe anda para trás
      const cy = f.yaw, lz = -(f.vel.x * -Math.sin(cy) + f.vel.z * -Math.cos(cy));
      A.walk.a.timeScale = (lz > 0.3 ? -1 : 1) * clamp(speed / 1.45, 0.4, 3.2);
    }
    if (s === 'dead') A.lay.a.time = A.lay.dur * 0.86 * (1 - smooth(0, 1.35, f.st));
    else if (s === 'down') A[full].a.time = full === 'knock' ? Math.min(0.42, f.st * 0.9) : A.lay.dur * 0.86 * clamp(1 - (f.downDur - f.st) / 0.9, 0, 1);
    else if (s === 'dodge') A.dash.a.time = lerp(0.1, 0.6, clamp(f.st / CFG.combat.dodge.dur, 0, 1));
    // crossfade curto
    for (const key in A) {
      const x = A[key], fade = key.startsWith('atk') ? 0.06 : full ? 0.1 : 0.16;
      x.w = dt > 0 ? damp(x.w, x.tw, 1 / fade, dt) : x.w;
      if (x.tw > 0 && x.w < 1e-3) x.w = 1e-3;
      x.a.setEffectiveWeight(x.w);
    }
    // o mixer só regrava um osso quando o valor do clipe muda; como mexemos em alguns ossos por
    // cima do clipe, eles voltam ao valor limpo antes de cada atualização (senão acumulam)
    for (const [b, q, p] of this.snap) { b.quaternion.copy(q); b.position.copy(p); }
    this.mixer.update(dt);
    for (const [b, q, p] of this.snap) { q.copy(b.quaternion); p.copy(b.position); }
    // esquiva lateral/para trás: o corpo gira para a direção do passo
    let mYaw = Math.PI;
    if (s === 'dodge') {
      const lx = f.dodgeDir.x * Math.cos(f.yaw) - f.dodgeDir.y * Math.sin(f.yaw), lz = f.dodgeDir.x * Math.sin(f.yaw) + f.dodgeDir.y * Math.cos(f.yaw);
      mYaw += Math.atan2(-lx, -lz) * Math.sin(Math.PI * clamp(f.st / CFG.combat.dodge.dur, 0, 1));
    }
    this.model.rotation.y = mYaw;
    this.baseY = full ? 0 : -k.crouch * 0.35;
    this.model.position.set(this.offs.x, this.baseY + this.offs.y, this.offs.z);
    this.model.updateMatrixWorld(true);
    // tronco: inclinação, torção e respiração por cima do clipe (divididas entre as vértebras)
    if (!full) {
      f.root.updateMatrixWorld(true);
      const rq = f.root.quaternion;
      const ax = _ax.copy(AX.x).applyQuaternion(rq), ay = AX.y, az = _pole.copy(AX.z).applyQuaternion(rq);
      for (const b of [B.spine_01, B.spine_02, B.spine_03]) {
        rotateWorld(b, ax, (-f.lean * 0.6) / 3); rotateWorld(b, ay, f.twist / 3); rotateWorld(b, az, f.roll / 3);
      }
      if (k.breathY) rotateWorld(B.spine_03, ax, -k.breathY * 3);
      rotateWorld(B.neck_01, ay, -f.twist * 0.6);
      this.levelHead(k, 0.7);
    }
    f.hat.rotation.set(Math.sin(f.phase * 2) * 0.02 * k.walkN, 0, Math.sin(f.phase) * 0.015 * k.walkN);
  }
  atkClip(m) {
    if (m.bash || m.thrust || m.sweep) return 'atkA';
    const keys = m.keys, pitchUp = keys && keys[0].pitch > 1.5;
    return pitchUp ? 'atkC' : keys && keys[0].yaw > 1 ? 'atkB' : 'atkA';
  }
  // braços: IK até a empunhadura; a espada fica presa à mão direita
  armsPose(k, dt = 1 / 60) {
    const f = this.f, { dead, spear } = k;
    if (!((f.drawn || spear) && !dead) || this.swordDropped) { this.offs.multiplyScalar(0.85); this.model.position.set(this.offs.x, this.baseY + this.offs.y, this.offs.z); return; }
    f.sword.updateMatrixWorld(true);
    const S = f.sword.matrixWorld;
    const rq = f.root.quaternion;
    // alcance: se o pulso não chega, o corpo avança/abaixa em direção à empunhadura (como um avanço
    // mais fundo), até 50 cm; assim a lâmina na mão coincide com a lâmina que acerta
    const wristR = _m.multiplyMatrices(S, this.arm.r.Tinv);
    this.reachAssist(wristR, this.arm.r, dt);
    this.reachAssist(wristR, this.arm.r, dt);
    f.sword.updateMatrixWorld(true);
    // mão direita: pulso = espada × (espada no espaço da mão)⁻¹
    this.solve(this.arm.r, _m.multiplyMatrices(f.sword.matrixWorld, this.arm.r.Tinv), _pole.set(0.5, -1, 0.35).applyQuaternion(rq));
    // mão esquerda: no escudo, mais atrás na haste (lança) ou no fim do cabo
    if (f.shieldG) {
      f.shieldG.getWorldPosition(_p2);
      this.solve(this.arm.l, null, _pole.set(-0.6, -1, 0.3).applyQuaternion(rq), _p2);
    } else {
      const back = spear ? _m2.makeTranslation(0, 0, 0.36) : _m2.identity();
      this.solve(this.arm.l, _m.multiplyMatrices(S, back).multiply(this.arm.l.Tinv), _pole.set(-0.6, -1, 0.3).applyQuaternion(rq));
    }
    // a espada segue a mão de verdade (fica presa ao osso)
    _m.multiplyMatrices(this.arm.r.ha.matrixWorld, this.arm.r.T);
    _m2.copy(f.root.matrixWorld).invert().multiply(_m);
    _m2.decompose(f.sword.position, f.sword.quaternion, _s);
    f.sword.updateMatrixWorld(true);
  }
  reachAssist(wristM, arm, dt) {
    const f = this.f;
    _p.setFromMatrixPosition(wristM);
    arm.up.getWorldPosition(_p2);
    const need = _p.distanceTo(_p2) - (arm.l1 + arm.l2) * 0.97;
    // alvo do deslocamento (no espaço do corpo), somado ao que já está aplicado
    const want = _p3.set(0, 0, 0);
    if (need > 0) {
      want.subVectors(_p, _p2).normalize().multiplyScalar(need);
      want.applyQuaternion(_q.copy(f.root.quaternion).invert());
    }
    if (need > 0) want.add(this.offs);
    const hl = Math.hypot(want.x, want.z); if (hl > 0.5) { want.x *= 0.5 / hl; want.z *= 0.5 / hl; }
    want.y = clamp(want.y, -0.2, 0.12);
    // com a mão alcançando, o corpo volta ao lugar em ~0,15 s; durante o golpe a correção é imediata
    this.offs.lerp(want, need > 0 && this.f.state === 'attack' ? 1 : 1 - Math.exp(-dt * 14));
    this.model.position.set(this.offs.x, this.baseY + this.offs.y, this.offs.z);
    this.model.updateMatrixWorld(true);
  }
  // IK de dois ossos: ombro-cotovelo-pulso, cotovelo no plano do "polo"
  solve(arm, wristM, pole, posOnly) {
    const target = posOnly ? posOnly : _p.setFromMatrixPosition(wristM);
    const up = arm.up, lo = arm.lo, ha = arm.ha;
    up.getWorldPosition(_p2);
    const l1 = arm.l1, l2 = arm.l2;
    const dv = _d.subVectors(target, _p2); let d = dv.length();
    const dir = dv.normalize();
    d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const pl = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    const elbow = _p3.copy(_p2).addScaledVector(dir, l1 * cosA).addScaledVector(pl, l1 * sinA).clone();
    const reach = _p2.clone().addScaledVector(dir, d);
    aimBone(up, lo.getWorldPosition(new THREE.Vector3()), elbow);
    aimBone(lo, ha.getWorldPosition(new THREE.Vector3()), reach);
    if (wristM) { wristM.decompose(_s, _q2, _p3); setWorldQuat(ha, _q2); }
    if (arm === this.arm.r) this.errR = ha.getWorldPosition(new THREE.Vector3()).distanceTo(target);
  }
  resetBody() {
    if (this.acts) for (const key in this.acts) { const x = this.acts[key]; x.w = x.tw = key === 'relax' ? 1 : 0; x.a.setEffectiveWeight(x.w); }
  }
}
