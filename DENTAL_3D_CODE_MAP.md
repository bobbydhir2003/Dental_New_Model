# Dental 3D Code Map

## 1. Project structure

### Important files and folders

- `index.html`
  - Main application page.
  - Contains the UI controls, canvas element, and loads `dentistry_js.js` as a module.
  - Defines the main HTML IDs used by the app.

- `dentistry_js.js`
  - The core application logic.
  - Loads the 3D model, creates the Three.js scene, handles input, and implements all control behaviors.

- `three/`
  - Contains the Three.js library and example assets.
  - Key files used by the app:
    - `three/build/three.module.js`
    - `three/examples/jsm/loaders/GLTFLoader.js`
    - `three/examples/jsm/loaders/RGBELoader.js`
    - `three/examples/jsm/controls/OrbitControls.js`
    - `three/examples/jsm/libs/lil-gui.module.min.js`

- `three/examples/models/gltf/denture.glb`
  - 3D denture model loaded by the app.

- `three/examples/textures/`
  - Contains textures for odontogram, x-rays, tooth selection, and developmental lobes.
  - Important texture files:
    - `textures/odontogram_universal.png`
    - `textures/odontogram_palmer.png`
    - `textures/odontogram_fdi.png`
    - `textures/odontogram.png`
    - `textures/xrays/xray-<toothNumber>.png`
    - `textures/tooth_selection/tooth_<i>.png`
    - `textures/devLobes/devLobe_tooth_8.png`

### App entry points

- The app is launched from `index.html`.
- `index.html` loads `dentistry_js.js` via `<script type="module" src="./dentistry_js.js"></script>`.
- `dentistry.html` exists in the repo but is not the current app entry point for `index.html`.

### Which file loads the 3D model

- `dentistry_js.js` is the file that loads `denture.glb`.

### Which file controls the UI

- `index.html` defines the UI structure and HTML IDs.
- `dentistry_js.js` wires UI event listeners to those IDs and implements behavior.

### Which file controls the 3D functions

- `dentistry_js.js` contains all Three.js setup, model control, selection, isolate, compare, and UI control functions.

---

## 2. 3D model loading

> **Update (model adapter):** the model is chosen in `dental_model_adapter.js`
> (default `v3` = `denture_v3_web.glb`; `?model=v3-source` = `denture_v3.glb`;
> `?model=legacy` = the original `denture.glb` described below). `init()` loads
> `ACTIVE_MODEL.url` and calls `normalizeModel()`, which applies the root
> transform (`350` / `(0,-50,0)` for legacy), aliases v3 names to the legacy
> names in section 6, adds empty `Arteries`/`Veins` placeholders for v3, gives
> each tooth its own materials, re-pivots grouped v3 teeth (`tooth_N` = Group of
> enamel/dentin/pulp) and records base jaw transforms. Jaw poses use base
> transform + per-model offsets. See README "3D Models" for v3 limitations.
> The snippet below shows the original legacy-only code.

### Where `denture.glb` is loaded

In `dentistry_js.js`, inside `init()`:

```js
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.loadAsync('./three/examples/models/gltf/denture.glb').then(function ( gltf ) {
    carm = gltf.scene;
    carm.scale.multiplyScalar(350);
    carm.position.set(0, -50, 0);
    scene1.add(carm);
    ...
});
```

### Model path

- `./three/examples/models/gltf/denture.glb`

### Three.js objects created

- `scene1`
  - `scene1 = new THREE.Scene();`
  - Main scene holding camera, lights, and the loaded model.

- `camera`
  - `camera = new THREE.PerspectiveCamera(45, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 2000);`
  - Positioned at `0, 0, 800`.
  - Added to the scene via `scene1.add(camera)`.

- `renderer`
  - `renderer = new THREE.WebGLRenderer({ antialias: true, canvas: container });`
  - Renders the scene to an existing HTML canvas.
  - Pixel ratio set with `renderer.setPixelRatio(window.devicePixelRatio)`.
  - Size set with `renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT)`.

