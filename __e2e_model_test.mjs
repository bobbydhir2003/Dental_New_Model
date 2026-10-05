// Browser end-to-end regression tests (Playwright + local Google Chrome).
// Needs: npm i --no-save playwright   (starts serve.js itself if port 8123 is free)
// Run:   node __e2e_model_test.mjs [default|v3|legacy|v3-source]
//        default = plain index.html (no ?model=), expected to load v3.
// Screenshots: test-results/model-shots/. Exit code 0 only if every check passes.
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import fs from 'fs';
import { ensureServer, BASE } from './__e2e_server.mjs';

const ARG = process.argv[2] || 'default';
const MODEL = ARG === 'default' ? 'v3' : ARG;
const EXPECT_URL = { legacy: '/three/examples/models/gltf/denture.glb', v3: '/denture_v3_web.glb', 'v3-source': '/denture_v3.glb' }[MODEL];
const glbRequests = [];
const SHOTS = fileURLToPath(new URL('./test-results/model-shots/', import.meta.url)); fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, extra) => { results.push([name, !!ok]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && !ok ? '  -> ' + JSON.stringify(extra) : '')); };

const stopServer = await ensureServer();
const browser = await chromium.launch({ channel: 'chrome' });
let exitCode = 1;
try {
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || /webgl|GL_INVALID|GL ERROR/i.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
const shot = (n) => page.locator('.scene-area').first().screenshot({ path: `${SHOTS}${ARG}-${n}.png` }).catch(() => page.screenshot({ path: `${SHOTS}${ARG}-${n}.png` }));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

page.on('request', (r) => { if (/\.glb(\?|$)/.test(r.url())) glbRequests.push(new URL(r.url()).pathname); });
await page.goto(ARG === 'default' ? `${BASE}/index.html?debug` : `${BASE}/index.html?model=${MODEL}&debug`);
await page.waitForFunction(() => window.__dental && window.__dental.carm, null, { timeout: 180000 });
await wait(1500);
await page.click('#sceneMessage button, .scene-message-close', { timeout: 2000 }).catch(() => {});

// ---------------------------------------------------------------- helpers in page
await ev(() => {
  const d = window.__dental, T = d.THREE;
  window.__t = {
    SELECT: new T.Color('rgb(0,115,130)'),
    tooth: (n) => d.carm.getObjectByName('tooth_' + n),
    glowing: () => { const out = []; d.carm.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.equals(window.__t.SELECT)) out.push({ tooth: o.userData.dentalTooth, tissue: o.userData.dentalTissue }); }); return out; },
    project: (v) => { const r = d.renderer.domElement.getBoundingClientRect(); const p = v.clone().project(d.camera); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; },
    // Integer screen pixel (searched outward from the tooth centre) where the
    // app's own pick logic - first VISIBLE tooth hit, pulp never pickable -
    // lands on tooth n (and on the given tissue, if any). Avoids overlay panels.
    pickPoint: (n, tissue) => {
      const r = d.renderer.domElement.getBoundingClientRect();
      const teeth = []; for (let i = 1; i <= 32; i++) teeth.push(window.__t.tooth(i));
      const vis = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
      const box = new T.Box3().setFromObject(window.__t.tooth(n));
      const pts = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(window.__t.project(new T.Vector3(x, y, z)));
      const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cand = [];
      for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) cand.push([Math.round(x0 + (x1 - x0) * i / 24), Math.round(y0 + (y1 - y0) * j / 24)]);
      cand.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      const ray = new T.Raycaster();
      for (const [x, y] of cand) {
        if (x < r.left + 40 || x > r.right - 380 || y < r.top + 120 || y > r.bottom - 200) continue;
        const el = document.elementFromPoint(x, y); if (el !== d.renderer.domElement) continue;
        ray.setFromCamera(new T.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1), d.camera);
        const hit = ray.intersectObjects(teeth, true).find(h => vis(h.object));
        if (!hit) continue;
        const owner = hit.object.userData.dentalTooth;
        if (owner === n && (!tissue || hit.object.userData.dentalTissue === tissue)) return { x, y, hitName: hit.object.name };
      }
      return null;
    },
    jaw: (name) => { const j = d.carm.getObjectByName(name); return { pos: j.position.toArray(), rot: [j.rotation.x, j.rotation.y, j.rotation.z], base: j.userData.basePosition.toArray() }; },
    visibleMeshes: () => { const out = []; d.carm.traverse(o => { if (o.isMesh) { let v = true, n = o; while (n) { if (!n.visible) { v = false; break; } n = n.parent; } if (v) out.push(o); } }); return out; },
  };
});
const sel = () => ev(() => window.__dental.selectedToothName);
const clickToggle = (id) => page.click(`label[for="${id}"]`);

