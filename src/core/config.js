import * as THREE from 'three';

/* ================================================================
   CONFIG — todos os números de ajuste ficam aqui
   ================================================================ */
export const CFG = {
  world:  { size: 800, hmRes: 512, seed: 1337 },
  player: { walk: 2.3, run: 5.6, stanceSpeed: 1.9, blockSpeed: 1.25, accel: 9, decel: 12, turnRate: 12, radius: 0.35 },
  camera: {
    dist: 3.6, pivotH: 1.52, shoulder: 0.26, pitch: -0.13, pitchMin: -0.62, pitchMax: 0.24, stanceDist: 1.0,
    fov: 58, fovRun: 63, mouseSens: 0.0022, touchSens: 0.0058, minClear: 0.95,
  },
  combat: {
    parryWindow: 0.16,   // s antes do contato em que apertar a defesa vira aparar
    parryRearm: 0.35,    // apertar a defesa de novo antes disso não abre janela (anti-spam)
    dodge: { dur: 0.3, dist: 2.7, iStart: 0.03, iEnd: 0.24, cooldown: 0.18 },
    regen: 7,            // s sem apanhar para recuperar a vitalidade
    stanceRange: 6.5,    // distância em que o personagem encara o alvo
  },
  fog:  { density: 0.0024, falloff: 0.011 },
  sun:  new THREE.Vector3(0.2, 0.19, -1).normalize(),
  wind: new THREE.Vector2(0.55, -0.83).normalize(),
};

// O sol se move: tarde na clareira, pôr do sol no duelo. Todas as cores do céu e da neblina
// vêm destes uniforms, compartilhados por TODOS os materiais (injetados no onBeforeCompile).
export const SUN_AZ = 0.2;
export const SUN = new THREE.Vector3().copy(CFG.sun);
export const ATMO = {
  uSunDir: { value: SUN },
  uSkyZen: { value: new THREE.Color(0.25, 0.37, 0.54) },
  uSkyHor: { value: new THREE.Color(0.76, 0.66, 0.5) },
  uSkyHaze: { value: new THREE.Color(1.32, 0.96, 0.58) },
  uFogDen: { value: CFG.fog.density },
  uLow: { value: 0 },
  uRimCol: { value: new THREE.Color(1, 0.8, 0.6) },
};
export function injectAtmo(sh) { Object.assign(sh.uniforms, ATMO); }
THREE.Material.prototype.onBeforeCompile = injectAtmo;

export const PATH_POINTS = [[3,172],[0,150],[-6,125],[2,95],[12,65],[8,35],[-4,5],[-12,-25],[-6,-55],[6,-85],[10,-115],[0,-145],[-6,-172]];
export const CLEARING = { x: 1, z: 158, r: 12, h: 0 };
export const DUMMY_POS = { x: 1.5, z: 152.5 };

export const URLP = new URLSearchParams(location.search);
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
