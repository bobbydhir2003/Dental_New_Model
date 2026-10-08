// Unit tests for dental_model_adapter.js using the real bundled three.js and
// small synthetic scenes shaped like the legacy (tooth_N = Mesh) and v3
// (tooth_N = Group{enamel,dentin,pulp}, shared materials) models.
// Run: node __model_adapter_test.mjs   (browser e2e covers the real GLBs)
import * as THREE from './three/build/three.module.js';
import * as A from './dental_model_adapter.js';

const results = [];
const check = (name, ok, extra) => { results.push([name, !!ok]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); };
const near = (a, b, eps = 1e-6) => a.distanceTo(b) < eps;

function box(x, y, z, s = 0.04) { const g = new THREE.BoxGeometry(s, s * 2, s); g.translate(x, y, z); return g; }
function toothX(n) { const i = n <= 16 ? n - 1 : 32 - n; return -0.3 + i * 0.04; }

function buildV3Like() {
  const root = new THREE.Group();
  const dentin = new THREE.MeshStandardMaterial({ name: 'dentinSG', color: 0xc5ab58 });
  const pulp = new THREE.MeshStandardMaterial({ name: 'pulpSG' });
  const tex = new THREE.Texture();
  const mkJaw = (name, upper) => {
    const jaw = new THREE.Group(); jaw.name = name; jaw.position.set(-0.34, 0.178, -0.758); root.add(jaw);
    const teeth = new THREE.Group(); teeth.name = upper ? 'upper_teeth' : 'lower_teeth'; teeth.position.set(0.34, -0.178, 0.758); jaw.add(teeth);
    const range = upper ? [1, 16] : [17, 32];
    for (let n = range[0]; n <= range[1]; n++) {
      const t = new THREE.Group(); t.name = 'tooth_' + n; teeth.add(t);
      const y = upper ? 0.05 : -0.1, z = 0.2 - Math.abs(toothX(n)) * 0.6;
      const e = new THREE.Mesh(box(toothX(n), y, z), new THREE.MeshStandardMaterial({ name: 'enamel' + n, map: tex })); e.name = 'x_enamel_' + n;
      const d = new THREE.Mesh(box(toothX(n), y + (upper ? 0.04 : -0.04), z), dentin); d.name = 'x_dentin_' + n;
      const p = new THREE.Mesh(box(toothX(n), y, z, 0.01), pulp); p.name = 'x_pulp_' + n; p.scale.setScalar(1);
      t.add(p, d, e); // pulp first on purpose (resolveToothMesh used to pick it)
    }
    return jaw;
  };
  const up = mkJaw('upperJawGrp', true), lo = mkJaw('lowerJawGrp', false);
  const mand = new THREE.Mesh(box(0, -0.2, 0, 0.5), new THREE.MeshStandardMaterial()); mand.name = 'Mandible'; lo.add(mand);
  const max = new THREE.Group(); max.name = 'Maxilla'; max.add(new THREE.Mesh(box(0, 0.2, 0, 0.4)), new THREE.Mesh(box(0, 0.25, 0, 0.1))); up.add(max);
  const gumMat = new THREE.MeshStandardMaterial({ name: 'gumsSG', vertexColors: true, color: 0xd04050, roughness: 0.23 });
  const palateMat = new THREE.MeshStandardMaterial({ name: 'palate_SG', vertexColors: true, roughness: 0.23 });
  const ug = new THREE.Group(); ug.name = 'Upper_gum';
  const gumMesh = new THREE.Mesh(box(0, 0.1, 0, 0.3), gumMat); gumMesh.name = 'Upper_gum_1';
  const palMesh = new THREE.Mesh(box(0, 0.12, 0, 0.2), palateMat); palMesh.name = 'Upper_gum_2';
  ug.add(gumMesh, palMesh); up.add(ug);
  const lg = new THREE.Mesh(box(0, -0.1, 0, 0.3)); lg.name = 'Lower_gum'; lo.add(lg);
  const nerves = new THREE.Group(); nerves.name = 'Skin_Nerves'; const nerveMesh = new THREE.Mesh(box(0.2, 0, 0), palateMat); nerveMesh.name = 'nerve_sharing_palate_mat'; nerves.add(nerveMesh); root.add(nerves);
  for (const c of ['curveOfSpee', 'curveOfWilson', 'sphereOfMonson']) { const m = new THREE.Mesh(box(0, 0, 0), new THREE.MeshStandardMaterial()); m.name = c; root.add(m); }
  return { root, dentin, pulp, tex, gumMat, palateMat };
}

