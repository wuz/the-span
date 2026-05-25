import * as THREE from "three";
import { BLOOM_LAYER, STAR_MAX, STAR_MIN } from "./config/renderConfig";
import { starTypes } from "./config/starDis";
import { clamp } from "./utils";

import sprite120 from "url:./resources/sprite120.png";

const texture = new THREE.TextureLoader().load(sprite120);
const material = new THREE.SpriteMaterial({ map: texture, color: "#fff" });
const materials = starTypes.color.map(
  (color) => new THREE.SpriteMaterial({ map: texture, color: color })
);

export class Star {
  obj: THREE.Object3D;
  constructor(position) {
    this.position = position;
    this.starType = this.generateStarType();
    this.obj = null;
  }

  generateStarType() {
    let num = Math.random() * 100;
    let pct = starTypes.percentage;
    for (let i = 0; i < pct.length; i++) {
      num -= pct[i];
      if (num < 0) {
        return i;
      }
    }
    return 0;
  }

  updateScale(camera) {
    let dist = this.position.distanceTo(camera.position) / 250;
    //star size
    let starSize = dist * starTypes.size[this.starType];
    starSize = clamp(starSize, STAR_MIN, STAR_MAX);
    this.obj.scale.copy(new THREE.Vector3(starSize, starSize, starSize));
  }

  removeObject() {
    if (!(this.obj instanceof THREE.Object3D)) return false;

    // for better memory management and performance
    if (this.obj.geometry) this.obj.geometry.dispose();

    if (this.obj.material) {
        if (this.obj.material instanceof Array) {
            // for better memory management and performance
            this.obj.material.forEach(material => material.dispose());
        } else {
            // for better memory management and performance
            this.obj.material.dispose();
        }
    }
    this.obj.removeFromParent(); // the parent might be the scene or another Object3D, but it is sure to be removed this way
    return true;
}

  toThreeObject(scene) {
    let star = new THREE.Sprite(materials[this.starType]);
    star.layers.set(BLOOM_LAYER);
    star.scale.multiplyScalar(starTypes.size[this.starType]);
    star.position.copy(this.position);

    this.obj = star;

    scene.add(star);
  }
}
