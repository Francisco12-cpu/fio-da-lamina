import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from '../combat/moves.js';
import { CLEARING, SUN_AZ } from '../core/config.js';
import { angDiff, clamp, fbm, lerp, mulberry32, rand, vnoise } from '../core/util.js';
import { scene } from '../render/renderer.js';
import { SH, terrain, withBacklight } from './world.js';

// ---------- Colisores, rochas e árvores ----------
export const colliders = []; // { x, z, r, top }
export function freeSpot(x, z, minPath) {
  if (terrain.nearest(x, z).d < minPath) return false;
  if (Math.hypot(x - CLEARING.x, z - CLEARING.z) < CLEARING.r + 3) return false;
  return true;
}
{
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4c4944 });
  const rockGeos = [0, 1, 2, 3].map((v) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position, t = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      t.fromBufferAttribute(p, i);
      t.multiplyScalar(1 + fbm(t.x * 1.3 + v * 5, t.z * 1.3 + t.y * 0.9, 3, 40 + v) * 0.28); t.y *= 0.72;
      p.setXYZ(i, t.x, t.y, t.z);
    }
    g.computeVertexNormals();
    return g;
  });
  let placed = 0, tries = 0;
  while (placed < 70 && tries < 3000) {
    tries++;
    const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 400, big = rand() < 0.18;
    if (!freeSpot(x, z, big ? 7 : 3.5)) continue;
    const s = big ? 1.8 + rand() * 2.4 : 0.35 + rand() * 1.0;
    const m = new THREE.Mesh(rockGeos[placed % 4], rockMat);
    m.scale.set(s * (0.8 + rand() * 0.5), s * (0.7 + rand() * 0.5), s * (0.8 + rand() * 0.5));
    m.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    m.position.set(x, terrain.heightAt(x, z) - s * 0.25, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    colliders.push({ x, z, r: Math.max(m.scale.x, m.scale.z) * 0.92, top: m.position.y + m.scale.y * 0.75 });
    placed++;
  }
}