- `controls`
  - `controls = new OrbitControls(camera, renderer.domElement);`
  - Uses the camera and renderer DOM element to receive user drag/pan/zoom input.
  - `controls.listenToKeyEvents(window);`
  - `controls.screenSpacePanning = true;`
  - `controls.maxPolarAngle = Math.PI / 2;`

- lights
  - Ambient light: `new THREE.AmbientLight(0xffffff, 0.2)`.
  - Directional light: `new THREE.DirectionalLight(0xffffff, 1)`.
  - Directional light is configured to cast shadows.

- `raycaster`
  - `const raycaster = new THREE.Raycaster();`
  - Used to detect clicks on the odontogram overlay and on tooth meshes.

### Render loop

- `animate()` is the animation loop:
  - Calls `requestAnimationFrame(animate)`.
  - If `params.turntable` is false, calls `render()`.
  - If `params.turntable` is true, calls `rotateCam()`.

- `render()` does:
  - `renderer.render(scene1, camera);`

- `rotateCam()` rotates the camera around the model and renders the scene.

- `onWindowResize()` updates the camera projection and renderer size, but it uses the static `CANVAS_WIDTH` and `CANVAS_HEIGHT` values defined at initialization.

---

## 3. Canvas information

### Canvas ID used by Three.js

- `threejs-canvas`

### How the renderer attaches to the canvas

- In `dentistry_js.js`, `container` is set to the canvas DOM element:

```js
let container = document.getElementById('threejs-canvas');
```

- Then renderer is created with:

```js
renderer = new THREE.WebGLRenderer({ antialias: true, canvas: container });
```

This instructs Three.js to render into the existing `<canvas id="threejs-canvas">` element instead of creating a new canvas.

### How mouse/touch events are connected to tooth selection