function buildLegacyLike() {
  const root = new THREE.Group(); const teethRoot = new THREE.Group(); teethRoot.scale.setScalar(0.01); root.add(teethRoot);
  for (const [name, a, b] of [['upperJawGrp', 1, 16], ['lowerJawGrp', 17, 32]]) {
    const jaw = new THREE.Group(); jaw.name = name; jaw.position.set(-36.748, 42.4481010, -40.914299); teethRoot.add(jaw);
    for (let n = a; n <= b; n++) { const m = new THREE.Mesh(box(0, 0, 0, 4), new THREE.MeshStandardMaterial()); m.name = 'tooth_' + n; m.position.set(toothX(n) * 100 + 36, -30, 40); jaw.add(m); }
  }
  for (const n of ['mandibleLow', 'RLMaxilla1', 'UMesh_PM3D_Sphere3D2_26', 'UMesh_LowerGums_Hide_Teeth6', 'Arteries', 'Veins', 'Skin_Nerves', 'curveOfSpee', 'curveOfWilson', 'sphereOfMonson']) {
    const m = new THREE.Mesh(box(0, 0, 0), new THREE.MeshStandardMaterial({ vertexColors: /Arteries|Veins|Skin_Nerves|UMesh_PM3D/.test(n) })); m.name = n; teethRoot.add(m);
  }
  return root;
}

// ------------------------------------------------------------- config selection
check('config: default is v3', A.getActiveModelConfig('').id === 'v3');
check('config: ?model=v3 selects v3', A.getActiveModelConfig('?model=v3').id === 'v3');
check('config: ?model=legacy selects legacy', A.getActiveModelConfig('?model=legacy').id === 'legacy');
check('config: ?model=v3-source selects source', A.getActiveModelConfig('?model=v3-source').id === 'v3-source');
check('config: unknown id falls back to default (v3)', A.getActiveModelConfig('?model=nope').id === 'v3');
check('config: v3 uses optimised derivative, source untouched path kept', A.MODEL_CONFIGS.v3.url === './denture_v3_web.glb' && A.MODEL_CONFIGS['v3-source'].url === './denture_v3.glb');

// ------------------------------------------------------------- v3 normalisation
const v3 = buildV3Like();
v3.root.updateMatrixWorld(true);
const worldBoxBefore = {}; for (let n = 1; n <= 32; n++) worldBoxBefore[n] = new THREE.Box3().setFromObject(v3.root.getObjectByName('tooth_' + n));
A.normalizeModel(v3.root, A.MODEL_CONFIGS.v3);
const R = v3.root;

check('aliases: Mandible -> mandibleLow', R.getObjectByName('mandibleLow') && R.getObjectByName('mandibleLow').userData.originalName === 'Mandible');
check('aliases: Maxilla group -> RLMaxilla1', R.getObjectByName('RLMaxilla1') && R.getObjectByName('RLMaxilla1').isGroup);
check('aliases: gums', !!R.getObjectByName('UMesh_PM3D_Sphere3D2_26') && !!R.getObjectByName('UMesh_LowerGums_Hide_Teeth6'));
const gumMeshes = []; R.getObjectByName('UMesh_PM3D_Sphere3D2_26').traverse(o => { if (o.isMesh) gumMeshes.push(o); });
check('vertex colours: v3 upper gum + palate have vertexColors disabled', gumMeshes.length === 2 && gumMeshes.every(m => m.material.vertexColors === false && m.material.userData.dentalVertexColorsDisabled), gumMeshes.map(m => m.material.vertexColors));
check('vertex colours: unshared gum material changed in place (not cloned)', R.getObjectByName('Upper_gum_1').material === v3.gumMat);
check('vertex colours: material shared with another mesh is cloned first', R.getObjectByName('Upper_gum_2').material !== v3.palateMat && v3.palateMat.vertexColors === true && R.getObjectByName('nerve_sharing_palate_mat').material === v3.palateMat);
check('vertex colours: gum colour/roughness/maps untouched', v3.gumMat.color.getHex() === 0xd04050 && v3.gumMat.roughness === 0.23 && R.getObjectByName('Upper_gum_2').material.roughness === 0.23);
check('vertex colours: tooth materials untouched', A.getToothMeshes(R.getObjectByName('tooth_8')).every(m => !m.material.userData.dentalVertexColorsDisabled));
check('vertex colours: v3-source config disables the same object', JSON.stringify(A.MODEL_CONFIGS['v3-source'].disableVertexColors) === JSON.stringify(A.MODEL_CONFIGS.v3.disableVertexColors));
const art = R.getObjectByName('Arteries'), vei = R.getObjectByName('Veins');
check('placeholders: Arteries/Veins exist, empty, invisible', art && vei && !art.visible && !vei.visible && art.children.length === 0 && vei.children.length === 0);

