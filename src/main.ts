import * as THREE from 'three';
import { Water } from './Water';
import { Renderer as WaterRenderer } from './Renderer';
import { connectWaterPointer } from './PointerInteraction';
import { fitWaterCamera, insideWater } from './Viewport';
import { applyDrawingTone, tones, type Tone } from './DrawingPalette';
import { OpenWaterBoundary } from './OpenWaterBoundary';
import { CausticPresentation } from './CausticPresentation';
import { WaterPresentation } from './WaterPresentation';
import { motionDefaults, motionRanges, rainImpulse, validateMotion } from './WaterMotion';
import { gestureKeys, gesturePattern, type GestureKey } from './GesturePatterns';
import { removeSunDisc } from './OpticsPresentation';
import { experimentDefaults, experimentSwitches, experimentRanges, printSwitches, waterBitmapSwitches, printPatterns, controlId, lightDirection, validateExperimentSettings } from './AppearanceExperiments';
import drawingVert from './shaders/Drawing.vert';
import drawingFrag from './shaders/Drawing.frag';
import printDrawingFrag from './shaders/DrawingExperiments.frag';
import bitmapWaterFrag from './shaders/BitmapWater.frag';

type Mode='ink-wash'|'etching'|'graphite'|'original';
const modes:Record<Mode,number>={'ink-wash':0,etching:1,graphite:2,original:3};
const labels:Record<Mode,string>={'ink-wash':'Ink wash',etching:'Etching',graphite:'Graphite',original:'Original'};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const POOL={width:1,length:1,depth:0.7,radius:1};
const TICK=1/60;

class Puddle {
  readonly state={mode:'etching' as Mode,tone:'night' as Tone,lineWeight:0.68,rain:true,rainRate:1.4,dropSize:0.026,paused:false,sourceGeometry:true,caustics:true,...experimentDefaults,...motionDefaults};
  readonly gl:THREE.WebGLRenderer;
  readonly water:Water;
  readonly visualWater:Water;
  readonly waterPresentation:WaterPresentation;
  readonly openBoundary:OpenWaterBoundary;
  readonly engine:WaterRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(33,1,0.01,100);
  readonly drawingScene=new THREE.Scene();
  readonly drawingCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  readonly target:THREE.WebGLRenderTarget;
  readonly litTarget:THREE.WebGLRenderTarget;
  readonly drawingTarget:THREE.WebGLRenderTarget;
  readonly drawing:THREE.ShaderMaterial;
  readonly printDrawing:THREE.ShaderMaterial;
  readonly bitmapDrawing:THREE.ShaderMaterial;
  readonly bitmapScene=new THREE.Scene();
  readonly drawingQuad:THREE.Mesh;
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
  private gestureQueue:{x:number;z:number;at:number}[]=[];
  private gestureElapsed=0;