- `document.addEventListener('mousedown', onPointerMove, false);`
- `document.addEventListener('touchstart', onPointerMove, false);

- `onPointerMove(event)`:
  - Computes pointer coordinates in normalized device coordinates relative to the renderer DOM element.
  - Uses `raycaster.setFromCamera(pointer, camera)`.
  - Intersects with `group` to detect clicks on the odontogram overlay.
  - Intersects with `group_Mesh` to detect clicks on 3D tooth meshes.
  - If a hit is detected, it sets `selectedTooth` and updates the UI via `highlightObject`, `highlightOdontogram`, and `info`.

---

## 4. All HTML IDs used by JavaScript

| HTML element ID | Element type | Where it appears in `index.html` | JS function / listener uses it | What it controls |
|---|---|---|---|---|
| `threejs-canvas` | `<canvas>` | Main canvas in page body | Passed to `WebGLRenderer({ canvas: container })` | 3D rendering surface |
| `hud` | `<div>` | Overlay on canvas | `document.onkeydown` writes keys here | Keyboard entry display |
| `universal` | radio input | Numbering system panel | `universalCheckbox.oninput` | Switch to Universal numbering |
| `palmer` | radio input | Numbering system panel | `palmerCheckbox.oninput` | Switch to Palmer numbering |
| `fdi` | radio input | Numbering system panel | `fdiCheckbox.oninput` | Switch to FDI numbering |
| `showNum` | radio input | Numbering system panel | `showNumCheckbox.oninput` | Show odontogram number overlay |
| `hideNum` | radio input | Numbering system panel | `hideNumCheckbox.oninput` | Hide odontogram number overlay |
| `bonesCheckbox` | checkbox | Visibility panel | `bonesCheckbox.addEventListener('click', ...)` | Toggle mandible/maxilla visibility |
| `jawViewCheckbox` | checkbox | Jaw controls panel | `jawViewCheckbox.addEventListener('click', ...)` | Toggle jaw view mode |
| `jawOpenCheckbox` | checkbox | Jaw controls panel | `jawOpenCheckbox.addEventListener('click', ...)` | Toggle open jaw mode |
| `compareCheckbox` | checkbox | Jaw controls panel | `compareCheckbox.addEventListener('click', ...)` | Toggle compare mode |
| `gumsCheckbox` | checkbox | Visibility panel | `gumsCheckbox.addEventListener('click', ...)` | Toggle gum visibility |
| `nervesCheckbox` | checkbox | Visibility panel | `nervesCheckbox.addEventListener('click', ...)` | Toggle nerve/vein visibility |
| `speeCheckbox` | checkbox | Visibility panel | `speeCheckbox.addEventListener('click', ...)` | Toggle curve of Spee |
| `wilsonCheckbox` | checkbox | Visibility panel | `wilsonCheckbox.addEventListener('click', ...)` | Toggle curve of Wilson |
| `monsonCheckbox` | checkbox | Visibility panel | `monsonCheckbox.addEventListener('click', ...)` | Toggle sphere of Monson |
| `isolateButton` | button | Functions panel | `isolateBtn.addEventListener('click', ...)` | Toggle isolate selected tooth |
| `devLobeButton` | button | Functions panel | `devLobeButton.addEventListener('click', ...)` | Apply developmental lobe texture |
| `xrayButton` | button | Functions panel | no current JS listener in `dentistry_js.js` | Opens the modal via Bootstrap data attributes |
| `searchBox` | `<input>` | Top navbar | searchBox event listeners | Search tooth names |
| `searchBtn` | button | Top navbar | `searchBtn.addEventListener('click', ...)` | Trigger search results |
| `closeSearchBtn` | button | Top navbar | `closeSearchBtn.addEventListener('click', ...)` | Clear search results |
| `resultsList` | `<ul>` | Search overlay | `populateResults()` appends items | Displays search results |
| `searchResultsDiv` | `<div>` | Search overlay | shown/hidden by search code | Search dropdown container |
| `compareLeft` | `<div>` | Selected tooth info card | `compare()` / `onSelectionTwo()` / `isolate()` | Shows compare left text |
| `compareRight` | `<div>` | Selected tooth info card | `compare()` / `onSelectionTwo()` | Shows compare right text |
| `info` | `<div>` | Selected tooth info card | `highlightOdontogram()`, `updateNumSystem()`, `compare()`, `devLobes()` | Shows selected tooth status |
| `teeth-info-title` | `<div>` | Selected tooth header | `compare()` toggles title | Label for info panel |
| `loadingDiv` | `<div>` | Canvas loading overlay | hidden when model loads | Shows loading spinner |
| `xrayImage` | `<img>` | X-ray panel | `highlightOdontogram()` | Displays selected tooth x-ray image |

> Note: `xrayButton` exists in HTML, but current `dentistry_js.js` does not attach a JavaScript click listener to it. It relies on Bootstrap modal attributes.

---

## 5. All button/control functions

| Button / control name | HTML ID | JS function called | What happens when clicked | Which model objects/meshes are affected |
|---|---|---|---|---|
| Jaw View | `jawViewCheckbox` | `jawViewToggle()` → `jawViewOn()` / `jawViewOff()` | Rotates upper and lower jaws into separated view; hides bones and vascular structures in jaw-view mode | `upperJawGrp`, `lowerJawGrp`, `RLMaxilla1`, `mandibleLow`, `Arteries`, `Veins`, `Skin_Nerves` |
| Open Jaw | `jawOpenCheckbox` | `jawOpenToggle()` → `openJaw()` / `closeJaw()` | Rotates lower jaw open or closed | `lowerJawGrp` |
| Compare | `compareCheckbox` | `compare()` | Toggles compare mode; first click enters a two-tooth selection mode, second click exits compare mode | All tooth mesh visibility; selected teeth `one` and `two`; `compareLeft` / `compareRight` info |
| Gums | `gumsCheckbox` | click listener | Hides or shows gum meshes | `UMesh_PM3D_Sphere3D2_26`, `UMesh_LowerGums_Hide_Teeth6` |
| Bones | `bonesCheckbox` | click listener | Hides or shows jaw bones | `mandibleLow`, `RLMaxilla1` |
| Nerves | `nervesCheckbox` | click listener | Hides or shows nerve and vascular structures | `Arteries`, `Veins`, `Skin_Nerves` |
| Curve of Spee | `speeCheckbox` | click listener | Hides or shows the Spee curve helper | `curveOfSpee` |
| Curve of Wilson | `wilsonCheckbox` | click listener | Hides or shows the Wilson curve helper | `curveOfWilson` |
| Sphere of Monson | `monsonCheckbox` | click listener | Hides or shows the Monson sphere helper | `sphereOfMonson` |
| Isolate Selected | `isolateButton` | `isolateToggle()` → `isolate()` / `unIsolate()` | Hides all meshes except the selected tooth, scales it up, and centers camera target on it | `selectedTooth` plus all other meshes hidden |
| Compare X-Ray | `xrayButton` | none in JS | Opens modal dialog via Bootstrap attribute | no model object, but `xrayImage` updates with selected tooth image elsewhere |
| Developmental Lobe | `devLobeButton` | `devLobes()` | Toggles a developmental lobe texture on the selected tooth | `selectedTooth.material` |
| Search | `searchBox`, `searchBtn`, `closeSearchBtn` | `populateResults()` | Filters tooth names, shows result list, and selects tooth on click | `selectedTooth` and `highlightOdontogram()` for selected tooth |
| Numbering system | `universal`, `palmer`, `fdi`, `showNum`, `hideNum` | `updateNumSystem()` | Changes displayed odontogram numbering system and toggle show/hide | `group.children[0]` odontogram sprite |
| Odontogram show/hide | `showNum`, `hideNum` | mapped to radio input handlers | Switches whether numbering overlay is visible | `group.children[0]` |

---

## 6. 3D model mesh/group names referenced in code

### Jaw groups

- `upperJawGrp`
  - Used in: `init()` and `jawViewOn()` / `jawViewOff()`.
  - Represents the upper jaw model group.
  - Unsafe to rename unless all code references are updated.

- `lowerJawGrp`
  - Used in: `init()`, `jawViewOn()` / `jawViewOff()`, `openJaw()`, `closeJaw()`.
  - Represents the lower jaw model group.
  - Unsafe to rename unless all code references are updated.

### Teeth groups

- `tooth_1` through `tooth_32`
  - Used in: `init()` to populate `group_Mesh`, `onPointerMove()` for mesh selection, `highlightObject()`, `highlightOdontogram()`, `isolate()`, compare mode, search result selection.
  - Represent individual tooth mesh names inside the GLTF model.
  - Unsafe to rename unless the entire mapping is updated.

### Gum groups

- `UMesh_PM3D_Sphere3D2_26`
  - Used in: `gumsCheckbox` click handler.
  - Appears to be an upper gum mesh.
  - Unsafe to rename unless all references are updated.

- `UMesh_LowerGums_Hide_Teeth6`
  - Used in: `gumsCheckbox` click handler.
  - Appears to be the lower gum mesh.
  - Unsafe to rename unless all references are updated.

### Bone groups

- `mandibleLow`
  - Used in: `bonesCheckbox`, `jawViewOn()`, `jawViewOff()`.
  - Represents lower jaw bone.
  - Unsafe to rename unless updated across code.

- `RLMaxilla1`
  - Used in: `bonesCheckbox`, `jawViewOn()`, `jawViewOff()`.
  - Represents upper maxilla bone.
  - Unsafe to rename unless updated across code.

### Nerve / artery / vein groups

- `Skin_Nerves`
  - Used in: visibility toggles, `init()` initial hide, and jaw/jaw-view modes.
  - Represents the nerve skin layer.
  - Unsafe to rename without code updates.

- `Arteries`
  - Used in: visibility toggles and jaw/jaw-view modes.
  - Represents artery geometry.
  - Unsafe to rename unless updated in code.

- `Veins`
  - Used in: visibility toggles and jaw/jaw-view modes.
  - Represents vein geometry.
  - Unsafe to rename unless updated in code.

### Occlusion groups

- `curveOfSpee`
  - Used in: initial hide and visibility toggle.
  - Represents the occlusal curve of Spee.
  - Unsafe to rename unless updated in code.

- `curveOfWilson`
  - Used in: initial hide and visibility toggle.
  - Represents the occlusal curve of Wilson.
  - Unsafe to rename unless updated in code.

- `sphereOfMonson`
  - Used in: initial hide and visibility toggle.
  - Represents the Monson sphere.
  - Unsafe to rename unless updated in code.

### X-ray / odontogram related groups

- `group`
  - A Three.js `THREE.Group()` added to the camera.
  - Holds sprite overlays for odontogram numbering and tooth highlight sprites.
  - Used for odontogram selection and display; not part of the GLTF model.
  - Renaming is safe only if all code references are updated.

- `group_Mesh`
  - A Three.js `THREE.Group()` that holds tooth mesh objects from the GLTF model.
  - Used only for raycasting selection of teeth.
  - Safe to rename only if code references are updated.

### Special named meshes

- `mainBody`
  - Commented-out code references it, but not actively used.
  - If present in the GLTF model, it is not currently part of active logic.

- `Scene1`
  - Name assigned to `scene1`, but not used for logic.

- `Grid` and `AxesHelper`
  - Created in code but not added to the scene.
  - Not part of active application behavior.

---

## 7. Tooth selection system

### How a tooth is selected

There are two selection paths:

1. **Clicking or touching the odontogram overlay**
   - `onPointerMove()` raycasts against `group`.
   - The code reads UV coordinates from the intersection and maps them to a hardcoded tooth region array (`toothReg`).
   - When the click falls inside a tooth region, it calls `highlightObject(toothNum)`, `highlightOdontogram(i)`, and sets `selectedTooth = carm.getObjectByName(toothNum)`.

2. **Clicking or touching a 3D tooth mesh**
   - `onPointerMove()` then raycasts against `group_Mesh`.
   - If a tooth mesh is hit, it sets `intersectedTooth`, calls `highlightObject(intersectedTooth.name)`, and assigns `selectedTooth = intersectedTooth`.
   - It then parses tooth number from the mesh name and updates the odontogram highlight.

### Raycasting in this project

- `raycaster.setFromCamera(pointer, camera)` converts screen coordinates into a 3D picking ray.
- `pointer` is computed from the mouse/touch event and the canvas bounding box.
- The code intersects two targets:
  - `group` (odontogram overlay sprites)
  - `group_Mesh` (3D tooth meshes)
- The first intersection path uses UV coordinates to detect tooth regions on the odontogram sprite.
- The second path uses direct mesh intersection to detect the clicked 3D tooth.

### How `selectedTooth` is stored

- `selectedTooth` is a global variable.
- It is set in both odontogram selection and mesh selection.
- Many features depend on it: isolate mode, dev lobe toggle, highlight, compare mode, info panel, and x-ray updates.

### How tooth numbers are mapped

- The code expects selected teeth to be named `tooth_<n>`.
- It parses the number from the name with `parseInt(selectedTooth.name.substring(6))`.
- `teethNumSystem` is a lookup array that maps tooth index to Universal, Palmer, FDI, and description.

### How the information panel updates

- `highlightOdontogram(toothNumber)` updates the UI text in `info`:
  - `document.getElementById("info").innerHTML = teethNumSystem[toothNumber][3] + " (" + teethNumSystem[toothNumber][numSystem] + ")";`
- `updateNumSystem()` refreshes this label if a numbering system radio button changes.
- Compare mode and isolate mode also update `info` and `compareLeft`/`compareRight` text.

### How x-ray image changes after selecting tooth

- `highlightOdontogram(toothNumber)` updates the `xrayImage` source:

```js
xrayImg.src = "./three/examples/textures/xrays/xray-" + [toothNumber] + ".png";
```

- This loads the image matching the selected tooth number.

### How odontogram selection works

- The odontogram is represented as a sprite group attached to the camera.
- There is one base odontogram sprite (`group.children[0]`) and 32 tooth highlight sprites.
- Clicking the odontogram overlay computes a tooth region from the UV coordinate.
- The selected tooth is then highlighted in the overlay and the corresponding 3D tooth is selected.

---

## 8. Isolate mode

### Which function handles isolate mode

- `isolateToggle()` is the button wrapper.
- `isolate()` performs the actual isolate action.
- `unIsolate()` restores the default view.

### Conditions required before isolate works

- `selectedTooth` must not be `null`.
- If no tooth is selected, `isolate()` updates `info` with an error message and returns `false`.

### Which objects are hidden

- `isolate()` traverses `carm` and hides every object whose `type == "Mesh"` and whose `name` does not match `selectedTooth.name`.
- This means all meshes other than the selected tooth are hidden.

### Which objects remain visible

- The selected tooth mesh remains visible.
- Non-mesh objects and the odontogram overlay are not affected by this traversal.
- Objects that are not `Mesh` may remain visible.

### How the selected tooth is positioned/scaled

- `isolatedTooth.getWorldPosition(pos)` computes its world position.
- `controls.target = pos` centers orbit controls on the tooth.
- `isolatedTooth.scale.set(3, 3, 3)` enlarges the selected tooth.
- `camera.lookAt(pos)` points the camera at the tooth.

### How the mode is reset

- `unIsolate()` restores visibility for all `Mesh` objects, except it explicitly leaves these hidden if present:
  - `curveOfSpee`
  - `curveOfWilson`
  - `sphereOfMonson`
  - `Skin_Nerves`
  - `Arteries`
  - `Veins`
- It resets `isolatedTooth.scale` to `1,1,1` and camera target to the origin.
- It also re-enables disabled checkboxes and buttons.
- If `compareToggle` is true, `unIsolate()` refuses to work and writes an error to `info`.

---

## 9. Compare mode

### Which function handles compare mode

- `compare()` toggles compare mode on and off.
- `onSelectionOne()` and `onSelectionTwo()` handle the two-step tooth selection.

### How first tooth and second tooth are selected

- When compare is enabled:
  - `compare()` sets `compareToggle = true`.
  - It disables jaw controls and isolate button.
  - It calls `closeJaw()` and updates `info` to prompt the user.
  - It registers `mousedown` and `touchstart` listeners for `onSelectionOne()`.

- `onSelectionOne()` waits until `intersects_Mesh.length > 0` and then stores `one = selectedTooth`.
  - It copies the selected tooth position into `onePos`.
  - It removes the first selection listeners and adds listeners for `onSelectionTwo()`.

- `onSelectionTwo()` waits until `intersects_Mesh.length > 0`, stores `two = selectedTooth`, copies `twoPos`, then performs compare view changes.

### How selected teeth are stored

- `one` and `two` are global variables of type `THREE.Object3D`.
- `onePos` and `twoPos` store each tooths original position.
- `compare()` resets these when compare mode is turned off.

### How compare x-ray works

- There is no dedicated compare x-ray function in `dentistry_js.js`.
- The compare UI is limited to `compareLeft` and `compareRight` text panels for the two selected teeth.
- Selecting either tooth still updates `xrayImage` through `highlightOdontogram()`.

### Fragile or risky compare logic

- `onSelectionOne()` contains recursive logic:
  - `while (intersects_Mesh <= 0) { onSelectionOne(); }`
  - This is dangerous because it can recurse indefinitely if no tooth is selected.

- `compare()` depends on global state from `intersects_Mesh`, which is only updated by `onPointerMove()`.
- The code hides every `Mesh` on `carm` except `one` and `two`; this also hides any other mesh-based helpers unexpectedly.
- Restoring compare mode uses `carm.traverse()` and may not restore hidden non-mesh objects or objects excluded by name conditions.
- The position adjustment of compared teeth uses `one.parent.position` and `two.parent.position`, which is brittle and dependent on the parent hierarchy.

---

## 10. Visibility toggles

### Gums

- HTML ID: `gumsCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected groups: `UMesh_PM3D_Sphere3D2_26`, `UMesh_LowerGums_Hide_Teeth6`
- Behavior: hides/shows gum geometry.
- Risky parts: hardcoded GLTF object names and no null checks.

