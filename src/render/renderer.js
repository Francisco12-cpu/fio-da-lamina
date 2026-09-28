import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CFG, IS_TOUCH } from '../core/config.js';

/* ================================================================
   RENDER
   ================================================================ */
export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.CustomToneMapping;
renderer.toneMappingExposure = 0.97;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = IS_TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcbbfa8, CFG.fog.density);
export const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, 0.08, 2600);
camera.rotation.order = 'YXZ';

// pós-processamento: raios de luz (a partir do próprio brilho do céu, sem passe extra de geometria),
// bloom e passe final com a mesma gradação de cor do modo sem pós.
export const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: IS_TOUCH ? 2 : 4 });
export const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
export const makeRays = (n) => new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSunUv: { value: new THREE.Vector2(0.5, 0.5) }, uAmt: { value: 0 }, uTint: { value: new THREE.Color(1, 0.8, 0.6) }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `#define SAMPLES ${n}
    uniform sampler2D tDiffuse; uniform vec2 uSunUv; uniform float uAmt, uAspect; uniform vec3 uTint; varying vec2 vUv;
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      if (uAmt < 0.002) { gl_FragColor = vec4(base, 1.0); return; }
      vec2 d = (vUv - uSunUv) * (0.95 / float(SAMPLES));
      vec2 c = vUv - d * fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      float w = 1.0; vec3 acc = vec3(0.0);
      for (int i = 0; i < SAMPLES; i++) {
        c -= d;
        vec3 sm = texture2D(tDiffuse, c).rgb;
        acc += min(sm, vec3(8.0)) * smoothstep(3.2, 9.0, dot(sm, vec3(0.3, 0.59, 0.11))) * w;
        w *= ${n > 20 ? '0.968' : '0.94'};
      }
      acc /= float(SAMPLES);
      float fall = 1.0 - smoothstep(0.0, 0.95, length((vUv - uSunUv) * vec2(uAspect, 1.0)));
      gl_FragColor = vec4(base + acc * uTint * uAmt * (0.15 + fall * 0.85), 1.0);
    }`,
});
export const raysHi = makeRays(32), raysLo = makeRays(12);
composer.addPass(raysHi); composer.addPass(raysLo);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.36, 0.7, 1.0);
composer.addPass(bloom);
export const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    #include <tonemapping_pars_fragment>
    void main() { gl_FragColor = vec4(CustomToneMapping(texture2D(tDiffuse, vUv).rgb), 1.0);
      #include <colorspace_fragment>
    }`,
});
finalPass.material.toneMapped = false;
composer.addPass(finalPass);
