
			import * as THREE from 'three';


			import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';
			import { RGBELoader } from './three/examples/jsm/loaders/RGBELoader.js';
			import { GUI } from './three/examples/jsm/libs/lil-gui.module.min.js';
			import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { LoadingManager } from 'three';
import {
	getActiveModelConfig, normalizeModel, getToothNumber, getToothMaterials,
	isPartOfTooth, getToothCenter, isVisibleInScene, restoreJawBasePosition, restoreJawBaseRotation,
	applyJawViewOffsets, getJawOpenAngle, isFeatureEnabled, buildToothDisplayClone, disposeOwnedObject,
	getHighlightTint, applyRendererSettings, applySceneLighting
} from './dental_model_adapter.js';

// Model selected via ?model=legacy|v3|v3-source (see dental_model_adapter.js).
const ACTIVE_MODEL = getActiveModelConfig();

// Safe UI-only config for the original Three.js odontogram.
// Change only these values to move/resize the real odontogram.
// Do not change toothReg, raycaster, or highlightOdontogram logic.
const ODONTOGRAM_UI = {
	x: 0,       // center the odontogram in the camera view
	y: -40,     // move the odontogram lower in the canvas
	z: -100,    // keep this usually unchanged
	scale: 1.2, // larger for a full-width odontogram display
};

// The floating in-canvas sprite odontogram (the one that was cut off at the
// bottom) is replaced by a real, clickable HTML card. Setting this to false
// hides that sprite and disables its click hit-test, so the HTML card is the
// single source of odontogram interaction.
const SPRITE_ODONTOGRAM_ENABLED = false;

// Odontogram artwork pixel size and per-tooth click regions [x1, x2, y1, y2].
// These are the SAME regions the original sprite hit-test used, reused here to
// position the HTML hotspots/highlights pixel-accurately over the card image.
const ODONTOGRAM_IMG_W = 3472;
const ODONTOGRAM_IMG_H = 1657;
const ODONTOGRAM_REGIONS = [
	[0, 0, 0, 0],
	[118, 330, 319, 790],
	[330, 555, 320, 793],
	[555, 813, 292, 814],
	[813, 982, 292, 811],
	[982, 1160, 277, 793],
	[1160, 1336, 196, 800],
	[1336, 1486, 290, 810],
	[1486, 1705, 292, 838],
	[1785, 2009, 286, 835],
	[2009, 2157, 281, 808],
	[2157, 2330, 207, 800],
	[2330, 2519, 281, 783],
	[2519, 2675, 290, 808],
	[2675, 2930, 306, 816],
	[2930, 3161, 306, 816],
	[3163, 3381, 319, 789],
	[3171, 3376, 914, 1372],
	[2938, 3169, 890, 1400],
	[2675, 2938, 890, 1408],
	[2519, 2675, 890, 1392],
	[2330, 2519, 890, 1408],
	[2157, 2330, 874, 1450],
	[1992, 2157, 898, 1400],
	[1795, 1992, 882, 1384],
	[1499, 1696, 882, 1392],
	[1334, 1499, 898, 1384],
	[1153, 1334, 890, 1466],
	[980, 1153, 890, 1376],
	[816, 980, 890, 1390],
	[561, 816, 890, 1384],
	[314, 561, 898, 1392],
	[119, 323, 914, 1377],
];

// Maps a numbering-system radio id to its odontogram artwork.
// Uses the original white-teeth art; CSS filter on .odo-base desaturates red
// numbers to white so the whole chart reads cleanly on the dark panel.
const ODONTOGRAM_IMAGES = {
	universal: './three/examples/textures/odontogram_universal.png',
	palmer: './three/examples/textures/odontogram_palmer.png',
	fdi: './three/examples/textures/odontogram_fdi.png',
	hideNum: './three/examples/textures/odontogram.png',
};