### Bones

- HTML ID: `bonesCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected groups: `mandibleLow`, `RLMaxilla1`
- Behavior: hides/shows bone geometry.
- Risky parts: hardcoded GLTF object names and no error handling if model names change.

### Nerves

- HTML ID: `nervesCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected groups: `Arteries`, `Veins`, `Skin_Nerves`
- Behavior: hides/shows nerves and vessels.
- Risky parts: names used in both hide and show logic, plus direct reliance on `carm` being loaded.

### Curve of Spee

- HTML ID: `speeCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected group: `curveOfSpee`
- Behavior: hides/shows the Spee curve helper.
- Risky parts: no null-check if object is missing.

### Curve of Wilson

- HTML ID: `wilsonCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected group: `curveOfWilson`
- Behavior: hides/shows the Wilson curve helper.
- Risky parts: same hardcoded GLTF name assumption.

### Sphere of Monson

- HTML ID: `monsonCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected group: `sphereOfMonson`
- Behavior: hides/shows the Monson sphere helper.
- Risky parts: same hardcoded GLTF name assumption.

### Jaw View

- HTML ID: `jawViewCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected groups: `upperJawGrp`, `lowerJawGrp`, `RLMaxilla1`, `mandibleLow`, `Arteries`, `Veins`, `Skin_Nerves`
- Behavior: rotates jaw pieces into a jaw view and hides bones/vessels.
- Risky parts: uses both `lowerJaw` and a locally retrieved `upperJaw` object; state may be inconsistent if the model is not loaded.

