import * as THREE from 'three';
import type { Water } from './Water';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/OpenWaterBoundary.frag';

export class OpenWaterBoundary {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  readonly material = new THREE.ShaderMaterial({
    vertexShader,fragmentShader,
    uniforms:{currentWater:{value:null},previousWater:{value:null},delta:{value:new THREE.Vector2(1/256,1/256)}},
    depthTest:false,depthWrite:false,toneMapped:false,
  });
  private spare: THREE.WebGLRenderTarget;

  constructor(water: Water){
    this.spare=new THREE.WebGLRenderTarget(water.textureA.width,water.textureA.height,{
      type:water.textureA.texture.type,format:THREE.RGBAFormat,
      minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,
    });
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
    quad.frustumCulled=false;this.scene.add(quad);
  }

  apply(renderer: THREE.WebGLRenderer,water: Water){
    const previousTarget=renderer.getRenderTarget();
    const current=water.textureA;
    this.material.uniforms.currentWater.value=current.texture;
    this.material.uniforms.previousWater.value=water.textureB.texture;
    renderer.setRenderTarget(this.spare);renderer.render(this.scene,this.camera);
    // Rotate three targets: preserve the previous state for the radiation pass
    // without sampling either texture while writing into it.
    water.textureA=this.spare;this.spare=current;
    renderer.setRenderTarget(previousTarget);
  }
}
