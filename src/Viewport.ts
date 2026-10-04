import * as THREE from 'three';

/** Crop the original square water surface to fill the viewport, with no camera tilt. */
export function fitWaterCamera(camera:THREE.PerspectiveCamera,width:number,height:number){
  camera.aspect=Math.max(1,width)/Math.max(1,height);
  camera.position.set(0,0.98/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(1,camera.aspect)),0);
  camera.up.set(0,0,-1);
  camera.lookAt(0,0,0);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
}

export function insideWater(x:number,z:number,margin=0){return Math.abs(x)<1-margin&&Math.abs(z)<1-margin;}
