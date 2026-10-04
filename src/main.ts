import * as THREE from 'three';
import { Water } from './Water';
import { Renderer as WaterRenderer } from './Renderer';
import { connectWaterPointer } from './PointerInteraction';
import drawingVert from './shaders/Drawing.vert';
import drawingFrag from './shaders/Drawing.frag';

type Mode='ink-wash'|'etching'|'graphite'|'original';
type Tone='paper'|'silver'|'night';
const modes:Record<Mode,number>={'ink-wash':0,etching:1,graphite:2,original:3};
const labels:Record<Mode,string>={'ink-wash':'Ink wash',etching:'Etching',graphite:'Graphite',original:'Original'};
const tones:Record<Tone,{paper:number;ink:number}>={paper:{paper:0xf5f5f5,ink:0x232323},silver:{paper:0xdfdfdf,ink:0x292929},night:{paper:0x161616,ink:0xdddddd}};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const POOL={width:1,length:1,depth:0.7,radius:1};
const TICK=1/60;

class Puddle {
  readonly state={mode:'ink-wash' as Mode,tone:'paper' as Tone,lineWeight:0.85,rain:true,rainRate:1.4,dropSize:0.038,paused:false,sourceGeometry:true};
  readonly gl:THREE.WebGLRenderer;
  readonly water:Water;
  readonly engine:WaterRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(33,1,0.01,100);
  readonly drawingScene=new THREE.Scene();
  readonly drawingCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  readonly target:THREE.WebGLRenderTarget;
  readonly drawing:THREE.ShaderMaterial;
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