### Open Jaw

- HTML ID: `jawOpenCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected group: `lowerJawGrp`
- Behavior: rotates the lower jaw open or closed.
- Risky parts: does not restore jaw open checkbox state from compare/isolate transitions consistently.

### Compare

- HTML ID: `compareCheckbox`
- JS listener: `addEventListener('click', ...)`
- Affected groups: all meshes in `carm`, plus selected compare teeth.
- Behavior: enters a tooth comparison mode and hides all non-selected teeth.
- Risky parts: global state, recursion, and object visibility restoration.

---

## 11. Current risks / fragile areas

### Hardcoded HTML IDs

- The app depends on many hardcoded IDs directly accessed by `document.getElementById()`.
- Renaming or removing any of these IDs will break the binding.
- Examples: `jawViewCheckbox`, `isolateButton`, `compareCheckbox`, `searchBox`, `xrayImage`, `gumsCheckbox`.

### Hardcoded mesh names

- The code uses `carm.getObjectByName()` for many fixed model names.
- If the GLTF model changes names, the app will fail silently or throw errors.
- Examples: `upperJawGrp`, `lowerJawGrp`, `curveOfSpee`, `Arteries`, `mandibleLow`, `tooth_<n>`.

### Document-level event listeners

- `document.addEventListener('mousedown', onPointerMove, false);`
- `document.addEventListener('touchstart', onPointerMove, false);
- Compare mode also adds/removes listeners for `onSelectionOne` and `onSelectionTwo`.
- Global listeners can interact badly with other UI changes.