  constructor(tile:THREE.Texture,sky:THREE.CubeTexture){
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
    this.waterPresentation=new WaterPresentation(this.water);
    this.water.updateNormals(POOL.width,POOL.length);
    this.waterPresentation.capture(this.gl,this.water);
    this.visualWater=Object.create(this.water) as Water;
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
    for(const mesh of [this.engine.getWaterMesh(),this.engine.getWaterMeshBack()])removeSunDisc(mesh.material as THREE.ShaderMaterial);
    this.flatCaustics.needsUpdate=true;
    this.engine.lightDir.set(2,2,-1).normalize();
    this.scene.add(this.engine.getPoolMesh(),this.engine.getWaterMesh(),this.engine.getWaterMeshBack());
    this.engine.markWaterOpticsHidden();
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.litTarget=this.target.clone();this.drawingTarget=this.target.clone();
    this.drawing=new THREE.ShaderMaterial({vertexShader:drawingVert,fragmentShader:drawingFrag,uniforms:{
      sceneColor:{value:this.target.texture},water:{value:this.water.textureA.texture},caustics:{value:false},pixel:{value:new THREE.Vector2()},pixelRatio:{value:this.gl.getPixelRatio()},poolSize:{value:new THREE.Vector2(POOL.width,POOL.length)},inverseViewProjection:{value:this.inverseViewProjection},eye:{value:this.camera.position},paper:{value:new THREE.Color()},ink:{value:new THREE.Color()},lineWeight:{value:this.state.lineWeight},mode:{value:0},sourceGeometry:{value:true},
      ...Object.fromEntries(Object.entries(experimentDefaults).map(([key,value])=>[key,{value}])),
    },depthTest:false,depthWrite:false,toneMapped:false});
    this.printDrawing=new THREE.ShaderMaterial({vertexShader:drawingVert,fragmentShader:printDrawingFrag,uniforms:this.drawing.uniforms,depthTest:false,depthWrite:false,toneMapped:false});
    this.bitmapDrawing=new THREE.ShaderMaterial({vertexShader:drawingVert,fragmentShader:bitmapWaterFrag,uniforms:{...this.drawing.uniforms,baseColor:{value:this.drawingTarget.texture},litScene:{value:this.litTarget.texture},flatScene:{value:this.target.texture}},depthTest:false,depthWrite:false,toneMapped:false});
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
    this.connectControls();
    this.connectPointer();
    this.resize();
    new ResizeObserver(()=>this.resize()).observe($('stage'));
    window.addEventListener('resize',()=>this.resize());
    document.addEventListener('visibilitychange',()=>{this.lastTime=0;this.accumulator=0;});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.animating=false;$('error').textContent='The graphics context was interrupted. Reload to return to the water.';$('error').hidden=false;});
    this.applyAppearance();
    // Same drop function and two solver steps per update as the source demo.
    const drops=[[-0.34,-0.23,0.018,-this.state.rainForce],[0.28,0.18,0.016,-this.state.rainForce],[-0.12,0.35,0.014,-this.state.rainForce],[0.41,-0.25,0.014,-this.state.rainForce]];
    for(const [x,z,r,s] of drops)this.addDrop(x,z,r,s);
    this.advance(22);
    this.waterPresentation.capture(this.gl,this.water);
    this.draw();
    $('loading').hidden=true;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.state.paused=true;this.pausedByPreference=true;this.updateControls();}
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
    this.litTarget.setSize(size.x,size.y);this.drawingTarget.setSize(size.x,size.y);
    this.drawing.uniforms.pixel.value.set(1/size.x,1/size.y);
    this.drawing.uniforms.pixelRatio.value=this.gl.getPixelRatio();
    this.engine.setSize(Math.min(size.x,1024),Math.min(size.y,1024));
    if(this.water)this.draw();
  }

  advance(ticks:number){
    for(let i=0;i<ticks;i++){
      this.waterPresentation.capture(this.gl,this.water);
      this.water.stepSimulation(POOL.width,POOL.length);
      this.openBoundary.apply(this.gl,this.water);
      this.water.stepSimulation(POOL.width,POOL.length);
      this.openBoundary.apply(this.gl,this.water);
      this.simulationSteps+=2;
      this.water.updateNormals(POOL.width,POOL.length);
    }
  }

  draw(){
    this.visualWater.textureA=this.waterPresentation.present(this.gl,this.water,this.accumulator/TICK);
    this.engine.updateObjectTextures(this.scene,this.camera,null);
    const projectedCaustics=this.state.caustics&&(this.state.mode==='original'||!this.state.alignedCaustics);
    const needsFocus=this.state.mode!=='original'&&(this.state.causticRipples||this.state.causticReveal);
    if(projectedCaustics||needsFocus)this.engine.updateCaustics(this.visualWater);
    this.engine.renderPool(this.visualWater);
    this.engine.renderWater(this.visualWater,this.camera);
    const lightMap=(projectedCaustics||needsFocus)?this.causticPresentation.texture(this.gl,this.engine.objectRenderResources.causticTexture,this.state.causticsStrength):this.flatCaustics;
    this.gl.setClearColor(0x000000,0);
    const renderSurface=(target:THREE.WebGLRenderTarget,map:THREE.Texture)=>{
      for(const mesh of [this.engine.getPoolMesh(),this.engine.getWaterMesh(),this.engine.getWaterMeshBack()])(mesh.material as THREE.ShaderMaterial).uniforms.causticTex.value=map;
      this.gl.setRenderTarget(target);this.gl.clear();this.gl.render(this.scene,this.camera);
    };
    if(needsFocus){renderSurface(this.litTarget,lightMap);renderSurface(this.target,this.flatCaustics);}
    else renderSurface(this.target,lightMap);
    this.drawing.uniforms.sceneColor.value=needsFocus&&projectedCaustics?this.litTarget.texture:this.target.texture;
    this.drawing.uniforms.water.value=this.visualWater.textureA.texture;
    this.gl.setClearColor(tones[this.state.tone].paper,1);
    const printActive=this.state.mode!=='original'&&(printSwitches.some(key=>this.state[key])||(this.state.caustics&&this.state.alignedCaustics));
    const bitmapActive=this.state.mode!=='original'&&(this.state.causticRipples||this.state.dreamy||this.state.subtle||waterBitmapSwitches.some(key=>this.state[key]));
    this.drawingQuad.material=printActive?this.printDrawing:this.drawing;
    this.gl.setRenderTarget(bitmapActive?this.drawingTarget:null);
    this.gl.render(this.drawingScene,this.drawingCamera);
    if(bitmapActive){this.gl.setRenderTarget(null);this.gl.render(this.bitmapScene,this.drawingCamera);}
  }

  private animate=(now:number)=>{
    if(!this.animating)return;
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,0.1):0;this.lastTime=now;
    if(!this.state.paused){
      this.accumulator+=dt*this.state.waveSpeed*(this.state.dreamy?.65:1);
      this.gestureElapsed+=dt*1000;
      while(this.gestureQueue.length&&this.gestureQueue[0].at<=this.gestureElapsed){const point=this.gestureQueue.shift()!;this.addDrop(point.x,point.z,this.state.dropSize*this.state.rippleScale,-this.state.touchForce*(this.state.subtle?.55:1));}
      if(this.state.rain&&now>this.clearRainUntil){
        this.rainAccumulator+=dt*this.state.rainRate;
        while(this.rainAccumulator>=1){
          this.rainAccumulator-=1;
          const point=this.randomPoint(),drop=rainImpulse(this.state.rainForce*(this.state.subtle?.55:1),this.state.rippleScale);
          this.addDrop(point.x,point.y,drop.radius,drop.strength);
        }
      }
      let ticks=0;
      while(this.accumulator>=TICK&&ticks<6){
        this.advance(1);this.accumulator-=TICK;ticks++;
      }
      this.draw();
    }
    requestAnimationFrame(this.animate);
  };

  inside(x:number,z:number,margin=0){return insideWater(x,z,margin);}

  private addDrop(x:number,z:number,radius:number,strength:number){
    // Every mark is an actual upstream impact, never a replacement ripple animation.
    this.water.addDrop(x,z,radius,strength,POOL.width,POOL.length);
    this.water.updateNormals(POOL.width,POOL.length);
    this.waterPresentation.capture(this.gl,this.water);
  }

  private randomPoint(){
    const rect=$('stage').getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);
    const halfX=0.98*Math.min(1,aspect),halfZ=0.98/Math.max(1,aspect);
    return new THREE.Vector2((Math.random()*2-1)*halfX*0.93,(Math.random()*2-1)*halfZ*0.93);
  }

  disturb(x:number,z:number){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!this.inside(x,z,0.015))throw new Error('Choose a point inside the water.');
    // An intentional gesture opts into motion after an automatic accessibility pause.
    // A pause chosen with the Pause button is still respected.
    if(this.pausedByPreference){this.pausedByPreference=false;this.state.paused=false;this.lastTime=0;this.accumulator=0;this.updateControls();}
    this.addDrop(x,z,this.state.dropSize*this.state.rippleScale,-this.state.touchForce*(this.state.subtle?.55:1));
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
    this.gestureElapsed=0;
    const first=this.gestureQueue.shift()!;this.disturb(first.x,first.z);
    $('interaction-hint').textContent='Playing '+(key==='/'?'slash':key.toUpperCase())+' gesture. Same path, every time.';
  }

  clear(){
    const previous=this.gl.getRenderTarget(),color=new THREE.Color();this.gl.getClearColor(color);const alpha=this.gl.getClearAlpha();
    this.gl.setClearColor(0,0);
    for(const target of [this.water.textureA,this.water.textureB]){this.gl.setRenderTarget(target);this.gl.clear();}
    this.gl.setRenderTarget(previous);this.gl.setClearColor(color,alpha);
    this.gestureQueue=[];
    this.water.updateNormals(POOL.width,POOL.length);this.waterPresentation.capture(this.gl,this.water);
    this.rainAccumulator=0;this.clearRainUntil=performance.now()+1800;this.draw();
  }

  applyAppearance(){
    if(this.state.causticRipples){this.state.caustics=false;this.state.alignedCaustics=false;}
    const {mode,tone,lineWeight,sourceGeometry,caustics}=this.state;
    document.body.dataset.tone=tone;
    applyDrawingTone(this.drawing.uniforms.paper.value,this.drawing.uniforms.ink.value,tone);
    this.drawing.uniforms.mode.value=modes[mode];this.drawing.uniforms.lineWeight.value=lineWeight;
    this.drawing.uniforms.sourceGeometry.value=sourceGeometry;
    this.drawing.uniforms.caustics.value=caustics&&!this.state.alignedCaustics;
    for(const key of Object.keys(experimentDefaults) as (keyof typeof experimentDefaults)[])this.drawing.uniforms[key].value=this.state[key];
    this.drawing.uniforms.alignedCaustics.value=caustics&&this.state.alignedCaustics;
    this.engine.lightDir.copy(lightDirection(this.state));
    for(const mesh of [this.engine.getPoolMesh(),this.engine.getWaterMesh(),this.engine.getWaterMeshBack()]){
      (mesh.material as THREE.ShaderMaterial).uniforms.tiles.value=mode==='original'?this.tile:this.matte;
    }
    this.updateControls();this.draw();
  }

  updateControls(){
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===this.state.mode)));
    document.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tone===this.state.tone)));
    $('style-caption').textContent=labels[this.state.mode];
    $<HTMLInputElement>('line-weight').value=String(this.state.lineWeight);
    $('weight-value').textContent=this.state.lineWeight<1?'Fine':this.state.lineWeight<1.7?'Medium':'Bold';
    $<HTMLInputElement>('rain').checked=this.state.rain;
    $<HTMLInputElement>('caustics').checked=this.state.caustics;
    $<HTMLInputElement>('caustics').disabled=this.state.causticRipples;
    $('ripple-note').textContent=this.state.causticRipples?'Refracted light shapes, drawn as ripples. Caustic lighting is off.':'The existing surface drawing, with open edges and no wall echoes.';
    $<HTMLInputElement>('rain-rate').value=String(this.state.rainRate);
    $<HTMLInputElement>('rain-rate').disabled=!this.state.rain;
    $('rain-value').textContent=!this.state.rain?'Off':this.state.rainRate<2?'Light':this.state.rainRate<5?'Steady':'Heavy';
    $('size-value').textContent=this.state.dropSize<0.029?'Small':this.state.dropSize<0.05?'Medium':'Large';
    $<HTMLInputElement>('drop-size').value=String(this.state.dropSize);
    for(const key of Object.keys(motionRanges) as (keyof typeof motionRanges)[]){
      $<HTMLInputElement>(controlId(key)).value=String(this.state[key]);
      $(controlId(key)+'-value').textContent=Math.round(this.state[key]*(key.endsWith('Force')?100/.0095:100))+'%';
    }
    $('pause').setAttribute('aria-pressed',String(this.state.paused));
    $('pause-label').textContent=this.state.paused?'Resume':'Pause';
    $('pause').querySelector('.pause-symbol')!.textContent=this.state.paused?'▷':'Ⅱ';
    $<HTMLInputElement>('line-weight').disabled=this.state.mode==='original';
    $('tone-field').style.opacity=this.state.mode==='original'?'.5':'1';
    $<HTMLFieldSetElement>('print-fields').disabled=this.state.mode==='original';
    $<HTMLFieldSetElement>('bitmap-fields').disabled=this.state.mode==='original';
    $<HTMLInputElement>('caustic-ripples').disabled=this.state.mode==='original';
    for(const key of experimentSwitches)$<HTMLInputElement>(controlId(key)).checked=this.state[key];
    for(const key of Object.keys(experimentRanges) as (keyof typeof experimentRanges)[]){
      $<HTMLInputElement>(controlId(key)).value=String(this.state[key]);
      const value=this.state[key];
      $(controlId(key)+'-value').textContent=['bitmapScale','revealWidth','waterBitmapScale','dreamSoftness'].includes(key)?value.toFixed(key==='bitmapScale'?1:0)+' px':key==='waterBitmapLevels'?Math.round(value)+' shades':key.startsWith('light')?Math.round(value)+'°':Math.round(value*100)+'%';
    }
    document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pattern)===this.state.bitmapPattern)));
    const printActive=printSwitches.some(key=>this.state[key]);
    $<HTMLInputElement>('bitmap-scale').disabled=!printActive;
    $<HTMLInputElement>('bitmap-strength').disabled=!(this.state.bitmapRipples||this.state.textureReveal);
    $<HTMLInputElement>('texture-faint').disabled=!(this.state.printedPaper||this.state.textureReveal||this.state.textureRefraction);
    $<HTMLInputElement>('refraction-strength').disabled=!this.state.textureRefraction;
    $<HTMLInputElement>('reveal-width').disabled=!(this.state.bitmapRipples||this.state.textureReveal||(this.state.caustics&&this.state.alignedCaustics));
    $<HTMLFieldSetElement>('caustic-fields').disabled=!(this.state.caustics||this.state.causticRipples||this.state.causticReveal);
    $<HTMLInputElement>('aligned-caustics').disabled=this.state.mode==='original'||this.state.causticRipples;
    $<HTMLInputElement>('caustic-ink').disabled=!this.state.causticRipples;
    $<HTMLInputElement>('dream-softness').disabled=!(this.state.softDiffusion||this.state.dreamy);
    $<HTMLInputElement>('water-bitmap-levels').disabled=!this.state.bitmapTones;
    for(const key of ['light-azimuth','light-elevation','overhead-light'])$<HTMLInputElement>(key).disabled=this.state.caustics&&this.state.alignedCaustics&&this.state.mode!=='original';
    for(const key of ['light-azimuth','light-elevation'])$<HTMLInputElement>(key).disabled=$<HTMLInputElement>(key).disabled||this.state.overheadLight;
    $('caustic-note').textContent=this.state.alignedCaustics&&this.state.mode!=='original'?'Surface glow follows the ripple positions. An artistic alignment experiment.':'Projected light falls below the water. Its highlights can sit apart from the ripple crests.';
  }

  private connectControls(){
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>{this.state.mode=b.dataset.mode as Mode;this.applyAppearance();});
    document.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(b=>b.onclick=()=>{this.state.tone=b.dataset.tone as Tone;this.applyAppearance();});
    $<HTMLInputElement>('line-weight').oninput=e=>{this.state.lineWeight=Number((e.target as HTMLInputElement).value);this.applyAppearance();};
    $<HTMLInputElement>('rain').onchange=e=>{this.state.rain=(e.target as HTMLInputElement).checked;this.updateControls();};
    $<HTMLInputElement>('caustics').onchange=e=>{this.state.caustics=(e.target as HTMLInputElement).checked;this.applyAppearance();};
    for(const key of experimentSwitches)$<HTMLInputElement>(controlId(key)).onchange=e=>{this.state[key]=(e.target as HTMLInputElement).checked;this.applyAppearance();};
    for(const key of Object.keys(experimentRanges) as (keyof typeof experimentRanges)[])$<HTMLInputElement>(controlId(key)).oninput=e=>{this.state[key]=Number((e.target as HTMLInputElement).value);this.applyAppearance();};
    for(const key of Object.keys(motionRanges) as (keyof typeof motionRanges)[])$<HTMLInputElement>(controlId(key)).oninput=e=>{this.state[key]=Number((e.target as HTMLInputElement).value);this.updateControls();};
    document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(b=>b.onclick=()=>{this.state.bitmapPattern=Number(b.dataset.pattern);this.applyAppearance();});
    $('reset-experiments').onclick=()=>{Object.assign(this.state,experimentDefaults);this.applyAppearance();};
    $<HTMLInputElement>('rain-rate').oninput=e=>{this.state.rainRate=Number((e.target as HTMLInputElement).value);this.updateControls();};
    $<HTMLInputElement>('drop-size').oninput=e=>{this.state.dropSize=Number((e.target as HTMLInputElement).value);this.updateControls();};
    $('clear').onclick=()=>this.clear();
    $('pause').onclick=()=>{this.pausedByPreference=false;this.state.paused=!this.state.paused;this.lastTime=0;this.updateControls();};
    $('toggle-controls').onclick=()=>{const hidden=document.body.classList.toggle('controls-hidden');$('toggle-controls').setAttribute('aria-expanded',String(!hidden));$('toggle-controls').textContent=hidden?'Show controls':'Hide controls';this.resize();};
    window.addEventListener('keydown',e=>{
      if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
      if((e.target as Element)?.closest?.('textarea,select,[contenteditable="true"],input:not([type="range"]):not([type="checkbox"]):not([type="button"])'))return;
      const key=e.key.toLowerCase();
      if(e.code==='Space'||key===' '){e.preventDefault();$('pause').click();}
      else if(key==='h'){e.preventDefault();$('toggle-controls').click();}
      else if(gestureKeys.includes(key as GestureKey)){e.preventDefault();this.playGesture(key as GestureKey);}
    });
    document.querySelectorAll<HTMLButtonElement>('[data-gesture]').forEach(button=>button.onclick=()=>this.playGesture(button.dataset.gesture as GestureKey));
  }

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
    const appearanceKeys=['mode','tone','caustics',...Object.keys(experimentDefaults),...Object.keys(motionRanges)];
    register({name:'set_water_appearance',title:'Set water appearance',description:'Change the drawing, bitmap experiments, motion, or lighting settings while retaining the source water solver.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:Object.keys(modes)},tone:{type:'string',enum:Object.keys(tones)},caustics:{type:'boolean'},bitmapPattern:{type:'integer',minimum:0,maximum:printPatterns.length-1},...Object.fromEntries(experimentSwitches.map(key=>[key,{type:'boolean'}])),...Object.fromEntries(Object.entries({...experimentRanges,...motionRanges}).map(([key,{min,max}])=>[key,{type:'number',minimum:min,maximum:max}]))},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{
      if(!input||typeof input!=='object')throw new Error('Expected appearance settings.');
      const x=input as Record<string,unknown>;for(const key of Object.keys(x))if(!appearanceKeys.includes(key))throw new Error('Unknown setting.');
      if(x.mode!==undefined&&(typeof x.mode!=='string'||!Object.hasOwn(modes,x.mode)))throw new Error('Unknown drawing mode.');
      if(x.tone!==undefined&&(typeof x.tone!=='string'||!Object.hasOwn(tones,x.tone)))throw new Error('Unknown tone.');
      if(x.caustics!==undefined&&typeof x.caustics!=='boolean')throw new Error('caustics must be boolean.');
      validateExperimentSettings(x);validateMotion(x);
      for(const [key,value] of Object.entries(x))if(value!==undefined)Object.assign(this.state,{[key]:value});
      this.applyAppearance();return this.snapshot();
    }});
    register({name:'disturb_water',title:'Create a ripple',description:'Create a real simulated ripple at an x,z point inside the visible water, using coordinates between -1 and 1.',inputSchema:{type:'object',properties:{x:{type:'number',minimum:-1,maximum:1},z:{type:'number',minimum:-1,maximum:1}},required:['x','z'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{
      const x=input as Record<string,unknown>;if(!x||typeof x.x!=='number'||typeof x.z!=='number'||Object.keys(x).some(k=>!['x','z'].includes(k)))throw new Error('Expected numeric x,z coordinates.');this.disturb(x.x,x.z);this.draw();return {rippleCreated:true,x:x.x,z:x.z};
    }});
  }
}

async function start(){
  try{
    const load=new THREE.TextureLoader();
    const tile=await load.loadAsync('./assets/tiles.jpg');
    tile.wrapS=tile.wrapT=THREE.RepeatWrapping;tile.minFilter=THREE.LinearMipmapLinearFilter;tile.generateMipmaps=true;
    const sky=await new THREE.CubeTextureLoader().loadAsync(['xpos','xneg','ypos','ypos','zpos','zneg'].map(n=>`./assets/${n}.jpg`));
    sky.flipY=true;sky.colorSpace=THREE.NoColorSpace;sky.minFilter=sky.magFilter=THREE.LinearFilter;sky.generateMipmaps=false;
    const app=new Puddle(tile,sky);
    (window as Window&{puddle?:Puddle}).puddle=app;
  }catch(error){
    $('loading').hidden=true;
    const message=error instanceof Error?error.message:'';
    $('error').textContent=/WebGL context/i.test(message)?'The water needs WebGL 2. Enable hardware acceleration in your browser, then reload.':message||'The water could not start. Please reload.';
    $('error').hidden=false;
    document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input').forEach(control=>control.disabled=true);
    console.error(error);
  }
}
void start();
