# Dental 3D Viewer – New Model Integration

The Dentistry 3D viewer (dental anatomy teaching app) updated to use the new
`denture_v3` dental model while preserving the existing app's UI and
functionality. A small model-adapter layer maps the new model onto the
structure the app was built for, and the previous model remains available as a
rollback option.

Built as a static site on Three.js r141 (bundled in `three/`), served locally
with a tiny Node.js server.

## Features

- 32 individually selectable teeth (mouse, touch, odontogram, search, keyboard number entry)
- Odontogram synchronization in both directions (3D model ↔ odontogram), Universal / Palmer / FDI numbering
- Tooth highlighting (enamel + dentin; never bleeds onto other teeth)
- Isolate / un-isolate a tooth
- Upper / lower jaw visibility controls
- Jaw open / close
- Occlusal view
- Compare mode: two independent 3D canvases, one complete tooth each
- Gums, bones, nerves and teeth visibility toggles
- Curve of Spee, curve of Wilson, sphere of Monson
- Reset view, x-ray panel, help overlay
- Desktop, tablet and mobile layouts

## Models

### Default — `denture_v3_web.glb`
- Optimized production model, ~24.2 MB (stored as a normal Git file so it
  works on any static host).
- Loaded by default.
- Built from the source model by `tools/build_denture_v3_web.mjs`
  (reproducible): 1024 px WebP textures, simplified pulp meshes, all 32 teeth
  and their enamel/dentin/pulp parts, names and hierarchy preserved.

### Source — `denture_v3.glb`
- Original, unmodified source asset, ~138.7 MB (Git LFS).
- Available through `?model=v3-source` for verification.

### Legacy — `three/examples/models/gltf/denture.glb`
- The previous model, ~47.6 MB (Git LFS), retained as a rollback.
- Available through `?model=legacy`.

## Model URLs

| URL | Loads |
|---|---|
| `index.html` | optimized v3 (`denture_v3_web.glb`) |
| `index.html?model=v3` | optimized v3 (`denture_v3_web.glb`) |
| `index.html?model=v3-source` | original source (`denture_v3.glb`) |
| `index.html?model=legacy` | old model (`three/examples/models/gltf/denture.glb`) |

Unknown values fall back to the default. To roll back permanently, set
`DEFAULT_MODEL_ID = 'legacy'` in `dental_model_adapter.js`.

## Running locally

Requirements: Node.js 12+ (18+ for the browser tests), and
[Git LFS](https://git-lfs.com) if you need the source or legacy models.

```bash
git lfs install                 # once per machine
git clone https://github.com/bobbydhir2003/Dental_New_Model.git
cd Dental_New_Model
node serve.js                   # or: npm start
```

Open http://localhost:8000 (set `PORT=xxxx` to change the port).

Without Git LFS the clone still runs with the default model; only
`?model=v3-source` and `?model=legacy` need the LFS files (`git lfs pull`).

## How the integration works

`dental_model_adapter.js` holds everything model-specific, so the app code
(`dentistry_js.js`) keeps its original logic:

- **Config per model**: file path, root scale/position, tilt correction
  (+19.4° for v3's chin-up occlusal plane), calibrated jaw-open angle and
  occlusal-view offsets, feature flags, renderer settings, highlight tint.
- **Name aliases**: `Mandible`→`mandibleLow`, `Maxilla`→`RLMaxilla1`,
  `Upper_gum`/`Lower_gum`→legacy gum names; empty `Arteries`/`Veins`
  placeholders for objects v3 does not contain.
- **Grouped teeth**: in v3 each `tooth_N` is a group of enamel, dentin and
  pulp meshes. The adapter gives every tooth its own materials, moves each
  tooth's pivot to its centre (for isolate/camera focus), excludes pulp from
  picking, and provides helpers (`getToothRoot`, `getToothMaterials`,
  `isPartOfTooth`, `getToothCenter`, …) used by selection, highlight,
  isolate and compare.
- **Jaws**: every jaw pose is the captured base transform plus a per-model
  offset, so repeated open/close and occlusal toggles never drift.

See `DENTAL_3D_CODE_MAP.md` for a detailed map of the application code.

## Known v3 content limitations

These come from the asset itself, not the code:

- No arteries/veins (the Nerves toggle shows nerves only).
- Maxilla only — no full cranium as in the legacy model.
- Lower enamel (teeth 18–31) and the maxilla have no UV coordinates, so they
  render a flat colour instead of a texture.
- Tooth 14's pulp mesh uses a blue "filling" material; preserved as supplied.
- Developmental lobes are disabled for v3 (that texture only fits legacy UVs).
- Lower third molars (17, 32) sit below the occlusal plane as authored.

## Rebuilding the optimized model

```bash
npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
node tools/build_denture_v3_web.mjs
```

The source model is only read. Mesh quantization is deliberately not used
(Three.js r141 cannot raycast quantized geometry).

## Tests

```bash
node __model_adapter_test.mjs                  # adapter unit tests (legacy + v3 structures)
node __compare_test.mjs                        # compare-view logic

# Browser tests (Node 18+, Google Chrome; they start/stop serve.js themselves)
npm i --no-save playwright
node __e2e_model_test.mjs default              # also: v3 | legacy | v3-source
node __e2e_responsive_test.mjs default,legacy,v3-source   # 1440 / 1024 / 430 px, touch
```

## Project structure

| Path | Purpose |
|---|---|
| `index.html` | App shell (entry point) |
| `dentistry_js.js` | Main application logic (scene, selection, controls) |
| `dental_model_adapter.js` | Model selection and compatibility layer |
| `main.css`, `mobile.css`, `mobile.js` | Styling and responsive layout |
| `serve.js` | Local static server |
| `tools/build_denture_v3_web.mjs` | Builds `denture_v3_web.glb` |
| `three/` | Bundled Three.js r141, textures, legacy model |
| `dentistry.html` | Older standalone page (not the entry point; loads the legacy model directly) |
| `__*_test.mjs`, `__e2e_server.mjs`, `__mtest.mjs` | Tests |
