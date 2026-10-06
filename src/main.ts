import * as THREE from 'three';
import { Water } from './Water';
import { Renderer as WaterRenderer } from './Renderer';
import { connectWaterPointer } from './PointerInteraction';
import { fitWaterCamera, insideWater } from './Viewport';
import { applyDrawingTone, tones } from './DrawingPalette';
import { ContinuousWaveLines } from './ContinuousWaveLines';
import { OpenWaterBoundary } from './OpenWaterBoundary';
import { CausticPresentation } from './CausticPresentation';
import { experimentDefaults, printSwitches, waterBitmapSwitches, lightDirection } from './AppearanceExperiments';
import { WaterControls } from './WaterControls';
import { type Mode, type WaterSettings } from './StartupSettings';
import { effectiveMotion, rainImpulse, selectedWaveSpeed } from './WaterMotion';
import { WaterPresentation } from './WaterPresentation';
import { RainWaveLayer } from './RainWaveLayer';
import { gesturePattern, type GestureKey } from './GesturePatterns';
import { SunDiscPresentation } from './OpticsPresentation';
import { UnderwaterLineDrawing } from './UnderwaterLines';
import { FloorLinePresentation } from './FloorLinePresentation';
import { CaptureClock, captureOptions, exposeCapture, seededRandom } from './CaptureMode';
import { PlaylistMusic } from './music/PlaylistMusic';
import type { MusicRainClock, MusicRainDrop } from './music/MusicScore';
import drawingVert from './shaders/Drawing.vert';
import drawingFrag from './shaders/Drawing.frag';
import printDrawingFrag from './shaders/DrawingExperiments.frag';
import bitmapWaterFrag from './shaders/BitmapWater.frag';

const modes:Record<Mode,number>={'ink-wash':0,etching:1,graphite:2,original:3};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const POOL={width:1,length:1,depth:0.7,radius:1};
const TICK=1/60;

class Puddle {
  readonly state:WaterSettings;
  readonly controls:WaterControls;
  readonly gl:THREE.WebGLRenderer;
  readonly water:Water;
  readonly openBoundary:OpenWaterBoundary;
  readonly engine:WaterRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(33,1,0.01,100);
  readonly drawingScene=new THREE.Scene();
  readonly drawingCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  readonly target:THREE.WebGLRenderTarget;
  readonly litTarget:THREE.WebGLRenderTarget;
  readonly flatTarget:THREE.WebGLRenderTarget;
  readonly drawingTarget:THREE.WebGLRenderTarget;
  readonly bitmapDrawing:THREE.ShaderMaterial;
  readonly bitmapScene=new THREE.Scene();
  readonly sunDisc=new SunDiscPresentation();
  readonly floorLine=new FloorLinePresentation();
  private waterPresentation?:WaterPresentation;
  private rainLayer?:RainWaveLayer;
  private rainLayerActive=false;
  private musicRain?:MusicRainClock;
  private referenceDrawing?:UnderwaterLineDrawing;
  private visualWater?:Water;
  private presentationSpeed=1;
  private pendingDraw=false;
  private renderRevision=0;
  private gestureQueue:{x:number;z:number;at:number}[]=[];
  private gestureElapsed=0;
  readonly drawing:THREE.ShaderMaterial;
  readonly printDrawing:THREE.ShaderMaterial;
  readonly drawingQuad:THREE.Mesh;
  readonly waveLines=new ContinuousWaveLines();
  readonly causticPresentation=new CausticPresentation();
  readonly flatCaustics=new THREE.DataTexture(new Float32Array([1,0,0,1]),1,1,THREE.RGBAFormat,THREE.FloatType);
  readonly tile:THREE.Texture;
  readonly matte:THREE.Texture;
  readonly inverseViewProjection=new THREE.Matrix4();
  private lastTime=0;
  private accumulator=0;
  private rainAccumulator=0;
  private simulationSteps=0;
  private animating=true;
  private clearRainUntil=0;
  private pausedByPreference=false;

  constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){
    this.controls=controls;this.state=controls.state;
    this.tile=tile;
    this.gl=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.gl.debug.onShaderError=(gl,program,vertex,fragment)=>{
      console.error('Water shader compilation failed',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));
      this.animating=false;
      throw new Error('The water drawing shader could not start. The browser console contains the diagnostic.');
    };
    this.gl.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.gl.outputColorSpace=THREE.SRGBColorSpace;
    if(!this.gl.extensions.has('EXT_color_buffer_float')) throw new Error('This study needs WebGL 2 with floating-point textures. Enable hardware acceleration in your browser and reload.');
    this.water=new Water(this.gl);
    this.openBoundary=new OpenWaterBoundary(this.water);
    const bytes=new Uint8Array(64*64*4);
    // A quiet grayscale paper-like material. Textures are appearance, not geometry.
    let seed=1857;
    for(let i=0;i<64*64;i++){seed=(seed*1664525+1013904223)>>>0;const c=214+(seed%8);bytes.set([c,c,c,255],i*4);}
    this.matte=new THREE.DataTexture(bytes,64,64,THREE.RGBAFormat);
    this.matte.wrapS=this.matte.wrapT=THREE.RepeatWrapping;
    this.matte.minFilter=this.matte.magFilter=THREE.LinearFilter;
    this.matte.needsUpdate=true;
    this.engine=new WaterRenderer(this.gl,tile,sky);
    this.engine.setPoolShape('Box',0,POOL.width,POOL.depth,POOL.length);
    this.flatCaustics.needsUpdate=true;
    this.engine.lightDir.set(2,2,-1).normalize();
    this.scene.add(this.engine.getPoolMesh(),this.engine.getWaterMesh(),this.engine.getWaterMeshBack());
    this.engine.markWaterOpticsHidden();
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.litTarget=this.target.clone();this.flatTarget=this.target.clone();this.drawingTarget=this.target.clone();
    this.drawing=new THREE.ShaderMaterial({vertexShader:drawingVert,fragmentShader:drawingFrag,uniforms:{
      sceneColor:{value:this.target.texture},water:{value:this.water.textureA.texture},waveLines:{value:this.waveLines.target.texture},waveBands:{value:this.waveLines.bandTarget.texture},hairlineRipples:{value:true},caustics:{value:false},pixel:{value:new THREE.Vector2()},pixelRatio:{value:this.gl.getPixelRatio()},poolSize:{value:new THREE.Vector2(POOL.width,POOL.length)},inverseViewProjection:{value:this.inverseViewProjection},eye:{value:this.camera.position},paper:{value:new THREE.Color()},ink:{value:new THREE.Color()},lineWeight:{value:this.state.lineWeight},mode:{value:0},sourceGeometry:{value:true},
      ...Object.fromEntries(Object.entries(experimentDefaults).map(([key,value])=>[key,{value}])),
    },depthTest:false,depthWrite:false,toneMapped:false});
    this.printDrawing=new THREE.ShaderMaterial({vertexShader:drawingVert,fragmentShader:printDrawingFrag,uniforms:this.drawing.uniforms,depthTest:false,depthWrite:false,toneMapped:false});
    this.bitmapDrawing=new THREE.ShaderMaterial({vertexShader:drawingVert,fragmentShader:bitmapWaterFrag,uniforms:{...this.drawing.uniforms,baseColor:{value:this.drawingTarget.texture},litScene:{value:this.litTarget.texture},flatScene:{value:this.flatTarget.texture}},depthTest:false,depthWrite:false,toneMapped:false});
    const bitmapQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.bitmapDrawing);bitmapQuad.frustumCulled=false;this.bitmapScene.add(bitmapQuad);
    this.drawingQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.drawing);
    this.drawingQuad.frustumCulled=false;
    this.drawingScene.add(this.drawingQuad);
    this.camera.position.set(0,4.5,0);
    this.camera.up.set(0,0,-1);
    this.camera.lookAt(0,0,0);
    const canvas=this.gl.domElement;
    canvas.tabIndex=0;
    canvas.setAttribute('aria-label','Water surface. Click or drag to create ripples; Space pauses the simulation.');
    $('stage').appendChild(canvas);
    this.controls.hooks={change:()=>{this.pausedByPreference=false;this.applyAppearance(false);},clear:()=>this.clear(),gesture:key=>this.playGesture(key)};
    this.connectPointer();
    this.resize();
    new ResizeObserver(()=>this.resize()).observe($('stage'));
    window.addEventListener('resize',()=>this.resize());
    document.addEventListener('visibilitychange',()=>{this.lastTime=0;this.accumulator=0;});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.animating=false;$('error').textContent='The graphics context was interrupted. Reload to return to the water.';$('error').hidden=false;});
    this.applyAppearance();
    // Same drop function and two solver steps per update as the source demo.
    const drops=[[-0.34,-0.23,0.032,-0.01],[0.28,0.18,0.029,0.012],[-0.12,0.35,0.027,-0.009],[0.41,-0.25,0.023,0.008]];
    for(const [x,z,r,s] of drops)this.addDrop(x,z,r,s);
    this.advance(22);
    this.draw();
    $('loading').hidden=true;
    this.controls.publish({ready:true});
    requestAnimationFrame(this.animate);
    this.registerTools();
  }

  resize(){
    const rect=$('stage').getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    this.gl.setSize(width,height);
    fitWaterCamera(this.camera,width,height);
    this.inverseViewProjection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).invert();
    const size=this.gl.getDrawingBufferSize(new THREE.Vector2());
    this.target.setSize(size.x,size.y);
    for(const target of [this.litTarget,this.flatTarget,this.drawingTarget])target.setSize(size.x,size.y);
    this.waveLines.target.setSize(size.x,size.y);
    this.waveLines.bandTarget.setSize(size.x,size.y);
    this.drawing.uniforms.pixel.value.set(1/size.x,1/size.y);
    this.drawing.uniforms.pixelRatio.value=this.gl.getPixelRatio();
    this.engine.setSize(Math.min(size.x,1024),Math.min(size.y,1024));
    this.updateReferenceLines();
    if(this.water)this.draw();
  }

  advance(ticks:number){
    for(let i=0;i<ticks;i++){
      if(this.motion.speed<1)this.waterPresentation?.capture(this.gl,this.water);
      this.water.stepSimulation(POOL.width,POOL.length);
      this.openBoundary.apply(this.gl,this.water);
      this.water.stepSimulation(POOL.width,POOL.length);
      this.openBoundary.apply(this.gl,this.water);
      this.simulationSteps+=2;
      if(this.motion.speed<1)this.water.updateNormals(POOL.width,POOL.length);
    }
  }

  draw(){
    this.water.updateNormals(POOL.width,POOL.length);
    this.drawing.uniforms.waveLines.value=this.waveLines.target.texture;
    this.drawing.uniforms.waveBands.value=this.waveLines.bandTarget.texture;
    if(this.state.hairlineRipples&&this.state.mode!=='original'){
      const needsBand=this.state.bitmapRipples||this.state.textureReveal||(this.state.caustics&&this.state.alignedCaustics);
      this.waveLines.render(this.gl,this.camera,this.simulationSteps,this.state.lineWeight,needsBand?this.state.revealWidth:0);
      if(this.rainLayerActive&&this.rainLayer){
        const drawing=this.rainLayer.renderLines(this.waveLines,this.camera,this.state.lineWeight,needsBand?this.state.revealWidth:0);
        this.drawing.uniforms.waveLines.value=drawing.lines;this.drawing.uniforms.waveBands.value=drawing.bands;
      }
    }
    const bitmapActive=this.state.mode!=='original'&&(this.state.causticRipples||this.state.dreamy||this.state.subtle||waterBitmapSwitches.some(key=>this.state[key]));
    // The neutral path presents the original Water object directly, exactly as 0124a47.
    let surface=this.water;
    if(this.motion.speed<1&&this.waterPresentation&&this.visualWater){
      this.visualWater.textureA=this.waterPresentation.present(this.gl,this.water,this.accumulator/TICK);
      surface=this.visualWater;
    }
    if(this.rainLayerActive&&this.rainLayer)surface=this.rainLayer.surface(this.water);
    this.engine.updateObjectTextures(this.scene,this.camera,null);
    const projectedCaustics=this.state.caustics&&!this.state.causticRipples&&(this.state.mode==='original'||!this.state.alignedCaustics);
    const needsFocus=bitmapActive&&(this.state.causticRipples||this.state.causticReveal);
    if(projectedCaustics||needsFocus)this.engine.updateCaustics(surface);
    this.engine.renderPool(surface);
    this.engine.renderWater(surface,this.camera);
    const lightMap=(projectedCaustics||needsFocus)?this.causticPresentation.texture(this.gl,this.engine.objectRenderResources.causticTexture,this.state.causticsStrength):this.flatCaustics;
    const renderSurface=(target:THREE.WebGLRenderTarget,map:THREE.Texture)=>{
      for(const mesh of [this.engine.getPoolMesh(),this.engine.getWaterMesh(),this.engine.getWaterMeshBack()]){
        (mesh.material as THREE.ShaderMaterial).uniforms.causticTex.value=map;
        const uniforms=(mesh.material as THREE.ShaderMaterial).uniforms;
        if(uniforms.referenceProjected)uniforms.referenceProjected.value=map!==this.flatCaustics;
      }
      this.gl.setClearColor(0x000000,0);
      this.gl.setRenderTarget(target);this.gl.clear();this.gl.render(this.scene,this.camera);
    };
    // Screen-aligned lit and unlit views differ only in the real projected caustics.
    // These masks are used by Bitmap water, never by the restored Print shader.
    if(needsFocus){renderSurface(this.litTarget,lightMap);renderSurface(this.flatTarget,this.flatCaustics);}
    renderSurface(this.target,projectedCaustics?lightMap:this.flatCaustics);
    this.drawing.uniforms.sceneColor.value=this.target.texture;
    this.drawing.uniforms.water.value=surface.textureA.texture;
    this.gl.setClearColor(tones[this.state.tone].paper,1);
    const printActive=this.state.mode!=='original'&&(printSwitches.some(key=>this.state[key])||(this.state.caustics&&this.state.alignedCaustics&&!this.state.causticRipples));
    this.drawingQuad.material=printActive?this.printDrawing:this.drawing;
    this.gl.setRenderTarget(bitmapActive?this.drawingTarget:null);
    this.gl.render(this.drawingScene,this.drawingCamera);
    if(bitmapActive){this.gl.setRenderTarget(null);this.gl.render(this.bitmapScene,this.drawingCamera);}
    if(this.state.mode!=='original'&&this.state.shortReferenceLines&&this.state.caustics&&!this.state.causticRipples){
      if(!this.referenceDrawing)this.referenceDrawing=new UnderwaterLineDrawing(this.engine.getWaterMesh());
      this.referenceDrawing.draw(this.gl,this.camera,this.drawingCamera,this.drawing.uniforms.ink.value,this.target.width,this.target.height);
    }
    this.pendingDraw=false;this.renderRevision++;
    this.controls.publish({simulationSteps:this.simulationSteps,renderRevision:this.renderRevision,
      drawingPipeline:printActive?'print':'normal',bitmapPass:bitmapActive,projectedCaustics,
      touchWaveSpeed:this.motion.speed,rainWaveSpeed:this.rainLayerActive?this.rainLayer?.speed:this.motion.speed,
      rainSimulationSteps:this.rainLayerActive?this.rainLayer?.simulationSteps:0});
  }

  private get motion(){return effectiveMotion(this.state);}

  private prepareMotion(){
    if(this.state.dreamyRainSpeed&&!this.rainLayerActive){
      if(!this.rainLayer)this.rainLayer=new RainWaveLayer(this.gl);
      this.rainLayerActive=true;this.accumulator=0;
    }else if(!this.state.dreamyRainSpeed&&this.rainLayerActive){
      this.rainLayer?.mergeInto(this.water,this.waveLines,this.simulationSteps);
      this.rainLayerActive=false;this.accumulator=0;
    }
    const speed=this.motion.speed;
    if(speed<1&&speed!==this.presentationSpeed){
      if(!this.waterPresentation){
        this.waterPresentation=new WaterPresentation(this.water);
        this.visualWater=Object.create(this.water) as Water;
      }
      // Re-entering slow motion must use today's surface, never a stale snapshot
      // from the last time Dreamy or the speed slider enabled interpolation.
      this.water.updateNormals(POOL.width,POOL.length);this.waterPresentation.capture(this.gl,this.water);
      this.accumulator=0;
    }
    this.presentationSpeed=speed;
  }

  private animate=(now:number)=>{
    if(!this.animating)return;
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,0.1):0;this.lastTime=now;
    let ticks=0;
    if(!this.state.paused){
      const motion=this.motion;
      if(this.rainLayerActive)this.rainLayer?.advance(dt,selectedWaveSpeed(this.state));
      this.accumulator+=dt*motion.speed;
      if(this.musicRain?.enabled){
        for(const drop of this.musicRain.updateMusicRain())if(now>this.clearRainUntil)this.emitRain(drop);
      }
      while(this.accumulator>=TICK&&ticks<6){
        // Fixed tick boundaries, path samples and spacing make gesture replays deterministic.
        if(this.gestureQueue.length){
          this.gestureElapsed+=TICK*1000/motion.speed;
          while(this.gestureQueue.length&&this.gestureQueue[0].at<=this.gestureElapsed){
            const point=this.gestureQueue.shift()!;
            this.addDrop(point.x,point.z,this.state.dropSize*motion.scale,-motion.touchForce);
          }
        }
        // Preserve the restored rain clock, random sample order and force distribution.
        if(!this.musicRain?.enabled&&this.state.rain&&now>this.clearRainUntil){
          this.rainAccumulator+=TICK*this.state.rainRate;
          if(this.rainAccumulator>=1){
            this.rainAccumulator-=1;
            this.emitRain();
          }
        }
        this.advance(1);this.accumulator-=TICK;ticks++;
      }
    }
    if(this.pendingDraw||ticks||(!this.state.paused&&(this.motion.speed<1||this.rainLayerActive)))this.draw();
    requestAnimationFrame(this.animate);
  };

  inside(x:number,z:number,margin=0){return insideWater(x,z,margin);}

  setMusicRain(clock:MusicRainClock){this.musicRain=clock;clock.setSimulationPaused(this.state.paused);}

  // Ordinary and musical rain share the original impulse distribution and both
  // original solver routes. Music supplies scheduling and reproducible placement.
  private emitRain(event?:MusicRainDrop){
    const motion=this.motion,random=event?seededRandom(event.seed):Math.random;
    let point:THREE.Vector2;
    if(event){
      const rect=$('stage').getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);
      point=new THREE.Vector2(event.position[0]*.94*Math.min(1,aspect)*.93,event.position[1]*.94/Math.max(1,aspect)*.93);
    }else point=this.randomPoint();
    const drop=rainImpulse(motion.rainForce*(event?.force??1),motion.scale*(event?.scale??1),random);
    if(this.rainLayerActive&&this.rainLayer)this.rainLayer.addDrop(point.x,point.y,drop.radius,drop.strength);
    else this.addDrop(point.x,point.y,drop.radius,drop.strength);
  }

  private addDrop(x:number,z:number,radius:number,strength:number){
    // Identical impacts and simulation clock drive the original surface and its
    // continuous drawing. The drawing never feeds back into the source solver.
    this.water.addDrop(x,z,radius,strength,POOL.width,POOL.length);
    this.waveLines.model.addDrop(x,z,radius,strength,this.simulationSteps);
    if(this.motion.speed<1&&this.waterPresentation){this.water.updateNormals(POOL.width,POOL.length);this.waterPresentation.capture(this.gl,this.water);}
  }

  private randomPoint(){
    const rect=$('stage').getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);
    const halfX=0.94*Math.min(1,aspect),halfZ=0.94/Math.max(1,aspect);
    return new THREE.Vector2((Math.random()*2-1)*halfX*0.93,(Math.random()*2-1)*halfZ*0.93);
  }

  disturb(x:number,z:number){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!this.inside(x,z,0.015))throw new Error('Choose a point inside the water.');
    // An intentional gesture opts into motion after an automatic accessibility pause.
    // A pause chosen with the Pause button is still respected.
    if(this.pausedByPreference){this.pausedByPreference=false;this.state.paused=false;this.lastTime=0;this.accumulator=0;this.updateControls();}
    const motion=this.motion;this.addDrop(x,z,this.state.dropSize*motion.scale,-motion.touchForce);
    // A gesture must be visible even if an embedded view throttles animation frames.
    this.draw();
  }

  playGesture(key:GestureKey){
    const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.gestureQueue=gesturePattern(key).map(point=>{
      raycaster.setFromCamera(new THREE.Vector2(point.x,-point.y),this.camera);
      const p=raycaster.ray.intersectPlane(plane,new THREE.Vector3())!;
      return {x:p.x,z:p.z,at:point.at};
    });
    this.gestureElapsed=0;this.accumulator=0;
    const first=this.gestureQueue.shift()!;this.disturb(first.x,first.z);
    $('interaction-hint').textContent='Playing '+(key==='/'?'slash':key.toUpperCase())+' gesture. Same path, every time.';
    this.controls.publish({gesture:key,gestureSamples:this.gestureQueue.length+1});
  }

  clear(){
    this.musicRain?.rebase();
    const previous=this.gl.getRenderTarget(),color=new THREE.Color();this.gl.getClearColor(color);const alpha=this.gl.getClearAlpha();
    this.gl.setClearColor(0,0);
    for(const target of [this.water.textureA,this.water.textureB]){this.gl.setRenderTarget(target);this.gl.clear();}
    this.gl.setRenderTarget(previous);this.gl.setClearColor(color,alpha);
    this.waveLines.model.clear();this.gestureQueue=[];this.gestureElapsed=0;
    this.rainLayer?.clear();
    if(this.waterPresentation){this.water.updateNormals(POOL.width,POOL.length);this.waterPresentation.capture(this.gl,this.water);}
    this.rainAccumulator=0;this.clearRainUntil=performance.now()+1800;this.draw();
  }

  applyAppearance(render=true){
    this.musicRain?.setSimulationPaused(this.state.paused);
    this.prepareMotion();
    const {mode,tone,lineWeight,sourceGeometry,hairlineRipples,caustics}=this.state;
    document.body.dataset.tone=tone;
    applyDrawingTone(this.drawing.uniforms.paper.value,this.drawing.uniforms.ink.value,tone);
    this.drawing.uniforms.mode.value=modes[mode];this.drawing.uniforms.lineWeight.value=lineWeight;
    this.drawing.uniforms.sourceGeometry.value=sourceGeometry;
    this.drawing.uniforms.hairlineRipples.value=hairlineRipples;this.drawing.uniforms.caustics.value=caustics&&!this.state.causticRipples&&!this.state.alignedCaustics;
    for(const key of Object.keys(experimentDefaults) as (keyof typeof experimentDefaults)[])this.drawing.uniforms[key].value=this.state[key];
    this.drawing.uniforms.alignedCaustics.value=caustics&&!this.state.causticRipples&&this.state.alignedCaustics;
    this.engine.lightDir.copy(lightDirection(this.state));
    for(const mesh of [this.engine.getPoolMesh(),this.engine.getWaterMesh(),this.engine.getWaterMeshBack()]){
      (mesh.material as THREE.ShaderMaterial).uniforms.tiles.value=mode==='original'?this.tile:this.matte;
    }
    for(const mesh of [this.engine.getWaterMesh(),this.engine.getWaterMeshBack()]){
      const material=mesh.material as THREE.ShaderMaterial;
      this.sunDisc.apply(material,this.state.hideSunDisc);
      if(mesh===this.engine.getWaterMesh())this.floorLine.apply(material,mode!=='original'&&this.state.shortReferenceLines&&caustics&&!this.state.causticRipples);
    }
    this.updateReferenceLines();
    this.updateControls();if(render)this.draw();else this.pendingDraw=true;
  }

  private updateReferenceLines(){
    this.floorLine.fit(this.camera,this.target.width);
    for(const mesh of [this.engine.getWaterMesh(),this.engine.getWaterMeshBack()]){
      const uniforms=(mesh.material as THREE.ShaderMaterial).uniforms;
      uniforms.inkFloorLine=this.floorLine.line;uniforms.referenceLineWeight={value:this.state.lineWeight};
      uniforms.referenceNeutralCaustic={value:.2*this.state.causticsStrength};uniforms.referenceProjected??={value:this.state.caustics};
      uniforms.referenceLineMaskOnly??={value:false};
    }
  }

  updateControls(){this.controls.sync();}

  private connectPointer(){
    connectWaterPointer({canvas:this.gl.domElement,camera:this.camera,inside:(x,z,margin)=>this.inside(x,z,margin),disturb:(x,z)=>this.disturb(x,z),dropSize:()=>this.state.dropSize*this.state.rippleScale});
  }

  snapshot(){return {...this.state,simulationSteps:this.simulationSteps,camera:{x:this.camera.position.x,z:this.camera.position.z,up:[this.camera.up.x,this.camera.up.y,this.camera.up.z]},grid:256,waterVertices:this.engine.getWaterMesh().geometry.attributes.position.count};}

  fieldStats(){
    const half=this.water.textureA.texture.type===THREE.HalfFloatType;
    const bytes=half?new Uint16Array(256*256*4):new Float32Array(256*256*4);
    this.gl.readRenderTargetPixels(this.water.textureA,0,0,256,256,bytes);
    let min=Infinity,max=-Infinity,sum=0,energy=0,finite=true;
    for(let i=0;i<bytes.length;i+=4){const h=half?THREE.DataUtils.fromHalfFloat(bytes[i]):bytes[i];min=Math.min(min,h);max=Math.max(max,h);sum+=h;energy+=h*h;finite=finite&&Number.isFinite(h);}
    return {min,max,mean:sum/(256*256),energy,finite};
  }

  private registerTools(){
    const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options?:unknown)=>unknown}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
    const register=(tool:unknown)=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'get_water_state',title:'Read water settings',description:'Read the actual controls, solver clock and active rendering passes.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>this.snapshot()});
    register({name:'set_water_appearance',title:'Set water appearance',description:'Change water controls through the same validated state transitions as the visible UI.',inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(this.state).map(([key,value])=>[key,{type:typeof value==='number'?'number':typeof value==='boolean'?'boolean':'string'}])),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{
      if(!input||typeof input!=='object')throw new Error('Expected water settings.');
      this.controls.change(input as Record<string,unknown>);return this.snapshot();
    }});
    register({name:'disturb_water',title:'Create a ripple',description:'Create a real simulated ripple at an x,z point inside the visible water, using coordinates between -1 and 1.',inputSchema:{type:'object',properties:{x:{type:'number',minimum:-1,maximum:1},z:{type:'number',minimum:-1,maximum:1}},required:['x','z'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{
      const x=input as Record<string,unknown>;if(!x||typeof x.x!=='number'||typeof x.z!=='number'||Object.keys(x).some(k=>!['x','z'].includes(k)))throw new Error('Expected numeric x,z coordinates.');this.disturb(x.x,x.z);this.draw();return {rippleCreated:true,x:x.x,z:x.z};
    }});
  }
}