// ---------------------------------------------------------------- MODEL SELECTION
const activeId = await ev(() => window.__dental.model.id);
check(`model: ${ARG} -> ${MODEL} (active config "${activeId}")`, activeId === MODEL, activeId);
check(`model: fetched only ${EXPECT_URL}`, glbRequests.length === 1 && glbRequests[0] === EXPECT_URL, glbRequests);
// ---------------------------------------------------------------- MODEL LOAD
const load = await ev(() => {
  const c = window.__dental.carm; const names = ['upperJawGrp', 'lowerJawGrp', 'mandibleLow', 'RLMaxilla1', 'UMesh_PM3D_Sphere3D2_26', 'UMesh_LowerGums_Hide_Teeth6', 'Skin_Nerves', 'Arteries', 'Veins', 'curveOfSpee', 'curveOfWilson', 'sphereOfMonson'];
  let teeth = 0; for (let i = 1; i <= 32; i++) if (c.getObjectByName('tooth_' + i)) teeth++;
  return { missing: names.filter(n => !c.getObjectByName(n)), teeth, curvesOpacity: [c.getObjectByName('curveOfSpee').material.opacity, c.getObjectByName('sphereOfMonson').material.opacity], spinner: getComputedStyle(document.getElementById('loadingDiv')).display };
});
check('load: all legacy-named objects resolvable', load.missing.length === 0, load.missing);
check('load: 32 teeth', load.teeth === 32);
check('load: curve opacity setup ran (no crash in load callback)', load.curvesOpacity[0] === 0.8 && load.curvesOpacity[1] === 0.5, load.curvesOpacity);
check('load: spinner hidden', load.spinner === 'none');
await shot('01-initial');

// tooth numbering: Universal ordering by position (upper 1->16 runs patient-right to left, i.e. -x to +x)
const order = await ev(() => { const xs = []; for (let i = 1; i <= 32; i++) xs.push(window.__dental.getToothCenter(window.__t.tooth(i)).toArray()); return xs; });
// Universal: 1-8 patient-right upper, 9-16 left upper, 17-24 left lower, 25-32 right lower
// (patient right = -x). Incisors (8,9,24,25) are the most anterior (+z) of their arch.
const mid = (order[7][0] + order[8][0]) / 2;
const sidesOk = order.every((c, i) => { const n = i + 1; const right = (n <= 8) || (n >= 25); return right ? c[0] < mid + 6 : c[0] > mid - 6; });
const archOk = order.slice(0, 16).every(c => c[1] > Math.max(...order.slice(16).map(q => q[1])));
const frontOk = [8, 9].every(n => order[n - 1][2] > order[2][2] && order[n - 1][2] > order[13][2]) && [24, 25].every(n => order[n - 1][2] > order[18][2] && order[n - 1][2] > order[29][2]);
check('numbering: Universal 1-32 sides/arches/incisors consistent', sidesOk && archOk && frontOk, order.map(c => c.map(v => Math.round(v))));

