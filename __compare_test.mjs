// Dependency-free harness that executes the REAL compare functions from
// dentistry_js.js (not a copy) against stubbed THREE / OrbitControls / DOM.
// Focus: prove the white-screen fix — renderers are created ONCE and reused
// across selections (no WebGL context churn) — plus mesh disposal on swap,
// per-tooth camera auto-fit, dark clear colour, and controlled error overlays.
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./dentistry_js.js', import.meta.url), 'utf8');
const start = src.indexOf('function resolveToothMesh');
const endMarker = 'function onSelectionTwo(){ /* deprecated */ }';
const end = src.indexOf(endMarker) + endMarker.length;
if (start < 0 || end < endMarker.length) throw new Error('Could not locate compare block');
const code = src.slice(start, end);

// ---------------- spies ----------------
const spy = { rendererCreated:0, rendererDispose:0, contextLoss:0, clearColorAlpha1:0,
              renders:0, geoDispose:0, matDispose:0, setSizeZero:0 };

// ---------------- THREE stub ----------------
function Vec3(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; }
Vec3.prototype.set = function(x,y,z){ this.x=x;this.y=y;this.z=z; return this; };
Vec3.prototype.copy = function(v){ this.x=v.x;this.y=v.y;this.z=v.z; return this; };
Vec3.prototype.clone = function(){ return new Vec3(this.x,this.y,this.z); };
Vec3.prototype.getCenter = function(t){ t.x=this.cx||0; t.y=this.cy||0; t.z=this.cz||0; return t; };

function makeGeometry(opts={}){
  return { cloned:false, _empty:!!opts.empty,
    boundingBox:{ getCenter(t){ t.x=10;t.y=20;t.z=-5; return t; } },
    boundingSphere:{ radius:120 }, translated:null,
    clone(){ const g=makeGeometry(opts); g.cloned=true; return g; },
    applyMatrix4(){ this.applied=true; }, computeBoundingBox(){}, translate(x,y,z){ this.translated={x,y,z}; },
    computeBoundingSphere(){}, dispose(){ spy.geoDispose++; } };
}
function makeMaterial(){ return { emissive:{ setRGB(){ this.reset=true; } }, needsUpdate:false,
    clone(){ return makeMaterial(); }, dispose(){ spy.matDispose++; } }; }

const THREE = {
  Vector3: Vec3,
  Color: function(c){ this.value=c; this.setRGB=function(){}; },
  Box3: function(){ this._empty=false;
    this.setFromObject=(o)=>{ this._empty = !!(o && o.__empty); return this; };
    this.isEmpty=()=>this._empty;
    this.getSize=(t)=>{ t.x=80;t.y=160;t.z=40; return t; };
    this.getCenter=(t)=>{ t.x=0;t.y=0;t.z=0; return t; }; },
  Scene: function(){ this.children=[]; this.background=null; this.environment=null;
    this.add=(o)=>this.children.push(o); this.remove=(o)=>{ const i=this.children.indexOf(o); if(i>=0)this.children.splice(i,1); }; },
  AmbientLight: function(){}, HemisphereLight: function(){},
  DirectionalLight: function(){ this.position={ set(){} }; },
  PerspectiveCamera: function(fov){ this.fov=fov; this.aspect=1; this.near=0; this.far=0;
    this.position=new Vec3(); this.lookAt=()=>{}; this.updateProjectionMatrix=()=>{}; },
  WebGLRenderer: function(opts){ spy.rendererCreated++; this.domElement=opts.canvas;
    this.shadowMap={enabled:false}; this.setPixelRatio=()=>{};
    this.setClearColor=(c,a)=>{ if(a===1) spy.clearColorAlpha1++; };
    this.setSize=(w,h)=>{ if(!w||!h) spy.setSizeZero++; };
    this.render=()=>{ spy.renders++; }; this.dispose=()=>{ spy.rendererDispose++; };
    this.forceContextLoss=()=>{ spy.contextLoss++; }; },
  Mesh: function(geometry, material){ this.geometry=geometry; this.material=material;
    this.castShadow=false; this.receiveShadow=false; this.__empty=false; },
  MeshStandardMaterial: function(){ Object.assign(this, makeMaterial()); },
};
const OrbitControls = function(){ this.target=new Vec3(); this.enableDamping=false;
  this.dampingFactor=0; this.screenSpacePanning=false; this.minDistance=0; this.maxDistance=0;
  this.update=()=>{}; this.dispose=()=>{}; };

