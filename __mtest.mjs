import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('./index.html','utf8');
// jsdom: don't run external scripts; we inject mobile.js manually with controllable matchMedia
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const document = window.document;

// controllable matchMedia
let MOBILE = false;
const listeners = [];
window.matchMedia = (q) => ({
  media: q,
  get matches(){ return MOBILE; },
  addEventListener: (_e,cb)=>listeners.push(cb),
  addListener: (cb)=>listeners.push(cb),
  removeEventListener(){}, removeListener(){}
});
window.requestAnimationFrame = (cb)=>cb();

// capture original parents
function path(el){ return el ? el.parentNode && el.parentNode.id ? '#'+el.parentNode.id : (el.parentNode && el.parentNode.className||'(root)') : 'null'; }
const targets = {
  search: document.querySelector('.search-shell'),
  info: document.querySelector('.info-panel'),
  actions: document.querySelector('.info-actions'),
  xray: document.querySelector('.xray-panel'),
  occ: document.querySelector('.occlusion-panel'),
  jaw: document.querySelector('.jaw-panel'),
  odo: document.getElementById('odontogramCard'),
};
const orig = {};
for (const k in targets) orig[k] = targets[k] ? targets[k].parentNode : null;

// load mobile.js into this window
const mjs = fs.readFileSync('./mobile.js','utf8');
window.eval(mjs);
// init runs (readyState complete) -> onMqChange with MOBILE=false => exitMobile (noop)

function fireChange(v){ MOBILE=v; listeners.forEach(cb=>cb({matches:v})); }

// --- go mobile ---
fireChange(true);
const drawerBody = document.getElementById('mobileDrawerBody');
const dock = document.getElementById('mobileActionDock');
const sceneArea = document.querySelector('.scene-area');
console.log('AFTER ENTER MOBILE:');
console.log('  search in drawer:', targets.search.parentNode === drawerBody);
console.log('  info in drawer:', targets.info.parentNode === drawerBody);
console.log('  xray in drawer:', targets.xray.parentNode === drawerBody);
console.log('  occlusion in drawer:', targets.occ.parentNode === drawerBody);
console.log('  jaw in drawer:', targets.jaw.parentNode === drawerBody);
console.log('  actions in dock:', dock && targets.actions.parentNode === dock);
console.log('  odontogram in scene-area:', targets.odo.parentNode === sceneArea);

// --- back to desktop ---
fireChange(false);
console.log('AFTER EXIT (back to desktop):');
let ok = true;
for (const k in targets){
  const back = targets[k].parentNode === orig[k];
  if(!back) ok=false;
  console.log('  '+k+' restored to original parent:', back);
}
console.log('  dock removed:', !document.getElementById('mobileActionDock'));
// verify actions back inside info-panel and info-panel inside left-column etc by checking order integrity
console.log('ALL RESTORED:', ok);

// --- toggle mobile again to ensure idempotent ---
fireChange(true); fireChange(false);
let ok2 = true; for(const k in targets){ if(targets[k].parentNode!==orig[k]) ok2=false; }
console.log('SECOND ROUND-TRIP RESTORED:', ok2);