// ---------------------------------------------------------------- SELECTION (3D click)
const tissueFront = MODEL === 'legacy' ? null : 'enamel';
let pt = await ev(([n, t]) => window.__t.pickPoint(n, t), [8, tissueFront]);
check('click: found visible point on tooth 8 ' + (tissueFront || 'mesh'), !!pt, pt);
if (pt) {
  await page.mouse.click(pt.x, pt.y); await wait(1300);
  check('click enamel/mesh -> tooth_8 selected', (await sel()) === 'tooth_8', { sel: await sel(), hit: pt.hitName });
  const info = await page.textContent('#info');
  check('click: info panel updated', /Maxillary Right Central Incisor/.test(info), info);
  check('click: x-ray updated', (await page.getAttribute('#xrayImage', 'src')).includes('xray-8.png'));
  check('click: odontogram card highlight', await page.$eval('.odo-highlight[data-tooth="8"]', e => e.classList.contains('is-active')));
  const g = await ev(() => window.__t.glowing());
  const expected = MODEL === 'legacy' ? 1 : 2;
  check('highlight: only tooth 8 glows', g.length === expected && g.every(x => x.tooth === 8), g);
  check('highlight: pulp not highlighted', g.every(x => x.tissue !== 'pulp'));
  const nb = await ev(() => [7, 9, 24, 25].map(n => window.__dental.getToothMaterials(window.__t.tooth(n)).some(m => m.emissive && m.emissive.equals(window.__t.SELECT) || m.transparent && m.opacity < 1)));
  check('highlight: neighbouring teeth unaffected', nb.every(x => !x), nb);
  await shot('02-select-tooth8');
}
if (MODEL !== 'legacy') {
  // dentin click: find a dentin point that is the first hit (roots, through gums)
  const dp = await ev(() => { for (const n of [27, 26, 22, 6, 11, 28, 21]) { const p = window.__t.pickPoint(n, 'dentin'); if (p) return { n, ...p }; } return null; });
  check('click: found visible dentin point', !!dp, dp);
  if (dp) {
    await page.mouse.click(dp.x, dp.y); await wait(1300);
    check('click dentin -> correct tooth (' + dp.n + ')', (await sel()) === 'tooth_' + dp.n, { sel: await sel(), dp });
  }
}

// ---------------------------------------------------------------- ALL 32 TEETH
// odontogram -> 3D (selection, glow on that tooth only, card + info sync), then
// 3D -> odontogram: click the now camera-focused tooth on the model; a click on
// the selected tooth deselects it, which proves the hit resolved to tooth_N.
const bad = [];
for (let n = 1; n <= 32; n++) {
  await page.click(`.odo-hotspot[data-tooth="${n}"]`); await wait(1150);
  const st = await ev((n) => ({ sel: window.__dental.selectedToothName, glow: [...new Set(window.__t.glowing().map(g => g.tooth))],
    card: [...document.querySelectorAll('.odo-highlight.is-active')].map(e => +e.dataset.tooth), xray: document.getElementById('xrayImage').getAttribute('src') }), n);
  if (st.sel !== 'tooth_' + n || st.glow.length !== 1 || st.glow[0] !== n || st.card.length !== 1 || st.card[0] !== n || !st.xray.endsWith(`xray-${n}.png`)) { bad.push({ n, step: 'odontogram', st }); continue; }
  const p3 = await ev((n) => window.__t.pickPoint(n, null), n);
  if (!p3) { bad.push({ n, step: 'no visible point after focus' }); continue; }
  await page.mouse.click(p3.x, p3.y); await wait(150);
  const after = await ev(() => ({ sel: window.__dental.selectedToothName, card: document.querySelectorAll('.odo-highlight.is-active').length, glow: window.__t.glowing().length }));
  if (after.sel !== null || after.card !== 0 || after.glow !== 0) bad.push({ n, step: '3D click', hit: p3.hitName, after });
}
check('all 32 teeth: odontogram->3D select/glow/card/x-ray and 3D click resolves to same tooth', bad.length === 0, bad);

