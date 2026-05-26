import * as THREE from "three";
import { gaussianRandom, spiral } from "./utils";
import type { GUI } from "dat.gui";
import { ZoneMap } from "./sectors";

export const starTypes = {
  percentage: [76.45, 12.1, 7.6, 3.0, 0.6, 0.13],
  color:      [0xdbf656, 0xffd2a1, 0xfff4ea, 0xf8f7ff, 0xcad7ff, 0xaabfff],
  size:       [0.7,     0.7,     1.15,    1.48,    2.0,     2.5],
};

function pickStarType(): number {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < starTypes.percentage.length; i++) {
    cumulative += starTypes.percentage[i];
    if (rand < cumulative) return i;
  }
  return starTypes.percentage.length - 1;
}

function createStarTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;

  // Wide soft outer glow
  const outerGlow = ctx.createRadialGradient(center, center, 0, center, center, center);
  outerGlow.addColorStop(0,   "rgba(255, 255, 255, 0.4)");
  outerGlow.addColorStop(0.4, "rgba(255, 255, 255, 0.15)");
  outerGlow.addColorStop(1.0, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = outerGlow;
  ctx.fillRect(0, 0, size, size);

  // Tight bright core
  const core = ctx.createRadialGradient(center, center, 0, center, center, center * 0.25);
  core.addColorStop(0,   "rgba(255, 255, 255, 1)");
  core.addColorStop(0.5, "rgba(255, 255, 255, 0.8)");
  core.addColorStop(1.0, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

export class Galaxy {
  scene: THREE.Scene;
  gui: GUI;

  /** Rotate this in the animation loop. Stars AND zones live inside it. */
  public group = new THREE.Group();

  private starPointsMeshes: THREE.Points[] = [];
  private hazePoints: THREE.Points | null = null;
  private starTexture: THREE.Texture = createStarTexture();
  private bloomLayer: number | null = null;

  private zoneMap: ZoneMap | null = null;

  controls: {
    numStars: number;
    arms: number;
    galaxyThickness: number;
    coreXDist: number;
    coreYDist: number;
    outerCoreXDist: number;
    outerCoreYDist: number;
    armXDist: number;
    armYDist: number;
    armXMean: number;
    armYMean: number;
    spiral: number;
  };

  constructor(scene: THREE.Scene, gui: GUI) {
    this.scene = scene;
    this.gui = gui;
    this.scene.add(this.group);

    this.controls = {
      numStars: 25000,
      arms: 1,
      galaxyThickness: 3.0,
      coreXDist: 50,
      coreYDist: 50,
      outerCoreXDist: 30,
      outerCoreYDist: 30,
      armXDist: 75,
      armYDist: 40,
      armXMean: 100,
      armYMean: 5,
      spiral: 0.8,
    };

    const regenerate = this.debounce(() => this.generateStars(), 150);

    const galaxyFolder = this.gui.addFolder("Galaxy");
    galaxyFolder.add(this.controls, "numStars", 10000, 50000, 250).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "arms", 1, 10, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "galaxyThickness", 1, 10, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "coreXDist", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "coreYDist", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "outerCoreXDist", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "outerCoreYDist", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "armXDist", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "armYDist", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "armXMean", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "armYMean", 5, 300, 1).onChange(regenerate).listen();
    galaxyFolder.add(this.controls, "spiral", 0.1, 5, 0.1).onChange(regenerate).listen();
    galaxyFolder.open();

    this.generateStars();
    this.generateSectors();
  }

  private debounce(fn: () => void, delay: number) {
    let timer: ReturnType<typeof setTimeout>;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  enableBloom(layer: number) {
    this.bloomLayer = layer;
    this.applyBloom();
  }

  private applyBloom() {
    if (this.bloomLayer === null) return;
    for (const mesh of this.starPointsMeshes) {
      mesh.layers.enable(this.bloomLayer);
    }
    if (this.hazePoints) {
      this.hazePoints.layers.enable(this.bloomLayer);
    }
  }

  generateSectors() {
    this.zoneMap?.removeObject();
    this.zoneMap = new ZoneMap(this.gui); // ← pass gui here
    this.zoneMap.toThreeObject(this.group);
  }

  generateStars() {
    for (const mesh of this.starPointsMeshes) {
      this.group.remove(mesh);
      (mesh.geometry as THREE.BufferGeometry).dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.starPointsMeshes = [];

    if (this.hazePoints) {
      this.group.remove(this.hazePoints);
      (this.hazePoints.geometry as THREE.BufferGeometry).dispose();
      (this.hazePoints.material as THREE.Material).dispose();
      this.hazePoints = null;
    }

    const positionsByType: number[][] = starTypes.percentage.map(() => []);
    const hazePositions: number[] = [];

    const {
      numStars, arms, galaxyThickness,
      coreXDist, coreYDist, outerCoreXDist, outerCoreYDist,
      armXDist, armYDist, armXMean, armYMean, spiral: spiralVal,
    } = this.controls;

    for (let i = 0; i < numStars / 4; i++) {
      positionsByType[pickStarType()].push(
        gaussianRandom(0, coreXDist),
        gaussianRandom(0, coreYDist),
        gaussianRandom(0, galaxyThickness)
      );
      positionsByType[pickStarType()].push(
        gaussianRandom(0, outerCoreXDist),
        gaussianRandom(0, outerCoreYDist),
        gaussianRandom(0, galaxyThickness)
      );
      for (let j = 0; j < arms; j++) {
        const pos = spiral(
          gaussianRandom(armXMean, armXDist),
          gaussianRandom(armYMean, armYDist),
          gaussianRandom(0, galaxyThickness),
          (j * 2 * Math.PI) / arms,
          armXDist,
          spiralVal
        );
        positionsByType[pickStarType()].push(pos.x, pos.y, pos.z);
        hazePositions.push(pos.x, pos.y, pos.z);
      }
    }

    starTypes.percentage.forEach((_, typeIndex) => {
      const positions = positionsByType[typeIndex];
      if (positions.length === 0) return;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        color: starTypes.color[typeIndex],
        size: starTypes.size[typeIndex] * 4,
        sizeAttenuation: true,
        map: this.starTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const mesh = new THREE.Points(geo, mat);
      this.group.add(mesh);
      this.starPointsMeshes.push(mesh);
    });

    if (hazePositions.length > 0) {
      const hazeGeo = new THREE.BufferGeometry();
      hazeGeo.setAttribute("position", new THREE.Float32BufferAttribute(hazePositions, 3));

      const hazeMat = new THREE.PointsMaterial({
        color: 0x334466,
        size: 6.0,
        sizeAttenuation: true,
        map: this.starTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.3,
      });

      this.hazePoints = new THREE.Points(hazeGeo, hazeMat);
      this.group.add(this.hazePoints);
    }

    this.applyBloom();
  }

  dispose() {
    this.zoneMap?.removeObject();
    this.starTexture.dispose();
  }
}
