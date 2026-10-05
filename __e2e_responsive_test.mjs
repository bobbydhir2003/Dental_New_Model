// Viewport + touch tests (desktop 1440 / tablet 1024 / phone 430): model on
// screen, selection by mouse click (desktop) or touch tap (tablet/phone).
// Needs: npm i --no-save playwright   (starts serve.js itself if port 8123 is free)
// Run:   node __e2e_responsive_test.mjs [default,legacy,v3,v3-source]   (default: default,legacy)
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { ensureServer, BASE } from './__e2e_server.mjs';
const SHOTS = fileURLToPath(new URL('./test-results/model-shots/', import.meta.url)); fs.mkdirSync(SHOTS, { recursive: true });
const stopServer = await ensureServer();
const browser = await chromium.launch({ channel: 'chrome' });
const VIEWS = [
  { name: 'desktop-1440', viewport: { width: 1440, height: 900 } },
  { name: 'tablet-1024', viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'phone-430', viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
];
let fails = 1;
try {
fails = 0;
for (const model of (process.argv[2] || 'default,legacy').split(',')) for (const v of VIEWS) {
  const ctx = await browser.newContext(v); const page = await ctx.newPage(); const errors = [];
  page.on('console', m => { if (m.type() === 'error' || /webgl|GL_INVALID|GL ERROR/i.test(m.text())) errors.push(m.text()); }); page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  const t0 = Date.now();
  await page.goto(model === 'default' ? `${BASE}/index.html?debug` : `${BASE}/index.html?model=${model}&debug`);
  await page.waitForFunction(() => window.__dental && window.__dental.carm, null, { timeout: 180000 });
  const loadMs = Date.now() - t0; await page.waitForTimeout(1200);
  const st = await page.evaluate(() => {
    const d = window.__dental, T = d.THREE, r = d.renderer.domElement.getBoundingClientRect();
    const box = new T.Box3(); for (let i = 1; i <= 32; i++) box.expandByObject(d.carm.getObjectByName('tooth_' + i));
    const corners = [box.min, box.max].map(p => p.clone().project(d.camera));
    const c = d.getToothCenter(d.carm.getObjectByName('tooth_8')).project(d.camera);
    return { canvas: [Math.round(r.width), Math.round(r.height)], tris: d.renderer.info.render.triangles, teethOnScreen: corners.every(p => Math.abs(p.x) <= 1.05 && Math.abs(p.y) <= 1.05),
      tap: { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height } };
  });
  await page.screenshot({ path: `${SHOTS}resp-${model}-${v.name}.png` });
  // select tooth 8 by tapping/clicking it on the 3D model
  if (v.hasTouch) await page.touchscreen.tap(st.tap.x, st.tap.y); else await page.mouse.click(st.tap.x, st.tap.y);
  await page.waitForTimeout(1400);
  const sel = await page.evaluate(() => window.__dental.selectedToothName);
  await page.screenshot({ path: `${SHOTS}resp-${model}-${v.name}-selected.png` });
  st.id = await page.evaluate(() => window.__dental.model.id);
  const ok = st.id === (model === 'default' ? 'v3' : model) && st.canvas[0] > 200 && st.canvas[1] > 200 && st.tris > 0 && st.teethOnScreen && sel === 'tooth_8' && errors.length === 0;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${model}->${st.id} ${v.name}: load ${loadMs}ms canvas ${st.canvas} tris ${st.tris} teethOnScreen ${st.teethOnScreen} ${v.hasTouch ? 'tap' : 'click'}->${sel} errors ${errors.length ? JSON.stringify(errors) : 0}`);
  await ctx.close();
}
console.log(fails ? `${fails} viewport check(s) FAILED` : 'all viewport checks passed');
} catch (e) {
  console.error('ERROR (test aborted):', e && e.message ? e.message : e);
  fails = fails || 1;
} finally {
  await browser.close();
  stopServer();
}
process.exit(fails ? 1 : 0);
