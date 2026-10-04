import type * as THREE from 'three';
const sunSpot='color += vec3(pow(max(0.0, dot(light, ray)), 5000.0)) * vec3(10.0, 8.0, 6.0);';
export function removeSunDisc(material:THREE.ShaderMaterial){
  material.fragmentShader=material.fragmentShader.replaceAll(sunSpot,'// The reflected sun disc is omitted from this water study.');
  material.needsUpdate=true;
}
