// Dental model adapter
// ---------------------------------------------------------------------------
// Centralises everything that differs between the dental GLB models so the
// rest of the app can keep using the legacy object names / assumptions:
//
//   legacy : three/examples/models/gltf/denture.glb  (tooth_N = one Mesh)
//   v3     : denture_v3_web.glb (optimised derivative of denture_v3.glb)
//            tooth_N = Group { enamel, dentin, pulp }
//
// Default: v3. Override with ?model=v3 | v3-source (unoptimised original) |
// legacy (rollback). Unknown values fall back to the default.
// ---------------------------------------------------------------------------

import * as THREE from './three/build/three.module.js';

const TOOTH_NAME_RE = /^tooth_(\d+)$/;

// Teeth used to measure/fit the arch (third molars excluded: their eruption
// state differs between models and would skew the fit).
const FIT_TEETH = [ 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
	18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31 ];

const LEGACY = {
	id: 'legacy',
	url: './three/examples/models/gltf/denture.glb',
	// Root transform exactly as the app always applied it.
	transform: { scale: 350, position: [ 0, - 50, 0 ], rotationX: 0 },
	fit: null,
	aliases: {},
	placeholders: [],
	repivotTeeth: false,
	highlightSkipTissues: [],
	pickSkipTissues: [],
	jaw: {
		openAngle: 0.3, // radians
		// Jaw-view / occlusal-view offsets relative to each jaw group's base
		// position, in the jaw's parent space. These reproduce the legacy
		// literals exactly: upper.y = 0 and lower.z = 20 (base 42.448101 / -40.914299).
		viewUpperOffset: [ 0, - 42.4481010, 0 ],
		viewLowerOffset: [ 0, 0, 60.914299 ],
	},
	features: { devLobes: true },
	renderer: null,          // keep the renderer defaults the app always used
	highlightTint: null,     // emissive glow alone reads well on legacy's grey teeth
};

const V3 = {
	id: 'v3',
	url: './denture_v3_web.glb',
	transform: null, // computed by `fit`
	// The v3 occlusal plane is pitched ~19° chin-up (its curve of Spee ships
	// rotated -19.4° about X to match). Rotating the root +19.4° restores the
	// legacy flat presentation; then scale/position are solved so the arch
	// (teeth 2-15, 18-31) has the same world width and centre as the legacy
	// arch at its legacy transform (measured: width 204.33, centre below).
	fit: {
		rotationX: 19.4 * Math.PI / 180,
		teeth: FIT_TEETH,
		targetWidth: 204.33,
		targetCenter: [ 7.9, - 17.39, 48.3 ],
	},
	// v3 name -> legacy name expected by the app.
	aliases: {
		Mandible: 'mandibleLow',
		Maxilla: 'RLMaxilla1',
		Upper_gum: 'UMesh_PM3D_Sphere3D2_26',
		Lower_gum: 'UMesh_LowerGums_Hide_Teeth6',
	},
	// Legacy objects the v3 asset does not contain. Empty, invisible groups so
	// existing getObjectByName(...).visible lookups never crash.
	placeholders: [ 'Arteries', 'Veins' ],
	repivotTeeth: true,
	highlightSkipTissues: [ 'pulp' ],
	pickSkipTissues: [ 'pulp' ], // pulp sits inside dentin; never the first hit
	jaw: {
		// Calibrated against legacy in the browser (after the fit above):
		// - openAngle gives the same lower-incisor travel as legacy's 0.3 rad
		//   (85 world units; the v3 incisors sit further from the hinge).
		// - view offsets (jaw-parent space) put the splayed upper/lower arch
		//   centres exactly where legacy's land in jaw/occlusal view.
		openAngle: 0.2693,
		viewUpperOffset: [ - 0.0191, - 0.6455, 0.1587 ],
		viewLowerOffset: [ 0, 0.1937, 0.8518 ],
	},
	features: { devLobes: false }, // legacy lobe texture fits only legacy UVs
	// v3 PBR textures are near-white and saturate under the app's light rig;
	// filmic tone mapping restores detail without touching any material value.
	// Exposure 0.8 picked by side-by-side comparison of 1.0 / 0.8 / 0.65.
	renderer: { toneMapping: 'ACESFilmic', exposure: 0.8 },
	// Near-white enamel cannot show an additive emissive glow, so the selected
	// tooth's base colour is also tinted teal (restored on deselect).
	highlightTint: 0x37c4d4,
};

export const MODEL_CONFIGS = {
	legacy: LEGACY,
	v3: V3,
	'v3-source': Object.assign( {}, V3, { id: 'v3-source', url: './denture_v3.glb' } ),
};

