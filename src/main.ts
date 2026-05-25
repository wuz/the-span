import * as THREE from "three";

import { CompositionShader } from "./shaders/CompositionShader";
import {
  BASE_LAYER,
  BLOOM_LAYER,
  BLOOM_PARAMS,
  OVERLAY_LAYER,
} from "./config/renderConfig.js";

// Rendering
import { MapControls } from 'three/examples/jsm/controls/MapControls';
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { GUI } from 'dat.gui'
import { Galaxy } from "./galaxy";


let canvas: HTMLCanvasElement | null,
  renderer: THREE.Renderer,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  orbit: THREE.MapControls,
  baseComposer: THREE.EffectComposer,
  bloomComposer: THREE.EffectComposer,
  overlayComposer: THREE.EffectComposer,
  cameraFolder: GUI,
  gui: GUI;

function initThree() {
  // grab canvas
  canvas = document.querySelector("#canvas");
  

  // scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xebe2db, 0.00003);

  // camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    5000000
  );
  camera.position.set(450, -500, 650);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);

  // map orbit
  orbit = new MapControls(camera, canvas);
  orbit.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
  orbit.dampingFactor = 0.05;
  orbit.screenSpacePanning = false;
  orbit.minDistance = 1;
  orbit.maxDistance = 16384;
  orbit.maxPolarAngle = Math.PI / 2 - Math.PI / 360;

  gui = new GUI();
  gui.close();
  cameraFolder = gui.addFolder("Camera");
  cameraFolder.add(camera.position, "x", -1000, 1000).listen();
  cameraFolder.add(camera.position, "y", -1000, 1000).listen();
  cameraFolder.add(camera.position, "z", -1000, 1000).listen();

  initRenderPipeline();
}

function animate() {
  orbit.update();
  renderer.render( scene, camera );
}

function initRenderPipeline() {
  // Assign Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas,
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setAnimationLoop(animate);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;

  // General-use rendering pass for chaining
  const renderScene = new RenderPass(scene, camera);

  // Rendering pass for bloom
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = BLOOM_PARAMS.bloomThreshold;
  bloomPass.strength = BLOOM_PARAMS.bloomStrength;
  bloomPass.radius = BLOOM_PARAMS.bloomRadius;

  // bloom composer
  bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  // overlay composer
  overlayComposer = new EffectComposer(renderer);
  overlayComposer.renderToScreen = false;
  overlayComposer.addPass(renderScene);

  // Shader pass to combine base layer, bloom, and overlay layers
  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
        overlayTexture: { value: overlayComposer.renderTarget2.texture },
      },
      vertexShader: CompositionShader.vertex,
      fragmentShader: CompositionShader.fragment,
      defines: {},
    }),
    "baseTexture"
  );
  finalPass.needsSwap = true;

  // base layer composer
  baseComposer = new EffectComposer(renderer);
  baseComposer.addPass(renderScene);
  baseComposer.addPass(finalPass);
}

function resizeRendererToDisplaySize(renderer: THREE.Renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

async function render() {
  orbit.update();

  // fix buffer size
  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  // fix aspect ratio
  const canvas = renderer.domElement;
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();

  galaxy.stars.forEach((star) => {
    star.updateScale(camera);
  });

  galaxy.haze.forEach((haze) => {
    haze.updateScale(camera);
  });

  // Run each pass of the render pipeline
  renderPipeline();

  requestAnimationFrame(render);
}

function renderPipeline() {
  // Render bloom
  camera.layers.set(BLOOM_LAYER);
  bloomComposer.render();

  // Render overlays
  camera.layers.set(OVERLAY_LAYER);
  overlayComposer.render();

  // Render normal
  camera.layers.set(BASE_LAYER);
  baseComposer.render();
}

initThree();

let galaxy = new Galaxy(scene, gui);

requestAnimationFrame(render);