// ---------------------------------------------------------------- ODONTOGRAM / SEARCH / KEYBOARD
await page.click('.odo-hotspot[data-tooth="14"]'); await wait(1300);
check('odontogram -> tooth_14', (await sel()) === 'tooth_14');
check('odontogram: 3D tooth 14 glows', (await ev(() => window.__t.glowing())).every(x => x.tooth === 14));
await page.fill('#searchBox', 'canine'); await wait(200);
const items = await page.$$('#resultsList li');
check('search: results listed', items.length >= 4, items.length);
await page.click('#resultsList li >> nth=0'); await wait(1300);
check('search -> tooth_6 (Maxillary Right Canine)', (await sel()) === 'tooth_6', await sel());
await page.$eval('#searchBox', e => e.blur()); await page.click('#threejs-canvas', { position: { x: 5, y: 300 } }).catch(() => {});
await page.keyboard.press('3'); await page.keyboard.press('0'); await wait(2400);
check('keyboard "30" -> tooth_30', (await sel()) === 'tooth_30', await sel());

// ---------------------------------------------------------------- DEV LOBES (D key)
const before = await ev(() => window.__dental.getToothMaterials(window.__t.tooth(30)).map(m => m.map ? m.map.uuid : null));
await page.keyboard.press('d'); await wait(400);
const after = await ev(() => window.__dental.getToothMaterials(window.__t.tooth(30)).map(m => m.map ? m.map.uuid : null));
if (MODEL === 'legacy') { check('devLobes legacy: toggles lobe map', JSON.stringify(before) !== JSON.stringify(after)); await page.keyboard.press('d'); await wait(300); }
else check('devLobes v3: safe no-op', JSON.stringify(before) === JSON.stringify(after));
await ev(() => { window.__dental.selectedTooth; }); // noop

// ---------------------------------------------------------------- ISOLATE
await page.click('.odo-hotspot[data-tooth="19"]'); await wait(1300);
await clickToggle('gumsCheckbox'); // user turns gums OFF before isolating
const c0 = await ev(() => window.__dental.getToothCenter(window.__t.tooth(19)).toArray());
await page.click('#isolateButton'); await wait(600);
const iso = await ev(() => {
  const vis = window.__t.visibleMeshes(); const t = window.__t.tooth(19);
  return { isolate: window.__dental.isolateTgl, vis: vis.map(m => m.name), allPartOf: vis.every(m => { let n = m; while (n) { if (n === t) return true; n = n.parent; } return false; }),
    parts: vis.length, center: window.__dental.getToothCenter(t).toArray(), target: window.__dental.controls.target.toArray(), scale: t.scale.x };
});
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
check('isolate: on', iso.isolate === true);
check('isolate: only tooth 19 parts visible', iso.allPartOf && iso.parts === (MODEL === 'legacy' ? 1 : 3), iso.vis);
// legacy tooth pivots are ~3 units off-centre (pre-existing; legacy path unchanged)
const isoTol = MODEL === 'legacy' ? 15 : 4;
check('isolate: tooth did not jump (centre moved < ' + isoTol + ' units)', dist(iso.center, c0) < isoTol, { c0, c: iso.center });
check('isolate: camera target on tooth centre (< ' + isoTol + ' units)', dist(iso.target, iso.center) < isoTol, { t: iso.target, c: iso.center });
check('isolate: scaled x3', iso.scale === 3);
await wait(600); await shot('03-isolate-19');
await page.click('#isolateButton'); await wait(600);
const un = await ev(() => ({ isolate: window.__dental.isolateTgl, scale: window.__t.tooth(19).scale.x, gumsVisible: window.__dental.carm.getObjectByName('UMesh_PM3D_Sphere3D2_26').visible || window.__dental.carm.getObjectByName('UMesh_LowerGums_Hide_Teeth6').visible, bones: window.__dental.carm.getObjectByName('mandibleLow').visible && window.__dental.carm.getObjectByName('RLMaxilla1').visible, teethVisible: window.__t.visibleMeshes().filter(m => m.userData.dentalTooth).length, nerves: window.__dental.carm.getObjectByName('Skin_Nerves').visible, glow: window.__t.glowing() }));
check('unisolate: off, scale 1', !un.isolate && un.scale === 1);
check('unisolate: gums stay OFF (user had disabled them)', un.gumsVisible === false);
check('unisolate: bones restored on', un.bones === true);
check('unisolate: nerves stay off', un.nerves === false);
check('unisolate: all teeth visible again', un.teethVisible >= 32, un.teethVisible);
check('unisolate: selected tooth re-highlighted', un.glow.length && un.glow.every(x => x.tooth === 19), un.glow);
await clickToggle('gumsCheckbox');