// Rollback: set to 'legacy' (or use ?model=legacy).
export const DEFAULT_MODEL_ID = 'v3';

export function getActiveModelConfig( search ) {
	let id = DEFAULT_MODEL_ID;
	try {
		const q = new URLSearchParams( search !== undefined ? search : window.location.search );
		const requested = q.get( 'model' );
		if ( requested && MODEL_CONFIGS[ requested ] ) id = requested;
	} catch ( e ) { /* non-browser: default */ }
	return MODEL_CONFIGS[ id ];
}

// ---------------------------------------------------------------------------
// Tooth helpers (work for both single-mesh and grouped teeth)
// ---------------------------------------------------------------------------

export function getToothNumber( obj ) {
	const root = getToothRoot( obj );
	return root ? parseInt( TOOTH_NAME_RE.exec( root.name )[ 1 ] ) : null;
}

// Walk up from any object (e.g. an enamel sub-mesh) to its owning tooth_N.
export function getToothRoot( obj ) {
	let node = obj;
	while ( node ) {
		const m = node.name && TOOTH_NAME_RE.exec( node.name );
		if ( m ) {
			const n = parseInt( m[ 1 ] );
			if ( n >= 1 && n <= 32 ) return node;
		}
		node = node.parent;
	}
	return null;
}

export function getToothMeshes( tooth ) {
	const out = [];
	if ( tooth ) tooth.traverse( function ( o ) { if ( o.isMesh ) out.push( o ); } );
	return out;
}

// Materials that should change when the tooth is highlighted. For v3 the pulp
// is excluded (config.highlightSkipTissues).
export function getToothMaterials( tooth, options ) {
	const skip = ( options && options.forHighlight && activeConfig ) ? activeConfig.highlightSkipTissues : [];
	const out = [];
	getToothMeshes( tooth ).forEach( function ( m ) {
		if ( skip.indexOf( m.userData.dentalTissue ) !== - 1 ) return;
		( Array.isArray( m.material ) ? m.material : [ m.material ] ).forEach( function ( mat ) {
			if ( mat && out.indexOf( mat ) === - 1 ) out.push( mat );
		} );
	} );
	return out;
}

export function isPartOfTooth( obj, tooth ) {
	let node = obj;
	while ( node ) {
		if ( node === tooth ) return true;
		node = node.parent;
	}
	return false;
}

export function getPrimaryToothMesh( tooth ) {
	const meshes = getToothMeshes( tooth );
	return meshes.find( function ( m ) { return m.userData.dentalTissue === 'enamel'; } ) || meshes[ 0 ] || null;
}

export function getToothCenter( tooth, target ) {
	target = target || new THREE.Vector3();
	if ( ! tooth ) return target.set( 0, 0, 0 );
	tooth.updateWorldMatrix( true, true );
	const box = new THREE.Box3().setFromObject( tooth );
	return box.isEmpty() ? tooth.getWorldPosition( target ) : box.getCenter( target );
}

