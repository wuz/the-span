import * as THREE from "three";
import { CompositionShader } from "./shaders/CompositionShader";
import {
  BASE_LAYER,
  BLOOM_LAYER,
  BLOOM_PARAMS,
  OVERLAY_LAYER,
} from "./config/renderConfig.js";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { GUI } from "dat.gui";
import { Galaxy } from "./galaxy";

let canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  orbit: MapControls,
  baseComposer: EffectComposer,
  bloomComposer: EffectComposer,
  overlayComposer: EffectComposer,
  bloomPass: UnrealBloomPass,
  galaxy: Galaxy,
  gui: GUI;

const clock = new THREE.Clock();

/** Controls exposed to the GUI for live tuning */
const renderControls = {
  bloomStrength: BLOOM_PARAMS.bloomStrength,
  bloomRadius: BLOOM_PARAMS.bloomRadius,
  bloomThreshold: BLOOM_PARAMS.bloomThreshold,
  rotationSpeed: 0.02, // radians per second
};

function initThree() {
  canvas = document.querySelector("#canvas")!;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xebe2db, 0.00003);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    5000000
  );
  camera.position.set(450, -500, 650);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);

  orbit = new MapControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.05;
  orbit.screenSpacePanning = false;
  orbit.minDistance = 1;
  orbit.maxDistance = 16384;
  orbit.maxPolarAngle = Math.PI / 2 - Math.PI / 360;

  gui = new GUI();
  gui.close();

  const cameraFolder = gui.addFolder("Camera");
  cameraFolder.add(camera.position, "x", -1000, 1000).listen();
  cameraFolder.add(camera.position, "y", -1000, 1000).listen();
  cameraFolder.add(camera.position, "z", -1000, 1000).listen();

  // Live bloom tuning
  const bloomFolder = gui.addFolder("Bloom");
  bloomFolder
    .add(renderControls, "bloomStrength", 0, 5, 0.05)
    .listen()
    .onChange((v: number) => { bloomPass.strength = v; });
  bloomFolder
    .add(renderControls, "bloomRadius", 0, 2, 0.05)
    .listen()
    .onChange((v: number) => { bloomPass.radius = v; });
  bloomFolder
    .add(renderControls, "bloomThreshold", 0, 1, 0.01)
    .listen()
    .onChange((v: number) => { bloomPass.threshold = v; });

  // Rotation speed tuning
  const animFolder = gui.addFolder("Animation");
  animFolder.add(renderControls, "rotationSpeed", 0, 0.2, 0.001).listen();

  initRenderPipeline();
  setupScreenshot();

  // Create galaxy and enable bloom on all its star meshes
  galaxy = new Galaxy(scene, gui);
  galaxy.enableBloom(BLOOM_LAYER);

  // Single unified animation loop — replaces both the old animate() and render()
  renderer.setAnimationLoop(animate);
}

function animate() {
  const delta = clock.getDelta();

  orbit.update();

  // Rotate the galaxy group around Z (the "up" axis in this scene)
  // Stars in the group spin; sectors added directly to scene stay fixed
  galaxy.group.rotation.z -= renderControls.rotationSpeed * delta;

  handleResize();
  renderPipeline();
}

function renderPipeline() {
  // 1. Render only BLOOM_LAYER objects → bloom texture
  camera.layers.set(BLOOM_LAYER);
  bloomComposer.render();

  // 2. Render only OVERLAY_LAYER objects → overlay texture
  camera.layers.set(OVERLAY_LAYER);
  overlayComposer.render();

  // 3. Render BASE_LAYER and composite bloom + overlay on top
  camera.layers.set(BASE_LAYER);
  baseComposer.render();
}

function handleResize() {
  const el = renderer.domElement;
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (el.width !== width || el.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function initRenderPipeline() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas,
    logarithmicDepthBuffer: true,
    preserveDrawingBuffer: true, // required for screenshot canvas.toBlob()
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;

  const renderScene = new RenderPass(scene, camera);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM_PARAMS.bloomStrength,
    BLOOM_PARAMS.bloomRadius,
    BLOOM_PARAMS.bloomThreshold
  );

  bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  overlayComposer = new EffectComposer(renderer);
  overlayComposer.renderToScreen = false;
  overlayComposer.addPass(renderScene);

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

  baseComposer = new EffectComposer(renderer);
  baseComposer.addPass(renderScene);
  baseComposer.addPass(finalPass);
}

function setupScreenshot() {
  const elem = document.querySelector("#screenshot");
  elem?.addEventListener("click", () => {
    renderPipeline(); // ensure latest frame is in buffer
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style.display = "none";
      const fileName = `screencapture-${canvas.width}x${canvas.height}.png`;
      a.href = window.URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      a.parentElement?.removeChild(a);
    });
  });
}

initThree();