### Checkbox onclick behavior in HTML

- Some checkboxes include inline `onclick="document.getElementById('...').click()"` in HTML.
- This is redundant and may cause confusing behavior if the UI structure changes.

### Invalid or fragile HTML structure

- The `<canvas id="threejs-canvas">` contains nested `<script>` tags inside it.
- This is nonstandard HTML and may be fragile if the page is rewritten or rendered by a stricter parser.

### Global variables

- Many globals are used across the script:
  - `carm`, `selectedTooth`, `isolatedTooth`, `compareToggle`, `intersects_Mesh`, `group`, `group_Mesh`, `one`, `two`, `jawView`, `isJawOpen`, `lastJawRotation`.
- This makes the code stateful and tightly coupled to the existing UI.

### Functions depending on `selectedTooth`

- `isolate()` / `devLobes()` / compare selection / `highlightOdontogram()` all assume `selectedTooth` exists.
- If `selectedTooth` is null, some functions still attempt to parse it or use it and may break.

### Functions depending on current UI state

- `unIsolate()` checks `compareToggle == false` and refuses to run if compare mode is active.
- `compare()` disables and re-enables UI controls manually, rather than through a central state system.
- `updateNumSystem()` relies on `selectedTooth` being currently selected.

### Other fragile logic

- `onSelectionOne()` recursion combined with `while (intersects_Mesh <= 0)` is unsafe.
- `onWindowResize()` does not recalculate `CANVAS_WIDTH` / `CANVAS_HEIGHT` from the DOM.
- `compare()` and `isolate()` both manipulate scene visibility and camera state without a shared state manager.

