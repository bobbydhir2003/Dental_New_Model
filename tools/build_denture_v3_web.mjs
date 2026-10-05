// Builds denture_v3_web.glb from denture_v3.glb (the source is only read).
//
// Requirements (not part of the app; install anywhere outside the project or
// with --no-save):  npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 \
//                       @gltf-transform/functions@4 meshoptimizer sharp
// Run from the project root:  node tools/build_denture_v3_web.mjs
// Optional env: OUT=<path> (write elsewhere, e.g. to verify reproducibility),
//               PULP_RATIO=<0..1> (default 0.12 of welded pulp vertices).
//
// What it does (all verified in the browser against the source model):
//  1. Enamel/maxilla primitives that have NO UVs (lower teeth 18-31, Maxilla)
//     can only ever sample uv(0,0); that colour is baked into baseColorFactor
//     and the unusable texture dropped (identical appearance).
//  2. Pulp meshes (unwelded triangle soup, up to 766k verts) are welded and
//     simplified to ~12%, with smooth normals recomputed. Names, hierarchy,
//     materials (incl. tooth 14's blue filling material) are preserved.
//  3. Textures -> 1024px WebP (EXT_texture_webp, supported by three r141).
//     Solid-colour textures are folded into factors by prune().
//  No mesh quantization: three r141 does not de-normalise attribute getters.
import { fileURLToPath } from 'url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, weld, simplifyPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../denture_v3.glb', import.meta.url));
const OUT = process.env.OUT || fileURLToPath(new URL('../denture_v3_web.glb', import.meta.url));
const PULP_RATIO = Number(process.env.PULP_RATIO || 0.12);

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const root = doc.getRoot();

const s2l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

// 1. Textured primitives without UVs (lower enamel 18-31, Maxilla) can only sample the
//    texture at uv(0,0) – with repeat wrapping + linear filtering that is the
//    average of the four corner texels. Bake that colour into baseColorFactor
//    and drop the texture: identical appearance, less download/GPU memory.
let flattened = 0;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const tex = mat && mat.getBaseColorTexture();
    if (!tex || prim.getAttribute('TEXCOORD_0')) continue;
    const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => { const o = (y * info.width + x) * info.channels; return [data[o], data[o + 1], data[o + 2]]; };
    const W = info.width - 1, H = info.height - 1;
    const corners = [px(0, 0), px(W, 0), px(0, H), px(W, H)];
    const lin = [0, 1, 2].map((k) => corners.reduce((a, c) => a + s2l(c[k]), 0) / 4);
    const f = mat.getBaseColorFactor();
    mat.setBaseColorFactor([lin[0] * f[0], lin[1] * f[1], lin[2] * f[2], f[3]]);
    mat.setBaseColorTexture(null);
    flattened++;
    console.log('flattened', mesh.getName(), corners.map((c) => c.join(',')).join(' | '));
  }
}

// 2. Simplify only the very dense pulp meshes (hidden inside dentin normally).
let before = 0, after = 0;
// Pulp meshes are unindexed triangle soup with per-face normals, so nothing
// welds/simplifies while NORMAL is present. Drop normals on pulps only, weld,
// simplify, then recompute smooth normals for those primitives.
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !/pulp/i.test(node.getName())) continue;
  for (const prim of mesh.listPrimitives()) { prim.setAttribute('NORMAL', null); prim.setAttribute('TANGENT', null); }
}
await doc.transform(weld()); // lossless: merges only identical vertices
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !/pulp/i.test(node.getName())) continue;
  for (const prim of mesh.listPrimitives()) {
    const n0 = prim.getAttribute('POSITION').getCount();
    if (n0 < 8000) continue;
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: PULP_RATIO, error: 0.002, lockBorder: false });
    const n1 = prim.getAttribute('POSITION').getCount();
    before += n0; after += n1;
    console.log('simplified', node.getName(), n0, '->', n1);
  }
}

// Smooth (area-weighted) normals for the simplified pulp primitives only.
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !/pulp/i.test(node.getName())) continue;
  for (const prim of mesh.listPrimitives()) {
    if (prim.getAttribute('NORMAL')) continue;
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
    const n = new Float32Array(pos.getCount() * 3), a = [0,0,0], b = [0,0,0], c = [0,0,0];
    const triCount = idx ? idx.getCount() / 3 : pos.getCount() / 3;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getScalar(t*3) : t*3, i1 = idx ? idx.getScalar(t*3+1) : t*3+1, i2 = idx ? idx.getScalar(t*3+2) : t*3+2;
      pos.getElement(i0, a); pos.getElement(i1, b); pos.getElement(i2, c);
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const fx=uy*vz-uz*vy, fy=uz*vx-ux*vz, fz=ux*vy-uy*vx;
      for (const i of [i0,i1,i2]) { n[i*3]+=fx; n[i*3+1]+=fy; n[i*3+2]+=fz; }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i],n[i+1],n[i+2]) || 1; n[i]/=l; n[i+1]/=l; n[i+2]/=l; }
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n).setBuffer(root.listBuffers()[0]));
  }
}

// 3. Textures: 1024px WebP (EXT_texture_webp is supported by the bundled r141 GLTFLoader).
await doc.transform(
  prune({ keepLeaves: true, keepAttributes: false, keepExtras: true }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 90 }),
  // No KHR_mesh_quantization: three r141 BufferAttribute getters do not
  // de-normalise, which breaks CPU raycasting / geometry baking in the app.
);

await io.write(OUT, doc);
console.log({ flattened, pulpVertsBefore: before, pulpVertsAfter: after });