// Árvores: tronco curvo afunilado, galhos, e copas feitas de "almofadas" de folhagem
// (estilo pinheiro japonês / acácia), com sombreado mais escuro por baixo e brilho de contraluz.
export function taperTube(pts, r0, r1, radial = 7, segs = 8) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [], P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curve.getPointAt(t, P);
    const r = lerp(r0, r1, t), N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(P.x + (N.x * c + B.x * s) * r, P.y + (N.y * c + B.y * s) * r, P.z + (N.z * c + B.z * s) * r);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export const blobBase = [0, 1, 2].map((v) => {
  const g = new THREE.SphereGeometry(1, 11, 8);
  g.deleteAttribute('uv');
  const p = g.attributes.position, t = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    t.fromBufferAttribute(p, i);
    t.multiplyScalar(1 + fbm(t.x * 1.7 + v * 3, t.y * 1.7 + t.z * 1.3, 3, 60 + v) * 0.26);
    p.setXYZ(i, t.x, t.y, t.z);
  }
  g.computeVertexNormals();
  return g;
});
export function canopyPad(out, cx, cy, cz, w, flat, n, tintCol = [0.17, 0.2, 0.085]) {
  for (let k = 0; k < n; k++) {
    const g = blobBase[k % 3].clone();
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * w * 0.58;
    const s = w * (0.3 + rand() * 0.2);
    const sy = s * flat * (0.8 + rand() * 0.4);
    g.scale(s, sy, s);
    const px = cx + Math.cos(a) * rr, pz = cz + Math.sin(a) * rr, py = cy + (rand() - 0.5) * w * flat * 0.35;
    g.translate(px, py, pz);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), tint = 0.82 + rand() * 0.32;
    for (let i = 0; i < pos.count; i++) {
      const k2 = clamp((pos.getY(i) - (py - sy)) / (2 * sy), 0, 1);
      const sh = lerp(0.38, 1.0, k2 * k2) * tint;
      col[i * 3] = tintCol[0] * sh; col[i * 3 + 1] = tintCol[1] * sh; col[i * 3 + 2] = tintCol[2] * sh;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.push(g);
  }
}
export const barkMat = new THREE.MeshLambertMaterial({ color: 0x2b2018, side: THREE.DoubleSide });
export const leafMat = withBacklight(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.9);
export function makeTree(x, z, kind, leafCol, scale = 1) {
  const y0 = terrain.heightAt(x, z), pine = kind === 'pine';
  const H = pine ? 3.2 + rand() * 1.6 : 3.6 + rand() * 1.6;
  const lx = (rand() - 0.5) * 1.5, lz = (rand() - 0.5) * 1.0;
  const top = new THREE.Vector3(lx, H, lz);
  const trunk = [new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(lx * 0.12, H * 0.35, lz * 0.1),
    new THREE.Vector3(lx * 0.7 + (rand() - 0.5) * 0.5, H * 0.7, lz * 0.6), top];
  const bark = [taperTube(trunk, 0.38, 0.15)], leaves = [];
  const nb = pine ? 3 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 2);
  for (let b = 0; b < nb; b++) {
    const a = (b / nb) * Math.PI * 2 + rand() * 0.8;
    const reach = pine ? 1.7 + rand() * 1.6 : 0.9 + rand() * 1.1;
    const rise = pine ? 0.2 + rand() * 0.9 : 0.4 + rand() * 1.8;
    const start = new THREE.Vector3().lerpVectors(trunk[2], top, 0.3 + rand() * 0.7);
    const end = top.clone().add(new THREE.Vector3(Math.cos(a) * reach, rise, Math.sin(a) * reach));
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.3, 0));
    bark.push(taperTube([start, mid, end], 0.12, 0.05, 5, 5));
    canopyPad(leaves, end.x, end.y + 0.2, end.z, pine ? 1.9 + rand() * 0.9 : 1.4 + rand() * 0.7, pine ? 0.42 : 0.62, pine ? 8 : 7, leafCol);
  }
  canopyPad(leaves, top.x, top.y + 0.55, top.z, pine ? 1.9 : 1.8, pine ? 0.45 : 0.7, 8, leafCol);
  const grp = new THREE.Group();
  const tm = new THREE.Mesh(mergeGeometries(bark), barkMat), lm = new THREE.Mesh(mergeGeometries(leaves), leafMat);
  tm.castShadow = lm.castShadow = true; tm.receiveShadow = true;
  grp.add(tm, lm);
  grp.position.set(x, y0, z); grp.rotation.y = rand() * Math.PI * 2; grp.scale.setScalar(scale);
  scene.add(grp);
  colliders.push({ x, z, r: 0.5 * scale, top: y0 + H * scale });
  return grp;
}
{
  let trees = 0, tries = 0;
  while (trees < 22 && tries < 2000) {
    tries++;
    const x = (rand() - 0.5) * 280, z = (rand() - 0.5) * 380;
    if (!freeSpot(x, z, 9)) continue;
    makeTree(x, z, rand() < 0.6 ? 'pine' : 'cloud');
    trees++;
  }
  makeTree(-11, 118, 'pine');
  makeTree(19, 72, 'cloud');
  makeTree(-13, 166, 'cloud');
}

// ---------- Sombra de contato sob os personagens (ancora os pés no chão) ----------
export const BLOB_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
export const BLOB_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// ---------- Pedrinhas na trilha ----------
{
  const N = 1400, g = new THREE.IcosahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xb8ad9c }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const p = terrain.ps[Math.floor(rand() * terrain.ps.length)];
    const a = rand() * Math.PI * 2, d = Math.pow(rand(), 0.7) * 1.35;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, s = 0.02 + Math.pow(rand(), 4) * 0.07;
    pp.set(x, terrain.heightAt(x, z) + s * 0.25, z); e.set(rand() * 3, rand() * 3, rand() * 3); q.setFromEuler(e);
    sc.set(s * (0.8 + rand() * 0.6), s * 0.6, s * (0.8 + rand() * 0.6));
    mesh.setMatrixAt(i, m.compose(pp, q, sc));
    const v = 0.5 + rand() * 0.25; mesh.setColorAt(i, col.setRGB(v, v * 0.94, v * 0.86));
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------- Marcos da trilha: lanternas de pedra e a árvore do duelo ----------
export function pathAtZ(z) {
  let best = null, bd = Infinity;
  for (const p of terrain.ps) { const d = Math.abs(p.z - z); if (d < bd) { bd = d; best = p; } }
  return best;
}
{
  const stone = new THREE.MeshLambertMaterial({ color: 0x6a655c });
  const parts = () => {
    const g = [];
    g.push(new THREE.CylinderGeometry(0.34, 0.4, 0.16, 6).translate(0, 0.08, 0));
    g.push(new THREE.CylinderGeometry(0.1, 0.13, 0.62, 8).translate(0, 0.47, 0));
    g.push(new THREE.CylinderGeometry(0.26, 0.2, 0.1, 6).translate(0, 0.83, 0));
    g.push(new THREE.BoxGeometry(0.34, 0.3, 0.34).translate(0, 1.03, 0));
    g.push(new THREE.ConeGeometry(0.44, 0.26, 6).translate(0, 1.31, 0));
    g.push(new THREE.SphereGeometry(0.07, 8, 6).translate(0, 1.49, 0));
    return mergeGeometries(g.map((x) => { x.deleteAttribute('uv'); return x; }));
  };
  const lg = parts();
  [135, 132, 52, 49, -78, -81].forEach((z, i) => {
    const c = pathAtZ(z), side = i % 2 ? 1 : -1;
    const x = c.x + side * 2.6, zz = c.z;
    const m = new THREE.Mesh(lg, stone);
    m.position.set(x, terrain.heightAt(x, zz) - 0.05, zz); m.rotation.y = rand();
    m.castShadow = m.receiveShadow = true; scene.add(m);
    colliders.push({ x, z: zz, r: 0.42, top: m.position.y + 1.5 });
  });
}
export const DUEL_TREE = (() => {
  const c = pathAtZ(-104);
  const x = c.x + 7.5, z = c.z - 3;
  makeTree(x, z, 'cloud', [0.36, 0.06, 0.035], 1.35);
  return new THREE.Vector3(x, terrain.heightAt(x, z) + 6.2, z);
})();

