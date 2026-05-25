import {
    OVERLAY_LAYER,

  } from "./config/renderConfig";
  import { clamp } from "./utils";
  import * as THREE from "three";
  
//   import feathered60 from "url:./resources/feathered60.png"
  
//   const hazeTexture = new THREE.TextureLoader().load(feathered60);
//   const hazeSprite = new THREE.SpriteMaterial({
//     map: hazeTexture,
//     color: 0x0082ff,
//     opacity: HAZE_OPACITY,
//     transparent: true,
//     depthTest: false,
//     depthWrite: false,
//     blending: THREE.AdditiveBlending,
//   });




// const triangleShape = new THREE.Shape()
// .moveTo( 80, 20 )
// .lineTo( 40, 80 )
// .lineTo( 120, 80 )
// .lineTo( 80, 20 );

// const circleRadius = 40;
// const circleShape = new THREE.Shape()
//     .moveTo( 0, circleRadius )
//     .quadraticCurveTo( circleRadius, circleRadius, circleRadius, 0 )
//     .quadraticCurveTo( circleRadius, - circleRadius, 0, - circleRadius )
//     .quadraticCurveTo( - circleRadius, - circleRadius, - circleRadius, 0 )
//     .quadraticCurveTo( - circleRadius, circleRadius, 0, circleRadius );
  
  export class Sector {
    obj: THREE.Object3D | null = null;
    name: string;
    position: THREE.Vector3;
    shape: THREE.Shape;
    constructor(name: string, position: THREE.Vector3, shape: THREE.Shape) {
      this.name = name;
      this.position = position;
      this.shape = shape;
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
      this.obj.removeFromParent();
      return true;
  }
  
    toThreeObject(scene: THREE.Scene) {
        const extrudeSettings = { depth: 8, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 1, bevelThickness: 1 };
        const geometry = new THREE.ExtrudeGeometry(this.shape, extrudeSettings );

        const color = 0xf08000;

        const mesh = new THREE.Mesh( geometry, new THREE.MeshPhongMaterial( { color: color } ) );
      mesh.layers.set(OVERLAY_LAYER);
      mesh.position.copy(this.position);
      this.obj = mesh;
      scene.add(mesh);
    }
  }
  