// Tracks which tooth is currently shown as highlighted on the HTML card.
let cardSelectedTooth = null;



			const link = document.createElement( 'a' );
			link.style.display = 'none';
			document.body.appendChild( link ); // Firefox workaround, see #6594



			let container = document.getElementById( 'threejs-canvas' );
			let sceneArea = container ? container.closest('.scene-area') : null;

			let hud = document.getElementById("hud")


			//////////// NUMBER SYSTEM SELECTION ///////////////////////
			// 0 - Univeral, 1 - Palmer, 2 - FDI
			var numSystem = 0

			var numVisible = true;

			

			var universalCheckbox = document.getElementById("universal")
			var palmerCheckbox = document.getElementById("palmer")
			var fdiCheckbox = document.getElementById("fdi")
			var showNumCheckbox = document.getElementById("showNum")
			var hideNumCheckbox = document.getElementById("hideNum")

			var bonesCheckbox = document.getElementById('bonesCheckbox');

			// New real visibility toggles (replace the former ui-only buttons).
			const upperJawCheckbox = document.getElementById('upperJawCheckbox');
			const lowerJawCheckbox = document.getElementById('lowerJawCheckbox');
			const teethCheckbox = document.getElementById('teethCheckbox');

			universalCheckbox.oninput = function(){

				if (this.checked){

					numSystem = 0;

					if(numVisible == true) {
					const map0 = new THREE.TextureLoader().load( './three/examples/textures/odontogram_universal.png', function(tex) {
						const material0 = new THREE.SpriteMaterial( { map: map0 } );
						setBaseOdontogramMaterial(map0);
					});
					}

					updateNumSystem();
			}

			}

			palmerCheckbox.oninput = function(){

				if (this.checked){

					numSystem = 1;

					if(numVisible == true) {
					const map0 = new THREE.TextureLoader().load( './three/examples/textures/odontogram_palmer.png', function(tex) {
						const material0 = new THREE.SpriteMaterial( { map: map0 } );
						setBaseOdontogramMaterial(map0);
					});
				}

				updateNumSystem();

				}

			}

			fdiCheckbox.oninput = function(){

				if (this.checked){

					numSystem = 2;

					if(numVisible == true) {
					

					const map0 = new THREE.TextureLoader().load( './three/examples/textures/odontogram_fdi.png', function(tex) {
						const material0 = new THREE.SpriteMaterial( { map: map0 } );
						setBaseOdontogramMaterial(map0);
					});
				}

				updateNumSystem();
			}

			}

			showNumCheckbox.oninput = function(){

				if (this.checked){

						if(numSystem == 0){
							const map0 = new THREE.TextureLoader().load( './three/examples/textures/odontogram_universal.png', function(tex) {
								const material0 = new THREE.SpriteMaterial( { map: map0 } );
								setBaseOdontogramMaterial(map0);
							});
						}
						else if(numSystem == 1){
							const map0 = new THREE.TextureLoader().load( './three/examples/textures/odontogram_palmer.png', function(tex) {
								const material0 = new THREE.SpriteMaterial( { map: map0 } );
								setBaseOdontogramMaterial(map0);
							});
						}
						else if(numSystem == 2){
							const map0 = new THREE.TextureLoader().load( './three/examples/textures/odontogram_fdi.png', function(tex) {
								const material0 = new THREE.SpriteMaterial( { map: map0 } );
								setBaseOdontogramMaterial(map0);
							});
						}

					numVisible = true;
				}

			}

			hideNumCheckbox.oninput = function(){

				if (this.checked){


					const map0 = new THREE.TextureLoader().load( './three/examples/textures/odontogram.png', function(tex) {
						const material0 = new THREE.SpriteMaterial( { map: map0 } );
						setBaseOdontogramMaterial(map0);
					});

					numVisible = false;
				}
				

			}

			function updateNumSystem(){
				if(selectedTooth != null){
					var toothNumber = parseInt(selectedTooth.name.substring(6));
					document.getElementById("info").innerHTML =  teethNumSystem[toothNumber][3] + " (" + teethNumSystem[toothNumber][numSystem] + ")";

				}
			}

			//container.width = container.clientWidth;
			//container.height = container.clientHeight;


			var CANVAS_WIDTH = container.clientWidth || 960;
			var CANVAS_HEIGHT = container.clientHeight || Math.round(window.innerHeight * 0.68);

			let camera, object, object2, material, geometry, scene1, scene2, renderer, controls;
			let gridHelper, sphere, waltHead;
			let resizeObserver = null;
			// Saved default view + handle for the smooth Reset animation.
			let defaultCameraPosition = null;
			let defaultControlsTarget = null;
			let defaultCameraZoom = 1;
			let resetAnimationId = null;
			// True only while a programmatic camera tween (reset / focus) is animating.
			// Used to release manual OrbitControls the instant the tween ends.
			let isCameraTweening = false;

			let carm;
			let spriteC;
			let mapC;
			let group = new THREE.Group();
			let baseOdontogramSprite = null;
			let toothHighlightSprites = [];
			let group_Mesh = new THREE.Group();
			let selectedTooth;
			// Name ("tooth_N") of the currently selected/highlighted tooth, or null.
			// This is the single source of truth for the persistent selection so the
			// highlight never depends on reading material state (which can desync).
			let selectedToothName = null;
			let isolatedTooth;

			//store the state of Compare Mode here:
			let compareToggle;

			let compareButton;
			
			let intersects_Mesh;

			var jawView = false;
			var isJawOpen = false;

			/**
			 * Stores jaw rotation value before jaw-view is turned on.
			 * So that when it is turned off, the jaw can return to original value.
			 */
			var lastJawRotation = new THREE.Vector3();

			let isolateBtn = document.getElementById("isolateButton");
			let jawOpenCheckbox = document.getElementById('jawOpenCheckbox');
			
			// Help and Reset buttons
			let btnHelp = document.getElementById('btnHelp');
			let btnReset = document.getElementById('btnReset');
			let helpModalOverlay = document.getElementById('helpModalOverlay');
			let helpModalClose = document.getElementById('helpModalClose');

			let loadingDiv = document.getElementById('loadingDiv');

			let xrayImg = document.getElementById("xrayImage");

			let compareToothOne = new THREE.Object3D;
			
			let compareToothTwo = new THREE.Object3D;

			let upperJaw, lowerJaw;

			// ---- Compare mode (two fully independent viewers) ----
			let envMap = null;             // shared PMREM environment from the main scene
			let compareActive = false;     // true only while the dual-canvas split is shown
			let compareViewers = [];       // persistent viewer controllers (created once, reused)
			let compareSavedBanner = null; // original banner text, restored on exit

			function setBaseOdontogramMaterial(map) {
				if (baseOdontogramSprite) {
					baseOdontogramSprite.material = new THREE.SpriteMaterial({
						map: map,
						transparent: true,
						opacity: 1,
						depthTest: false,
						depthWrite: false
					});
					baseOdontogramSprite.renderOrder = 1;
					baseOdontogramSprite.visible = true;
				}
			}

			const params = {
				hideShow: true,
				turntable: false,
				isolate: isolate,
				unIsolate: unIsolate,
				openJaw: openJaw,
				devLobes: devLobes,
				compare: compare,
				jawView: false,
				nerves: false,
				arteries: false,
				veins: false,
				curveOfSpee: false,
				curveOfWilson: false,
				sphereOfMonson: false
				
			};

				///////////////////////////////////////////////////////////////////////////////////////////
				/////////////////////        TEETH NAMES          /////////////////////////////////////////
				///////////////////////////////////////////////////////////////////////////////////////////


				const teethNames = [
								"This is the non-existent tooth number zero",

								"Maxillary Right Second Molar",	
								"Maxillary Right First Molar",
								"Maxillary Right Second Premolar",
								"Maxillary Right First Premolar",
								"Maxillary Right Canine",
								"Maxillary Right Lateral Incisor",
								"Maxillary Right Central Incisor",

								"Maxillary Left Central Incisor",
								"Maxillary Left Lateral Incisor",
								"Maxillary Left Canine",
								"Maxillary Left First Premolar",
								"Maxillary Left Second Premolar",
								"Maxillary Left First Molar",
								"Maxillary Left Second Molar",

								"Mandibular Right Second Molar",
								"Mandibular Right First Molar",
								"Mandibular Right Second Premolar",
								"Mandibular Right First Premolar",
								"Mandibular Right Lateral Incisor",
								"Mandibular Right Canine",
								"Mandibular Right Central Incisor",
							
								"Mandibular Left Central Incisor",
								"Mandibular Left Canine",
								"Mandibular Left Lateral Incisor",
								"Mandibular Left First Premolar",
								"Mandibular Left Second Premolar",
								"Mandibular Left First Molar",
								"Mandibular Left Second Molar",

								];
				
								console.log("┏┐")
					//└ ┘ ┐┏

				// [0] Univeral, [1] Palmer, [2] FDI, [3] Name
				const teethNumSystem = [

					[0, "0", 0, "null"],

					[1, "8┘", 18, "Maxillary Right Third Molar"],
					[2, "7┘", 17, "Maxillary Right Second Molar"],
					[3, "6┘", 16, "Maxillary Right First Molar"],
					[4, "5┘", 15, "Maxillary Right Second Premolar"],
					[5, "4┘", 14, "Maxillary Right First Premolar"],
					[6, "3┘", 13, "Maxillary Right Canine"],
					[7, "2┘", 12, "Maxillary Right Lateral Incisor"],
					[8, "1┘", 11, "Maxillary Right Central Incisor"],

					[9,  "└1", 21, "Maxillary Left Central Incisor"],
					[10, "└2", 22, "Maxillary Left Lateral Incisor"],
					[11, "└3", 23, "Maxillary Left Canine"],
					[12, "└4", 24, "Maxillary Left First Premolar"],
					[13, "└5", 25, "Maxillary Left Second Premolar"],
					[14, "└6", 26, "Maxillary Left First Molar"],
					[15, "└7", 27, "Maxillary Left Second Molar"],
					[16, "└8", 28, "Maxillary Left Third Molar"],

					[17, "┏8", 38, "Mandibular Left Third Molar"],
					[18, "┏7", 37, "Mandibular Left Second Molar"],
					[19, "┏6", 36, "Mandibular Left First Molar"],
					[20, "┏5", 35, "Mandibular Left Second Premolar"],
					[21, "┏4", 34, "Mandibular Left First Premolar"],
					[22, "┏3", 33, "Mandibular Left Canine"],
					[23, "┏2", 32, "Mandibular Left Lateral Incisor"],
					[24, "┏1", 31, "Mandibular Left Central Incisor"],

					[25, "1┐", 41, "Mandibular Right Central Incisor"],
					[26, "2┐", 42, "Mandibular Right Lateral Incisor"],
					[27, "3┐", 43, "Mandibular Right Canine"],
					[28, "4┐", 44, "Mandibular Right First Premolar"],
					[29, "5┐", 45, "Mandibular Right Second Premolar"],
					[30, "6┐", 46, "Mandibular Right First Molar"],
					[31, "7┐", 47, "Mandibular Right Second Molar"],
					[32, "8┐", 48, "Mandibular Right Third Molar"],




				]





			init();
			animate();

			function init() {
				



				
				//document.body.appendChild( container );

				// Make linear gradient texture
				
				const data = new Uint8ClampedArray( 100 * 100 * 4 );


				const gradientTexture = new THREE.DataTexture( data, 100, 100, THREE.RGBAFormat );
				gradientTexture.minFilter = THREE.LinearFilter;
				gradientTexture.magFilter = THREE.LinearFilter;
				gradientTexture.needsUpdate = true;

				scene1 = new THREE.Scene();
				scene1.name = 'Scene1';


				

				// ---------------------------------------------------------------------
				// Perspective Camera
				// ---------------------------------------------------------------------
				camera = new THREE.PerspectiveCamera( 45, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 2000 );
				camera.position.set( 0,0,800 );
				scene1.add( camera );

				// ---------------------------------------------------------------------
				// Ambient light
				// ---------------------------------------------------------------------
				const ambientLight = new THREE.AmbientLight( 0xffffff, 0.46 );
				ambientLight.name = 'AmbientLight';
				scene1.add( ambientLight );

				const hemiLight = new THREE.HemisphereLight( 0xf5f0e8, 0x17191d, 0.55 );
				hemiLight.name = 'HemisphereLight';
				scene1.add( hemiLight );

				// ---------------------------------------------------------------------
				// DirectLight
				// ---------------------------------------------------------------------
				const dirLight = new THREE.DirectionalLight( 0xfff5e9, 1.35 );
				dirLight.target.position.set( 0, 0, - 1 );
				dirLight.position.set( 240, 420, 360 );
				dirLight.add( dirLight.target );
				dirLight.lookAt( - 1, - 1, 0 );
				dirLight.name = 'DirectionalLight';
				dirLight.castShadow = true;
				dirLight.shadow.mapSize.width = 1024;
				dirLight.shadow.mapSize.height = 1024;
				scene1.add( dirLight );
				applySceneLighting( scene1, ACTIVE_MODEL ); // per-model light balance (v3 only)

				// ---------------------------------------------------------------------
				//LOAD THE GLTF FILE
				//////////////////////////////////////////////////////////////////////
				/*
				const loader = new OBJLoader();
				loader.load( './three/examples/models/obj/walt/carm.obj', function ( obj ) {

					waltHead = obj;
					waltHead.scale.multiplyScalar( 1.5 );
					waltHead.position.set( 400, 0, 0 );
					//scene1.add( waltHead );
					

				} );
				*/

				const loadingManager = new THREE.LoadingManager();

				loadingManager.onLoad = function(){

					loadingDiv.style.display = "none";

				}
				
				const gltfLoader = new GLTFLoader(loadingManager);
				gltfLoader.loadAsync( ACTIVE_MODEL.url ).then(function ( gltf ) {

					carm = gltf.scene;
					// Aliases legacy names, adds placeholders, per-tooth materials,
					// tooth pivots, root scale/position/tilt and base jaw transforms.
					normalizeModel( carm, ACTIVE_MODEL );

					//carm.getObjectByName("mainBody").material.color.set( "rgb(255, 0, 0)" );
					carm.castShadow = true;
					carm.receiveShadow = true;
					scene1.add( carm );


					group_Mesh.children[0] = new THREE.Object3D();

					upperJaw = carm.getObjectByName("upperJawGrp");
					lowerJaw = carm.getObjectByName("lowerJawGrp");

					//add teeth from position 29 to 57 in the group
					for (var i = 1; i <= 32; i++ ){

						
						var toothObject = carm.getObjectByName("tooth_" + i);

						group_Mesh.children[i] = toothObject;
					}

					
					carm.getObjectByName("Skin_Nerves").visible = false;
					carm.getObjectByName("Arteries").visible = false;
					carm.getObjectByName("Veins").visible = false;

					carm.getObjectByName("curveOfSpee").visible = false;
					carm.getObjectByName("curveOfWilson").visible = false;
					carm.getObjectByName("sphereOfMonson").visible = false;


					carm.getObjectByName("curveOfSpee").material.transparent = true;
					carm.getObjectByName("curveOfSpee").material.opacity = 0.8;

					carm.getObjectByName("curveOfWilson").material.transparent = true;
					carm.getObjectByName("curveOfWilson").material.opacity = 0.8;

					carm.getObjectByName("sphereOfMonson").material.transparent = true;
					carm.getObjectByName("sphereOfMonson").material.opacity = 0.5;

				} ).catch( function ( err ) {
					console.error( "[dental-model] failed to load " + ACTIVE_MODEL.url, err );
				} );

				
				
				//---------------------------------------------------------------------
				// KEYBOARD CONTROL
				//---------------------------------------------------------------------

				//push all key presses in an array 
				//and clear it if there is no input for 1.5 seconds

				let keys = [];
				let timeout = null;
				
				document.onkeydown = function(e) {


					if(document.activeElement != searchBox){ //making sure user is not typing in searchbox


					if(e.key >= 0 && e.key <= 32){

						hud.innerHTML += e.key;
					}

					keys.push(e.key);
					clearTimeout(timeout);

					timeout = setTimeout(function() {
						
						let input = parseInt(keys.join(""));


						if(input > 0 && input <= 32){ //check the input is within range

						var toothNum = "tooth_" + input;

						if ( typeof compareToggle !== "undefined" && compareToggle ) {
							// Compare mode: drive the two-tooth picker, then focus.
							registerCompareSelection( input );
							focusCameraOnTooth( input );
						} else if ( typeof isolateTgl !== "undefined" && isolateTgl ) {
							// Isolate mode: switch the isolated tooth.
							switchIsolatedTooth( input );
						} else {
							highlightObject(toothNum);

							// Sync (or clear, on a re-typed deselect) every selection surface.
							applySelectionUI(input);

							// Smoothly focus the camera on the selected tooth.
							if ( selectedToothName ) focusCameraOnTooth( input );
						}

						}


						keys = [];
						hud.innerHTML = "";

					},1000)



					//detect "i" for isolate
					if(e.keyCode == 73){

						if(isolateBtn.style.pointerEvents != "none"){ //check if isolate button has been disabled
							isolateToggle();
						}
					}



					//detect "d" for developmental lobes
					if(e.keyCode == 68){

					devLobes();
					}


				}

					
				}

				

				//---------------------------------------------------------------------
				// HUD SPRITES - ODONTOGRAM
				//---------------------------------------------------------------------

				//group = new THREE.Group();


				camera.add( group );

				// Hide the floating in-canvas odontogram; the HTML card replaces it.
				if ( ! SPRITE_ODONTOGRAM_ENABLED ) {
					group.visible = false;
				}

				var imageWidth;
				var imageHeight;

				
				document.addEventListener( 'mousedown', onPointerMove, false );
				document.addEventListener('touchstart', onPointerMove, false);
				
				
				const map0 = new THREE.TextureLoader().load('./three/examples/textures/odontogram_universal.png', function(tex) {
				imageWidth = tex.image.width / 100;
				imageHeight = tex.image.height / 100;

const material0 = new THREE.SpriteMaterial({
			map: map0,
			transparent: true,
			opacity: 1,
			depthTest: false,
			depthWrite: false
		});
		const sprite = new THREE.Sprite(material0);

		sprite.scale.set(
			imageWidth * ODONTOGRAM_UI.scale,
			imageHeight * ODONTOGRAM_UI.scale,
			1
		);

		sprite.position.set(
			ODONTOGRAM_UI.x,
			ODONTOGRAM_UI.y,
			ODONTOGRAM_UI.z
		);

		sprite.renderOrder = 1;
				//camera.add(sprite);
				baseOdontogramSprite = sprite;
				group.add(sprite);
				});
				
				

				var toothLoadCounter = 0;

		for (let i = 1; i <= 32; i++){
				var path = "./three/examples/textures/tooth_selection/tooth_" + i + ".png";

				
				const map1 = new THREE.TextureLoader().load( path, function(tex) {
				imageWidth = tex.image.width / 100;
				imageHeight = tex.image.height / 100;
const material1 = new THREE.SpriteMaterial({
			map: map1,
			transparent: true,
			opacity: 1,
			depthTest: false,
			depthWrite: false,
			blending: THREE.NormalBlending
		});
		const sprite = new THREE.Sprite(material1);

		sprite.scale.set(
			imageWidth * ODONTOGRAM_UI.scale,
			imageHeight * ODONTOGRAM_UI.scale,
			1
		);

		sprite.position.set(
			ODONTOGRAM_UI.x,
			ODONTOGRAM_UI.y,
			ODONTOGRAM_UI.z
		);

		sprite.renderOrder = 2;
				//camera.add( sprite );
				toothHighlightSprites[i] = sprite;
				group.add(sprite);
				sprite.visible = false;

				toothLoadCounter++;

				if(toothLoadCounter == 32){

					console.log("Odontogram loaded!")
				}

				});


				


				
				//var toothObject = carm.getObjectByName("tooth_" + i);

				//group.add(toothObject);


				



			}



				////MAPPING PIXEL VALUES TO EVERY TOOTH
				
				//detect the click and query if the user clicked
				//on the odontogram
				let selectedObject = null;
				const raycaster = new THREE.Raycaster();
				const pointer = new THREE.Vector2();

				// Walk up from a raycast hit to the owning "tooth_N" node and return N
				// (1–32), or null if the hit isn't part of a tooth (gums/bone/skull).
				function resolveToothNumberFromHit( obj ) {
					return getToothNumber( obj );   // shared with the model adapter
				}

				function onPointerMove( event ) {

					// Ignore clicks that land on the HTML odontogram card / UI overlay
					// (the card handles its own selection) or inside the compare split
					// (each compare canvas drives its own independent OrbitControls).
					if ( event.target && event.target.closest &&
						( event.target.closest('.odontogram-card') || event.target.closest('.compare-view') ) ) {
						return;
					}

					// Touch devices fire BOTH touchstart and a synthetic mousedown for a
					// single tap. Without this guard the tooth would be toggled twice
					// (selected then immediately deselected), making the highlight appear
					// to vanish. Swallow the mousedown that follows a recent touchstart.
					var nowTs = Date.now();
					if ( event.type === 'touchstart' ) {
						onPointerMove._lastTouch = nowTs;
					} else if ( event.type === 'mousedown' &&
						onPointerMove._lastTouch && ( nowTs - onPointerMove._lastTouch ) < 700 ) {
						return;
					}

					if ( selectedObject ) {

						//selectedObject.material.color.set( '#69f' );
						selectedObject = null;

					}

					// Touch events (touchstart) carry coordinates in event.touches /
					// event.changedTouches, NOT event.clientX/Y — read whichever exists so
					// tapping a tooth works on iPad/tablet exactly like a mouse click.
					var clientX = event.clientX;
					var clientY = event.clientY;
					if ( clientX === undefined && event.touches && event.touches[0] ) {
						clientX = event.touches[0].clientX; clientY = event.touches[0].clientY;
					}
					if ( clientX === undefined && event.changedTouches && event.changedTouches[0] ) {
						clientX = event.changedTouches[0].clientX; clientY = event.changedTouches[0].clientY;
					}
					if ( clientX === undefined ) return;   // no usable coordinates

					var rect = renderer.domElement.getBoundingClientRect();
					pointer.x = ( (clientX - rect.left)/ (rect.right - rect.left) ) * 2 - 1 ;
					pointer.y = - ( (clientY - rect.top) / (rect.bottom - rect.top))  * 2 + 1;

					raycaster.setFromCamera( pointer, camera );

					// When the sprite odontogram is disabled, skip its hit-test so the
					// hidden bottom region can't intercept clicks. The HTML card handles it.
					const intersects = SPRITE_ODONTOGRAM_ENABLED ? raycaster.intersectObject( group, true ) : [];



					

					if ( intersects.length > 0 ) {

						const res = intersects.filter( function ( res ) {

							return res && res.object;

						} )[ 0 ];

						if ( res && res.object ) {

							selectedObject = res.object;

							//if the user did click on the odontogram, query the pixel value of the
							//point of click and store it in intersectX and intersectY
							var intersectX = intersects[0].uv.x * imageWidth * 100;
							var intersectY =  (imageHeight - (intersects[0].uv.y * imageHeight)) * 100;


							
							//coverage area of every tooth on the
							//odontogram image in the format [x1,x2,y1,y2]

							var toothReg = [
								[0,0,0,0],
								[118,330,319,790],
								[330,555,320,793],
								[555,813,292,814],
								[813,982,292,811],
								[982,1160,277,793],
								[1160,1336,196,800],
								[1336,1486,290,810],
								[1486,1705,292,838],
								[1785,2009,286,835],
								[2009,2157,281,808],
								[2157,2330,207,800],
								[2330,2519,281,783],
								[2519,2675,290,808],
								[2675,2930,306,816],
								[2930,3161,306,816],
								[3163,3381,319,789],
								[3171,3376,914,1372],
								[2938,3169,890,1400],
								[2675,2938,890,1408],
								[2519,2675,890,1392],
								[2330,2519,890,1408],
								[2157,2330,874,1450],
								[1992,2157,898,1400],
								[1795,1992,882,1384],
								[1499,1696,882,1392],
								[1334,1499,898,1384],
								[1153,1334,890,1466],
								[980,1153,890,1376],
								[816,980,890,1390],
								[561,816,890,1384],
								[314,561,898,1392],
								[119,323,914,1377],
								]


							

							//query if the click was in the coverage area
							//of any tooth and then highlight that tooth
							for(var i = 1; i <=32; i++){

									



									var toothNum = "tooth_" + i;

									if( toothReg[i][0]< intersectX 
										&& intersectX < toothReg[i][1]
										&& toothReg[i][2] < intersectY 
										&& intersectY < toothReg[i][3]){

										

										highlightObject(toothNum);

											
											
										highlightOdontogram(i);



										//feed the selected tooth info to selectedTooth
										//variable for other functions (like isolate) to use
										selectedTooth = carm.getObjectByName(toothNum);

										

										



										;}




							}








						}

					}



					///////////////////TEETH MESH SELECTION UPON CLICK///////////////////////////
					

					let intersectedTooth = null;
					raycaster.setFromCamera( pointer, camera );
					intersects_Mesh = raycaster.intersectObject( group_Mesh, true );


					if ( intersects_Mesh.length > 0 ) {

						// Ignore hits on hidden teeth (Teeth / jaw toggles off, isolate).
						const res2 = intersects_Mesh.filter( function ( res2 ) {

							return res2 && res2.object && isVisibleInScene( res2.object );

						} )[ 0 ];

						if ( res2 && res2.object ) {

							intersectedTooth = res2.object;

							// The ray often hits a nested sub-mesh whose name is NOT
							// "tooth_N", so climb the parent chain to find the real tooth
							// node. Returns null for gums/bone/skull (no tooth mapping),
							// which leaves the selection untouched.
							var toothNum = resolveToothNumberFromHit( intersectedTooth );

							if ( toothNum ) {
								if ( typeof isolateTgl !== "undefined" && isolateTgl ) {
									// ISOLATION mode: the isolated tooth stays locked.
									// Ignore 3D clicks (exit via the Un-isolate button).
								} else if ( compareToggle ) {
									// COMPARE mode: drive the existing two-tooth picker
									// (only fires during the pick phase; once the split is
									// shown the main canvas is hidden so this can't run).
									registerCompareSelection( toothNum );
								} else {
									// NORMAL mode: toggle persistent selection (click the
									// same tooth again to deselect) and sync every surface.
									highlightObject( "tooth_" + toothNum );
									applySelectionUI( toothNum );
									// Smoothly focus the camera on the newly selected tooth
									// (skip on a re-click that deselected it).
									if ( selectedToothName ) focusCameraOnTooth( toothNum );
								}
							}

					}}

					

				}



				// ---------------------------------------------------------------------
				// Grid
				// ---------------------------------------------------------------------
				gridHelper = new THREE.GridHelper( 2000, 20, 0x888888, 0x444444 );
				gridHelper.position.y = - 50;
				gridHelper.name = 'Grid';
				//scene1.add( gridHelper );

				// ---------------------------------------------------------------------
				// Axes
				// ---------------------------------------------------------------------
				const axes = new THREE.AxesHelper( 500 );
				axes.name = 'AxesHelper';
				//scene1.add( axes );


				




				// ---------------------------------------------------------------------
				// Ortho camera
				// ---------------------------------------------------------------------
				const cameraOrtho = new THREE.OrthographicCamera( CANVAS_WIDTH / - 2, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT / - 2, 0.1, 10 );
				scene1.add( cameraOrtho );
				cameraOrtho.name = 'OrthographicCamera';

				material = new THREE.MeshLambertMaterial( {
					color: 0xffff00,
					side: THREE.DoubleSide
				} );

				object = new THREE.Mesh( new THREE.CircleGeometry( 50, 20, 0, Math.PI * 2 ), material );
				object.position.set( 200, 0, - 400 );
				////scene1.add( object );

				object = new THREE.Mesh( new THREE.RingGeometry( 10, 50, 20, 5, 0, Math.PI * 2 ), material );
				object.position.set( 0, 0, - 400 );
				////scene1.add( object );

				object = new THREE.Mesh( new THREE.CylinderGeometry( 25, 75, 100, 40, 5 ), material );
				object.position.set( - 200, 0, - 400 );
				////scene1.add( object );

				//
				const points = [];

				for ( let i = 0; i < 50; i ++ ) {

					points.push( new THREE.Vector2( Math.sin( i * 0.2 ) * Math.sin( i * 0.1 ) * 15 + 50, ( i - 5 ) * 2 ) );

				}

				object = new THREE.Mesh( new THREE.LatheGeometry( points, 20 ), material );
				object.position.set( 200, 0, 400 );
				////scene1.add( object );



				// ---------------------------------------------------------------------
				// HDRI - IMAGE BASED LIGHTING
				// ---------------------------------------------------------------------
				new RGBELoader()
				.setPath('./three/examples/textures/equirectangular/')
				.load('brown_photostudio_01_2k.hdr', function (texture) {

					
					texture.mapping = THREE.EquirectangularReflectionMapping;

					

					
					//scene1.background = texture;
					// Unified charcoal: EXACTLY matches the page background (#1a1a1c) so
					// the 3D model area blends seamlessly into the rest of the interface
					// instead of looking like a separate canvas window.
					scene1.background = new THREE.Color( "rgb(26, 26, 28)" );
					scene1.environment = texture;
					// Reuse this PMREM environment in the compare viewers.
					envMap = texture;

				});



				//////////////////////////////////////////////////////////////////////////////


				
				renderer = new THREE.WebGLRenderer( { antialias: true, canvas: container} );
				renderer.setPixelRatio( Math.min( window.devicePixelRatio || 1, 2 ) );
				// updateStyle = false: size the drawing buffer but let CSS control the
				// displayed canvas size, so the responsive width/height rules apply.
				renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT, false );
				renderer.shadowMap.enabled = true;
				applyRendererSettings( renderer, ACTIVE_MODEL ); // per-model tone mapping (v3 only)



				//container.appendChild( renderer.domElement );

				controls = new OrbitControls( camera, renderer.domElement );
				controls.listenToKeyEvents( window ); // optional
				controls.enableDamping = false; // an animation loop is required when either damping or auto-rotation are enabled
				controls.dampingFactor = 0.05;

				controls.screenSpacePanning = true;

				//controls.minDistance = 100;
				//controls.maxDistance = 1000;

				controls.maxPolarAngle = Math.PI / 2;
				controls.target.set( 0, 0, 0 );
				controls.update();

				// --- Default camera pose for the Reset button -------------------
				// Captured once, here at setup, so the Reset button can smoothly
				// animate the camera back to the original default view. This is
				// the first-load pose (camera at 0,0,800 looking at origin) — the
				// same state controls.reset() restored before. Stored once and
				// never mutated afterwards.
				defaultCameraPosition = camera.position.clone();
				defaultControlsTarget = controls.target.clone();
				defaultCameraZoom = camera.zoom;

				

				/////////////////////////GUI///////////////////////////////////////
				
				window.addEventListener( 'resize', onWindowResize );
				window.addEventListener( 'orientationchange', onWindowResize );
				// Sync the renderer to the final laid-out canvas size once everything loads.
				window.addEventListener( 'load', onWindowResize );
				if ( window.ResizeObserver ) {
					resizeObserver = new ResizeObserver( function () {
						onWindowResize();
					} );
					resizeObserver.observe( container );
					if ( sceneArea ) {
						resizeObserver.observe( sceneArea );
					}
				}

				const gui = new GUI();

				let h = gui.addFolder( 'Settings' );
				//h.add( params, 'trs' ).name( 'Use TRS' );
				//h.add( params, 'onlyVisible' ).name( 'Only Visible Objects' );
				//h.add( params, 'truncateDrawRange' ).name( 'Truncate Draw Range' );
				//h.add( params, 'binary' ).name( 'Binary (GLB)' );
				//h.add( params, 'maxTextureSize', 2, 8192 ).name( 'Max Texture Size' ).step( 1 );


				/////////////////////JAW VIEW CONTROLS/////////////////////////////////////////

				h.add(params, 'turntable').name('Turntable');
				h.add(params, 'jawView').name('Jaw View').onChange(function(){


					if(params.jawView){
					jawViewOn();}

					else{

						jawViewOff();
					}

				}); 


				///////////////////////////////////////////////////////////////////////////////////////////
				/////////////////////NERVES, ARTERIES AND VEINS VISIBLITY/////////////////////////////////////////
				///////////////////////////////////////////////////////////////////////////////////////////
				h = gui.addFolder( 'NERVES AND VESSELS' );


				h.add(params, 'nerves').name('Nerves').onChange(function(){
					
					if(params.nerves){
					carm.getObjectByName("Skin_Nerves").visible = true;}

					
					else{
						carm.getObjectByName("Skin_Nerves").visible = false;}		

				}); 

				h.add(params, 'arteries').name('Arteries').onChange(function(){
					
					if(params.arteries){
					carm.getObjectByName("Arteries").visible = true;}

					
					else{
						carm.getObjectByName("Arteries").visible = false;}		

				}); 

				h.add(params, 'veins').name('Veins').onChange(function(){
					
					if(params.veins){
					carm.getObjectByName("Veins").visible = true;}

					
					else{
						carm.getObjectByName("Veins").visible = false;}		

				}); 
				///////////////////////////////////////////////////////////////////////////////////////////
				/////////////////////OCCLUSION DEFINITION CONTROLS/////////////////////////////////////////
				///////////////////////////////////////////////////////////////////////////////////////////
				h = gui.addFolder( 'OCLLUSAL SURFACES' );

				h.add(params, 'curveOfSpee').name('Curve of Spee').onChange(function(){
					
					if(params.curveOfSpee){
					carm.getObjectByName("curveOfSpee").visible = true;}

					
					else{
						carm.getObjectByName("curveOfSpee").visible = false;}		

				}); 

				h.add(params, 'curveOfWilson').name('Curve of Wilson').onChange(function(){
					
					if(params.curveOfWilson){
					carm.getObjectByName("curveOfWilson").visible = true;}
					else{
						carm.getObjectByName("curveOfWilson").visible = false;}		

				}); 

				h.add(params, 'sphereOfMonson').name('Sphere of Monson').onChange(function(){
					
					if(params.sphereOfMonson){
					carm.getObjectByName("sphereOfMonson").visible = true;}
					else{
						carm.getObjectByName("sphereOfMonson").visible = false;}		

				}); 




				///////////////////////////////FUNCTION CONTROLS////////////////////////////////////

				h = gui.addFolder( 'FUNCTIONS' );


				h.add(params, 'isolate').name('Isolate Selected Tooth (I)');
				h.add(params, 'unIsolate').name('Un-isolate (U)');
				h.add(params, 'openJaw').name('Open/Close Jaw');
				h.add(params, 'devLobes').name('Developmental Lobe (D)');
				compareButton = h.add(params, 'compare').name('Compare Mode')

				

				//h.add(carm.getObjectByName("lowerJawGrp").rotation, 'z', 0, 5).name('Try me');

				

				gui.open();

				gui.destroy();

				

			}



			/////////////////////////////////////////////////////////////////////////////////////////
			//// CHECKBOXES FOR DIFFERENT MODES
			/////////////////////////////////////////////////////////////////////////////////////////

			////////////////////////////// HELP & RESET BUTTONS ///////////////////////////////
			if (btnHelp) {
				btnHelp.addEventListener('click', function() {
					if (helpModalOverlay) helpModalOverlay.style.display = 'flex';
				});
			}

			if (helpModalClose) {
				helpModalClose.addEventListener('click', function() {
					if (helpModalOverlay) helpModalOverlay.style.display = 'none';
				});
			}

			if (helpModalOverlay) {
				helpModalOverlay.addEventListener('click', function(e) {
					if (e.target === helpModalOverlay) {
						helpModalOverlay.style.display = 'none';
					}
				});
			}

			// Smoothly animate the main camera + OrbitControls target back to the
			// stored default view, instead of snapping instantly. Uses an
			// easeOutCubic tween over ~900ms (within the 700–1200ms range) and
			// disables user controls while the animation is running.
			function smoothResetView() {
				if ( !controls || !camera || !defaultCameraPosition || !defaultControlsTarget ) return;

				// Cancel any camera animation already in progress (and make sure we
				// don't inherit its "disabled" state).
				if ( resetAnimationId !== null ) {
					cancelAnimationFrame( resetAnimationId );
					resetAnimationId = null;
				}

				var startPosition = camera.position.clone();
				var startTarget = controls.target.clone();
				var startZoom = camera.zoom;
				var startJawRotation = ( typeof jaw !== 'undefined' && jaw )
					? jaw.rotation.clone()
					: null;

				var duration = 3600; // ms
				var startTime = ( typeof performance !== 'undefined' && performance.now )
					? performance.now()
					: Date.now();

				// Disable user interaction during the animation; ALWAYS re-enable after.
				isCameraTweening = true;
				controls.enabled = false;

				function easeOutCubic( t ) {
					return 1 - Math.pow( 1 - t, 3 );
				}

				function step( now ) {
					var elapsed = now - startTime;
					var t = Math.min( elapsed / duration, 1 );
					var e = easeOutCubic( t );

					camera.position.lerpVectors( startPosition, defaultCameraPosition, e );
					controls.target.lerpVectors( startTarget, defaultControlsTarget, e );
					camera.zoom = startZoom + ( defaultCameraZoom - startZoom ) * e;
					camera.updateProjectionMatrix();

					if ( startJawRotation && jaw ) {
						jaw.rotation.x = startJawRotation.x * ( 1 - e );
						jaw.rotation.y = startJawRotation.y * ( 1 - e );
						jaw.rotation.z = startJawRotation.z * ( 1 - e );
					}

					controls.update();

					if ( t < 1 ) {
						resetAnimationId = requestAnimationFrame( step );
					} else {
						// Snap to the exact stored defaults, then re-enable input.
						camera.position.copy( defaultCameraPosition );
						controls.target.copy( defaultControlsTarget );
						camera.zoom = defaultCameraZoom;
						camera.updateProjectionMatrix();
						if ( typeof jaw !== 'undefined' && jaw ) jaw.rotation.set( 0, 0, 0 );
						controls.update();
						// Release control back to the user (manual orbit/zoom/pan).
						controls.enabled = true;
						isCameraTweening = false;
						resetAnimationId = null;
					}
				}

				resetAnimationId = requestAnimationFrame( step );
			}

			// -----------------------------------------------------------------------
			// Reusable camera focus — same easeOutCubic tween the Reset button uses,
			// factored out so ANY tooth selection (model, odontogram, search, compare)
			// can smoothly move/focus the main camera onto the chosen tooth.
			// -----------------------------------------------------------------------

			// Generic smooth tween of the main camera + OrbitControls target. Shares
			// resetAnimationId so starting a new move cancels any in-flight reset/focus.
			function tweenCameraTo( goalPos, goalTarget, duration ) {
				if ( !controls || !camera || !goalPos || !goalTarget ) return;

				if ( resetAnimationId !== null ) {
					cancelAnimationFrame( resetAnimationId );
					resetAnimationId = null;
				}

				var startPosition = camera.position.clone();
				var startTarget = controls.target.clone();
				duration = duration || 900; // ms

				var startTime = ( typeof performance !== 'undefined' && performance.now )
					? performance.now()
					: Date.now();

				// Disable user interaction during the animation; ALWAYS re-enable after
				// (never restore a possibly-stale "disabled" state, which would lock the
				// model when tweens overlap, e.g. selecting several teeth in a row).
				isCameraTweening = true;
				controls.enabled = false;

				function easeOutCubic( t ) { return 1 - Math.pow( 1 - t, 3 ); }

				function step( now ) {
					var elapsed = now - startTime;
					var t = Math.min( elapsed / duration, 1 );
					var e = easeOutCubic( t );

					camera.position.lerpVectors( startPosition, goalPos, e );
					controls.target.lerpVectors( startTarget, goalTarget, e );
					controls.update();

					if ( t < 1 ) {
						resetAnimationId = requestAnimationFrame( step );
					} else {
						camera.position.copy( goalPos );
						controls.target.copy( goalTarget );
						controls.update();
						// Release control back to the user (manual orbit / zoom / pan).
						controls.enabled = true;
						isCameraTweening = false;
						resetAnimationId = null;
					}
				}

				resetAnimationId = requestAnimationFrame( step );
			}

			// Centroid of all 32 teeth (the middle of the dental arches). Used as the
			// origin for the "outward/buccal" direction so the camera can orbit to the
			// correct side of the jaw for any selected tooth. Recomputed on demand.
			function getDentalArchCenter() {
				if ( !carm ) return null;
				carm.updateMatrixWorld( true );
				var sum = new THREE.Vector3();
				var count = 0;
				for ( var i = 1; i <= 32; i++ ) {
					var t = carm.getObjectByName( "tooth_" + i );
					if ( !t ) continue;
					var b = new THREE.Box3().setFromObject( t );
					if ( b.isEmpty() ) continue;
					sum.add( b.getCenter( new THREE.Vector3() ) );
					count++;
				}
				if ( count === 0 ) return null;
				return sum.multiplyScalar( 1 / count );
			}

			// Smoothly frame the main camera on a tooth (1–32). Besides moving in, it
			// ORBITS the camera so the tooth faces the user: the view direction is the
			// tooth's outward (buccal) direction from the arch centre, blended with a
			// frontal bias so even posterior molars are seen from the front-lateral
			// side rather than edge-on or from behind the jaw. No-ops while the compare
			// split is open (main canvas hidden) or the occlusal view is active.
			function focusCameraOnTooth( toothNumber, opts ) {
				if ( !carm || !camera || !controls ) return;
				if ( typeof compareActive !== "undefined" && compareActive ) return;
				if ( typeof occlusalActive !== "undefined" && occlusalActive ) return;

				opts = opts || {};
				// `fill` = how far back to pull (lower = tighter); `minDist` = floor.
				// Defaults give a medium zoom with surrounding teeth visible; isolate
				// mode passes tighter values since only one (enlarged) tooth is shown.
				var fill = ( typeof opts.fill === "number" ) ? opts.fill : 6.5;
				var minDist = ( typeof opts.minDist === "number" ) ? opts.minDist : 420;

				var n = parseInt( toothNumber );
				if ( !n || n < 1 || n > 32 ) return;

				var tooth = carm.getObjectByName( "tooth_" + n );
				if ( !tooth ) return;

				carm.updateMatrixWorld( true );
				var box = new THREE.Box3().setFromObject( tooth );
				if ( box.isEmpty() ) return;

				var center = box.getCenter( new THREE.Vector3() );
				var size = box.getSize( new THREE.Vector3() );
				var maxDim = Math.max( size.x, size.y, size.z ) || 1;

				var fov = camera.fov * ( Math.PI / 180 );
				// Pull the camera back so the tooth is centred but context stays visible.
				// The bbox term scales with tooth size; the minimum keeps a comfortable
				// distance even for small teeth.
				var dist = ( maxDim / 2 ) / Math.tan( fov / 2 ) * fill;
				if ( dist < minDist ) dist = minDist;

				// ---- Orbit to face the tooth ----
				// Outward (buccal) direction = from the arch centre to the tooth, in the
				// horizontal (XZ) plane. The front of the face is +Z (default camera sits
				// at +Z looking toward the model), so a frontal bias keeps the view from
				// in front of the patient even for back teeth.
				var archCenter = getDentalArchCenter() || new THREE.Vector3( 0, center.y, 0 );
				var radial = new THREE.Vector3( center.x - archCenter.x, 0, center.z - archCenter.z );
				if ( radial.lengthSq() < 1e-4 ) radial.set( 0, 0, 1 );
				radial.normalize();

				// Blend outward direction with a forward (+Z) bias. radial=1.0 keeps the
				// correct side; front=1.3 guarantees a clear front-facing component.
				var dir = radial.multiplyScalar( 1.0 ).add( new THREE.Vector3( 0, 0, 1.3 ) );

				// Small vertical tilt so the crown reads well: look slightly down on
				// lower teeth (camera above) and slightly up at upper teeth (camera below).
				dir.y += ( n >= 17 ) ? 0.16 : -0.12;

				if ( dir.lengthSq() < 1e-6 ) dir.set( 0, 0, 1 );
				dir.normalize();

				var goalPos = center.clone().addScaledVector( dir, dist );
				tweenCameraTo( goalPos, center.clone(), 1000 );
			}

			if (btnReset) {
				btnReset.addEventListener('click', function() {
					if (compareActive) {
						compareViewers.forEach(function(v) {
							if (v && v.resetControls) v.resetControls();
						});
					} else {
						// Smoothly animate the camera back to the default view
						// instead of snapping. Same destination as before.
						smoothResetView();
					}
				});
			}
			////////////////////////////// JAW OPEN ///////////////////////////////////////////
			jawOpenCheckbox.addEventListener('click', function() {

				jawOpenToggle();

			});

			

			////////////////////////////// COMPARE ///////////////////////////////////////////
			document.getElementById('compareCheckbox').addEventListener('click', function() {

				var checkbox = document.getElementById('compareCheckbox');

				if (checkbox.checked == true) {

					compare();

				} else {
					compare();
				}

			});

			/////////////////////////////////////////////////////////////////////////////////////////
			//// BUTTONS
			/////////////////////////////////////////////////////////////////////////////////////////


			////////////////////////////// ISOLATE BUTTON ///////////////////////////////////////////
			/**
			 * Tracks if a tooth is isolated.
			 */
			var isolateTgl = false;

			function isolateToggle(){

				if (!isolateTgl) {
					
					var isolate_success = isolate();

					if(isolate_success){

						isolateTgl = true;
						isolateBtn.innerHTML = "Un-isolate";
						// Active state styled in CSS (.light-pill.is-active) so the
						// Isolate button turns the app red when isolation is on.
						isolateBtn.classList.add("is-active");
						// Lock the odontogram: it shows the isolated tooth but can't
						// be used to change the selection until un-isolated.
						if ( typeof updateOdontogramLock === "function" ) updateOdontogramLock();

					}
				}
				else{

					unIsolate();
					isolateTgl = false;
					isolateBtn.innerHTML = "Isolate";
					isolateBtn.classList.remove("is-active");
					// Un-isolated -> odontogram clickable again.
					if ( typeof updateOdontogramLock === "function" ) updateOdontogramLock();
				}

			}

			isolateBtn.addEventListener('click', function() {

				isolateToggle();

			});


			////////////////////////////// DEVELOPMETAL LOBE BUTTON ///////////////////////////////////////////
			// The Developmental lobe button has been removed from the UI. Guard the
			// binding so the missing element never throws (the devLobes() function and
			// its keyboard/GUI hooks are left intact and harmless).
			var devLobeBtn = document.getElementById('devLobeButton');
			if (devLobeBtn) {
				devLobeBtn.addEventListener('click', function() {
					devLobes();
				});
			}



			/////////////////////////////////////////////////////////////////////////////////////////
			//// CHECKBOXES FOR SHOW/HIDE
			/////////////////////////////////////////////////////////////////////////////////////////
			

			///////////////////////GUMS CHECKBOX///////////////////////////////////////////
			document.getElementById('gumsCheckbox').addEventListener('click', function() {

				var checkbox = document.getElementById('gumsCheckbox');

				var gumsToHide = [carm.getObjectByName("UMesh_PM3D_Sphere3D2_26"),
				carm.getObjectByName("UMesh_LowerGums_Hide_Teeth6")];

				if (checkbox.checked != true) {
				  for (var i = 0; i < gumsToHide.length; i++) {
					gumsToHide[i].visible = false;
				  }
				} else {
				  for (var i = 0; i < gumsToHide.length; i++) {
					gumsToHide[i].visible = true;
				  }
				}

			  });



			///////////////////////BONES CHECKBOX///////////////////////////////////////////
			bonesCheckbox.addEventListener('click', function() {

				var checkbox = document.getElementById('bonesCheckbox');

				var bonesToHide = [carm.getObjectByName("mandibleLow"),
									carm.getObjectByName("RLMaxilla1")];

				if (checkbox.checked != true) {
				  for (var i = 0; i < bonesToHide.length; i++) {
					bonesToHide[i].visible = false;
				  }
				} else {
				  for (var i = 0; i < bonesToHide.length; i++) {
					bonesToHide[i].visible = true;
				  }
				}

			  });

			///////////////////////Nerves CHECKBOX///////////////////////////////////////////
			document.getElementById('nervesCheckbox').addEventListener('click', function() {

				var checkbox = document.getElementById('nervesCheckbox');

				var nervesToHide = [carm.getObjectByName("Arteries"),
									carm.getObjectByName("Veins"),
									carm.getObjectByName("Skin_Nerves")];

				if (checkbox.checked != true) {
				  for (var i = 0; i < nervesToHide.length; i++) {
					nervesToHide[i].visible = false;
				  }
				} else {
				  for (var i = 0; i < nervesToHide.length; i++) {
					nervesToHide[i].visible = true;
				  }
				}

			  });



			///////////////////////UPPER JAW / LOWER JAW / TEETH VISIBILITY///////////////////////////
			// Real visibility toggles wired to the actual GLB groups/meshes:
			//   Upper Jaw -> upperJawGrp (maxilla + upper gums/pulp + tooth_1..16)
			//   Lower Jaw -> lowerJawGrp (mandible + lower gums/pulp + tooth_17..32)
			//   Teeth     -> tooth_1 .. tooth_32
			const UPPER_JAW_OBJECT_NAMES = ['upperJawGrp'];
			const LOWER_JAW_OBJECT_NAMES = ['lowerJawGrp'];

			function setObjectVisibilityByNames(names, visible) {
				if (typeof carm === 'undefined' || !carm) return;
				names.forEach(function (name) {
					var obj = carm.getObjectByName(name);
					if (obj) obj.visible = visible;
				});
			}

			function setTeethVisibility(visible) {
				if (typeof carm === 'undefined' || !carm) return;
				for (var i = 1; i <= 32; i++) {
					var tooth = carm.getObjectByName('tooth_' + i);
					if (tooth) tooth.visible = visible;
				}
			}

			/**
			 * Re-applies the three visibility toggles to the model. Called after
			 * isolate/compare restore mesh visibility so the UI and model agree.
			 * Only touches .visible — never materials, selection, or highlighting.
			 */
			function applyVisibilityToggles() {
				if (upperJawCheckbox) setObjectVisibilityByNames(UPPER_JAW_OBJECT_NAMES, upperJawCheckbox.checked);
				if (lowerJawCheckbox) setObjectVisibilityByNames(LOWER_JAW_OBJECT_NAMES, lowerJawCheckbox.checked);
				if (teethCheckbox) setTeethVisibility(teethCheckbox.checked);

				// Also honour the anatomy/occlusion toggles, so un-isolate never turns
				// gums/bones/nerves/curves on when the user had them off (or leaves
				// them off when checked). Bones/nerves are owned by the occlusal/jaw
				// views while those are active, so leave them alone then.
				var cb = function (id) { var el = document.getElementById(id); return el ? el.checked : null; };
				var toggles = [
					['gumsCheckbox', ['UMesh_PM3D_Sphere3D2_26', 'UMesh_LowerGums_Hide_Teeth6']],
					['speeCheckbox', ['curveOfSpee']],
					['wilsonCheckbox', ['curveOfWilson']],
					['monsonCheckbox', ['sphereOfMonson']]
				];
				if (!occlusalActive && !jawView) {
					toggles.push(['bonesCheckbox', ['mandibleLow', 'RLMaxilla1']]);
					toggles.push(['nervesCheckbox', ['Arteries', 'Veins', 'Skin_Nerves']]);
				}
				toggles.forEach(function (t) {
					var on = cb(t[0]);
					if (on === null) return;
					setObjectVisibilityByNames(t[1], on);
				});
			}

			if (upperJawCheckbox) {
				upperJawCheckbox.addEventListener('change', function () {
					setObjectVisibilityByNames(UPPER_JAW_OBJECT_NAMES, upperJawCheckbox.checked);
				});
			}

			if (lowerJawCheckbox) {
				lowerJawCheckbox.addEventListener('change', function () {
					setObjectVisibilityByNames(LOWER_JAW_OBJECT_NAMES, lowerJawCheckbox.checked);
				});
			}

			if (teethCheckbox) {
				teethCheckbox.addEventListener('change', function () {
					setTeethVisibility(teethCheckbox.checked);
				});
			}


			///////////////////////CURVE OF SPEE CHECKBOX///////////////////////////////////////////
			document.getElementById('speeCheckbox').addEventListener('click', function() {

				var checkbox = document.getElementById('speeCheckbox');

				var speeToHide = [carm.getObjectByName("curveOfSpee"),];

				if (checkbox.checked != true) {
				  for (var i = 0; i < speeToHide.length; i++) {
					speeToHide[i].visible = false;
				  }
				} else {
				  for (var i = 0; i < speeToHide.length; i++) {
					speeToHide[i].visible = true;
				  }
				}

			  });

			///////////////////////CURVE OF WILSON CHECKBOX///////////////////////////////////////////
			document.getElementById('wilsonCheckbox').addEventListener('click', function() {

				var checkbox = document.getElementById('wilsonCheckbox');

				var wilsonToHide = [carm.getObjectByName("curveOfWilson"),];

				if (checkbox.checked != true) {
				  for (var i = 0; i < wilsonToHide.length; i++) {
					wilsonToHide[i].visible = false;
				  }
				} else {
				  for (var i = 0; i < wilsonToHide.length; i++) {
					wilsonToHide[i].visible = true;
				  }
				}

			  });

			///////////////////////SPHERE OF MONSON CHECKBOX///////////////////////////////////////////
			document.getElementById('monsonCheckbox').addEventListener('click', function() {

				var checkbox = document.getElementById('monsonCheckbox');

				var monsonToHide = [carm.getObjectByName("sphereOfMonson"),];

				if (checkbox.checked != true) {
				  for (var i = 0; i < monsonToHide.length; i++) {
					monsonToHide[i].visible = false;
				  }
				} else {
				  for (var i = 0; i < monsonToHide.length; i++) {
					monsonToHide[i].visible = true;
				  }
				}

			  });






			///////////////////////OCCLUSAL VIEW TOGGLE///////////////////////////////////////////
			// Switches the 3D model to a true occlusal view – both jaws open wide
			// (using the same geometry as jawViewOn()), bones/nerves/vessels hidden,
			// and the camera smoothly animated to a top-down perspective.  Turning
			// it off smoothly restores every saved property (camera, jaw rotations,
			// jaw positions, and visibility) so the UI and model stay in sync.
			var occlusalActive = false;
			var occlusalSavedState = null;
			var occlusalAnimationId = null;

			function occlusalViewOn() {
				if (!carm || !camera || !controls) { return false; }

				// Cancel any occlusal animation already running.
				if (occlusalAnimationId !== null) {
					cancelAnimationFrame(occlusalAnimationId);
					occlusalAnimationId = null;
				}

				// Also cancel any in-flight main-camera tween (reset / tooth focus) so it
				// can't fight the occlusal animation, and make sure controls are released
				// so this animation captures an enabled state.
				if (resetAnimationId !== null) {
					cancelAnimationFrame(resetAnimationId);
					resetAnimationId = null;
				}
				isCameraTweening = false;
				controls.enabled = true;

				var upperJawOcc = carm.getObjectByName("upperJawGrp");
				var lowerJawOcc = carm.getObjectByName("lowerJawGrp");

				// ---- Save the full state so toggle-off is fully reversible ----
				occlusalSavedState = {
					camPos:          camera.position.clone(),
					target:          controls.target.clone(),
					up:              camera.up.clone(),
					zoom:            camera.zoom,
					maxPolarAngle:   controls.maxPolarAngle,
					upperRotX:       upperJawOcc ? upperJawOcc.rotation.x : 0,
					upperRotY:       upperJawOcc ? upperJawOcc.rotation.y : 0,
					upperRotZ:       upperJawOcc ? upperJawOcc.rotation.z : 0,
					lowerRotX:       lowerJawOcc ? lowerJawOcc.rotation.x : 0,
					lowerRotY:       lowerJawOcc ? lowerJawOcc.rotation.y : 0,
					lowerRotZ:       lowerJawOcc ? lowerJawOcc.rotation.z : 0,
					lowerPos:        lowerJawOcc ? lowerJawOcc.position.clone() : null,
					upperPos:        upperJawOcc ? upperJawOcc.position.clone() : null,
					bonesVisible:    [],
					nervesVisible:   []
				};

				// Save and then hide bones
				var boneNames = ["RLMaxilla1", "mandibleLow"];
				boneNames.forEach(function (name) {
					var obj = carm.getObjectByName(name);
					if (obj) {
						occlusalSavedState.bonesVisible.push({ name: name, visible: obj.visible });
						obj.visible = false;
					}
				});

				// Save and then hide nerves/vessels
				var nerveNames = ["Arteries", "Veins", "Skin_Nerves"];
				nerveNames.forEach(function (name) {
					var obj = carm.getObjectByName(name);
					if (obj) {
						occlusalSavedState.nervesVisible.push({ name: name, visible: obj.visible });
						obj.visible = false;
					}
				});

				// ---- Open both jaws wide ----
				// Use rotation.SET so any small base y/z orientation on the jaw groups
				// is cleared — otherwise splaying about a non-world-aligned local axis
				// makes the arches look rolled/tilted (the misalignment in Screenshot 1).
				if (upperJawOcc) {
					upperJawOcc.rotation.set( -Math.PI / 2, 0, 0 );   // clean -90° about world X
				}
				if (lowerJawOcc) {
					lowerJawOcc.rotation.set( Math.PI / 2, 0, 0 );    // clean +90° about world X
				}
				// Splay offsets = base position + per-model offset (adapter config).
				applyJawViewOffsets( upperJawOcc, lowerJawOcc );

				// Refresh world matrices after repositioning.
				carm.updateMatrixWorld(true);

				// ---- Compute ideal camera destination ----
				// SIZE comes from the whole splayed jaws (keeps the existing zoom), but
				// the CENTRE comes from the TEETH only, so the framing is symmetric on
				// the dental arches. The old centre used the full jaw groups, which
				// include off-centre bone/gum geometry and pulled the view sideways /
				// off-centre (the misalignment in the reference screenshot).
				var sizeBox = new THREE.Box3();
				if (upperJawOcc) { sizeBox.expandByObject(upperJawOcc); }
				if (lowerJawOcc) { sizeBox.expandByObject(lowerJawOcc); }
				if (sizeBox.isEmpty()) { sizeBox.setFromObject(carm); }
				var size   = sizeBox.getSize(new THREE.Vector3());
				var maxDim = Math.max(size.x, size.y, size.z);

				var teethBox = new THREE.Box3();
				var hasTeeth = false;
				for (var ti = 1; ti <= 32; ti++) {
					var tk = carm.getObjectByName("tooth_" + ti);
					if (tk) { teethBox.expandByObject(tk); hasTeeth = true; }
				}
				var center = (hasTeeth && !teethBox.isEmpty())
					? teethBox.getCenter(new THREE.Vector3())
					: sizeBox.getCenter(new THREE.Vector3());

				var fov    = camera.fov * (Math.PI / 180);
				// Frame the splayed arches with a little margin so they sit centred and
				// don't touch the top/bottom edges.
				var dist   = (maxDim / 2) / Math.tan(fov / 2) * 1.3;

				// When both jaws splay open (upper -90°, lower +90°) BOTH occlusal
				// surfaces end up facing +Z, so the clean view is from the FRONT and
				// slightly above — not straight down. dir.x = 0 keeps the view perfectly
				// symmetric (no left/right offset or azimuth) about the dental midline.
				var dir       = new THREE.Vector3(0, 0.55, 1).normalize();
				var goalPos   = center.clone().addScaledVector(dir, dist);
				var goalTarget = center.clone();

				// ---- Smooth camera animation (easeOutCubic, same style as smoothResetView) ----
				var startPos    = occlusalSavedState.camPos.clone();
				var startTarget = occlusalSavedState.target.clone();
				var startZoom   = occlusalSavedState.zoom;
				var duration    = 1200; // ms
				var startTime   = performance.now();
				var wasEnabled  = controls.enabled;
				controls.enabled = false;
				controls.maxPolarAngle = Math.PI;

				function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

				function step(now) {
					var elapsed = now - startTime;
					var t = Math.min(elapsed / duration, 1);
					var e = easeOutCubic(t);

					camera.position.lerpVectors(startPos, goalPos, e);
					controls.target.lerpVectors(startTarget, goalTarget, e);
					camera.up.set(0, 1, 0);
					camera.zoom = startZoom + (1 - startZoom) * e;
					camera.updateProjectionMatrix();
					controls.update();

					if (t < 1) {
						occlusalAnimationId = requestAnimationFrame(step);
					} else {
						camera.position.copy(goalPos);
						controls.target.copy(goalTarget);
						camera.zoom = 1;
						camera.updateProjectionMatrix();
						controls.update();
						// Always release controls so the user can orbit/zoom the occlusal view.
						controls.enabled = true;
						occlusalAnimationId = null;
					}
				}

				occlusalAnimationId = requestAnimationFrame(step);
				occlusalActive = true;
				return true;
			}

			function occlusalViewOff() {
				if (!occlusalSavedState) { occlusalActive = false; return; }

				// Cancel any occlusal animation already running.
				if (occlusalAnimationId !== null) {
					cancelAnimationFrame(occlusalAnimationId);
					occlusalAnimationId = null;
				}

				// Also cancel any in-flight main-camera tween so it can't fight this one.
				if (resetAnimationId !== null) {
					cancelAnimationFrame(resetAnimationId);
					resetAnimationId = null;
				}
				isCameraTweening = false;

				var s = occlusalSavedState;
				var upperJawOcc = carm ? carm.getObjectByName("upperJawGrp") : null;
				var lowerJawOcc = carm ? carm.getObjectByName("lowerJawGrp") : null;

				// ---- Smooth camera animation back to saved state ----
				var startPos    = camera.position.clone();
				var startTarget = controls.target.clone();
				var startZoom   = camera.zoom;

				// Capture the current jaw state for interpolation.
				var startUpperRotX = upperJawOcc ? upperJawOcc.rotation.x : s.upperRotX;
				var startLowerRotX = lowerJawOcc ? lowerJawOcc.rotation.x : s.lowerRotX;
				var startLowerPos = lowerJawOcc ? lowerJawOcc.position.clone() : null;
				var startUpperPos = upperJawOcc ? upperJawOcc.position.clone() : null;

				var duration  = 1200; // ms
				var startTime = performance.now();
				var wasEnabled = controls.enabled;
				controls.enabled = false;

				function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

				function step(now) {
					var elapsed = now - startTime;
					var t = Math.min(elapsed / duration, 1);
					var e = easeOutCubic(t);

					// Interpolate camera
					camera.position.lerpVectors(startPos, s.camPos, e);
					controls.target.lerpVectors(startTarget, s.target, e);
					camera.zoom = startZoom + (s.zoom - startZoom) * e;
					camera.updateProjectionMatrix();

					// Interpolate jaw rotations and positions
					if (upperJawOcc) {
						upperJawOcc.rotation.x = startUpperRotX + (s.upperRotX - startUpperRotX) * e;
						if (s.upperPos) upperJawOcc.position.lerpVectors(startUpperPos, s.upperPos, e);
					}
					if (lowerJawOcc) {
						lowerJawOcc.rotation.x = startLowerRotX + (s.lowerRotX - startLowerRotX) * e;
						if (s.lowerPos) lowerJawOcc.position.lerpVectors(startLowerPos, s.lowerPos, e);
					}

					controls.update();

					if (t < 1) {
						occlusalAnimationId = requestAnimationFrame(step);
					} else {
						// Snap to exact saved values
						camera.position.copy(s.camPos);
						camera.up.copy(s.up);
						controls.target.copy(s.target);
						camera.zoom = s.zoom;
						camera.updateProjectionMatrix();
						controls.maxPolarAngle = s.maxPolarAngle;
						controls.update();
						// Always release controls back to the user after restoring.
						controls.enabled = true;

						if (upperJawOcc) {
							upperJawOcc.rotation.set( s.upperRotX, s.upperRotY || 0, s.upperRotZ || 0 );
							if (s.upperPos) upperJawOcc.position.copy(s.upperPos);
						}
						if (lowerJawOcc) {
							lowerJawOcc.rotation.set( s.lowerRotX, s.lowerRotY || 0, s.lowerRotZ || 0 );
							if (s.lowerPos) lowerJawOcc.position.copy(s.lowerPos);
						}

						// Restore bone visibility based on saved state
						s.bonesVisible.forEach(function (entry) {
							var obj = carm.getObjectByName(entry.name);
							if (obj) obj.visible = entry.visible;
						});

						// Restore nerve/vessel visibility based on saved state
						s.nervesVisible.forEach(function (entry) {
							var obj = carm.getObjectByName(entry.name);
							if (obj) obj.visible = entry.visible;
						});

						occlusalSavedState = null;
						occlusalActive = false;
						occlusalAnimationId = null;
					}
				}

				occlusalAnimationId = requestAnimationFrame(step);
			}

			var occlusalCheckbox = document.getElementById('occlusalCheckbox');
			if (occlusalCheckbox) {
				occlusalCheckbox.addEventListener('change', function () {
					if (occlusalCheckbox.checked) {
						var ok = occlusalViewOn();
						// If the model isn't ready yet, don't leave the switch stuck on.
						if (!ok) { occlusalCheckbox.checked = false; }
					} else {
						occlusalViewOff();
					}
				});
			}


			/////////////////////////////////////////////////////////////////////////////////////////
			//// JAW VIEW
			/////////////////////////////////////////////////////////////////////////////////////////


			/**
			 * Function to display the denture in an open Jaw View.
			 */
			function jawViewOn(){

			var upperJaw = carm.getObjectByName("upperJawGrp");
			

				lastJawRotation.x = lowerJaw.rotation.x;

				
				
				upperJaw.rotation.x = -Math.PI/2; //-90 degrees in radians
				lowerJaw.rotation.x = Math.PI/2; //90 degrees in radians

				// Splay offsets = base position + per-model offset (adapter config).
				applyJawViewOffsets( upperJaw, lowerJaw );


				carm.getObjectByName("RLMaxilla1").visible = false;
				carm.getObjectByName("mandibleLow").visible = false;
				carm.getObjectByName("Arteries").visible = false;
				carm.getObjectByName("Veins").visible = false;
				carm.getObjectByName("Skin_Nerves").visible = false;


				jawView = true;


			}

			function jawViewOff(){
			
			if (!upperJaw || !lowerJaw) return; // model not loaded yet

			// Restore the jaw groups' captured base transforms (no hardcoded,
			// model-specific coordinates, so no drift across toggles).
			restoreJawBaseRotation( upperJaw );
			lowerJaw.rotation.x = lastJawRotation.x;

			restoreJawBasePosition( lowerJaw );
			restoreJawBasePosition( upperJaw );

			if(bonesCheckbox.checked){ //check if the user hid the bones
			carm.getObjectByName("RLMaxilla1").visible = true;
			carm.getObjectByName("mandibleLow").visible = true;
			}
			/*
			carm.getObjectByName("Arteries").visible = true;
			carm.getObjectByName("Veins").visible = true;
			carm.getObjectByName("Skin_Nerves").visible = true;
			*/

			// Jaw View was removed from the current UI, so the checkbox may not
			// exist. Guard the reference so this function (called by isolate(),
			// openJaw() and closeJaw()) never throws a ReferenceError.
			var jawViewCb = document.getElementById('jawViewCheckbox');
			if (jawViewCb) jawViewCb.checked = false;
			jawView = false;


			}

			function jawViewToggle(){


				if (!jawView) {

					jawViewOn();

				} else {
					jawViewOff();
				}


			}




			/////////////////////////////////////////////////////////////////////////////////////////
			//// COMPARE FUNCTION
			/////////////////////////////////////////////////////////////////////////////////////////
			
			//initiate toggle as false
			compareToggle = false;
			
			

			//initiate positon vectors
			//for selection 1 and 2 for compare
			var onePos = new THREE.Vector3();
			var twoPos = new THREE.Vector3();

			var one,two;

			// Controlled-edit state for the open split view (PHASE B). The user chooses
			// a side to edit ('L' or 'R') and stages a TEMPORARY pick for EACH side
			// independently. BOTH sides can be staged before committing; the Confirm
			// button then applies left and right together. Until commit, the rendered
			// (confirmed) teeth never change.
			var compareEditSide = null;    // 'L' | 'R' | null — side the next pick fills
			var compareTempLeft = null;    // tooth number staged for the LEFT side, or null
			var compareTempRight = null;   // tooth number staged for the RIGHT side, or null

			// =====================================================================
			// COMPARE MODE — two fully independent Three.js viewers, one tooth each.
			// Each viewer owns its scene, camera, renderer, OrbitControls, lights,
			// render loop and resize handling, so rotating/zooming/panning one tooth
			// never affects the other. Teeth are cloned out of the already-loaded
			// denture model (no second 47 MB download).
			// =====================================================================

			// If a tooth node is a wrapper, dig out the actual mesh.
			// If a tooth node is a wrapper, dig out the actual mesh.
			function resolveToothMesh( obj ) {
				if ( obj && obj.geometry ) return obj;
				let found = null;
				if ( obj && obj.traverse ) {
					obj.traverse( function ( c ) { if ( !found && c.isMesh ) found = c; } );
				}
				return found || obj;
			}

			/**
			 * Clone one tooth out of the shared model into a standalone, centered
			 * THREE.Mesh. The source world transform is baked into the geometry so the
			 * tooth keeps its natural orientation/scale, then it is recentered on the
			 * origin so the compare camera can frame it cleanly. Throws on bad input so
			 * the caller can show a controlled error instead of a blank/white canvas.
			 */
			function buildIsolatedToothMesh( sourceTooth ) {
				// Grouped teeth (v3: enamel + dentin + pulp) -> clone the COMPLETE
				// tooth via the model adapter. Single-mesh (legacy) teeth keep the
				// original path below unchanged.
				if ( sourceTooth && !sourceTooth.geometry && typeof buildToothDisplayClone === "function" ) {
					return buildToothDisplayClone( sourceTooth );
				}
				const src = resolveToothMesh( sourceTooth );
				if ( !src || !src.geometry ) {
					throw new Error( "Tooth has no geometry to display" );
				}
				src.updateWorldMatrix( true, false );

				const geo = src.geometry.clone();
				geo.applyMatrix4( src.matrixWorld );      // bake orientation + scale + position
				geo.computeBoundingBox();
				const center = new THREE.Vector3();
				geo.boundingBox.getCenter( center );
				geo.translate( -center.x, -center.y, -center.z );   // recenter on origin
				geo.computeBoundingSphere();

				let material;
				if ( Array.isArray( src.material ) ) {
					material = src.material.map( function ( m ) { return m.clone(); } );
				} else if ( src.material ) {
					material = src.material.clone();
				} else {
					// Last-resort material so a tooth missing its material still renders.
					material = new THREE.MeshStandardMaterial( { color: 0xe8e3da, roughness: 0.7, metalness: 0.0 } );
				}
				// Drop any selection highlight carried over from the main scene.
				( Array.isArray( material ) ? material : [ material ] ).forEach( function ( m ) {
					if ( m && m.emissive ) m.emissive.setRGB( 0, 0, 0 );
					if ( m ) m.needsUpdate = true;
				} );

				const mesh = new THREE.Mesh( geo, material );
				mesh.castShadow = false;
				mesh.receiveShadow = false;
				return mesh;
			}

			// Dark surface used as the renderer clear colour so a compare canvas is
			// NEVER white — even before a model is set or if rendering is interrupted.
			const COMPARE_BG = new THREE.Color( "rgb(26, 26, 28)" );

			/**
			 * Robust per-tooth camera framing using the world-space bounding box, so
			 * each differently sized tooth is clearly visible. Guards against empty or
			 * non-finite boxes (never leaves the camera pointing at nothing).
			 */
			function fitCameraToObject( camera, controls, object, offset ) {
				offset = offset || 1.8;
				const box = new THREE.Box3().setFromObject( object );
				if ( box.isEmpty() ) {
					camera.position.set( 0, 0, 300 );
					camera.near = 0.1; camera.far = 5000;
					camera.lookAt( 0, 0, 0 );
					camera.updateProjectionMatrix();
					if ( controls ) { controls.target.set( 0, 0, 0 ); controls.update(); }
					return;
				}
				const size = box.getSize( new THREE.Vector3() );
				const center = box.getCenter( new THREE.Vector3() );
				let maxDim = Math.max( size.x, size.y, size.z );
				if ( !isFinite( maxDim ) || maxDim <= 0 ) maxDim = 100;

				// Aspect-aware framing: compute the camera distance that just fits the
				// model's HEIGHT inside the vertical FOV and the distance that fits its
				// WIDTH inside the (aspect-scaled) horizontal FOV, then use the larger so
				// the tooth is fully visible AND fills the canvas on whichever axis is the
				// constraint. This removes the large empty margins on portrait/landscape
				// canvases and keeps the model centered regardless of window shape.
				const fov = camera.fov * Math.PI / 180;
				const aspect = ( isFinite( camera.aspect ) && camera.aspect > 0 ) ? camera.aspect : 1;
				const distH = ( size.y / 2 ) / Math.tan( fov / 2 );
				const distW = ( size.x / 2 ) / ( Math.tan( fov / 2 ) * aspect );
				let dist = Math.max( distH, distW, size.z / 2 ) * offset;
				if ( !isFinite( dist ) || dist <= 0 ) dist = ( maxDim / 2 ) / Math.tan( fov / 2 ) * offset;

				camera.near = Math.max( dist / 1000, 0.01 );
				camera.far = dist * 1000;
				camera.position.set( center.x, center.y, center.z + dist );
				camera.lookAt( center );
				camera.updateProjectionMatrix();

				if ( controls ) {
					controls.target.copy( center );
					controls.minDistance = dist * 0.2;
					controls.maxDistance = dist * 6;
					controls.update();
				}
			}

			/**
			 * Creates ONE fully independent, *persistent* tooth viewer bound to a single
			 * <canvas>. The renderer / scene / camera / controls / lights are created
			 * once and REUSED across selections — only the tooth mesh is swapped. This
			 * is deliberate: tearing down and recreating a WebGL renderer/context on the
			 * same canvas for every selection is exactly what exhausts the browser's
			 * WebGL context pool and produces the intermittent white screen.
			 *
			 * Returns a controller: setTooth, clearMesh, resize, pause, resume,
			 * showError, hideError, destroy.
			 */
			function createCompareToothViewer( canvasEl, viewerLabel ) {
				const label = viewerLabel || "compare";

				// --- dark error / status overlay (never white) ---
				const overlay = document.createElement( "div" );
				overlay.className = "compare-error";
				overlay.style.display = "none";
				if ( canvasEl.parentNode ) canvasEl.parentNode.appendChild( overlay );
				function showError( msg ) { overlay.textContent = msg; overlay.style.display = "flex"; }
				function hideError() { overlay.style.display = "none"; }

				// --- scene (opaque dark background -> no white, no bleed-through) ---
				const scene = new THREE.Scene();
				scene.background = COMPARE_BG;
				if ( envMap ) scene.environment = envMap;

				// --- lights (mirror the main viewer) ---
				scene.add( new THREE.AmbientLight( 0xffffff, 0.46 ) );
				scene.add( new THREE.HemisphereLight( 0xf5f0e8, 0x17191d, 0.55 ) );
				const dirLight = new THREE.DirectionalLight( 0xfff5e9, 1.35 );
				dirLight.position.set( 240, 420, 360 );
				scene.add( dirLight );
				if ( typeof applySceneLighting === "function" && typeof ACTIVE_MODEL !== "undefined" ) {
					applySceneLighting( scene, ACTIVE_MODEL ); // same light balance as the main view
				}

				// --- camera ---
				const camera = new THREE.PerspectiveCamera( 45, 1, 0.1, 100000 );
				camera.position.set( 0, 0, 300 );

				// --- render loop state (declared before handlers that reference them) ---
				let rafId = null;
				let running = false;

				// --- renderer (created ONCE, reused for the page lifetime) ---
				let renderer;
				try {
					renderer = new THREE.WebGLRenderer( { canvas: canvasEl, antialias: true, alpha: false } );
				} catch ( err ) {
					console.error( "[compare:" + label + "] WebGL renderer creation failed:", err );
					showError( "3D view unavailable on this device." );
					// Inert controller so callers never crash.
					return {
						setTooth: function () { return false; }, clearMesh: function () {}, resize: function () {},
						pause: function () {}, resume: function () {},
						showError: showError, hideError: hideError, destroy: function () {}
					};
				}
				renderer.setPixelRatio( Math.min( window.devicePixelRatio || 1, 2 ) );
				renderer.setClearColor( COMPARE_BG, 1 );   // opaque dark, never white
				renderer.shadowMap.enabled = false;
				if ( typeof applyRendererSettings === "function" && typeof ACTIVE_MODEL !== "undefined" ) {
					applyRendererSettings( renderer, ACTIVE_MODEL ); // match the main view's look
				}

				// --- controls (bound only to THIS canvas's DOM element) ---
				const controls = new OrbitControls( camera, renderer.domElement );
				controls.enableDamping = true;
				controls.dampingFactor = 0.08;
				controls.screenSpacePanning = true;
				controls.update();

				let currentMesh = null;
				// Stored "home" framing for this viewer, captured right after each
				// auto-fit. Reset tweens the camera back to exactly these values so the
				// motion matches the smooth reset used by the main view.
				let defaultCamPos = null;
				let defaultTarget = null;
				let resetRafId = null;

				// Capture the current camera framing as this viewer's reset target.
				function storeDefaultView() {
					defaultCamPos = camera.position.clone();
					defaultTarget = controls.target.clone();
				}

				// --- resize: only sizes when the canvas has real dimensions ---
				function resize() {
					const w = canvasEl.clientWidth | 0;
					const h = canvasEl.clientHeight | 0;
					if ( !w || !h ) {
						// Container not laid out yet -> retry next frame (never setSize(0)).
						requestAnimationFrame( resize );
						return;
					}
					camera.aspect = w / h;
					camera.updateProjectionMatrix();
					renderer.setSize( w, h, false );
				}

				// Re-frame the current tooth for the canvas's CURRENT size/aspect. Used
				// after layout settles (entering compare mode) so the model is centered
				// and fills the freshly-sized canvas rather than the pre-layout one.
				function refit() {
					if ( !currentMesh ) return;
					resize();
					// Larger offset = camera farther back = tooth framed smaller, so the
					// full crown/body fits comfortably without touching the panel edges.
					fitCameraToObject( camera, controls, currentMesh, 1.7 );
					storeDefaultView();
				}

				// Smoothly animate this compare viewer back to its stored home framing —
				// camera position, controls target, and any model rotation — mirroring
				// the easeOutCubic tween used by the main viewer's Reset (no snapping).
				function resetControls() {
					if ( !camera || !controls ) return;
					if ( resetRafId ) { cancelAnimationFrame( resetRafId ); resetRafId = null; }

					const goalPos = defaultCamPos ? defaultCamPos.clone() : new THREE.Vector3( 0, 0, 150 );
					const goalTarget = defaultTarget ? defaultTarget.clone() : new THREE.Vector3( 0, 0, 0 );
					const startPos = camera.position.clone();
					const startTarget = controls.target.clone();
					const startRot = currentMesh ? currentMesh.rotation.clone() : null;

					const duration = 900; // ms — smooth, professional return
					const startTime = ( typeof performance !== 'undefined' && performance.now )
						? performance.now() : Date.now();
					const wasEnabled = controls.enabled;
					controls.enabled = false;

					function easeOutCubic( t ) { return 1 - Math.pow( 1 - t, 3 ); }

					function stepReset( now ) {
						const t = Math.min( ( now - startTime ) / duration, 1 );
						const e = easeOutCubic( t );
						camera.position.lerpVectors( startPos, goalPos, e );
						controls.target.lerpVectors( startTarget, goalTarget, e );
						if ( startRot && currentMesh ) {
							currentMesh.rotation.x = startRot.x * ( 1 - e );
							currentMesh.rotation.y = startRot.y * ( 1 - e );
							currentMesh.rotation.z = startRot.z * ( 1 - e );
						}
						camera.updateProjectionMatrix();
						controls.update();
						if ( t < 1 ) {
							resetRafId = requestAnimationFrame( stepReset );
						} else {
							camera.position.copy( goalPos );
							controls.target.copy( goalTarget );
							if ( currentMesh ) currentMesh.rotation.set( 0, 0, 0 );
							camera.updateProjectionMatrix();
							controls.update();
							controls.enabled = wasEnabled;
							resetRafId = null;
						}
					}
					resetRafId = requestAnimationFrame( stepReset );
				}

				let ro = null;
				if ( window.ResizeObserver ) {
					ro = new ResizeObserver( function () { resize(); } );
					ro.observe( canvasEl );
				}
				window.addEventListener( "resize", resize );
				window.addEventListener( "orientationchange", resize );

				function loop() {
					if ( !running ) return;
					rafId = requestAnimationFrame( loop );
					controls.update();
					try {
						renderer.render( scene, camera );
					} catch ( err ) {
						running = false;
						console.error( "[compare:" + label + "] render error:", err );
						showError( "Unable to render this tooth." );
					}
				}
				function resume() { if ( running ) return; running = true; loop(); }
				function pause() {
					running = false;
					if ( rafId ) { cancelAnimationFrame( rafId ); rafId = null; }
					if ( resetRafId ) { cancelAnimationFrame( resetRafId ); resetRafId = null; }
				}

				// --- WebGL context loss safety: show a dark message, never go white ---
				canvasEl.addEventListener( "webglcontextlost", function ( e ) {
					e.preventDefault();
					running = false;
					console.warn( "[compare:" + label + "] WebGL context lost" );
					showError( "Rendering paused (graphics context lost). Reselect to retry." );
				}, false );
				canvasEl.addEventListener( "webglcontextrestored", function () {
					console.warn( "[compare:" + label + "] WebGL context restored" );
					hideError();
					resize();
					resume();
				}, false );

				// --- swap the displayed tooth (disposes the PREVIOUS mesh only) ---
				function clearMesh() {
					if ( currentMesh ) {
						scene.remove( currentMesh );
						if ( currentMesh.isGroup && typeof disposeOwnedObject === "function" ) {
							// Full-tooth clone: dispose every cloned geometry/material
							// (textures are shared with the main model and kept).
							disposeOwnedObject( currentMesh );
						} else {
							if ( currentMesh.geometry ) currentMesh.geometry.dispose();
							( Array.isArray( currentMesh.material ) ? currentMesh.material : [ currentMesh.material ] )
								.forEach( function ( m ) { if ( m && m.dispose ) m.dispose(); } );
						}
						currentMesh = null;
					}
				}

				function setTooth( sourceTooth ) {
					const n = ( sourceTooth && sourceTooth.name ) ? parseInt( sourceTooth.name.substring( 6 ) ) : NaN;
					const niceName = ( teethNumSystem[ n ] && teethNumSystem[ n ][ 3 ] ) || ( "tooth_" + n );
					console.log( "[compare:" + label + "] setTooth id=" + n + " name='" + niceName +
						"' source=in-memory denture clone canvas=" + canvasEl.clientWidth + "x" + canvasEl.clientHeight );

					if ( !sourceTooth || isNaN( n ) || n < 1 || n > 32 ) {
						console.error( "[compare:" + label + "] invalid tooth selection:", sourceTooth );
						clearMesh();
						showError( "Invalid tooth selection." );
						return false;
					}

					try {
						clearMesh();
						const mesh = buildIsolatedToothMesh( sourceTooth );
						scene.add( mesh );
						currentMesh = mesh;
						resize();                                     // correct aspect/size first
						fitCameraToObject( camera, controls, mesh, 1.7 );  // per-tooth auto-fit (larger offset → tooth framed smaller, fits comfortably)
						storeDefaultView();                           // remember this framing for smooth Reset
						hideError();
						console.log( "[compare:" + label + "] load OK id=" + n );
						resume();
						return true;
					} catch ( err ) {
						console.error( "[compare:" + label + "] failed to build tooth " + n + ":", err );
						clearMesh();
						showError( "Unable to display this tooth." );
						return false;
					}
				}

				// --- full teardown (renderers are normally reused, not destroyed) ---
				function destroy() {
					pause();
					if ( ro ) ro.disconnect();
					window.removeEventListener( "resize", resize );
					window.removeEventListener( "orientationchange", resize );
					if ( controls ) controls.dispose();
					clearMesh();
					if ( renderer ) {
						renderer.dispose();
						if ( renderer.forceContextLoss ) renderer.forceContextLoss();
					}
					if ( overlay && overlay.parentNode ) overlay.parentNode.removeChild( overlay );
				}

				return {
					setTooth: setTooth, clearMesh: clearMesh, resize: resize, refit: refit,
					pause: pause, resume: resume,
					showError: showError, hideError: hideError, destroy: destroy,
					resetControls: resetControls,
					getMesh: function () { return currentMesh; }
				};
			}

			// Create the two compare viewers once and reuse them (avoids WebGL context
			// churn — the root cause of the intermittent white screen).
			function ensureCompareViewers() {
				if ( compareViewers.length === 2 ) return true;
				const leftCanvas = document.getElementById( "compareCanvasLeft" );
				const rightCanvas = document.getElementById( "compareCanvasRight" );
				if ( !leftCanvas || !rightCanvas ) return false;
				compareViewers = [
					createCompareToothViewer( leftCanvas, "left" ),
					createCompareToothViewer( rightCanvas, "right" )
				];
				return compareViewers.length === 2;
			}

			// Full teardown of both viewers (available for a hard reset; not used in
			// the normal enter/exit flow so contexts stay stable).
			function destroyCompareViewers() {
				compareViewers.forEach( function ( v ) {
					try { v.destroy(); } catch ( e ) { /* no-op */ }
				} );
				compareViewers = [];
			}

			function compareToothLabel( toothObj ) {
				const n = parseInt( toothObj.name.substring( 6 ) );
				const name = ( teethNumSystem[ n ] && teethNumSystem[ n ][ 3 ] ) || ( "Tooth " + n );
				return name + " (" + n + ")";
			}

			// Visual LEFT-to-RIGHT order of the teeth as laid out on the odontogram
			// (by Universal number). Lower index = further LEFT on screen. The
			// physical layout is identical across numbering systems, so this single
			// array is the source of truth for compare-mode left/right placement.
			var COMPARE_VISUAL_ORDER = [
				1, 2, 3, 4, 5, 6, 7, 8,
				9, 10, 11, 12, 13, 14, 15, 16,
				32, 31, 30, 29, 28, 27, 26, 25,
				24, 23, 22, 21, 20, 19, 18, 17
			];

			function toothVisualIndex( n ) {
				var i = COMPARE_VISUAL_ORDER.indexOf( parseInt( n ) );
				return i === -1 ? 999 : i;
			}

			// Given the two selected tooth meshes (in click order), return them ordered
			// LEFT-to-RIGHT by their visual position on the odontogram. Click order is
			// still tracked by `one`/`two`; this ONLY decides visual placement, so the
			// left/right panels always match the odontogram regardless of click order.
			function compareDisplayPair( a, b ) {
				if ( !a || !b ) return [ a, b ];
				var an = parseInt( a.name.substring( 6 ) );
				var bn = parseInt( b.name.substring( 6 ) );
				return ( toothVisualIndex( an ) <= toothVisualIndex( bn ) ) ? [ a, b ] : [ b, a ];
			}

			/**
			 * Locks or unlocks odontogram interaction based on the current mode.
			 * The card stays fully visible (and keeps its highlights) — only its
			 * clickable hotspots are disabled, with a not-allowed cursor affordance.
			 * Locked while a comparison is shown (compareActive) or a tooth is
			 * isolated (isolateTgl).
			 */
			function updateOdontogramLock() {
				var card = document.getElementById( "odontogramCard" );
				if ( !card ) return;
				// The odontogram is ALWAYS interactive now. In Compare mode it drives the
				// two-tooth picker; in Isolate mode it switches the isolated tooth; in
				// normal mode it selects a tooth. So it is never locked.
				card.classList.toggle( "is-locked", false );
			}

			/**
			 * Shows the split layout and loads tooth `one` (left) and `two` (right)
			 * into the persistent viewers. Each tooth loads independently, so one
			 * failing never blanks the other.
			 */
			function showCompareView() {
				if ( !one || !two || !carm ) return;

				const view = document.getElementById( "compareView" );
				if ( !view ) return;

				// LEFT/RIGHT placement follows the CLICK order: the first selected
				// tooth (`one`) is the LEFT (L) panel, the second (`two`) is the
				// RIGHT (R) panel. This keeps the split, the L/R badges, and the info
				// text all consistent with the order the user picked the teeth.
				var leftTooth = one;
				var rightTooth = two;
				const leftN = parseInt( leftTooth.name.substring( 6 ) );
				const rightN = parseInt( rightTooth.name.substring( 6 ) );

				// Titles use the real selected tooth names, in visual order.
				const titleL = document.getElementById( "compareTitleLeft" );
				const titleR = document.getElementById( "compareTitleRight" );
				if ( titleL ) titleL.textContent = compareToothLabel( leftTooth );
				if ( titleR ) titleR.textContent = compareToothLabel( rightTooth );

				// Reveal first so the canvases have a measurable size.
				view.hidden = false;
				compareActive = true;
				updateOdontogramLock();   // two teeth shown -> lock odontogram

				// Flag the scene so CSS can reserve the right-side control column and
				// tuck the odontogram into it (prevents collision with the canvases).
				if ( sceneArea ) sceneArea.classList.add( "is-comparing" );

				// Hide the main jaw canvas so it doesn't bleed through behind the compare viewers.
				var mainCanvas = document.getElementById( "threejs-canvas" );
				if ( mainCanvas ) mainCanvas.style.visibility = "hidden";

				// Update the selection UI + dual highlights FIRST, before touching the
				// WebGL viewers. This way the "two teeth selected" state (info text,
				// detail cards, and both odontogram highlights) is always shown, even
				// if creating the split viewers fails on a constrained device.
				// Everything below is keyed to the VISUAL left/right order. Names come
				// from teethNumSystem (the correct, title-matching source) — NOT the
				// offset teethNames array. Shown as clean stacked text only: the boxed
				// cards are cleared so they collapse (CSS hides :empty), keeping the
				// panel compact so the Compare/Isolate/Dev-lobe buttons stay visible.
				document.getElementById( "info" ).innerHTML =
					"Comparing teeth " + leftN + " and " + rightN +
					"<br><br><strong>Left side tooth:</strong><br>" + compareToothLabel( leftTooth ) +
					"<br><br><strong>Right side tooth:</strong><br>" + compareToothLabel( rightTooth );
				document.getElementById( "compareLeft" ).innerHTML = "";
				document.getElementById( "compareRight" ).innerHTML = "";

				// Highlight both selected teeth everywhere (model + odontogram sprites + card).
				applyCompareHighlights( leftN, rightN );

				if ( !ensureCompareViewers() ) {
					console.error( "[compare] viewer canvases not found in DOM" );
					return;
				}

				// Load each tooth into the viewer matching its visual side: left mesh
				// in the left canvas, right mesh in the right canvas.
				try { compareViewers[ 0 ].setTooth( leftTooth ); }
				catch ( e ) { console.error( "[compare] left viewer error:", e ); compareViewers[ 0 ].showError( "Unable to display this tooth." ); }
				try { compareViewers[ 1 ].setTooth( rightTooth ); }
				catch ( e ) { console.error( "[compare] right viewer error:", e ); compareViewers[ 1 ].showError( "Unable to display this tooth." ); }

				// The split now shows a CONFIRMED pair: clear any controlled-edit state
				// and the pending temp highlight, switch the banner to the "change
				// selections" guidance, refresh the L/R badges, and update the Confirm
				// button (disabled until the user starts editing a side again).
				compareEditSide = null;
				compareTempLeft = null;
				compareTempRight = null;
				clearTempHighlights();
				setCompareBanner( COMPARE_BANNER_CHANGE );
				updateCompareLRMarkers();
				updateConfirmButtonState();

				// Force a correct size AND re-frame once layout has settled after
				// un-hiding, so each tooth is centered and fills its final-size canvas.
				requestAnimationFrame( function () {
					compareViewers.forEach( function ( v ) {
						try { v.resize(); if ( v.refit ) v.refit(); } catch ( e ) {}
					} );
				} );
			}

			/**
			 * Hides the split layout and PAUSES both viewers, returning to the main
			 * viewer. Renderers/contexts are kept alive for instant, churn-free reuse.
			 */
			function hideCompareView() {
				compareViewers.forEach( function ( v ) { try { v.pause(); } catch ( e ) {} } );
				const view = document.getElementById( "compareView" );
				if ( view ) view.hidden = true;
				compareActive = false;
				updateOdontogramLock();   // split hidden -> odontogram clickable again (unless isolated)

				// Restore the odontogram to its normal (wide) size outside compare mode.
				if ( sceneArea ) sceneArea.classList.remove( "is-comparing" );

				// Clear the dual-tooth highlights from the odontogram card.
				clearCardHighlights();

				// Restore the main jaw canvas.
				var mainCanvas = document.getElementById( "threejs-canvas" );
				if ( mainCanvas ) mainCanvas.style.visibility = "";

				// Returning to the selection phase (or leaving compare): clear any
				// controlled-edit state + pending highlights, then refresh the Confirm
				// button and L/R badges to match the current state.
				compareEditSide = null;
				compareTempLeft = null;
				compareTempRight = null;
				if ( typeof clearTempHighlights === "function" ) clearTempHighlights();
				updateConfirmButtonState();
				updateCompareLRMarkers();

				if ( controls ) controls.update();
			}

			// Banner copy for the two compare-mode phases.
			const COMPARE_BANNER_SELECT = "Select two teeth for comparison on the model or on the odontogram. Confirm your selection.";
			const COMPARE_BANNER_CHANGE = "Change your selections using the odontogram. To exit compare mode, deselect the 'Compare' button.";

			/**
			 * Enables/shows the "Confirm selection" button. It is visible the whole
			 * time Compare mode is on (both while choosing the initial pair and while
			 * the split is open), so the user always has it at hand. It is ENABLED when
			 * there is something to commit:
			 *   - PHASE A (no split yet): two teeth have been picked.
			 *   - PHASE B (split open):   at least one side has a staged temp pick.
			 */
			function updateConfirmButtonState() {
				var btn = document.getElementById( "compareConfirmBtn" );
				if ( !btn ) return;
				var inCompare = ( typeof compareToggle !== "undefined" && compareToggle === true );
				var splitOpen = ( typeof compareActive !== "undefined" && compareActive === true );
				if ( !inCompare ) {
					btn.hidden = true;
					btn.disabled = true;
					return;
				}
				btn.hidden = false;
				if ( !splitOpen ) {
					btn.disabled = !( one && two );
				} else {
					btn.disabled = !( compareTempLeft || compareTempRight );
				}
			}

			/**
			 * PHASE B helper: begin editing one side of the open comparison. Marks the
			 * side active so the next odontogram pick fills that side's TEMP slot. Does
			 * NOT clear staged picks (either side may already be staged). Nothing is
			 * rendered/changed yet — that waits for Confirm.
			 */
			function beginCompareEdit( side ) {
				if ( !compareActive ) return;
				compareEditSide = side;     // 'L' or 'R'
				updateCompareEditUI();
			}

			/**
			 * PHASE B helper: positions a dashed "pending" outline (by element id) over
			 * a staged tooth, or hides it when there is none.
			 */
			function positionTempHighlight( elId, toothNum ) {
				var el = document.getElementById( elId );
				if ( !el ) return;
				var r = ( toothNum && ODONTOGRAM_REGIONS[ toothNum ] ) ? ODONTOGRAM_REGIONS[ toothNum ] : null;
				if ( !r ) { el.style.display = "none"; return; }
				var leftPct = ( r[ 0 ] / ODONTOGRAM_IMG_W ) * 100;
				var topPct  = ( r[ 2 ] / ODONTOGRAM_IMG_H ) * 100;
				var wPct    = ( ( r[ 1 ] - r[ 0 ] ) / ODONTOGRAM_IMG_W ) * 100;
				var hPct    = ( ( r[ 3 ] - r[ 2 ] ) / ODONTOGRAM_IMG_H ) * 100;
				el.style.left = leftPct + "%";
				el.style.top = topPct + "%";
				el.style.width = wPct + "%";
				el.style.height = hPct + "%";
				el.style.display = "block";
			}

			// Hides both pending outlines (used when leaving the edit/compare state).
			function clearTempHighlights() {
				positionTempHighlight( "odoTempHighlightL", null );
				positionTempHighlight( "odoTempHighlightR", null );
			}

			/**
			 * PHASE B helper: refreshes everything that reflects the controlled-edit
			 * state — the L/R badges (which follow each side's staged-or-confirmed
			 * tooth, with the active/pending side flagged), the two pending outlines,
			 * the Information-panel status text, and the Confirm button. Never
			 * re-renders the split viewers.
			 */
			function updateCompareEditUI() {
				var oneN = one ? parseInt( one.name.substring( 6 ) ) : null;
				var twoN = two ? parseInt( two.name.substring( 6 ) ) : null;

				// Keep both CONFIRMED teeth highlighted on the card; badges + pending
				// outlines follow the staged picks.
				applyCompareHighlights( oneN, twoN );
				updateCompareLRMarkers();
				positionTempHighlight( "odoTempHighlightL", compareTempLeft );
				positionTempHighlight( "odoTempHighlightR", compareTempRight );

				var infoEl = document.getElementById( "info" );
				if ( infoEl ) {
					var html = "<strong>Comparing teeth " + oneN + " and " + twoN + "</strong>";
					if ( compareEditSide ) {
						var sideWord = ( compareEditSide === "L" ) ? "left" : "right";
						html += "<br><br><strong>Changing " + sideWord + " side tooth</strong>" +
							"<br>Select a new tooth from the odontogram.";
					}
					// List any staged (pending) changes for either side.
					var pending = "";
					if ( compareTempLeft ) {
						var lObj = carm ? carm.getObjectByName( "tooth_" + compareTempLeft ) : null;
						pending += "<br><strong>New left:</strong> " + ( lObj ? compareToothLabel( lObj ) : ( "Tooth " + compareTempLeft ) );
					}
					if ( compareTempRight ) {
						var rObj = carm ? carm.getObjectByName( "tooth_" + compareTempRight ) : null;
						pending += "<br><strong>New right:</strong> " + ( rObj ? compareToothLabel( rObj ) : ( "Tooth " + compareTempRight ) );
					}
					if ( pending ) {
						html += "<br><br>" + pending + "<br><br>Click <strong>Confirm selection</strong> to apply.";
					}
					infoEl.innerHTML = html;
				}

				updateConfirmButtonState();
			}

			/**
			 * Commits the current staged selection. In PHASE A this opens the split for
			 * the chosen pair; in PHASE B it applies BOTH staged side picks together and
			 * re-renders only then. Wired to the Confirm button.
			 */
			function confirmCompareSelection() {
				if ( typeof compareToggle === "undefined" || !compareToggle ) return;

				if ( !compareActive ) {
					// PHASE A: open the split for the chosen pair.
					if ( one && two ) showCompareView();
					return;
				}

				// PHASE B: nothing staged -> nothing to do.
				if ( !carm || ( !compareTempLeft && !compareTempRight ) ) return;

				var oneN = one ? parseInt( one.name.substring( 6 ) ) : null;
				var twoN = two ? parseInt( two.name.substring( 6 ) ) : null;

				// Resolve the FINAL pair (staged temp if present, else the current tooth)
				// and refuse a same-tooth comparison.
				var finalLeftN = compareTempLeft || oneN;
				var finalRightN = compareTempRight || twoN;
				if ( finalLeftN === finalRightN ) {
					var warnEl = document.getElementById( "info" );
					if ( warnEl ) {
						warnEl.innerHTML =
							"<strong>Comparing teeth " + oneN + " and " + twoN + "</strong>" +
							"<br><br>The two sides can't be the same tooth — pick a different tooth before confirming.";
					}
					return;
				}

				var leftObj = carm.getObjectByName( "tooth_" + finalLeftN );
				var rightObj = carm.getObjectByName( "tooth_" + finalRightN );
				if ( leftObj ) one = leftObj;
				if ( rightObj ) two = rightObj;
				selectedTooth = one;

				compareEditSide = null;
				compareTempLeft = null;
				compareTempRight = null;
				clearTempHighlights();
				showCompareView();   // re-renders BOTH updated teeth (clears edit UI)
			}

			/**
			 * Positions a single L/R badge over a tooth on the odontogram card, or
			 * hides it when no tooth is assigned. Coordinates are the centre of the
			 * tooth's click region, expressed as a percentage of the artwork — the same
			 * normalized space the hotspots/highlights use, so it tracks the art.
			 */
			function positionOdoMarker( el, toothNum ) {
				if ( !el ) return;
				var r = ( toothNum && ODONTOGRAM_REGIONS[ toothNum ] ) ? ODONTOGRAM_REGIONS[ toothNum ] : null;
				if ( !r ) { el.style.display = "none"; return; }
				var cx = ( ( r[ 0 ] + r[ 1 ] ) / 2 ) / ODONTOGRAM_IMG_W * 100;
				var cy = ( ( r[ 2 ] + r[ 3 ] ) / 2 ) / ODONTOGRAM_IMG_H * 100;
				el.style.left = cx + "%";
				el.style.top = cy + "%";
				el.style.display = "flex";
			}

			/**
			 * Refreshes both L/R badges. Each badge sits on that side's EFFECTIVE tooth:
			 * a staged temp pick if one exists, otherwise the confirmed tooth (`one` for
			 * L, `two` for R). The badge for a side with a pending change is flagged
			 * `is-pending`; the side currently being edited is flagged `is-editing`.
			 * Both hide when not in compare mode or when the tooth is unset.
			 */
			function updateCompareLRMarkers() {
				var lEl = document.getElementById( "odoMarkerL" );
				var rEl = document.getElementById( "odoMarkerR" );
				if ( !lEl && !rEl ) return;
				var inCompare = ( typeof compareToggle !== "undefined" && compareToggle === true );
				var oneN = ( inCompare && one ) ? parseInt( one.name.substring( 6 ) ) : null;
				var twoN = ( inCompare && two ) ? parseInt( two.name.substring( 6 ) ) : null;
				// Effective per-side tooth = staged temp (if any) else the confirmed one.
				var leftN = inCompare ? ( compareTempLeft || oneN ) : null;
				var rightN = inCompare ? ( compareTempRight || twoN ) : null;
				positionOdoMarker( lEl, leftN );
				positionOdoMarker( rEl, rightN );
				if ( lEl ) {
					lEl.classList.toggle( "is-editing", compareEditSide === "L" );
					lEl.classList.toggle( "is-pending", !!compareTempLeft );
				}
				if ( rEl ) {
					rEl.classList.toggle( "is-editing", compareEditSide === "R" );
					rEl.classList.toggle( "is-pending", !!compareTempRight );
				}
			}

			function setCompareBanner( text ) {
				const msg = document.getElementById( "sceneMessage" );
				if ( !msg ) return;
				const span = msg.querySelector( "span" );
				if ( span ) {
					if ( compareSavedBanner === null ) compareSavedBanner = span.textContent;
					span.textContent = text;
				}
				msg.style.display = "";
			}

			function restoreCompareBanner() {
				const msg = document.getElementById( "sceneMessage" );
				if ( msg && compareSavedBanner !== null ) {
					const span = msg.querySelector( "span" );
					if ( span ) span.textContent = compareSavedBanner;
				}
				compareSavedBanner = null;
			}

			/**
			 * Selection state machine while compare mode is on. Driven by either the
			 * HTML odontogram card or by clicking a tooth in the main 3D view.
			 *   pick 1            -> store as tooth one (prompt for the second)
			 *   pick 2 (different)-> store as tooth two and show the split
			 *   later picks       -> STAY in compare; replace the right tooth with the
			 *                        new selection (the left tooth stays the anchor) so
			 *                        the user never drops back to the main jaw screen.
			 * Two DIFFERENT teeth are always required — picking the tooth that is
			 * already selected is ignored with a short hint (never "8 and 8").
			 */
			function registerCompareSelection( toothNumber ) {
				if ( !compareToggle || !carm ) return;
				const n = parseInt( toothNumber );
				if ( !n || n < 1 || n > 32 ) return;
				const obj = carm.getObjectByName( "tooth_" + n );
				if ( !obj ) { console.warn( "[compare] no mesh found for tooth_" + n ); return; }

				var oneN = one ? parseInt( one.name.substring( 6 ) ) : null;
				var twoN = two ? parseInt( two.name.substring( 6 ) ) : null;

				// ---- PHASE B: the split comparison is already open. Changes are now
				// CONTROLLED — nothing updates the rendered teeth until the user clicks
				// "Confirm selection". BOTH sides can be staged before confirming:
				//   1. Click the L marker / left tooth  -> edit LEFT side.
				//      Click the R marker / right tooth -> edit RIGHT side.
				//   2. Click any other tooth -> it becomes the TEMPORARY pick for the
				//      side being edited (shown on the odontogram, but the split is NOT
				//      re-rendered).
				//   3. Repeat for the other side if desired.
				//   4. Confirm selection -> BOTH staged picks are applied together.
				if ( compareActive ) {
					// Effective per-side tooth = staged temp if any, else the confirmed
					// tooth. Clicking a side's effective tooth (or its marker) selects
					// that side for editing; the user can switch sides freely.
					var leftEff = compareTempLeft || oneN;
					var rightEff = compareTempRight || twoN;
					if ( n === oneN || n === compareTempLeft ) { beginCompareEdit( "L" ); return; }
					if ( n === twoN || n === compareTempRight ) { beginCompareEdit( "R" ); return; }

					// Any other tooth becomes the temporary pick for the active side —
					// but only once the user has chosen which side to change.
					if ( !compareEditSide ) {
						var hintEl = document.getElementById( "info" );
						if ( hintEl ) {
							hintEl.innerHTML =
								"<strong>Comparing teeth " + oneN + " and " + twoN + "</strong>" +
								"<br><br>Select the <strong>L</strong> or <strong>R</strong> marker on the " +
								"odontogram to choose which tooth to change.";
						}
						return;
					}

					if ( compareEditSide === "L" ) { compareTempLeft = n; }
					else { compareTempRight = n; }
					updateCompareEditUI();   // stage highlight + enable Confirm
					return;
				}

				// ---- PHASE A: choosing the two teeth before the split opens. Both the
				// first (LEFT/L) and second (RIGHT/R) selections are editable before
				// Confirm — exactly like the compare window:
				//   * Empty slots fill progressively: 1st pick -> first, 2nd -> second.
				//   * Clicking an already-chosen tooth (or its L/R marker) selects THAT
				//     side for editing; the next pick then replaces just that side.
				//   * With both chosen and no side selected, a new pick asks the user to
				//     pick L or R first (so changes are always intentional).
				if ( n === oneN ) { compareEditSide = "L"; refreshPhaseASelectionUI(); focusCameraOnTooth( n ); return; }
				if ( n === twoN ) { compareEditSide = "R"; refreshPhaseASelectionUI(); focusCameraOnTooth( n ); return; }

				if ( compareEditSide === "L" ) {
					one = obj; compareEditSide = null;
				} else if ( compareEditSide === "R" ) {
					two = obj; compareEditSide = null;
				} else if ( !one ) {
					one = obj;
				} else if ( !two ) {
					two = obj;
				} else {
					// Both chosen, no side picked — guide the user to choose which to change.
					var hintA = document.getElementById( "info" );
					if ( hintA ) {
						hintA.innerHTML =
							"<strong>First tooth:</strong><br>" + compareToothLabel( one ) +
							"<br><br><strong>Second tooth:</strong><br>" + compareToothLabel( two ) +
							"<br><br>Tap the <strong>L</strong> or <strong>R</strong> marker (or a selected tooth) to choose which one to change.";
					}
					return;
				}

				selectedTooth = one || null;   // keep a ref so Developmental lobe works
				refreshPhaseASelectionUI();
				// Smoothly focus the main camera on the tooth just picked (no-ops once
				// the split is open, since the main canvas is hidden there).
				focusCameraOnTooth( n );
			}

			/**
			 * Renders the PHASE A (pre-split) selection state into the Information
			 * panel, x-ray, highlights, L/R badges and Confirm button. Shared by tooth
			 * picks and by clicking the L/R markers, so the main-screen flow stays
			 * consistent however the user interacts.
			 */
			function refreshPhaseASelectionUI() {
				var oneN = one ? parseInt( one.name.substring( 6 ) ) : null;
				var twoN = two ? parseInt( two.name.substring( 6 ) ) : null;

				var infoEl = document.getElementById( "info" );
				if ( infoEl ) {
					var html = "";
					if ( one ) html += "<strong>First tooth:</strong><br>" + compareToothLabel( one );
					if ( one && two ) html += "<br><br>";
					if ( two ) html += "<strong>Second tooth:</strong><br>" + compareToothLabel( two );
					if ( !one && !two ) html = "Select the first tooth.";

					if ( compareEditSide === "L" ) {
						html += "<br><br><strong>Changing first tooth</strong> — select a new tooth from the model or odontogram.";
					} else if ( compareEditSide === "R" ) {
						html += "<br><br><strong>Changing second tooth</strong> — select a new tooth from the model or odontogram.";
					} else if ( one && !two ) {
						html += "<br><br>Select the second tooth.";
					} else if ( one && two ) {
						html += "<br><br>Confirm your selection.";
					}
					infoEl.innerHTML = html;
				}

				document.getElementById( "compareLeft" ).innerHTML = "";
				document.getElementById( "compareRight" ).innerHTML = "";
				if ( oneN && typeof updateXrayForTooth === "function" ) updateXrayForTooth( oneN );

				applyCompareHighlights( oneN, twoN );
				updateCompareLRMarkers();
				updateConfirmButtonState();
			}

			function compare(){

				// ENTER compare mode
				if ( compareToggle == false ) {
					compareToggle = true;

					disableCheckbox("jawOpenCheckbox");
					disableButton("isolateButton");

					// Avoid unexpected rotations carried in from jaw view.
					closeJaw();

					// Fresh selection each time compare is entered.
					one = null;
					two = null;
					compareEditSide = null;
					compareTempLeft = null;
					compareTempRight = null;
					hideCompareView();

					document.getElementById("teeth-info-title").innerHTML = "Compare Mode";
					document.getElementById("info").innerHTML = "Select the first tooth.";
					document.getElementById("compareLeft").innerHTML = "";
					document.getElementById("compareRight").innerHTML = "";

					// Selection phase: show the "select two teeth" guidance, reveal the
					// Confirm button (disabled until two teeth are picked), clear badges,
					// and make sure the odontogram is interactive.
					setCompareBanner( COMPARE_BANNER_SELECT );
					updateOdontogramLock();
					updateConfirmButtonState();
					updateCompareLRMarkers();
				}

				// EXIT compare mode
				else {
					compareToggle = false;

					hideCompareView();
					// Free the displayed tooth meshes but KEEP the renderers/contexts
					// alive for fast, churn-free re-entry.
					compareViewers.forEach( function ( v ) { try { v.clearMesh(); v.hideError(); } catch ( e ) {} } );
					restoreCompareBanner();

					one = null;
					two = null;
					compareEditSide = null;
					compareTempLeft = null;
					compareTempRight = null;
					if ( typeof clearTempHighlights === "function" ) clearTempHighlights();

					// ---- Clear EVERY trace of the compare selection so nothing stays
					// highlighted after exiting (3D glow, odontogram sprite + card,
					// and the selection state). The panel returns to "None". ----
					if ( typeof clearAllToothEmissive === "function" ) clearAllToothEmissive();
					selectedToothName = null;
					selectedTooth = null;
					for ( var ci = 1; ci <= 32; ci++ ) {
						if ( toothHighlightSprites[ ci ] ) toothHighlightSprites[ ci ].visible = false;
					}
					if ( baseOdontogramSprite ) baseOdontogramSprite.visible = true;
					if ( typeof clearCardHighlights === "function" ) clearCardHighlights();

					// Hide the Confirm button + L/R badges and restore the odontogram lock
					// state now that compare mode is off.
					updateConfirmButtonState();
					updateCompareLRMarkers();
					updateOdontogramLock();

					document.getElementById("teeth-info-title").innerHTML = "Selected Tooth";
					document.getElementById("info").innerHTML = "None";
					document.getElementById("compareLeft").innerHTML = "";
					document.getElementById("compareRight").innerHTML = "";

					enableCheckbox("jawOpenCheckbox");
					enableButton("isolateButton");

					// Make sure the main model reflects the current visibility toggles.
					applyVisibilityToggles();
				}
			}

			// Legacy no-ops kept for name compatibility. Compare selection is now
			// handled by registerCompareSelection(), driven by the odontogram card
			// and by clicking teeth in the main 3D view.
			function onSelectionOne(){ /* deprecated */ }
			function onSelectionTwo(){ /* deprecated */ }



			
			
			/////////////////////////////////////////////////////////////////////////////////////////
			//// DEVELOPMENT LOBES FUNCTION
			/////////////////////////////////////////////////////////////////////////////////////////
			function devLobes(){

				// The lobe texture only fits the legacy tooth UVs; disabled for v3.
				if (!isFeatureEnabled('devLobes')) return;

				if(selectedTooth == null){

					document.getElementById("info").innerHTML = "Please select a tooth from the odontogram or by clicking on a tooth!";
					return;

				}

				var toothObject = selectedTooth;
				var toothMat = selectedTooth.material;

				var colorMap = new THREE.TextureLoader().load( "./three/examples/textures/devLobes/devLobe_tooth_8.png" );
				
				if(toothMat.map == null){
				toothMat.map = colorMap;
				toothMat.needsUpdate = true;}

				else{

					toothMat.map = null;
					toothMat.needsUpdate = true;
				}


			}





			// HIGHLIGHT OBJECT FUNCTION //////////////////////////////////
			///////////////////////////////////////////////////////////////
			// Selection colours (module-scoped so every helper agrees on them).
			var SELECT_EMISSIVE = new THREE.Color("rgb(0,115,130)");
			var BLACK_EMISSIVE = new THREE.Color(0, 0, 0);

			// Selected-tooth highlight tuning: a transparent, high-opacity teal tooth
			// with a strong inner emission glow so it stands out clearly.
			var SELECT_EMISSIVE_INTENSITY = 2.0;   // strong glow (1.5–2.5 range)
			var SELECT_OPACITY = 0.85;             // high opacity, still slightly see-through

			// Remembers each tooth material's ORIGINAL look the first time it is lit, so
			// the exact original (emissive / transparency / opacity) can be restored when
			// the highlight moves away. Keyed by material uuid.
			var toothMatOriginal = {};

			function rememberToothMat(mat) {
				if (!mat || toothMatOriginal[mat.uuid]) return;
				toothMatOriginal[mat.uuid] = {
					colorHex: mat.color ? mat.color.getHex() : null,
					emissiveHex: mat.emissive ? mat.emissive.getHex() : 0,
					emissiveIntensity: (typeof mat.emissiveIntensity === "number") ? mat.emissiveIntensity : 1,
					transparent: mat.transparent,
					opacity: (typeof mat.opacity === "number") ? mat.opacity : 1
				};
			}

			// Apply the glowing teal selection look to a tooth material.
			function applyToothSelectGlow(mat) {
				if (!mat || !mat.emissive) return;
				rememberToothMat(mat);                 // capture original before changing it
				mat.emissive.set(SELECT_EMISSIVE);
				// Per-model base-colour tint (v3: near-white enamel can't show the glow).
				var tint = getHighlightTint();
				if (tint !== null && mat.color) mat.color.setHex(tint);
				mat.emissiveIntensity = SELECT_EMISSIVE_INTENSITY;
				mat.transparent = true;
				mat.opacity = SELECT_OPACITY;
				mat.needsUpdate = true;
			}

			// Apply the selection glow to every highlightable material of a tooth
			// (legacy: its one mesh; v3: enamel + dentin, never pulp). Returns
			// false if the tooth has nothing that can glow.
			function glowTooth(tooth) {
				var mats = getToothMaterials(tooth, { forHighlight: true })
					.filter(function (m) { return m && m.emissive; });
				mats.forEach(applyToothSelectGlow);
				return mats.length > 0;
			}

			// Restore a tooth material to its saved original look.
			function restoreToothMat(mat) {
				var o = mat && toothMatOriginal[mat.uuid];
				if (!o) return;
				if (mat.emissive) mat.emissive.setHex(o.emissiveHex);
				if (mat.color && o.colorHex !== null) mat.color.setHex(o.colorHex);
				mat.emissiveIntensity = o.emissiveIntensity;
				mat.transparent = o.transparent;
				mat.opacity = o.opacity;
				mat.needsUpdate = true;
			}

			// Clear the teal selection glow from every tooth, restoring each lit tooth's
			// original material (emissive + transparency + opacity). Hover effects (if
			// any) must use a DIFFERENT colour so they never get wiped by selection logic.
			function clearAllToothEmissive() {
				if (!carm) return;
				carm.traverse(function (object) {
					if (object.material && object.material.emissive &&
						object.material.emissive.equals(SELECT_EMISSIVE)) {
						restoreToothMat(object.material);
					}
				});
			}

			/**
			 * Persistent, toggleable selection highlight.
			 *   - Click a tooth        -> highlight it and KEEP it highlighted.
			 *   - Click the same tooth -> deselect (clear the highlight).
			 *   - Click another tooth  -> move the highlight to the new tooth.
			 * The highlight never clears on its own (no timers, no hover reset).
			 * `selectedToothName` is the single source of truth.
			 */
			function highlightObject(name) {
				if (!carm) return;

				// Always start from a clean slate so only one tooth is ever lit.
				clearAllToothEmissive();

				// Re-click on the already-selected tooth => deselect it.
				if (name === selectedToothName) {
					selectedToothName = null;
					return;
				}

				var object = carm.getObjectByName(name);

				// Glowing transparent-teal selection: high opacity, strong emission.
				if (!object || !glowTooth(object)) {
					selectedToothName = null;
					return;
				}
				selectedToothName = name;
				}

			/**
			 * Syncs every selection-driven UI surface (selectedTooth ref, sprite
			 * odontogram, HTML odontogram card, info text, x-ray) to the CURRENT
			 * selection state. Call right after highlightObject(): if the tooth is now
			 * selected it lights everything up; if it was just deselected it clears the
			 * highlights so nothing is left stranded "on".
			 */
			function applySelectionUI(toothNumber){
				var n = parseInt(toothNumber);
				if (selectedToothName){
					selectedTooth = carm ? carm.getObjectByName("tooth_" + n) : null;
					highlightOdontogram(n);
					syncOdontogramCard(n);
				} else {
					// Deselected: clear all highlights, keep last info/x-ray on screen.
					selectedTooth = null;
					for (var i = 1; i <= 32; i++){
						if (toothHighlightSprites[i]) toothHighlightSprites[i].visible = false;
					}
					if (baseOdontogramSprite) baseOdontogramSprite.visible = true;
					var actives = document.querySelectorAll('.odo-highlight.is-active');
					actives.forEach(function(img){ img.classList.remove('is-active'); });
					cardSelectedTooth = null;
				}
			}


			function highlightOdontogram(toothNumber){


			//UN-HIGHLIGHT THE ODONTOGRAM
			for(var i = 1; i <=32; i++)
			{
				if(toothHighlightSprites[i] && toothHighlightSprites[i].visible == true){
				toothHighlightSprites[i].visible = false;}
			}

			if (baseOdontogramSprite) {
				baseOdontogramSprite.visible = true;
			}

			//AND THEN HIGHLIGHT THE TOOTH NUMBER THAT'S SELECTED
			//BY MAKING THAT TOOTH-HIGHLIGHT-PNG VISIBLE
			if (toothHighlightSprites[toothNumber]) {
				toothHighlightSprites[toothNumber].visible = true;
			}


			}

			/////////////////////////////////////////////////////////////////////////
			// COMPARE-MODE DUAL HIGHLIGHTING
			// Unlike the normal single-selection highlightObject(), these keep BOTH
			// selected teeth lit at the same time — the first tooth is never cleared
			// when the second is added. Used only while Compare mode is on.
			/////////////////////////////////////////////////////////////////////////

			// Light both teeth's cyan emissive on the main 3D jaw model. Pass a single
			// tooth (n2 omitted/null) while waiting for the second pick.
			function highlightCompareTeethOnModel(n1, n2){
				if (!carm) return;
				clearAllToothEmissive();
				[n1, n2].forEach(function(num){
					var t = parseInt(num);
					if (!t) return;
					var obj = carm.getObjectByName("tooth_" + t);
					if (obj) glowTooth(obj);
				});
			}

			// Show the highlight sprites for both teeth on the (legacy) 3D odontogram.
			function highlightCompareOdontogramSprites(n1, n2){
				for (var i = 1; i <= 32; i++){
					if (toothHighlightSprites[i]) toothHighlightSprites[i].visible = false;
				}
				if (baseOdontogramSprite) baseOdontogramSprite.visible = true;
				[n1, n2].forEach(function(num){
					var t = parseInt(num);
					if (t && toothHighlightSprites[t]) toothHighlightSprites[t].visible = true;
				});
			}

			// One call to light both teeth EVERYWHERE for compare mode: main 3D model,
			// 3D odontogram sprites, and the HTML odontogram card. Pass a single tooth
			// (n2 omitted/null) for the "first tooth selected, awaiting second" state.
			// Safe to call regardless of whether the split viewers initialise, so the
			// highlight state never depends on WebGL context creation succeeding.
			function applyCompareHighlights(n1, n2){
				var a = parseInt(n1) || null;
				var b = parseInt(n2) || null;
				highlightCompareTeethOnModel(a, b);
				highlightCompareOdontogramSprites(a, b);
				if (a && b){
					if (typeof highlightCardTeethCompare === "function") highlightCardTeethCompare(a, b);
				} else if (a){
					if (typeof highlightCardTooth === "function") highlightCardTooth(a);
				} else {
					// Nothing selected — clear the odontogram card highlights too.
					if (typeof clearCardHighlights === "function") clearCardHighlights();
				}
			}

		




			
			/**
			 * Function to isolate the selected tooth.
			 * @returns true if successful, false if unsuccessful (if no tooth was selected).
			 */
			function isolate() {

				//lastJawRotation.x = lowerJaw.rotation.x;
				jawViewOff();

				unIsolate();
				



				
				if(selectedTooth != null){


				disableCheckbox("compareCheckbox")
				disableCheckbox("jawOpenCheckbox")

				carm.traverse( function( object ) {
			
			



				// Keep every part of the selected tooth (v3: enamel/dentin/pulp).
				if(object.type == "Mesh"
				&& !isPartOfTooth(object, selectedTooth)){

					
					object.visible = false;		



				}

				

			} );

			isolatedTooth = selectedTooth;

			//query world position of the isolated tooth
			//and set cameraLookAt and orbitControls target
			//to this position (tooth pivots sit at the tooth centre; the
			//adapter re-pivots grouped v3 teeth at load)
			var pos = new THREE.Vector3();

			isolatedTooth.getWorldPosition(pos);

			controls.target = pos;
			isolatedTooth.scale.set(3,3,3);
			camera.lookAt(pos);

			var toothNum = parseInt(isolatedTooth.name.substring(6));
			
			// The isolated 3D tooth shows its NATURAL material — clear the cyan
			// selection glow from the model. The odontogram highlight + selection
			// state (selectedToothName) stay intact, and the x-ray is unchanged.
			clearAllToothEmissive();

			// Clean stacked text only — NO bordered detail card (keep #compareLeft
			// empty so CSS collapses it), consistent with the compare-mode cleanup.
			var isoLabel = teethNumSystem[toothNum][3] + " (" + teethNumSystem[toothNum][numSystem] + ")";
			document.getElementById("info").innerHTML =
				isoLabel +
				"<br><br>Tooth: " + isoLabel +
				"<br>Number of Roots: #<br>Number of Canals: #<br>Comments:";
			document.getElementById("compareLeft").innerHTML = "";

			// Hide the Developmental lobe button so the panel stays uncluttered.
			var devBtnIso = document.getElementById("devLobeButton");
			if (devBtnIso) devBtnIso.style.display = "none";

			return true;
			

		}
			else{
				document.getElementById("info").innerHTML = "Please select a tooth from the odontogram or by clicking on a tooth!";

				return false;
				
			}
				


				
			}


			

			function unIsolate() {
			
			//run unisolate only if the user
			//is not in COMPARE mode
			//to avoid unexpected visibility and scale issues
			if(compareToggle == false) {


			carm.traverse( function( object ) {

			if(object.type == "Mesh"
			&& object.name != "curveOfSpee"
			&& object.name != "curveOfWilson"
			&& object.name != "sphereOfMonson"
			&& object.name != "Skin_Nerves"
			&& object.name != "Arteries"
			&& object.name != "Veins"){

				
				object.visible = true;		


			}
			} );

			//lowerJaw.rotation.x = lastJawRotation.x;

			if(isolatedTooth != null){
			controls.target = new THREE.Vector3();
			isolatedTooth.scale.set(1,1,1);
			camera.lookAt(0,0,0);

			document.getElementById("compareLeft").innerHTML = "";

			// Put the clean selected-tooth name back in the info area.
			var isoN = parseInt(isolatedTooth.name.substring(6));
			if (typeof updateInfoForTooth === "function") updateInfoForTooth(isoN);

			// Re-apply the normal selection glow to the (still-selected) tooth now
			// that the full model is restored.
			if (selectedToothName){
				var selObjUn = carm.getObjectByName(selectedToothName);
				if (selObjUn) glowTooth(selObjUn);
			}
			}

			// Restore the Developmental lobe button hidden during isolate.
			var devBtnUn = document.getElementById("devLobeButton");
			if (devBtnUn) devBtnUn.style.display = "";

			enableCheckbox("compareCheckbox")
			enableCheckbox("jawOpenCheckbox")

			// Re-apply the visibility toggles after isolate restores all meshes.
			applyVisibilityToggles();

			}




		//if compare mode is on, display an error.
		else{

			document.getElementById("info").innerHTML = "Un-Isolate cannot work in Compare mode.";

		}
	}




			function openJaw(){

				jawViewOff();


				var lowerJaw = carm.getObjectByName("lowerJawGrp");
				

				lowerJaw.rotation.x = getJawOpenAngle(); // radians, per-model (adapter config)

				lastJawRotation.x = lowerJaw.rotation.x;

				isJawOpen = true;
				
			}


			function closeJaw(){


				jawViewOff();

				if (lowerJaw) restoreJawBaseRotation( lowerJaw );
					
				lastJawRotation.x = lowerJaw ? lowerJaw.rotation.x : 0;
				isJawOpen = false;

			}


			function jawOpenToggle(){

				if (!isJawOpen){

					openJaw();
				}
				else{

					closeJaw();
				}

			}

			/**
			 * Search Functionality
			 */
			var searchBox = document.getElementById("searchBox");
			var resultsList = document.getElementById("resultsList");
			var searchBtn = document.getElementById("searchBtn");
			var closeSearchBtn = document.getElementById("closeSearchBtn");
			var searchResultsDiv = document.getElementById("searchResultsDiv");
			



			searchBox.addEventListener("input", function(e){


				clearResultsList();
				let value = this.value;
				let valueTrim = value.trim();

				

				if (value != ""){

					searchResultsDiv.style.display = "block";
					value = value.toLowerCase()

					populateResults(teethNumSystem.filter(tooth => {
						return tooth[3].toLowerCase().includes(value);
					}))
				}
				else{
					searchResultsDiv.style.display = "none";
				}

			})


			searchBtn.addEventListener("click", function(){


				clearResultsList();
				let value = searchBox.value;
				let valueTrim = value.trim();

				

				if (value != ""){

					searchResultsDiv.style.display = "block";
					value = value.toLowerCase()

					populateResults(teethNumSystem.filter(tooth => {
						return tooth[3].toLowerCase().includes(value);
					}))
				}
				else{
					searchResultsDiv.style.display = "none";
				}
			})


			// The clear (×) button was removed from the search bar UI; guard in case
			// the element isn't present so the rest of the search wiring still runs.
			if ( closeSearchBtn ) {
				closeSearchBtn.addEventListener("click", function(){

					clearResultsList();
					searchBox.value = "";
					searchResultsDiv.style.display = "none";

				});
			}

			function populateResults(results){

			results.forEach(function(item){

				const resultItem = document.createElement('li');

				resultItem.classList.add('result-item');

				const link = document.createElement('a');
				link.innerHTML = item[3] + " (" + item[numSystem] + ")"
				resultItem.onclick = function(){

					var toothName = "tooth_" + item[0]

					// In Compare mode a search pick drives the two-tooth picker (fills
					// the side being edited / first empty slot) exactly like clicking the
					// model or odontogram, and focuses the camera on it.
					if ( typeof compareToggle !== "undefined" && compareToggle ) {
						registerCompareSelection( item[0] );
						focusCameraOnTooth( item[0] );
						clearResultsList();
						searchResultsDiv.style.display = "none";
						return;
					}

					// In Isolate mode a search pick switches the isolated tooth.
					if ( typeof isolateTgl !== "undefined" && isolateTgl ) {
						switchIsolatedTooth( item[0] );
						clearResultsList();
						searchResultsDiv.style.display = "none";
						return;
					}

					// A search pick always SELECTS the tooth (never toggles it off),
					// so force a fresh selection regardless of prior state.
					selectedToothName = null;
					highlightObject(toothName);
					applySelectionUI(item[0]);

					// Smoothly focus the camera on the searched tooth.
					focusCameraOnTooth(item[0]);

					clearResultsList();
					searchResultsDiv.style.display = "none";
					
					

				}

				resultItem.appendChild(link);

				resultsList.append(resultItem);



			})

			}


			function clearResultsList(){
				// looping through each child of the search results list and remove each child
				while (resultsList.firstChild){
					resultsList.removeChild(resultsList.firstChild)
				}
			}


			updateSearchResultsPosition();


			/**
			 * 
			 */

			
			function disableCheckbox(id) {

				document.getElementById(id).style.pointerEvents = "none";
				document.querySelector('[for=' + id + ']').style.color = "grey";
				document.querySelector('[for=' + id + ']').style.pointerEvents = "none";
			}

			function enableCheckbox(id) {

				document.getElementById(id).style.pointerEvents = "all";
				document.querySelector('[for=' + id + ']').style.color = "";
				document.querySelector('[for=' + id + ']').style.pointerEvents = "all";
			}

			function disableButton(id){


				document.getElementById(id).style.pointerEvents = "none";
				document.getElementById(id).style.opacity = "0.5";
				

			}

			function enableButton(id){

				document.getElementById(id).style.pointerEvents = "all";
				document.getElementById(id).style.opacity = "1";

			}




			function onWindowResize() {

				if ( !renderer || !camera ) return;

				// Measure the canvas's actual displayed size (driven by the CSS),
				// then resize the renderer buffer and update the camera to match.
				var canvasEl = renderer.domElement;
				var width = canvasEl.clientWidth || container.clientWidth;
				var height = canvasEl.clientHeight || container.clientHeight;
				if ( !width || !height ) return;

				camera.aspect = width / height;
				camera.updateProjectionMatrix();

				renderer.setPixelRatio( Math.min( window.devicePixelRatio || 1, 2 ) );
				renderer.setSize( width, height, false );
				if ( controls ) controls.update();

				updateSearchResultsPosition();

			}

			//

			

			function animate() {

				requestAnimationFrame( animate );


				if(!params.turntable){
				render();}
				else{
					rotateCam();
				}

			}

			function render() {

				// While the compare split is shown, the main canvas is hidden behind
				// it and the two compare viewers drive their own render loops.
				if ( compareActive ) return;

				renderer.render( scene1, camera );

				if(lowerJaw){
				//console.log(lowerJaw.rotation.x)
				}

			}

			function rotateCam(){

				if ( compareActive ) return;

				const timer = Date.now() * 0.0001;



				camera.position.x = Math.cos( timer ) * 800;
				camera.position.y = 100;
				camera.position.z = Math.sin( timer ) * 800;



				camera.lookAt( 0,0,0);

				renderer.render( scene1, camera );

			}


			/////////////////////////////////////////////////////////////////////////////////////////
			//// HTML ODONTOGRAM CARD (real, clickable) — replaces the floating sprite odontogram
			/////////////////////////////////////////////////////////////////////////////////////////

			/**
			 * Highlights a single tooth on the HTML odontogram card and clears the rest.
			 */
			function highlightCardTooth(toothNumber){
				cardSelectedTooth = parseInt(toothNumber);
				var imgs = document.querySelectorAll('.odo-highlight');
				imgs.forEach(function(img){
					var t = parseInt(img.getAttribute('data-tooth'));
					if (t === cardSelectedTooth){
						img.classList.add('is-active');
					} else {
						img.classList.remove('is-active');
					}
				});
			}

			/**
			 * Highlights TWO teeth on the HTML odontogram card simultaneously.
			 * Used during Compare mode so both selected teeth are visible.
			 */
			function highlightCardTeethCompare(n1, n2){
				var t1 = parseInt(n1);
				var t2 = parseInt(n2);
				var imgs = document.querySelectorAll('.odo-highlight');
				imgs.forEach(function(img){
					var t = parseInt(img.getAttribute('data-tooth'));
					if (t === t1 || t === t2){
						img.classList.add('is-active');
					} else {
						img.classList.remove('is-active');
					}
				});
			}

			/**
			 * Clears ALL odontogram card highlights (used when exiting compare mode).
			 */
			function clearCardHighlights(){
				var imgs = document.querySelectorAll('.odo-highlight');
				imgs.forEach(function(img){
					img.classList.remove('is-active');
				});
				cardSelectedTooth = null;
			}

			/**
			 * Updates the Information panel text for the given tooth, using the
			 * currently selected numbering system.
			 */
			function updateInfoForTooth(toothNumber){
				var n = parseInt(toothNumber);
				if (!n || n < 1 || n > 32 || !teethNumSystem[n]) return;

				var infoEl = document.getElementById("info");
				if (infoEl){
					var sys = (numSystem === 1 || numSystem === 2) ? numSystem : 0;
					infoEl.innerHTML = teethNumSystem[n][3] + " (" + teethNumSystem[n][sys] + ")";
				}

				var titleEl = document.getElementById("teeth-info-title");
				var inCompare = (typeof compareToggle !== "undefined" && compareToggle === true);
				if (titleEl && !inCompare){
					titleEl.innerHTML = "Selected Tooth";
				}
			}

			/**
			 * Updates the X-ray panel (and modal) image for the given tooth.
			 */
			function updateXrayForTooth(toothNumber){
				var src = "./three/examples/textures/xrays/xray-" + parseInt(toothNumber) + ".png";
				if (xrayImg){ xrayImg.src = src; }
				var modalImg = document.getElementById("xrayModalImage");
				if (modalImg){ modalImg.src = src; }
			}

			/**
			 * Mirrors a selection (made anywhere) onto the HTML card: highlight,
			 * info text, and x-ray. Safe to call before the 3D model has loaded.
			 */
			function syncOdontogramCard(toothNumber){
				var n = parseInt(toothNumber);
				if (!n || n < 1 || n > 32) return;
				highlightCardTooth(n);
				updateInfoForTooth(n);
				updateXrayForTooth(n);
			}

			/**
			 * While isolate mode is ON, switch the isolated tooth to `n`: make it the
			 * active selection, re-isolate to it (restores the previous tooth, hides the
			 * rest, scales + centres the new one), refresh the odontogram highlight and
			 * x-ray, and smoothly focus the camera on it. The Isolate button stays in its
			 * "Un-isolate" state throughout.
			 */
			function switchIsolatedTooth(n){
				n = parseInt(n);
				if (!n || n < 1 || n > 32 || !carm) return;
				var obj = carm.getObjectByName("tooth_" + n);
				if (!obj) return;

				// Make the picked tooth the active selection BEFORE re-isolating, since
				// isolate() works off selectedTooth.
				selectedToothName = "tooth_" + n;
				selectedTooth = obj;

				// Re-isolate to the new tooth (restores the old one, hides the rest,
				// scales + centres the new one, and rewrites the Information panel text).
				isolate();

				// Refresh the odontogram (sprite + card) highlight and the x-ray AFTER
				// isolate() so nothing inside it overrides them.
				if (typeof highlightOdontogram === "function") highlightOdontogram(n);
				if (typeof highlightCardTooth === "function") highlightCardTooth(n);
				if (typeof updateXrayForTooth === "function") updateXrayForTooth(n);

				// Smoothly move the camera to the newly isolated tooth. The isolated
				// tooth is enlarged (3x) and shown alone, so frame it tighter than the
				// normal full-arch focus.
				focusCameraOnTooth(n, { fill: 2.2, minDist: 120 });
			}

			/**
			 * Full selection triggered by clicking a tooth on the HTML card:
			 * selects the matching 3D mesh, flashes it, and syncs the card UI.
			 */
			function selectToothFromCard(toothNumber){
				var n = parseInt(toothNumber);
				if (!n || n < 1 || n > 32) return;

				var name = "tooth_" + n;
				var inCompare = (typeof compareToggle !== "undefined" && compareToggle === true);

				// In compare mode, DON'T run the single-selection highlight (it would
				// clear the first tooth). registerCompareSelection() owns the dual
				// highlight, the info/x-ray text, and the L/R badges so both teeth stay
				// consistent — let it drive everything.
				if (inCompare){
					registerCompareSelection(n);
					return;
				}

				// In isolate mode, switch the isolated tooth to the newly picked one
				// (selection + re-isolate + camera focus) instead of a normal selection.
				if (isolateTgl){
					switchIsolatedTooth(n);
					return;
				}

				// Normal mode: toggle the matching 3D tooth's persistent highlight.
				if (typeof carm !== "undefined" && carm){
					var obj = carm.getObjectByName(name);
					if (obj){
						highlightObject(name);
					}
				}

				// Normal mode: sync (or clear, on a re-click deselect) every surface.
				applySelectionUI(n);

				// Smoothly focus the camera on the selected tooth (not on deselect).
				if (selectedToothName) focusCameraOnTooth(n);

				// Dismiss the intro hint once the user makes a selection.
				var msg = document.getElementById("sceneMessage");
				if (msg && selectedToothName){ msg.style.display = "none"; }
			}

			/**
			 * Builds the clickable hotspots + highlight overlays over the card art,
			 * and wires the numbering-system radios to swap the artwork.
			 */
			function initOdontogramCard(){
				var card = document.getElementById("odontogramCard");
				var layer = document.getElementById("odoLayer");
				var baseImg = document.getElementById("odoBaseImg");
				if (!card || !layer || !baseImg) return;

				// Build the 32 highlight overlays + hotspots from the shared regions.
				for (var i = 1; i <= 32; i++){
					var r = ODONTOGRAM_REGIONS[i];
					if (!r) continue;

					var leftPct = (r[0] / ODONTOGRAM_IMG_W) * 100;
					var topPct  = (r[2] / ODONTOGRAM_IMG_H) * 100;
					var wPct    = ((r[1] - r[0]) / ODONTOGRAM_IMG_W) * 100;
					var hPct    = ((r[3] - r[2]) / ODONTOGRAM_IMG_H) * 100;

					// cyan highlight overlay (normalized to the full art size)
					var hl = document.createElement("img");
					hl.className = "odo-highlight";
					hl.setAttribute("data-tooth", i);
					hl.setAttribute("alt", "");
					hl.src = "./three/examples/textures/tooth_selection_norm/tooth_" + i + ".png";
					layer.appendChild(hl);

					// clickable hotspot
					var btn = document.createElement("button");
					btn.type = "button";
					btn.className = "odo-hotspot";
					btn.setAttribute("data-tooth", i);
					btn.setAttribute("aria-label", "Select tooth " + i);
					btn.style.left = leftPct + "%";
					btn.style.top = topPct + "%";
					btn.style.width = wPct + "%";
					btn.style.height = hPct + "%";

					(function(toothNum){
						btn.addEventListener("click", function(e){
							e.preventDefault();
							e.stopPropagation();
							selectToothFromCard(toothNum);
						});
					})(i);

					layer.appendChild(btn);
				}

				// Pending (temporary) selection outlines — one per side. Shown over a
				// tooth the user has staged for that side of an open comparison, before
				// Confirm. Both can be visible at once (left + right staged together).
				["L", "R"].forEach(function(side){
					var temp = document.createElement("div");
					temp.id = "odoTempHighlight" + side;
					temp.className = "odo-temp-highlight odo-temp-highlight--" + side.toLowerCase();
					temp.setAttribute("aria-hidden", "true");
					temp.style.display = "none";
					layer.appendChild(temp);
				});

				// Compare-mode L/R badges. These float over the selected teeth on the
				// card (first pick = L, second = R) and are positioned/shown by
				// updateCompareLRMarkers(). While the split is open they are CLICKABLE:
				// clicking one selects that side for editing. Hidden until compare mode
				// assigns teeth.
				["L", "R"].forEach(function(side){
					var m = document.createElement("button");
					m.type = "button";
					m.id = "odoMarker" + side;
					m.className = "odo-lr-marker odo-lr-marker--" + side.toLowerCase();
					m.textContent = side;
					m.setAttribute("aria-label", "Edit " + (side === "L" ? "left" : "right") + " comparison tooth");
					m.style.display = "none";
					m.addEventListener("click", function(e){
						e.preventDefault();
						e.stopPropagation();
						if (typeof compareToggle === "undefined" || !compareToggle) return;
						if (compareActive){
							// PHASE B: edit the confirmed side in the open split.
							beginCompareEdit(side);
						} else {
							// PHASE A: choose which pending selection (first/second) to change.
							compareEditSide = side;
							refreshPhaseASelectionUI();
						}
					});
					layer.appendChild(m);
				});

				// Wire the "Confirm selection" button: PHASE A opens the split for the
				// chosen pair; PHASE B applies the staged left/right edit.
				var confirmBtn = document.getElementById("compareConfirmBtn");
				if (confirmBtn){
					confirmBtn.addEventListener("click", function(e){
						e.preventDefault();
						e.stopPropagation();
						confirmCompareSelection();
					});
				}

				// Isolate the card from the document-level 3D selection handlers so a
				// click on the card never also raycasts into the model behind it.
				["mousedown", "touchstart", "pointerdown"].forEach(function(evt){
					card.addEventListener(evt, function(e){ e.stopPropagation(); });
				});

				// Numbering-system radios swap the card artwork and refresh the label.
				["universal", "palmer", "fdi", "hideNum"].forEach(function(id){
					var el = document.getElementById(id);
					if (!el) return;
					el.addEventListener("change", function(){
						if (!this.checked) return;
						if (ODONTOGRAM_IMAGES[id]){ baseImg.src = ODONTOGRAM_IMAGES[id]; }
						if (cardSelectedTooth){ updateInfoForTooth(cardSelectedTooth); }
					});
				});
			}

			initOdontogramCard();
			function updateSearchResultsPosition() {

				if ( !searchBox || !searchResultsDiv ) return;

				var anchor = searchBox.closest( '.search-field' ) || searchBox;
				var rect = anchor.getBoundingClientRect();
				var gutter = window.innerWidth <= 640 ? 12 : 16;
				var width = Math.min( rect.width, window.innerWidth - ( gutter * 2 ) );
				var left = Math.min( Math.max( rect.left, gutter ), window.innerWidth - width - gutter );

				searchResultsDiv.style.left = left.toString() + "px";
				searchResultsDiv.style.top = Math.round( rect.bottom + 8 ).toString() + "px";
				searchResultsDiv.style.width = Math.round( width ).toString() + "px";

			}

			// Local test/inspection hook used by the browser e2e tests. Only created
			// with ?debug on localhost; exposes live scene/selection references and
			// pure helpers (no app actions, no credentials or server data).
			if ( /[?&]debug\b/.test( window.location.search ) &&
				/^(localhost|127\.0\.0\.1|\[::1\])$/.test( window.location.hostname ) ) {
				window.__dental = Object.freeze( {
					model: ACTIVE_MODEL,
					THREE: THREE,
					get carm() { return carm; },
					get camera() { return camera; },
					get controls() { return controls; },
					get renderer() { return renderer; },
					get selectedToothName() { return selectedToothName; },
					get selectedTooth() { return selectedTooth; },
					get isolateTgl() { return isolateTgl; },
					get compareActive() { return compareActive; },
					get compareViewers() { return compareViewers; },
					getToothMaterials: getToothMaterials,
					getToothCenter: getToothCenter
				} );
			}
