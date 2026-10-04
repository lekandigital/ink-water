import * as THREE from 'three';
import { Water } from './Water';
import { OpenWaterBoundary } from './OpenWaterBoundary';
import { WaterPresentation } from './WaterPresentation';
import { ContinuousWaveLines } from './ContinuousWaveLines';
import { MAX_WAVE_IMPULSES, WAVE_LIFETIME_STEPS } from './ContinuousWaveModel';
import { rainWaveSpeed } from './WaterMotion';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/WaterLayers.frag';

const TICK=1/60;
type RainImpulse={x:number;z:number;radius:number;strength:number;born:number};

// Only allocated when Dreamy rain speed is enabled. Both independent fields
// use the untouched original solver and open boundary. Their sum is a view;
// it never feeds back into either running simulation.
export class RainWaveLayer{
  readonly water:Water;
  readonly boundary:OpenWaterBoundary;
  readonly presentation:WaterPresentation;
  readonly combined:Water;
  readonly lines=new ContinuousWaveLines();
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  readonly material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{touchWater:{value:null},rainWater:{value:null},joinStrokes:{value:false}},depthTest:false,depthWrite:false,toneMapped:false});
  readonly lineTarget=this.lines.target.clone();
  readonly bandTarget=this.lines.bandTarget.clone();
  simulationSteps=0;
  speed=rainWaveSpeed(0);
  private accumulator=0;
  private elapsed=0;
  private previousSteps=0;
  private impulses:RainImpulse[]=[];

  constructor(private renderer:THREE.WebGLRenderer){
    this.water=new Water(renderer);
    this.boundary=new OpenWaterBoundary(this.water);
    this.presentation=new WaterPresentation(this.water);
    this.combined=new Water(renderer);
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);
    this.clear();
  }

  advance(seconds:number,selectedSpeed:number){
    this.elapsed+=seconds;
    this.speed=rainWaveSpeed(this.elapsed,selectedSpeed);
    this.accumulator+=seconds*this.speed;
    while(this.accumulator>=TICK){
      this.previousSteps=this.simulationSteps;
      this.presentation.capture(this.renderer,this.water);
      for(let i=0;i<2;i++){
        this.water.stepSimulation(1,1);
        this.boundary.apply(this.renderer,this.water);
      }
      this.simulationSteps+=2;
      this.water.updateNormals(1,1);
      this.accumulator-=TICK;
    }
  }

  addDrop(x:number,z:number,radius:number,strength:number){
    this.water.addDrop(x,z,radius,strength,1,1);
    this.lines.model.addDrop(x,z,radius,strength,this.simulationSteps);
    this.impulses=this.impulses.filter(drop=>this.simulationSteps-drop.born<WAVE_LIFETIME_STEPS);
    if(this.impulses.length<MAX_WAVE_IMPULSES)this.impulses.push({x,z,radius,strength,born:this.simulationSteps});
    this.water.updateNormals(1,1);this.presentation.capture(this.renderer,this.water);this.previousSteps=this.simulationSteps;
  }

  private rainSurface(){
    return this.presentation.present(this.renderer,this.water,this.accumulator/TICK);
  }

  private get viewSteps(){return this.previousSteps+(this.simulationSteps-this.previousSteps)*this.accumulator/TICK;}

  private compose(touch:THREE.Texture,rain:THREE.Texture,target:THREE.WebGLRenderTarget,joinStrokes=false){
    const previous=this.renderer.getRenderTarget();
    this.material.uniforms.touchWater.value=touch;this.material.uniforms.rainWater.value=rain;this.material.uniforms.joinStrokes.value=joinStrokes;
    this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(previous);
  }

  surface(touch:Water){
    this.compose(touch.textureA.texture,this.rainSurface().texture,this.combined.textureA);
    this.combined.updateNormals(1,1);
    return this.combined;
  }

  renderLines(touch:ContinuousWaveLines,camera:THREE.PerspectiveCamera,lineWeight:number,bandWidth:number){
    const {width,height}=touch.target;
    for(const target of [this.lines.target,this.lines.bandTarget,this.lineTarget,this.bandTarget])target.setSize(width,height);
    this.lines.render(this.renderer,camera,this.viewSteps,lineWeight,bandWidth);
    this.compose(touch.target.texture,this.lines.target.texture,this.lineTarget,true);
    if(bandWidth>0)this.compose(touch.bandTarget.texture,this.lines.bandTarget.texture,this.bandTarget,true);
    return {lines:this.lineTarget.texture,bands:this.bandTarget.texture};
  }

  mergeInto(touch:Water,lines:ContinuousWaveLines,touchSteps:number){
    // Leaving the option preserves existing waves without a jump or clearing
    // unrelated settings. From here they use the ordinary single solver again.
    this.compose(touch.textureA.texture,this.rainSurface().texture,touch.textureB);
    [touch.textureA,touch.textureB]=[touch.textureB,touch.textureA];
    touch.updateNormals(1,1);
    for(const drop of this.impulses){
      const age=this.viewSteps-drop.born;
      if(age<WAVE_LIFETIME_STEPS)lines.model.addDrop(drop.x,drop.z,drop.radius,drop.strength,touchSteps-age);
    }
    this.clear();
  }

  clear(){
    const previous=this.renderer.getRenderTarget(),color=new THREE.Color();this.renderer.getClearColor(color);const alpha=this.renderer.getClearAlpha();
    this.renderer.setClearColor(0,0);
    for(const target of [this.water.textureA,this.water.textureB,this.combined.textureA,this.combined.textureB,this.presentation.previous,this.presentation.target]){
      this.renderer.setRenderTarget(target);this.renderer.clear();
    }
    this.renderer.setRenderTarget(previous);this.renderer.setClearColor(color,alpha);
    this.lines.model.clear();this.impulses=[];this.simulationSteps=0;this.previousSteps=0;this.accumulator=0;this.elapsed=0;this.speed=rainWaveSpeed(0);
  }
}