// ---------------------------------------------------------------- VISIBILITY
const vis = async () => ev(() => { const c = window.__dental.carm; const v = (n) => c.getObjectByName(n).visible; return { gums: v('UMesh_PM3D_Sphere3D2_26') && v('UMesh_LowerGums_Hide_Teeth6'), bones: v('mandibleLow') && v('RLMaxilla1'), nerves: v('Skin_Nerves'), spee: v('curveOfSpee'), wilson: v('curveOfWilson'), monson: v('sphereOfMonson'), upper: v('upperJawGrp'), lower: v('lowerJawGrp') }; });
check('visibility: gums back on', (await vis()).gums);
await clickToggle('gumsCheckbox'); check('toggle gums off', !(await vis()).gums); await clickToggle('gumsCheckbox');
await clickToggle('bonesCheckbox'); check('toggle bones off', !(await vis()).bones); await shot('04-bones-off'); await clickToggle('bonesCheckbox'); check('toggle bones on', (await vis()).bones);
await clickToggle('nervesCheckbox'); check('toggle nerves on (no crash)', (await vis()).nerves); await shot('05-nerves-on'); await clickToggle('nervesCheckbox'); check('toggle nerves off', !(await vis()).nerves);
for (const [id, k] of [['speeCheckbox', 'spee'], ['wilsonCheckbox', 'wilson'], ['monsonCheckbox', 'monson']]) { await clickToggle(id); check('toggle ' + k + ' on', (await vis())[k]); }
await shot('06-curves-on');
for (const id of ['speeCheckbox', 'wilsonCheckbox', 'monsonCheckbox']) await clickToggle(id);
await clickToggle('upperJawCheckbox'); check('toggle upper jaw off', !(await vis()).upper); await shot('07-upper-off'); await clickToggle('upperJawCheckbox');
await clickToggle('teethCheckbox');
await ev(() => window.__dental.controls.target.set(0, 0, 0));
const hiddenPt = await ev(() => window.__t.project(window.__dental.getToothCenter(window.__t.tooth(8))));
const selBefore = await sel(); await page.mouse.click(hiddenPt.x, hiddenPt.y); await wait(300);
check('hidden teeth are not clickable', (await sel()) === selBefore, { selBefore, now: await sel() });
await clickToggle('teethCheckbox');

// ---------------------------------------------------------------- JAW
const J0 = { u: await ev(() => window.__t.jaw('upperJawGrp')), l: await ev(() => window.__t.jaw('lowerJawGrp')) };
const same = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);
check('jaw: starts at base', same(J0.u.pos, J0.u.base) && same(J0.l.pos, J0.l.base));
const expAngle = MODEL === 'legacy' ? 0.3 : 0.2693;
await clickToggle('jawOpenCheckbox'); await wait(300);
let L = await ev(() => window.__t.jaw('lowerJawGrp')), U = await ev(() => window.__t.jaw('upperJawGrp'));
check('jaw open: lower rotation = ' + expAngle, Math.abs(L.rot[0] - expAngle) < 1e-9, L.rot);
check('jaw open: jaws stay at base position (not off-screen)', same(L.pos, L.base) && same(U.pos, U.base), { L, U });
await shot('08-jaw-open');
await clickToggle('jawOpenCheckbox'); await wait(300);
for (let i = 0; i < 3; i++) { await clickToggle('jawOpenCheckbox'); await wait(120); await clickToggle('jawOpenCheckbox'); await wait(120); }
L = await ev(() => window.__t.jaw('lowerJawGrp')); U = await ev(() => window.__t.jaw('upperJawGrp'));
check('jaw: closed after repeated open/close, no drift', L.rot[0] === 0 && same(L.pos, L.base) && same(U.pos, U.base) && U.rot.every(v => v === 0), { L, U });
await shot('09-jaw-closed');

