// Visualizador de clipes (ferramenta de desenvolvimento): folha de contato com N quadros de um clipe.
// ?clip=Nome&n=8&side=1   window.__clips lista os nomes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
const P = new URLSearchParams(location.search);
const N = +(P.get('n') || 8), W = 1600, H = 420;
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(W, H); r.setScissorTest(true); document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x303436);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 4, 3); scene.add(d);
const grid = new THREE.GridHelper(4, 8, 0x666666, 0x444444); scene.add(grid);
const cam = new THREE.PerspectiveCamera(35, (W / N) / H, 0.1, 50);
const side = +(P.get('side') || 0);
new GLTFLoader().load('/assets/characters/ual2/UAL2_Standard.glb', (g) => {
  window.__clips = g.animations.map((a) => a.name + ':' + a.duration.toFixed(2));
  const clip = g.animations.find((a) => a.name === P.get('clip')) || g.animations[0];
  const obj = SkeletonUtils.clone(g.scene); scene.add(obj);
  const mixer = new THREE.AnimationMixer(obj), act = mixer.clipAction(clip); act.play();
  for (let i = 0; i < N; i++) {
    const t = (clip.duration * i) / (N - 1);
    mixer.setTime(t);
    const hand = obj.getObjectByName('hand_r'); const hp = hand.getWorldPosition(new THREE.Vector3());
    if (side) cam.position.set(3.4, 1.2, 0); else cam.position.set(0.9, 1.35, 3.4);
    cam.lookAt(0, 0.95, 0);
    r.setViewport((W / N) * i, 0, W / N, H); r.setScissor((W / N) * i, 0, W / N, H); r.render(scene, cam);
  }
  window.__done = clip.name;
});
