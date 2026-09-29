// Gera assets/characters/personagem.glb a partir do UAL2_Standard.glb (Quaternius, CC0):
// só os clipes usados pelo jogo, curvas reamostradas e compressão Meshopt.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { resample, prune, dedup, meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const KEEP = ['Walk_Carry_Loop', 'Idle_Shield_Loop', 'Sword_Block', 'Sword_Dash', 'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C',
  'Hit_Knockback', 'LayToIdle', 'Shield_OneShot', 'Idle_Shield_Break'];
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('assets/characters/ual2/UAL2_Standard.glb');
for (const a of doc.getRoot().listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
await doc.transform(resample({ tolerance: 1e-4 }), prune(), dedup(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write('assets/characters/personagem.glb', doc);
console.log('ok', doc.getRoot().listAnimations().map((a) => a.getName()).join(', '));