async function start(){
  // Capture stays opt-in; normal page clocks and randomness are untouched.
  const capture=captureOptions(location.search),clock=capture?new CaptureClock(capture):undefined;
  const controls=new WaterControls();
  const music=new PlaylistMusic({tone:()=>controls.state.tone,toneChosen:()=>controls.toneWasChosen,
    setTone:tone=>controls.change({tone},false),publish:state=>controls.publish(state)},!!clock);
  try{
    const load=new THREE.TextureLoader();
    const tile=await load.loadAsync('./assets/tiles.jpg');
    tile.wrapS=tile.wrapT=THREE.RepeatWrapping;tile.minFilter=THREE.LinearMipmapLinearFilter;tile.generateMipmaps=true;
    const sky=await new THREE.CubeTextureLoader().loadAsync(['xpos','xneg','ypos','ypos','zpos','zneg'].map(n=>`./assets/${n}.jpg`));
    sky.flipY=true;sky.colorSpace=THREE.NoColorSpace;sky.minFilter=sky.magFilter=THREE.LinearFilter;sky.generateMipmaps=false;
    const app=new Puddle(tile,sky,controls);
    app.setMusicRain(music);
    (window as Window&{puddle?:Puddle}).puddle=app;
    if(clock)exposeCapture(app,controls,clock);
  }catch(error){
    $('loading').hidden=true;
    const message=error instanceof Error?error.message:'';
    $('error').textContent=/WebGL context/i.test(message)?'The water needs WebGL 2. Enable hardware acceleration in your browser, then reload.':message||'The water could not start. Please reload.';
    $('error').hidden=false;
    controls.publish({ready:false,error:message});
    console.error(error);
  }
}
void start();