const t8 = R.getObjectByName('tooth_8'), t9 = R.getObjectByName('tooth_9');
const enamel8 = t8.children.find(c => /enamel/.test(c.name)), dentin8 = t8.children.find(c => /dentin/.test(c.name)), pulp8 = t8.children.find(c => /pulp/.test(c.name));
check('helpers: getToothRoot(enamel) -> tooth_8', A.getToothRoot(enamel8) === t8);
check('helpers: getToothNumber(dentin) -> 8', A.getToothNumber(dentin8) === 8);
check('helpers: getToothRoot(non-tooth) -> null', A.getToothRoot(R.getObjectByName('mandibleLow')) === null);
check('helpers: getToothMeshes -> 3 parts', A.getToothMeshes(t8).length === 3);
check('helpers: isPartOfTooth', A.isPartOfTooth(pulp8, t8) && !A.isPartOfTooth(pulp8, t9));
check('helpers: getPrimaryToothMesh -> enamel', A.getPrimaryToothMesh(t8) === enamel8);
check('tissues tagged', enamel8.userData.dentalTissue === 'enamel' && dentin8.userData.dentalTissue === 'dentin' && pulp8.userData.dentalTissue === 'pulp');
const hm = A.getToothMaterials(t8, { forHighlight: true });
check('highlight materials: enamel + dentin, not pulp', hm.length === 2 && hm.includes(enamel8.material) && hm.includes(dentin8.material) && !hm.includes(pulp8.material));
check('materials: shared dentin cloned per tooth', dentin8.material !== v3.dentin && dentin8.material !== t9.children.find(c => /dentin/.test(c.name)).material);
check('materials: shared pulp cloned per tooth', pulp8.material !== t9.children.find(c => /pulp/.test(c.name)).material);
check('materials: settings preserved on clone', dentin8.material.color.getHex() === v3.dentin.color.getHex());
check('materials: unique enamel keeps texture object', enamel8.material.map === v3.tex);
check('pick: pulp excluded from raycast', (() => { const hits = []; pulp8.raycast(new THREE.Raycaster(), hits); return hits.length === 0 && pulp8.userData.dentalNoPick; })());

// re-pivot: world appearance unchanged, origin at tooth centre
R.updateMatrixWorld(true);
let pivotOk = true, worldOk = true;
for (let n = 1; n <= 32; n++) {
  const t = R.getObjectByName('tooth_' + n);
  const now = new THREE.Box3().setFromObject(t);
  const centre = now.getCenter(new THREE.Vector3());
  if (!near(t.getWorldPosition(new THREE.Vector3()), centre, 1e-6 * R.scale.x * 10)) pivotOk = false;
  // compare in root-local space (root transform was applied after the "before" snapshot)
  const localCentre = R.worldToLocal(centre.clone());
  if (!near(localCentre, worldBoxBefore[n].getCenter(new THREE.Vector3()), 1e-6)) worldOk = false;
}
check('repivot: tooth origin == tooth centre', pivotOk);
check('repivot: tooth does not move', worldOk);
check('repivot: x3 scale keeps centre (isolate)', (() => { const c0 = A.getToothCenter(t8).clone(); t8.scale.setScalar(3); const c1 = A.getToothCenter(t8); t8.scale.setScalar(1); return near(c0, c1, 1e-6); })());

// root fit
check('fit: root tilted 19.4°', Math.abs(R.rotation.x - 19.4 * Math.PI / 180) < 1e-12);
const fitBox = new THREE.Box3(); A.MODEL_CONFIGS.v3.fit.teeth.forEach(n => fitBox.expandByObject(R.getObjectByName('tooth_' + n)));
check('fit: arch width == legacy target', Math.abs((fitBox.max.x - fitBox.min.x) - 204.33) < 1e-6, fitBox.max.x - fitBox.min.x);
check('fit: arch centre == legacy target', near(fitBox.getCenter(new THREE.Vector3()), new THREE.Vector3(7.9, -17.39, 48.3), 1e-6));

// jaws
const up = R.getObjectByName('upperJawGrp'), lo = R.getObjectByName('lowerJawGrp');
check('jaw: base transforms captured', up.userData.basePosition && lo.userData.baseRotation);
const b0 = [up.position.clone(), lo.position.clone()];
for (let i = 0; i < 5; i++) { A.applyJawViewOffsets(up, lo); A.restoreJawBasePosition(up); A.restoreJawBasePosition(lo); }
check('jaw: repeated view/restore has no drift', up.position.equals(b0[0]) && lo.position.equals(b0[1]));
A.applyJawViewOffsets(up, lo);
check('jaw: view offset = base + config', near(up.position, b0[0].clone().add(new THREE.Vector3().fromArray(A.MODEL_CONFIGS.v3.jaw.viewUpperOffset))));
A.restoreJawBasePosition(up); A.restoreJawBasePosition(lo);
check('jaw: v3 open angle from config', A.getJawOpenAngle() === A.MODEL_CONFIGS.v3.jaw.openAngle);
check('features: devLobes disabled for v3', A.isFeatureEnabled('devLobes') === false);