// True only if the object and all its ancestors are visible.
export function isVisibleInScene( obj ) {
	let node = obj;
	while ( node ) {
		if ( ! node.visible ) return false;
		node = node.parent;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Jaw helpers: every jaw pose is base transform + configured offset, so
// repeated toggling never accumulates drift.
// ---------------------------------------------------------------------------

export function restoreJawBasePosition( jaw ) {
	if ( jaw && jaw.userData.basePosition ) jaw.position.copy( jaw.userData.basePosition );
}

export function restoreJawBaseRotation( jaw ) {
	if ( jaw && jaw.userData.baseRotation ) jaw.rotation.copy( jaw.userData.baseRotation );
}

export function applyJawViewOffsets( upperJaw, lowerJaw ) {
	const jaw = activeConfig ? activeConfig.jaw : LEGACY.jaw;
	if ( upperJaw && upperJaw.userData.basePosition ) {
		upperJaw.position.copy( upperJaw.userData.basePosition ).add( new THREE.Vector3().fromArray( jaw.viewUpperOffset ) );
	}
	if ( lowerJaw && lowerJaw.userData.basePosition ) {
		lowerJaw.position.copy( lowerJaw.userData.basePosition ).add( new THREE.Vector3().fromArray( jaw.viewLowerOffset ) );
	}
}

export function getJawOpenAngle() {
	return activeConfig ? activeConfig.jaw.openAngle : LEGACY.jaw.openAngle;
}

export function getHighlightTint() {
	return activeConfig ? activeConfig.highlightTint : null;
}

// Applies per-model renderer settings (main view and compare viewers).
export function applyRendererSettings( renderer, config ) {
	const r = config && config.renderer;
	if ( ! renderer || ! r ) return;
	if ( r.toneMapping === 'ACESFilmic' ) renderer.toneMapping = THREE.ACESFilmicToneMapping;
	if ( typeof r.exposure === 'number' ) renderer.toneMappingExposure = r.exposure;
}

export function isFeatureEnabled( name ) {
	return ! activeConfig || activeConfig.features[ name ] !== false;
}

// ---------------------------------------------------------------------------
// Normalisation (run once, right after the GLB loads)
// ---------------------------------------------------------------------------

let activeConfig = null;

export function getLoadedModelConfig() { return activeConfig; }

function tissueOf( name ) {
	if ( /enamel/i.test( name ) ) return 'enamel';
	if ( /dentin/i.test( name ) ) return 'dentin';
	if ( /pulp/i.test( name ) ) return 'pulp';
	return null;
}

function rememberBaseLook( mat ) {
	if ( ! mat || mat.userData.dentalBase ) return;
	mat.userData.dentalBase = {
		color: mat.color ? mat.color.getHex() : null,
		emissive: mat.emissive ? mat.emissive.getHex() : 0,
		emissiveIntensity: typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1,
		transparent: mat.transparent,
		opacity: mat.opacity,
	};
}

// Move a tooth group's origin to its geometric centre without changing how it
// looks in world space (children are shifted by the opposite amount). Needed so
// isolate's x3 scale and getWorldPosition() operate around the tooth itself.
function repivotTooth( tooth ) {
	if ( tooth.isMesh || ! tooth.parent ) return;
	tooth.updateWorldMatrix( true, true );
	const box = new THREE.Box3().setFromObject( tooth );
	if ( box.isEmpty() ) return;
	const centerWorld = box.getCenter( new THREE.Vector3() );
	const centerInTooth = tooth.worldToLocal( centerWorld.clone() );
	const centerInParent = tooth.parent.worldToLocal( centerWorld.clone() );
	tooth.children.forEach( function ( c ) { c.position.sub( centerInTooth ); } );
	tooth.position.copy( centerInParent );
	tooth.updateMatrixWorld( true );
}

function fitRoot( root, fit ) {
	root.position.set( 0, 0, 0 );
	root.rotation.set( fit.rotationX || 0, 0, 0 );
	root.scale.setScalar( 1 );

	const measure = function () {
		root.updateMatrixWorld( true );
		const box = new THREE.Box3();
		fit.teeth.forEach( function ( n ) {
			const t = root.getObjectByName( 'tooth_' + n );
			if ( t ) box.expandByObject( t );
		} );
		return box;
	};

	const box1 = measure();
	if ( box1.isEmpty() ) return;
	const width = box1.max.x - box1.min.x; // rotation is about X, so width is exact
	root.scale.setScalar( fit.targetWidth / width );
	const center = measure().getCenter( new THREE.Vector3() );
	root.position.fromArray( fit.targetCenter ).sub( center );
	root.updateMatrixWorld( true );
}

/**
 * Adapts a freshly loaded gltf.scene in place so the app's legacy assumptions
 * hold, and applies the root transform. Safe to call for both models.
 */
export function normalizeModel( root, config ) {
	activeConfig = config;
	root.userData.dentalModelId = config.id;

	// 1. Legacy name aliases (original kept in userData.originalName).
	Object.keys( config.aliases ).forEach( function ( from ) {
		const obj = root.getObjectByName( from );
		if ( obj ) {
			obj.userData.originalName = from;
			obj.name = config.aliases[ from ];
		} else {
			console.warn( '[dental-model] alias source missing:', from );
		}
	} );

	// 2. Empty placeholders for objects this asset lacks.
	config.placeholders.forEach( function ( name ) {
		if ( root.getObjectByName( name ) ) return;
		const g = new THREE.Group();
		g.name = name;
		g.visible = false;
		g.userData.dentalPlaceholder = true;
		root.add( g );
	} );

	// 3. Teeth: tag tissues, give each tooth its own materials, re-pivot.
	const materialOwners = new Map(); // material -> Set(tooth numbers)
	const teeth = [];
	for ( let n = 1; n <= 32; n ++ ) {
		const tooth = root.getObjectByName( 'tooth_' + n );
		if ( ! tooth ) { console.warn( '[dental-model] missing tooth_' + n ); continue; }
		teeth.push( tooth );
		getToothMeshes( tooth ).forEach( function ( m ) {
			m.userData.dentalTooth = n;
			m.userData.dentalTissue = m === tooth ? 'tooth' : tissueOf( m.name );
			if ( config.pickSkipTissues.indexOf( m.userData.dentalTissue ) !== - 1 ) {
				// Pulp is enclosed by dentin so it is never the first hit; skipping
				// it avoids ray-testing the densest meshes on every click.
				m.userData.dentalNoPick = true;
				m.raycast = function () {};
			}
			( Array.isArray( m.material ) ? m.material : [ m.material ] ).forEach( function ( mat ) {
				if ( ! mat ) return;
				if ( ! materialOwners.has( mat ) ) materialOwners.set( mat, new Set() );
				materialOwners.get( mat ).add( n );
			} );
		} );
	}
	// Materials shared between teeth (v3: dentinSG, pulpSG) are cloned per
	// tooth so highlighting one tooth never lights the others. Clones share the
	// same texture objects; all other material settings are preserved.
	teeth.forEach( function ( tooth ) {
		const perTooth = new Map();
		getToothMeshes( tooth ).forEach( function ( m ) {
			const swap = function ( mat ) {
				if ( ! mat || materialOwners.get( mat ).size < 2 ) return mat;
				if ( ! perTooth.has( mat ) ) perTooth.set( mat, mat.clone() );
				return perTooth.get( mat );
			};
			m.material = Array.isArray( m.material ) ? m.material.map( swap ) : swap( m.material );
			( Array.isArray( m.material ) ? m.material : [ m.material ] ).forEach( rememberBaseLook );
		} );
	} );

	// 4. Root transform.
	if ( config.fit ) fitRoot( root, config.fit );
	else {
		root.scale.setScalar( config.transform.scale );
		root.position.fromArray( config.transform.position );
		root.rotation.set( config.transform.rotationX || 0, 0, 0 );
	}

	if ( config.repivotTeeth ) teeth.forEach( repivotTooth );

	// 5. Base jaw transforms, captured once; all jaw poses derive from these.
	[ 'upperJawGrp', 'lowerJawGrp' ].forEach( function ( name ) {
		const jaw = root.getObjectByName( name );
		if ( jaw ) {
			jaw.userData.basePosition = jaw.position.clone();
			jaw.userData.baseRotation = jaw.rotation.clone();
		}
	} );

	root.updateMatrixWorld( true );
	return root;
}

/**
 * Builds a standalone, origin-centred copy of a complete tooth for the compare
 * viewers: every sub-mesh (enamel/dentin/pulp for v3, the single mesh for
 * legacy) with its world transform baked in. Geometries and materials are
 * clones owned by the result (textures are shared and must NOT be disposed).
 * Throws if the tooth has no geometry.
 */
export function buildToothDisplayClone( sourceTooth ) {
	const meshes = getToothMeshes( sourceTooth ).filter( function ( m ) { return m.geometry; } );
	if ( ! meshes.length ) throw new Error( 'Tooth has no geometry to display' );

	const group = new THREE.Group();
	group.name = ( sourceTooth.name || 'tooth' ) + '_compare';
	const box = new THREE.Box3();
	meshes.forEach( function ( src ) {
		src.updateWorldMatrix( true, false );
		const geo = src.geometry.clone();
		geo.applyMatrix4( src.matrixWorld ); // bake orientation + scale + position
		geo.computeBoundingBox();
		box.union( geo.boundingBox );
		const cloneMat = function ( m ) {
			const c = m.clone();
			const base = m.userData.dentalBase;
			// Drop any selection highlight carried over from the main scene.
			if ( c.emissive ) c.emissive.setHex( base ? base.emissive : 0 );
			if ( base ) {
				if ( c.color && base.color !== null ) c.color.setHex( base.color );
				c.emissiveIntensity = base.emissiveIntensity;
				c.transparent = base.transparent;
				c.opacity = base.opacity;
			}
			c.needsUpdate = true;
			return c;
		};
		const mat = Array.isArray( src.material ) ? src.material.map( cloneMat )
			: ( src.material ? cloneMat( src.material )
				: new THREE.MeshStandardMaterial( { color: 0xe8e3da, roughness: 0.7, metalness: 0.0 } ) );
		const mesh = new THREE.Mesh( geo, mat );
		mesh.name = src.name;
		group.add( mesh );
	} );
	const center = box.getCenter( new THREE.Vector3() );
	group.children.forEach( function ( m ) {
		m.geometry.translate( - center.x, - center.y, - center.z );
		m.geometry.computeBoundingSphere();
	} );
	return group;
}

// Disposes geometries + materials of a clone made by buildToothDisplayClone
// (or any object whose resources it exclusively owns). Textures are shared
// with the main model and intentionally left alone.
export function disposeOwnedObject( obj ) {
	if ( ! obj ) return;
	obj.traverse( function ( o ) {
		if ( o.geometry ) o.geometry.dispose();
		if ( o.material ) ( Array.isArray( o.material ) ? o.material : [ o.material ] )
			.forEach( function ( m ) { if ( m && m.dispose ) m.dispose(); } );
	} );
}