// occlusal view
await clickToggle('occlusalCheckbox'); await wait(1800);
L = await ev(() => window.__t.jaw('lowerJawGrp')); U = await ev(() => window.__t.jaw('upperJawGrp'));
const occ = await ev(() => { const d = window.__dental, T = d.THREE; const r = []; for (const n of [8, 25]) { const p = d.getToothCenter(window.__t.tooth(n)).project(d.camera); r.push([p.x, p.y, p.z]); } return { r, bonesHidden: !d.carm.getObjectByName('mandibleLow').visible }; });
check('occlusal: jaws splayed ±90°', Math.abs(U.rot[0] + Math.PI / 2) < 1e-6 && Math.abs(L.rot[0] - Math.PI / 2) < 1e-6);
check('occlusal: both arches on screen', occ.r.every(p => Math.abs(p[0]) < 1 && Math.abs(p[1]) < 1 && p[2] < 1), occ.r);
check('occlusal: bones hidden', occ.bonesHidden);
await shot('10-occlusal');
await clickToggle('occlusalCheckbox'); await wait(1800);
L = await ev(() => window.__t.jaw('lowerJawGrp')); U = await ev(() => window.__t.jaw('upperJawGrp'));
check('occlusal off: exact base transforms restored', same(L.pos, L.base, 1e-6) && same(U.pos, U.base, 1e-6) && L.rot.every(v => Math.abs(v) < 1e-9) && U.rot.every(v => Math.abs(v) < 1e-9), { L, U });
check('occlusal off: bones restored', await ev(() => window.__dental.carm.getObjectByName('mandibleLow').visible));
// occlusal -> isolate -> unisolate -> occlusal off (cross-feature drift)
await clickToggle('occlusalCheckbox'); await wait(1500);
await page.click('.odo-hotspot[data-tooth="3"]'); await wait(300);
await page.click('#isolateButton'); await wait(400); await page.click('#isolateButton'); await wait(300);
await clickToggle('occlusalCheckbox'); await wait(1800);
L = await ev(() => window.__t.jaw('lowerJawGrp')); U = await ev(() => window.__t.jaw('upperJawGrp'));
check('occlusal + isolate round-trip: no drift', same(L.pos, L.base, 1e-6) && same(U.pos, U.base, 1e-6), { L, U });

// ---------------------------------------------------------------- RESET
await ev(() => { const d = window.__dental; d.camera.position.set(300, 200, 300); d.controls.target.set(40, 10, 0); d.controls.update(); });
await page.click('#btnReset'); await wait(4000);
const cam = await ev(() => ({ p: window.__dental.camera.position.toArray(), t: window.__dental.controls.target.toArray(), rot: window.__dental.carm.rotation.x }));
check('reset: camera + target restored', same(cam.p, [0, 0, 800], 1e-6) && same(cam.t, [0, 0, 0], 1e-6), cam);
check('reset: model orientation unchanged', Math.abs(cam.rot - (MODEL === 'legacy' ? 0 : 19.4 * Math.PI / 180)) < 1e-9);
await shot('11-after-reset');

