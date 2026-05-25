import * as THREE from "three";
import { Star } from "./star";
import { gaussianRandom, spiral } from "./utils";
import { Haze } from "./haze";
import type { GUI } from "dat.gui"; 
import { Sector } from "./sectors";

//galaxy class
export class Galaxy {
  stars: Star[] = [];
  haze: Haze[] = [];
  scene: THREE.Scene;
  gui: GUI;
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
    this.controls = {
      numStars: 8000,
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
    const galaxyFolder = this.gui.addFolder('Galaxy');
    galaxyFolder.add(this.controls, 'numStars', 3000, 20000, 250).onChange(() => {
      this.generateStars();
    }).listen();
    galaxyFolder.add(this.controls, 'arms', 1, 10, 1).onChange(() => {
      this.generateStars();
    }).listen();
    galaxyFolder.add(this.controls, 'galaxyThickness', 1, 10, 1).onChange(() => {
      this.generateStars();
    }).listen();

    galaxyFolder.add(this.controls, 'coreXDist', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();
    galaxyFolder.add(this.controls, 'coreYDist', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();

    galaxyFolder.add(this.controls, 'outerCoreXDist', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();
    galaxyFolder.add(this.controls, 'outerCoreYDist', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();

    galaxyFolder.add(this.controls, 'armXDist', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();
    galaxyFolder.add(this.controls, 'armYDist', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();

    galaxyFolder.add(this.controls, 'armXMean', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();
    galaxyFolder.add(this.controls, 'armYMean', 5, 300, 1).onChange(() => {
      this.generateStars();
    }).listen();

    galaxyFolder.add(this.controls, 'spiral', 0.1, 5, 0.1).onChange(() => {
      this.generateStars();
    }).listen();

    galaxyFolder.open()
    this.generateStars();
    this.generateSectors();
  }
  generateSectors() {
    const triangleShape = new THREE.Shape()
    .moveTo( 8000, 2000 )
    .lineTo( 4000, 8000 )
    .lineTo( 12000, 8000 )
    .lineTo( 8000, 2000 );
    const position = new THREE.Vector3(0, 0, 0);
    const sector = new Sector("Authority", position, triangleShape);
    sector.toThreeObject(this.scene)
  }
  updateScale(camera: THREE.Camera) {
    this.stars.forEach((star) => {
      star.updateScale(camera);
    });

    this.haze.forEach((haze) => {
      haze.updateScale(camera);
    });
  }
  generateStars() {
    this.stars.forEach((star) => star.removeObject());
    this.haze.forEach((h) => h.removeObject());
    let stars = [];
    let hazes = [];

    for (let i = 0; i < this.controls.numStars / 4; i++) {
      let pos = new THREE.Vector3(
        gaussianRandom(0, this.controls.coreXDist),
        gaussianRandom(0, this.controls.coreYDist),
        gaussianRandom(0, this.controls.galaxyThickness)
      );
      let star = new Star(pos);
      stars.push(star);
      let haze = new Haze(pos);
      hazes.push(haze);
    }

    for (let i = 0; i < this.controls.numStars / 4; i++) {
      let pos = new THREE.Vector3(
        gaussianRandom(0, this.controls.outerCoreXDist),
        gaussianRandom(0, this.controls.outerCoreYDist),
        gaussianRandom(0, this.controls.galaxyThickness)
      );
      let star = new Star(pos);
      stars.push(star);
      let haze = new Haze(pos);
      hazes.push(haze);
    }

    for (let j = 0; j < this.controls.arms; j++) {
      for (let i = 0; i < this.controls.numStars / 4; i++) {
        let pos = spiral(
          gaussianRandom(this.controls.armXMean, this.controls.armXDist),
          gaussianRandom(this.controls.armYMean, this.controls.armYDist),
          gaussianRandom(0, this.controls.galaxyThickness),
          (j * 2 * Math.PI) / this.controls.arms,
          this.controls.armXDist,
          this.controls.spiral,
        );
        let star = new Star(pos);
        stars.push(star);
        let haze = new Haze(pos);
        hazes.push(haze);
      }
    }

    this.stars = stars;
    this.stars.forEach((star) => star.toThreeObject(this.scene));
  }
}
