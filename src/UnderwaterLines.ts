import * as THREE from 'three';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/ReferenceLineDrawing.frag';

// Draw coverage once, instead of passing a thin mark through the etching edge
// detector, which would turn it into two parallel outlines. The mask uses the
// actual source water mesh, parallax normals and refracted ray.
export class UnderwaterLineDrawing{
  readonly target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
  readonly maskScene=new THREE.Scene();
  readonly scene=new THREE.Scene();
  readonly material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{marks:{value:this.target.texture},ink:{value:new THREE.Color()}},transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  private sourceMaterial:THREE.ShaderMaterial;
  constructor(source:THREE.Mesh){
    const copy=source.clone(false);copy.frustumCulled=false;this.maskScene.add(copy);
    this.sourceMaterial=source.material as THREE.ShaderMaterial;
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);
  }
  draw(renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera,screenCamera:THREE.OrthographicCamera,ink:THREE.Color,width:number,height:number){
    this.target.setSize(width,height);
    const previous=renderer.getRenderTarget(),color=new THREE.Color();renderer.getClearColor(color);const alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
    this.sourceMaterial.uniforms.referenceLineMaskOnly.value=true;this.sourceMaterial.uniformsNeedUpdate=true;
    renderer.setClearColor(0,0);renderer.setRenderTarget(this.target);renderer.clear();renderer.render(this.maskScene,camera);
    this.sourceMaterial.uniforms.referenceLineMaskOnly.value=false;this.sourceMaterial.uniformsNeedUpdate=true;
    renderer.setRenderTarget(previous);renderer.setClearColor(color,alpha);renderer.autoClear=false;
    this.material.uniforms.ink.value.copy(ink);renderer.render(this.scene,screenCamera);
    renderer.autoClear=autoClear;
  }
}