// ---------------------------------------------------------------- COMPARE
await clickToggle('compareCheckbox'); await wait(300);
await page.click('.odo-hotspot[data-tooth="8"]'); await wait(300);
await page.click('.odo-hotspot[data-tooth="19"]'); await wait(300);
const glowCmp = await ev(() => [...new Set(window.__t.glowing().map(g => g.tooth))].sort((a, b) => a - b));
check('compare: both picks highlighted on model', JSON.stringify(glowCmp) === '[8,19]', glowCmp);
await page.click('#compareConfirmBtn'); await wait(1500);
const cmp = await ev(() => {
  const d = window.__dental; const v = d.compareViewers; const meshes = (o) => { const a = []; o && o.traverse(x => { if (x.isMesh) a.push(x); }); return a; };
  const main = new Set(); d.carm.traverse(o => { if (o.material) [].concat(o.material).forEach(m => main.add(m)); if (o.geometry) main.add(o.geometry); });
  return v.map(x => { const m = x.getMesh(); const ms = meshes(m); return { parts: ms.map(q => q.name), shared: ms.some(q => main.has(q.material) || main.has(q.geometry)), emissiveClean: ms.every(q => !q.material.emissive || q.material.emissive.getHex() === 0), opaque: ms.every(q => q.material.opacity === 1) }; })
    .concat([{ active: d.compareActive, titles: [document.getElementById('compareTitleLeft').textContent, document.getElementById('compareTitleRight').textContent] }]);
});
const nParts = MODEL === 'legacy' ? 1 : 3;
check('compare: split active with correct titles', cmp[2].active && /\(8\)/.test(cmp[2].titles[0]) && /\(19\)/.test(cmp[2].titles[1]), cmp[2]);
check('compare: left shows complete tooth (' + nParts + ' part(s))', cmp[0].parts.length === nParts, cmp[0].parts);
check('compare: right shows complete tooth', cmp[1].parts.length === nParts, cmp[1].parts);
check('compare: clones own their geometry/materials', !cmp[0].shared && !cmp[1].shared);
check('compare: no carried-over glow', cmp[0].emissiveClean && cmp[1].emissiveClean);
if (MODEL !== 'legacy') check('compare: clones restored to original opacity', cmp[0].opaque && cmp[1].opaque);
await page.screenshot({ path: `${SHOTS}${ARG}-12-compare.png` });
// change the right tooth (phase B) then confirm -> old clone disposed, new one shown
await page.click('#odoMarkerR'); await page.click('.odo-hotspot[data-tooth="30"]'); await page.click('#compareConfirmBtn'); await wait(1000);
const r2 = await ev(() => { const m = window.__dental.compareViewers[1].getMesh(); const a = []; m.traverse(x => { if (x.isMesh) a.push(x.name); }); return { title: document.getElementById('compareTitleRight').textContent, parts: a.length }; });
check('compare: change right tooth to 30', /\(30\)/.test(r2.title) && r2.parts === nParts, r2);
await clickToggle('compareCheckbox'); await wait(600);
const ex = await ev(() => ({ active: window.__dental.compareActive, glow: window.__t.glowing().length, canvas: document.getElementById('threejs-canvas').style.visibility }));
check('compare exit: main view back, highlights cleared', !ex.active && ex.glow === 0 && ex.canvas === '', ex);

// ---------------------------------------------------------------- WEBGL
const glErr = await ev(() => { const gl = window.__dental.renderer.getContext(); return { err: gl.getError(), lost: gl.isContextLost() }; });
check('webgl: no GL error state, context not lost', glErr.err === 0 && !glErr.lost, glErr);

// ---------------------------------------------------------------- CONSOLE
const relevant = errors.filter(e => !/favicon/i.test(e));
check('console: no errors / page errors / HTTP failures', relevant.length === 0, relevant);

const pass = results.filter(r => r[1]).length;
console.log(`\n[${ARG}] ${pass}/${results.length} passed`);
exitCode = pass === results.length ? 0 : 1;
} catch (e) {
  console.error(`[${ARG}] ERROR (test aborted):`, e && e.message ? e.message : e);
} finally {
  await browser.close();
  stopServer();
}
process.exit(exitCode);