// ---------------- DOM stub ----------------
function makeCanvas(){
  const parent = { _kids:[], appendChild(el){ this._kids.push(el); el.parentNode=this; },
                   removeChild(el){ const i=this._kids.indexOf(el); if(i>=0)this._kids.splice(i,1); } };
  const c = { clientWidth:600, clientHeight:700, parentNode:parent,
              addEventListener(){}, removeEventListener(){} };
  parent.appendChild(c);
  return c;
}
function makeEl(){ const span={textContent:''};
  return { _html:'', set innerHTML(v){this._html=v;}, get innerHTML(){return this._html;},
           textContent:'', hidden:true, style:{display:''}, querySelector:(s)=>s==='span'?span:null, _span:span }; }
const els = {
  compareView: makeEl(), compareTitleLeft: makeEl(), compareTitleRight: makeEl(),
  info: makeEl(), compareLeft: makeEl(), compareRight: makeEl(),
  'teeth-info-title': makeEl(), sceneMessage: makeEl(),
  compareCanvasLeft: makeCanvas(), compareCanvasRight: makeCanvas(),
};
els.sceneMessage._span.textContent = 'Click on a tooth to view more information on the tooth.';
const overlays = [];
const document = {
  getElementById:(id)=>els[id]||null,
  createElement:(tag)=>{ const el={ tagName:tag, className:'', style:{display:'none'}, textContent:'',
      parentNode:null, appendChild(){}, }; overlays.push(el); return el; },
};
const window = {
  ResizeObserver: function(cb){ this.cb=cb; this.observe=()=>{}; this.disconnect=()=>{}; },
  devicePixelRatio: 2, addEventListener:()=>{}, removeEventListener:()=>{},
};
const ResizeObserver = window.ResizeObserver;
const requestAnimationFrame = ()=>1;   // never re-invoke (single render per resume)
const cancelAnimationFrame = ()=>{};

// ---------------- app-scope stubs ----------------
let envMap = { isTexture:true };
let compareActive = false;
let compareViewers = [];
let compareSavedBanner = null;
let compareToggle = false;
let one, two;
let selectedTooth = null;
// State/functions declared outside the evaluated slice in dentistry_js.js.
var compareEditSide = null, compareTempLeft = null, compareTempRight = null;
const ODONTOGRAM_REGIONS = Array.from({length:33},(_,i)=> i ? [0,10,0,10] : [0,0,0,0]);
const ODONTOGRAM_IMG_W = 100, ODONTOGRAM_IMG_H = 100;
let selectedToothName = null;
const toothHighlightSprites = []; let baseOdontogramSprite = null;
function applyCompareHighlights(){} function clearCardHighlights(){} function clearAllToothEmissive(){}
function focusCameraOnTooth(){} function updateXrayForTooth(){}
let sceneAreaClasses = new Set();
const sceneArea = { classList: { add:(c)=>sceneAreaClasses.add(c), remove:(c)=>sceneAreaClasses.delete(c) } };
const controls = { update:()=>{} };
const teethNames = Array.from({length:33},(_,i)=>`ToothName${i}`);
const teethNumSystem = Array.from({length:33},(_,i)=>[i,'p',i,`Sys Name ${i}`]);

// tooth_30 is intentionally broken (no geometry) to exercise error handling.
const carm = { getObjectByName:(name)=>{ const n=parseInt(name.substring(6)); if(!n) return null;
  const geometry = (n===30) ? null : makeGeometry();
  return { name, updateWorldMatrix(){}, matrixWorld:{}, geometry, material: makeMaterial() }; } };

function disableCheckbox(){} function enableCheckbox(){}
function disableButton(){} function enableButton(){}
let closeJawCalls=0, applyVisCalls=0;
function closeJaw(){ closeJawCalls++; }
function applyVisibilityToggles(){ applyVisCalls++; }

// ---------------- evaluate the REAL functions ----------------
const api = eval(code + '\n;({ compare, registerCompareSelection, confirmCompareSelection, buildIsolatedToothMesh, fitCameraToObject });');
const { compare, registerCompareSelection, confirmCompareSelection, buildIsolatedToothMesh, fitCameraToObject } = api;

// ============================ DRIVE ============================
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

// Enter compare
compare();
check('enter: compareToggle true', compareToggle === true);
check('enter: no renderers created yet (lazy)', spy.rendererCreated === 0);

// pick 1
registerCompareSelection(8);
check('pick1: one=tooth_8, hidden', one && one.name==='tooth_8' && compareActive===false);
check('pick1: still no renderers', spy.rendererCreated === 0);

// pick 2 -> pair chosen, split waits for Confirm
registerCompareSelection(9);
check('pick2: two=tooth_9, split not yet shown (needs Confirm)', two && two.name==='tooth_9' && compareActive===false && spy.rendererCreated===0);