// compare clone
enamel8.material.emissive.setHex(0x007382); enamel8.material.transparent = true; enamel8.material.opacity = 0.85; enamel8.material.color.setHex(0x37c4d4);
const clone = A.buildToothDisplayClone(t8);
const cm = []; clone.traverse(o => { if (o.isMesh) cm.push(o); });
check('compare clone: all 3 parts', cm.length === 3);
check('compare clone: centred on origin', near(new THREE.Box3().setFromObject(clone).getCenter(new THREE.Vector3()), new THREE.Vector3(), 1e-6));
check('compare clone: same size as tooth in world', (() => { const a = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3()), b = new THREE.Box3().setFromObject(t8, true).getSize(new THREE.Vector3()); return near(a, b, 1e-4); })());
check('compare clone: owns geometry + materials', cm.every(m => ![enamel8, dentin8, pulp8].some(s => s.geometry === m.geometry || s.material === m.material)));
const ce = cm.find(m => /enamel/.test(m.name)).material;
check('compare clone: original look restored (no glow/tint/transparency)', ce.emissive.getHex() === 0 && !ce.transparent && ce.opacity === 1 && ce.color.getHex() === 0xffffff);
check('compare clone: textures shared, not copied', ce.map === v3.tex);
let texDisposed = false; v3.tex.addEventListener('dispose', () => { texDisposed = true; });
let geoDisposed = 0, matDisposed = 0; cm.forEach(m => { m.geometry.addEventListener('dispose', () => geoDisposed++); m.material.addEventListener('dispose', () => matDisposed++); });
let srcDisposed = false; enamel8.geometry.addEventListener('dispose', () => { srcDisposed = true; }); enamel8.material.addEventListener('dispose', () => { srcDisposed = true; });
A.disposeOwnedObject(clone);
check('dispose: clone geometries + materials disposed', geoDisposed === 3 && matDisposed === 3);
check('dispose: shared texture and main-model resources untouched', !texDisposed && !srcDisposed);
check('visibility helper', (() => { const ok1 = A.isVisibleInScene(enamel8); t8.visible = false; const ok2 = !A.isVisibleInScene(enamel8); t8.visible = true; return ok1 && ok2; })());

// ------------------------------------------------------------- legacy normalisation
const L = buildLegacyLike();
const legacyTooth = L.getObjectByName('tooth_5'); const legacyMat = legacyTooth.material;
A.normalizeModel(L, A.MODEL_CONFIGS.legacy);
check('legacy: root transform 350 / (0,-50,0) / no tilt', L.scale.x === 350 && L.position.equals(new THREE.Vector3(0, -50, 0)) && L.rotation.x === 0);
check('legacy: names untouched, no placeholders added', L.getObjectByName('Arteries').isMesh && !L.getObjectByName('Arteries').userData.dentalPlaceholder);
check('legacy: unique materials not cloned', legacyTooth.material === legacyMat);
check('legacy: tooth is its own root/mesh', A.getToothRoot(legacyTooth) === legacyTooth && A.getToothMeshes(legacyTooth).length === 1);
check('legacy: highlight material = tooth material', A.getToothMaterials(legacyTooth, { forHighlight: true })[0] === legacyMat);
check('legacy: no re-pivot (position untouched)', legacyTooth.position.x === toothX(5) * 100 + 36);
check('legacy: jaw open 0.3 and literal-equivalent view offsets', A.getJawOpenAngle() === 0.3 && (() => { const j = L.getObjectByName('lowerJawGrp'); A.applyJawViewOffsets(L.getObjectByName('upperJawGrp'), j); const ok = Math.abs(j.position.z - 20) < 1e-9 && Math.abs(L.getObjectByName('upperJawGrp').position.y) < 1e-9; A.restoreJawBasePosition(j); return ok; })());
check('legacy: devLobes enabled', A.isFeatureEnabled('devLobes'));
check('legacy: vertex-colour handling untouched (nerves/vessels/gum keep vertexColors)', ['Arteries', 'Veins', 'Skin_Nerves', 'UMesh_PM3D_Sphere3D2_26'].every(n => L.getObjectByName(n).material.vertexColors === true && !L.getObjectByName(n).material.userData.dentalVertexColorsDisabled));
check('legacy: compare clone is the single tooth mesh', (() => { const c = A.buildToothDisplayClone(legacyTooth); let k = 0; c.traverse(o => { if (o.isMesh) k++; }); return k === 1; })());

const pass = results.filter(r => r[1]).length;
console.log(`\n${pass} passed, ${results.length - pass} failed`);
process.exit(pass === results.length ? 0 : 1);
