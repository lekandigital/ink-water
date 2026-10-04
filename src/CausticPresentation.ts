import * as THREE from 'three';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/CausticPresentation.frag';

// Presentation intensity only. The source ray projection and intensity map
// remain unchanged, and the default bypasses this pass completely.
export class CausticPresentation {
  readonly target=new THREE.WebGLRenderTarget(1024,1024,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  readonly material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{causticMap:{value:null},strength:{value:1}},depthTest:false,depthWrite:false,toneMapped:false});
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  constructor(){
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
    quad.frustumCulled=false;this.scene.add(quad);
  }
  texture(renderer:THREE.WebGLRenderer,source:THREE.Texture,strength:number){
    if(strength===1)return source;
    const previous=renderer.getRenderTarget();
    this.material.uniforms.causticMap.value=source;this.material.uniforms.strength.value=strength;
    renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera);renderer.setRenderTarget(previous);
    return this.target.texture;
  }
}
