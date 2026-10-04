import type * as THREE from 'three';
const sunSpot='color += vec3(pow(max(0.0, dot(light, ray)), 5000.0)) * vec3(10.0, 8.0, 6.0);';
// Preserve the original shader verbatim whenever this optional treatment is off.
export class SunDiscPresentation{
  private originals=new Map<THREE.ShaderMaterial,string>();
  apply(material:THREE.ShaderMaterial,hidden:boolean){
    if(!this.originals.has(material))this.originals.set(material,material.fragmentShader);
    const original=this.originals.get(material)!;
    const source=hidden?original.replaceAll(sunSpot,'// Optional reflected sun disc suppression.'):original;
    if(material.fragmentShader!==source){material.fragmentShader=source;material.needsUpdate=true;}
  }
}
