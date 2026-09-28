import * as THREE from 'three';
import { CFG } from '../core/config.js';

/* ================================================================
   ATMOSFERA — céu e neblina usam a mesma função de cor
   ================================================================ */
export const v3 = (v) => `vec3(${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)})`;
export const SKY_GLSL = /* glsl */`
uniform vec3 uSunDir, uSkyZen, uSkyHor, uSkyHaze;
uniform float uFogDen, uLow;
vec3 skyColor(vec3 d) {
  float y = d.y;
  float s = max(dot(d, uSunDir), 0.0);
  vec3 col = mix(uSkyHor, uSkyZen, pow(clamp(y, 0.0, 1.0), 0.5));
  col = mix(col, uSkyHor * 0.9, 1.0 - smoothstep(-0.08, 0.0, y));
  col += uSkyHaze * (pow(s, 3.0) * 0.25 + pow(s, 16.0) * 0.5 + pow(s, 120.0) * 1.0);
  // no pôr do sol, uma faixa larga e quente abraça o horizonte do lado do sol
  vec2 hz = normalize(d.xz + 1e-5), hs = normalize(uSunDir.xz + 1e-5);
  col += uSkyHaze * uLow * 0.45 * exp(-max(y, 0.0) * 7.0) * pow(max(dot(hz, hs), 0.0), 2.5);
  return col;
}
vec4 fogCalc(vec3 wpos) {
  vec3 ray = wpos - cameraPosition;
  float dist = length(ray);
  vec3 n = ray / max(dist, 1e-4);
  const float fh = ${CFG.fog.falloff.toFixed(5)};
  float dy = ray.y;
  float integ = abs(fh * dy) > 1e-3 ? (1.0 - exp(-fh * dy)) / (fh * dy) : 1.0;
  float amt = uFogDen * dist * exp(-fh * max(cameraPosition.y, 0.0)) * integ;
  amt = 1.55 * pow(amt, 1.55);
  return vec4(skyColor(normalize(vec3(n.x, max(n.y, 0.0) * 0.3 + 0.001, n.z))), clamp(1.0 - exp(-amt), 0.0, 1.0));
}
// cor de neblina convertida para o espaço de saída (funciona com e sem pós-processamento)
vec3 fogToOutput(vec3 c) {
  #ifdef TONE_MAPPING
    c = toneMapping(c);
  #endif
  return linearToOutputTexel(vec4(c, 1.0)).rgb;
}`;

THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    vec3 c = ACESFilmicToneMapping( color );
    float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
    c *= mix( vec3( 0.93, 0.98, 1.06 ), vec3( 1.05, 1.0, 0.91 ), smoothstep( 0.08, 0.7, l ) );
    c = mix( vec3( l ), c, 1.1 );
    c = clamp( c, 0.0, 1.0 );
    return c * c * ( 3.0 - 2.0 * c ) * 0.22 + c * 0.78;
  }`);
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth; varying vec3 vFogWorldPos;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
vec4 fogWP = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
fogWP = batchingMatrix * fogWP;
#endif
#ifdef USE_INSTANCING
fogWP = instanceMatrix * fogWP;
#endif
vFogWorldPos = ( modelMatrix * fogWP ).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorldPos;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
${SKY_GLSL}
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
{ vec4 fg = fogCalc(vFogWorldPos); gl_FragColor.rgb = mix(gl_FragColor.rgb, fogToOutput(fg.rgb), fg.a); }
#endif`;
