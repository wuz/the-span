import {
  BASE_LAYER,
  HAZE_MAX,
  HAZE_MIN,
  HAZE_OPACITY,
} from "./config/renderConfig";
import { clamp } from "./utils";
import * as THREE from "three";

import feathered60 from "url:./resources/feathered60.png"

const hazeTexture = new THREE.TextureLoader().load(feathered60);
const hazeSprite = new THREE.SpriteMaterial({
  map: hazeTexture,
  color: 0x0082ff,
  opacity: HAZE_OPACITY,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

export class Haze {
  obj: THREE.Object3D;
  constructor(position) {
    this.position = position;
    this.obj = null;
  }

  updateScale(camera) {
    let dist = this.position.distanceTo(camera.position) / 250;
    this.obj.material.opacity = clamp(
      HAZE_OPACITY * Math.pow(dist / 2.5, 2),
      0,
      HAZE_OPACITY
    );
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
    let haze = new THREE.Sprite(hazeSprite);
    haze.layers.set(BASE_LAYER);
    haze.position.copy(this.position);
    haze.scale.multiplyScalar(
      clamp(HAZE_MAX * Math.random(), HAZE_MIN, HAZE_MAX)
    );
    this.obj = haze;
    scene.add(haze);
  }
}