// ---------- Cordilheiras em camadas ----------
export function makeRidge(radius, baseY, minH, maxH, seed, color, bumps, notch) {
  const seg = 360, pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, u = Math.cos(a) * 3, v = Math.sin(a) * 3;
    let n = 1 - Math.abs(fbm(u, v, 4, seed)); n *= n;
    let top = baseY + lerp(minH, maxH, n) + (vnoise(i * 0.9, 0, seed + 3) - 0.5) * bumps;
    // vão nas montanhas exatamente onde o sol se põe
    const sunA = Math.atan2(-Math.cos(SUN_AZ), Math.sin(SUN_AZ));
    top = lerp(top, notch, 0.85 * Math.exp(-Math.pow(angDiff(a, sunA) / 0.34, 2)));
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    pos.push(x, baseY - 60, z, x, top, z);
    if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  scene.add(m);
}
makeRidge(392, 22, 14, 58, 70, 0x151a13, 3.5, 4);
makeRidge(760, 0, 70, 230, 90, 0x1e252c, 1.5, 14);
makeRidge(1150, 0, 120, 320, 110, 0x2a3240, 1, 30);

// ---------- Pólen no ar ----------
export const MOTES_MAX = 400;
export const motes = (() => {
  const g = new THREE.BufferGeometry();
  const r = mulberry32(99), a = new Float32Array(MOTES_MAX * 3);
  for (let i = 0; i < a.length; i++) a[i] = r();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: SH.uTime, uSunDirU: SH.uSunDirU, uWindDir: SH.uWindDir, uPx: { value: 1 } },
    vertexShader: /* glsl */`
      uniform float uTime, uPx; uniform vec3 uSunDirU; uniform vec2 uWindDir;
      varying float vA;
      void main() {
        vec3 s = position;
        vec3 box = vec3(34.0, 7.0, 34.0);
        vec3 p = s * box;
        p.xz += uWindDir * uTime * (0.6 + s.y * 0.5);
        p += vec3(sin(uTime * 0.4 + s.z * 20.0), sin(uTime * 0.7 + s.x * 17.0) * 0.4, cos(uTime * 0.33 + s.y * 13.0)) * 0.6;
        vec3 c = cameraPosition + vec3(0.0, 0.5, 0.0);
        p = c + mod(p - c + 0.5 * box, box) - 0.5 * box;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = uPx * (1.4 + s.x * 1.6) * 26.0 / max(dist, 0.5);
        float glow = pow(max(dot(normalize(p - cameraPosition), uSunDirU), 0.0), 4.0);
        vA = (0.12 + glow * 1.7) * smoothstep(0.8, 2.5, dist) * (1.0 - smoothstep(12.0, 17.0, dist)) * (0.5 + 0.5 * sin(uTime * 1.3 + s.z * 40.0));
      }`,
    fragmentShader: `varying float vA; void main() { float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA; gl_FragColor = vec4(vec3(1.0, 0.86, 0.58) * a, a); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();