---

## 12. Safe UI redesign rules

### IDs that must be preserved

Keep these IDs unchanged if you want the existing JavaScript to continue working:

- `threejs-canvas`
- `jawViewCheckbox`
- `jawOpenCheckbox`
- `compareCheckbox`
- `gumsCheckbox`
- `bonesCheckbox`
- `nervesCheckbox`
- `speeCheckbox`
- `wilsonCheckbox`
- `monsonCheckbox`
- `isolateButton`
- `devLobeButton`
- `searchBox`
- `searchBtn`
- `closeSearchBtn`
- `resultsList`
- `searchResultsDiv`
- `compareLeft`
- `compareRight`
- `info`
- `teeth-info-title`
- `xrayImage`
- `loadingDiv`
- `universal`
- `palmer`
- `fdi`
- `showNum`
- `hideNum`

### Functions that must not be renamed

Avoid renaming these functions unless you also update all references in `dentistry_js.js`:

- `init`
- `animate`
- `render`
- `rotateCam`
- `onWindowResize`
- `onPointerMove`
- `highlightObject`
- `highlightOdontogram`
- `isolate`
- `unIsolate`
- `isolateToggle`
- `jawViewOn`
- `jawViewOff`
- `jawViewToggle`
- `openJaw`
- `closeJaw`
- `jawOpenToggle`
- `compare`
- `onSelectionOne`
- `onSelectionTwo`
- `devLobes`
- `populateResults`
- `clearResultsList`
- `updateNumSystem`
- `disableCheckbox`
- `enableCheckbox`
- `disableButton`
- `enableButton`

