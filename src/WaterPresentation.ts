import * as THREE from 'three';
import type {Water} from './Water';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/WaterPresentation.frag';

// Interpolation is for viewing only. Its output never enters a solver pass.
export class WaterPresentation{
  readonly previous:THREE.WebGLRenderTarget;
  readonly target:THREE.WebGLRenderTarget;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  readonly material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{previousWater:{value:null},currentWater:{value:null},blend:{value:1}},depthTest:false,depthWrite:false,toneMapped:false});
  constructor(water:Water){
    const options={type:water.textureA.texture.type,format:THREE.RGBAFormat,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false};
    this.previous=new THREE.WebGLRenderTarget(water.textureA.width,water.textureA.height,options);this.target=this.previous.clone();
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);
  }
  capture(renderer:THREE.WebGLRenderer,water:Water){
    const previous=renderer.getRenderTarget();
    this.material.uniforms.previousWater.value=water.textureA.texture;this.material.uniforms.currentWater.value=water.textureA.texture;this.material.uniforms.blend.value=1;
    renderer.setRenderTarget(this.previous);renderer.render(this.scene,this.camera);renderer.setRenderTarget(previous);
  }
  present(renderer:THREE.WebGLRenderer,water:Water,blend:number){
    const previous=renderer.getRenderTarget();
    this.material.uniforms.previousWater.value=this.previous.texture;this.material.uniforms.currentWater.value=water.textureA.texture;this.material.uniforms.blend.value=Math.max(0,Math.min(1,blend));
    renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera);renderer.setRenderTarget(previous);
    return this.target;
  }
}