  constructor(tile:THREE.Texture,sky:THREE.CubeTexture){
    this.tile=tile;
    this.gl=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.gl.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.gl.outputColorSpace=THREE.SRGBColorSpace;
    if(!this.gl.extensions.has('EXT_color_buffer_float')) throw new Error('This study needs WebGL 2 with floating-point textures. Enable hardware acceleration in your browser and reload.');
    this.water=new Water(this.gl);
    const bytes=new Uint8Array(64*64*4);
    // A quiet grayscale paper-like material. Textures are appearance, not geometry.
    let seed=1857;
    for(let i=0;i<64*64;i++){seed=(seed*1664525+1013904223)>>>0;const c=214+(seed%8);bytes.set([c,c,c,255],i*4);}
    this.matte=new THREE.DataTexture(bytes,64,64,THREE.RGBAFormat);
    this.matte.wrapS=this.matte.wrapT=THREE.RepeatWrapping;
    this.matte.minFilter=this.matte.magFilter=THREE.LinearFilter;
    this.matte.needsUpdate=true;
    this.engine=new WaterRenderer(this.gl,tile,sky);
    this.engine.setPoolShape('RoundedBox',POOL.radius,POOL.width,POOL.depth,POOL.length);
    this.engine.lightDir.set(2,2,-1).normalize();
    this.scene.add(this.engine.getPoolMesh(),this.engine.getWaterMesh(),this.engine.getWaterMeshBack());
    this.engine.markWaterOpticsHidden();
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.drawing=new THREE.ShaderMaterial({vertexShader:drawingVert,fragmentShader:drawingFrag,uniforms:{
      sceneColor:{value:this.target.texture},water:{value:this.water.textureA.texture},pixel:{value:new THREE.Vector2()},poolSize:{value:new THREE.Vector2(POOL.width,POOL.length)},inverseViewProjection:{value:this.inverseViewProjection},eye:{value:this.camera.position},paper:{value:new THREE.Color()},ink:{value:new THREE.Color()},lineWeight:{value:this.state.lineWeight},mode:{value:0},sourceGeometry:{value:true},
    },depthTest:false,depthWrite:false,toneMapped:false});
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.drawing);
    quad.frustumCulled=false;
    this.drawingScene.add(quad);
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
    const drops=[[-0.34,-0.23,0.032,-0.01],[0.28,0.18,0.029,0.012],[-0.12,0.35,0.027,-0.009],[0.41,-0.25,0.023,0.008]];
    for(const [x,z,r,s] of drops)this.water.addDrop(x,z,r,s,POOL.width,POOL.length);
    this.advance(22);
    this.draw();
    $('loading').hidden=true;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.state.paused=true;this.pausedByPreference=true;this.updateControls();}
    requestAnimationFrame(this.animate);
    this.registerTools();
  }

  resize(){
    const rect=$('stage').getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    this.gl.setSize(width,height);
    this.camera.aspect=width/height;
    // Keep the whole source circle visible at every aspect ratio, without camera tilt.
    this.camera.position.y=1.29/(Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*Math.min(1,this.camera.aspect));
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.inverseViewProjection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).invert();
    const size=this.gl.getDrawingBufferSize(new THREE.Vector2());
    this.target.setSize(size.x,size.y);
    this.drawing.uniforms.pixel.value.set(1/size.x,1/size.y);
    this.engine.setSize(Math.min(size.x,1024),Math.min(size.y,1024));
    if(this.water)this.draw();
  }

  advance(ticks:number){
    for(let i=0;i<ticks;i++){
      this.water.stepSimulation(POOL.width,POOL.length);
      this.water.stepSimulation(POOL.width,POOL.length);
      this.simulationSteps+=2;
    }
  }

  draw(){
    this.water.updateNormals(POOL.width,POOL.length);
    this.engine.updateObjectTextures(this.scene,this.camera,null);
    this.engine.updateCaustics(this.water);
    this.engine.renderPool(this.water);
    this.engine.renderWater(this.water,this.camera);
    this.gl.setClearColor(0x000000,0);
    this.gl.setRenderTarget(this.target);this.gl.clear();
    this.gl.render(this.scene,this.camera);
    this.drawing.uniforms.water.value=this.water.textureA.texture;
    this.gl.setRenderTarget(null);
    this.gl.setClearColor(tones[this.state.tone].paper,1);
    this.gl.render(this.drawingScene,this.drawingCamera);
  }

  private animate=(now:number)=>{
    if(!this.animating)return;
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,0.1):0;this.lastTime=now;
    if(!this.state.paused){
      this.accumulator+=dt;
      let ticks=0;
      while(this.accumulator>=TICK&&ticks<6){
        if(this.state.rain&&now>this.clearRainUntil){
          this.rainAccumulator+=TICK*this.state.rainRate;
          if(this.rainAccumulator>=1){
            this.rainAccumulator-=1;
            const point=this.randomPoint();
            this.water.addDrop(point.x,point.y,0.016+Math.random()*0.012,-0.006-Math.random()*0.007,POOL.width,POOL.length);
          }
        }
        this.advance(1);this.accumulator-=TICK;ticks++;
      }
      if(ticks)this.draw();
    }
    requestAnimationFrame(this.animate);
  };

  inside(x:number,z:number,margin=0){
    if(this.state.sourceGeometry)return Math.hypot(x,z)<1-margin;
    const qx=x/0.96,qz=z/0.77,a=Math.atan2(qz,qx);
    const r=0.87+0.06*Math.cos(3*a+0.5)+0.032*Math.sin(5*a-0.7)+0.018*Math.cos(7*a);
    return Math.hypot(qx,qz)<r-margin;
  }

  private randomPoint(){
    for(let i=0;i<100;i++){const x=Math.random()*1.72-0.86,z=Math.random()*1.5-0.75;if(this.inside(x,z,0.07))return new THREE.Vector2(x,z);}
    return new THREE.Vector2(0,0);
  }

  disturb(x:number,z:number){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!this.inside(x,z,0.015))throw new Error('Choose a point inside the water.');
    // An intentional gesture opts into motion after an automatic accessibility pause.
    // A pause chosen with the Pause button is still respected.
    if(this.pausedByPreference){this.pausedByPreference=false;this.state.paused=false;this.lastTime=0;this.accumulator=0;this.updateControls();}
    this.water.addDrop(x,z,this.state.dropSize,-0.02,POOL.width,POOL.length);
    // A gesture must be visible even if an embedded view throttles animation frames.
    this.draw();
  }

  clear(){
    const previous=this.gl.getRenderTarget(),color=new THREE.Color();this.gl.getClearColor(color);const alpha=this.gl.getClearAlpha();
    this.gl.setClearColor(0,0);
    for(const target of [this.water.textureA,this.water.textureB]){this.gl.setRenderTarget(target);this.gl.clear();}
    this.gl.setRenderTarget(previous);this.gl.setClearColor(color,alpha);
    this.rainAccumulator=0;this.clearRainUntil=performance.now()+1800;this.draw();
  }

  applyAppearance(){
    const {mode,tone,lineWeight,sourceGeometry}=this.state;
    document.body.dataset.tone=tone;
    // Exact RGB grayscale values; no warm tint is introduced by color management.
    this.drawing.uniforms.paper.value.set(tones[tone].paper,THREE.LinearSRGBColorSpace);
    this.drawing.uniforms.ink.value.set(tones[tone].ink,THREE.LinearSRGBColorSpace);
    this.drawing.uniforms.mode.value=modes[mode];this.drawing.uniforms.lineWeight.value=lineWeight;
    this.drawing.uniforms.sourceGeometry.value=sourceGeometry;
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
    $<HTMLInputElement>('source-geometry').checked=this.state.sourceGeometry;
    $('geometry-note').textContent=this.state.sourceGeometry?'Original meshes. Original wave solver.':'Freeform outline. Same wave solver.';
    $<HTMLInputElement>('rain-rate').value=String(this.state.rainRate);
    $<HTMLInputElement>('rain-rate').disabled=!this.state.rain;
    $('rain-value').textContent=!this.state.rain?'Off':this.state.rainRate<2?'Light':this.state.rainRate<5?'Steady':'Heavy';
    $('size-value').textContent=this.state.dropSize<0.029?'Small':this.state.dropSize<0.05?'Medium':'Large';
    $<HTMLInputElement>('drop-size').value=String(this.state.dropSize);
    $('pause').setAttribute('aria-pressed',String(this.state.paused));
    $('pause-label').textContent=this.state.paused?'Resume':'Pause';
    $('pause').querySelector('.pause-symbol')!.textContent=this.state.paused?'▷':'Ⅱ';
    $<HTMLInputElement>('line-weight').disabled=this.state.mode==='original';
    $('tone-field').style.opacity=this.state.mode==='original'?'.5':'1';
  }

  private connectControls(){
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>{this.state.mode=b.dataset.mode as Mode;this.applyAppearance();});
    document.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(b=>b.onclick=()=>{this.state.tone=b.dataset.tone as Tone;this.applyAppearance();});
    $<HTMLInputElement>('line-weight').oninput=e=>{this.state.lineWeight=Number((e.target as HTMLInputElement).value);this.applyAppearance();};
    $<HTMLInputElement>('rain').onchange=e=>{this.state.rain=(e.target as HTMLInputElement).checked;this.updateControls();};
    $<HTMLInputElement>('source-geometry').onchange=e=>{this.state.sourceGeometry=(e.target as HTMLInputElement).checked;this.applyAppearance();};
    $<HTMLInputElement>('rain-rate').oninput=e=>{this.state.rainRate=Number((e.target as HTMLInputElement).value);this.updateControls();};
    $<HTMLInputElement>('drop-size').oninput=e=>{this.state.dropSize=Number((e.target as HTMLInputElement).value);this.updateControls();};
    $('clear').onclick=()=>this.clear();
    $('pause').onclick=()=>{this.pausedByPreference=false;this.state.paused=!this.state.paused;this.accumulator=0;this.updateControls();};
    $('toggle-controls').onclick=()=>{const hidden=document.body.classList.toggle('controls-hidden');$('toggle-controls').setAttribute('aria-expanded',String(!hidden));$('toggle-controls').textContent=hidden?'Show controls':'Hide controls';this.resize();};
    window.addEventListener('keydown',e=>{
      if((e.target as HTMLElement).matches('input,button,summary,a'))return;
      if(e.code==='Space'){e.preventDefault();$('pause').click();}
      if(e.key.toLowerCase()==='h')$('toggle-controls').click();
    });
  }

  private connectPointer(){
    connectWaterPointer({canvas:this.gl.domElement,camera:this.camera,inside:(x,z,margin)=>this.inside(x,z,margin),disturb:(x,z)=>this.disturb(x,z),dropSize:()=>this.state.dropSize});
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
    register({name:'set_water_appearance',title:'Set water appearance',description:'Change the visible drawing style, paper tone, or source-geometry setting without changing the water solver.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:Object.keys(modes)},tone:{type:'string',enum:Object.keys(tones)},sourceGeometry:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{
      if(!input||typeof input!=='object')throw new Error('Expected appearance settings.');
      const x=input as Record<string,unknown>;for(const key of Object.keys(x))if(!['mode','tone','sourceGeometry'].includes(key))throw new Error('Unknown setting.');
      if(x.mode!==undefined&&(typeof x.mode!=='string'||!Object.hasOwn(modes,x.mode)))throw new Error('Unknown drawing mode.');
      if(x.tone!==undefined&&(typeof x.tone!=='string'||!Object.hasOwn(tones,x.tone)))throw new Error('Unknown tone.');
      if(x.sourceGeometry!==undefined&&typeof x.sourceGeometry!=='boolean')throw new Error('sourceGeometry must be boolean.');
      if(x.mode!==undefined)this.state.mode=x.mode as Mode;if(x.tone!==undefined)this.state.tone=x.tone as Tone;if(x.sourceGeometry!==undefined)this.state.sourceGeometry=x.sourceGeometry as boolean;
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