### Files that should not be touched

- `index.html`
- `dentistry_js.js`
- `three/examples/models/gltf/denture.glb`
- any texture files under `three/examples/textures/`

### CSS-only changes that are safe

- Style wrappers around existing IDs and classes.
- Adding new CSS rules for new UI controls.
- Adjusting layout and spacing without modifying HTML IDs.
- Hiding existing elements with CSS while keeping them in the DOM.

### HTML changes that are safe

- Adding new UI elements with new IDs/classes.
- Adding new wrappers or sections around existing controls as long as existing IDs remain and are not moved inside invalid containers.
- Moving elements visually with CSS rather than removing or renaming required IDs.

### HTML changes that are dangerous

- Renaming or removing IDs that are referenced in `dentistry_js.js`.
- Changing input types or structure for any referenced control.
- Removing `threejs-canvas` or altering the canvas element so the renderer cannot attach.
- Nesting the canvas or scripts in a way that breaks the existing query selectors or invalidates the DOM structure.

### JavaScript changes that are dangerous

- Changing `carm.getObjectByName(...)` names without updating model and code references.
- Rewriting selection logic without preserving `selectedTooth` and the `tooth_<n>` naming assumption.
- Altering compare or isolate state flows before a proper refactor of their global state.
- Removing or renaming event listeners for the existing IDs.
- Changing `group` / `group_Mesh` semantics without ensuring selection still works.

### How to connect a new UI to existing functions safely

- Preserve the original HTML IDs and wire new controls to the same IDs if possible.
- If you build a new UI component, keep the old IDs as hidden fallback controls and trigger their `click()` or call the existing functions directly.
- Use new UI elements to call existing functions, e.g. `isolateToggle()`, `compare()`, `jawViewToggle()`, `jawOpenToggle()`, `devLobes()`.
- Keep the x-ray image ID `xrayImage` so tooth selection still updates the displayed image.
- Keep search-related IDs `searchBox`, `searchBtn`, `closeSearchBtn`, `resultsList`, `searchResultsDiv` if you want existing search code to continue working.
- Avoid modifying the logic inside `dentistry_js.js` until you have a stable abstraction for selection and state.

---

## 13. Summary

- The app is centered on `dentistry_js.js` and `index.html`.
- All model behavior, selection, and UI binding is implemented in one script.
- The 3D model is loaded from `./three/examples/models/gltf/denture.glb`.
- Selection depends on hardcoded tooth mesh names and a global `selectedTooth` state.
- Isolate and compare modes both alter scene visibility and are currently fragile.
- A safe UI redesign should preserve IDs and avoid changing core model names or event bindings.

> This report is designed so a new developer can understand the current model and control flow before building a new UI.