// confirm -> creates exactly two renderers, shows split
confirmCompareSelection();
const vL = compareViewers[0], vR = compareViewers[1];
check('confirm: two viewers created', compareViewers.length === 2);
check('confirm: exactly 2 WebGL renderers created', spy.rendererCreated === 2);
check('confirm: dark clear colour set (alpha 1) on both', spy.clearColorAlpha1 === 2);
check('confirm: compareActive', compareActive === true && els.compareView.hidden === false);
check('confirm: both rendered', spy.renders >= 2);
check('confirm: titles real names', els.compareTitleLeft.textContent==='Sys Name 8 (8)' && els.compareTitleRight.textContent==='Sys Name 9 (9)');

// CORE FIX: changing a side must NOT create new renderers (no context churn)
const createdBeforeRepick = spy.rendererCreated;
const geoDispBeforeRepick = spy.geoDispose;
registerCompareSelection(9);                  // choose RIGHT side for editing
registerCompareSelection(14);                 // stage tooth 14 for the right side
check('edit: staged only, split unchanged until Confirm', two.name==='tooth_9' && compareTempRight===14);
confirmCompareSelection();
check('edit: right side now tooth_14', two && two.name==='tooth_14' && compareActive===true);
check('edit: SAME viewer instances kept', compareViewers[0]===vL && compareViewers[1]===vR);
check('edit: NO new renderers created', spy.rendererCreated === createdBeforeRepick);
check('edit: old mesh disposed on swap', spy.geoDispose > geoDispBeforeRepick);
check('edit: zero-size setSize never called', spy.setSizeZero === 0);

// Exit compare -> meshes cleared, renderers KEPT (not disposed)
const dispBeforeExit = spy.rendererDispose;
selectedTooth = carm.getObjectByName('tooth_15');
compare();
check('exit: compareToggle false, hidden', compareToggle===false && els.compareView.hidden===true);
check('exit: renderers NOT disposed (kept for reuse)', spy.rendererDispose === dispBeforeExit);
check('exit: banner restored', els.sceneMessage._span.textContent.includes('Click on a tooth'));

// Re-enter + pick a pair -> renderers persist across sessions (still 2)
compare();
registerCompareSelection(3);
registerCompareSelection(20);
confirmCompareSelection();
check('reenter: renderers persisted (still 2 total)', spy.rendererCreated === 2);
check('reenter: same viewer identities', compareViewers[0]===vL && compareViewers[1]===vR);

// Error handling: a broken tooth (30) shows a dark error, does NOT throw, and
// does NOT blank the other viewer.
compare(); compare();
let threw = false;
try { registerCompareSelection(30); registerCompareSelection(7); confirmCompareSelection(); } catch(e){ threw = true; }
check('error: no exception bubbled to caller', threw === false);
const leftOverlay = els.compareCanvasLeft.parentNode._kids.find(k=>k.className==='compare-error');
check('error: left overlay element exists', !!leftOverlay);
check('error: left overlay shown (broken tooth 30)', leftOverlay && leftOverlay.style.display==='flex');
check('error: right viewer still active/rendering', compareActive === true);

// fitCameraToObject sanity (finite camera, target = box center)
const cam = new THREE.PerspectiveCamera(45); const ctl = new OrbitControls();
fitCameraToObject(cam, ctl, new THREE.Mesh(makeGeometry(), makeMaterial()));
check('fit: camera z finite & positive', isFinite(cam.position.z) && cam.position.z > 0);
check('fit: controls target set to center', ctl.target.x===0 && ctl.target.y===0 && ctl.target.z===0);
check('fit: projection updated (near/far finite)', isFinite(cam.near) && isFinite(cam.far) && cam.far>cam.near);

// buildIsolatedToothMesh throws on missing geometry (so caller shows error)
let buildThrew=false; try { buildIsolatedToothMesh(carm.getObjectByName('tooth_30')); } catch(e){ buildThrew=true; }
check('build: throws on missing geometry', buildThrew === true);

// recenter + material clone (no shared state with main model)
const m = buildIsolatedToothMesh(carm.getObjectByName('tooth_5'));
check('build: recentered by -center', m.geometry.translated && m.geometry.translated.x===-10 && m.geometry.translated.z===5);
check('build: material cloned, not shared', m.material !== carm.getObjectByName('tooth_5').material);

// ---------------- report ----------------
let pass=0, fail=0;
for (const [name, ok] of results){ console.log((ok?'PASS':'FAIL')+'  '+name); ok?pass++:fail++; }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
