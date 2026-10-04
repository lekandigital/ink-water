import * as THREE from 'three';
import type { GestureKey } from './GesturePatterns';

// Deterministic recording harness for social assets, enabled only by ?capture=1.
// It replaces the page clock and random source before the water starts, so a
// script can step exact 60 Hz frames. The simulation code itself is unchanged.
export type CaptureOptions={seed:number;fps:number};
type CaptureApp={readonly camera:THREE.PerspectiveCamera;disturb(x:number,z:number):void;playGesture(key:GestureKey):void;clear():void;snapshot():unknown};
type CaptureControls={change(input:Record<string,unknown>):void};
export type CaptureAction=
  |{type:'settings';settings:Record<string,unknown>}
  |{type:'touch';x:number;y:number}
  |{type:'gesture';key:GestureKey}
  |{type:'still'}
  |{type:'seed';seed:number};

export function captureOptions(search:string):CaptureOptions|null{
  const params=new URLSearchParams(search),value=params.get('capture');
  if(value===null||value==='0'||value==='false')return null;
  const seed=Number(params.get('seed')??1),fps=Number(params.get('fps')??60);
  return {seed:Number.isFinite(seed)?seed:1,fps:Number.isFinite(fps)&&fps>0&&fps<=240?fps:60};
}

/** mulberry32: small, fast and identical in every browser. */
export function seededRandom(seed:number){
  let a=seed>>>0;
  return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}

export class CaptureClock{
  private now=1000;
  private queue:FrameRequestCallback[]=[];
  private handle=0;
  // A negligible excess keeps every frame on exactly one solver tick at 60 fps
  // instead of letting floating-point rounding alternate between zero and two.
  readonly frameMs:number;
  constructor(readonly options:CaptureOptions){
    this.frameMs=1000/options.fps+1e-6;
    this.seed(options.seed);
    window.requestAnimationFrame=callback=>{this.queue.push(callback);return ++this.handle;};
    window.cancelAnimationFrame=()=>{};
    Object.defineProperty(performance,'now',{configurable:true,value:()=>this.now});
    document.body.classList.add('capture');
  }
  seed(seed:number){Math.random=seededRandom(seed);}
  frame(){
    this.now+=this.frameMs;
    const callbacks=this.queue;this.queue=[];
    for(const callback of callbacks)callback(this.now);
  }
}

export function exposeCapture(app:CaptureApp,controls:CaptureControls,clock:CaptureClock){
  const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  // x and y are screen positions from -1 to 1, with y pointing down, like the gesture paths.
  const touch=(x:number,y:number)=>{
    raycaster.setFromCamera(new THREE.Vector2(x,-y),app.camera);
    const p=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    if(!p)throw new Error('That point is outside the water.');
    app.disturb(p.x,p.z);
  };
  const apply=(action:CaptureAction)=>{
    if(action.type==='settings')controls.change(action.settings);
    else if(action.type==='touch')touch(action.x,action.y);
    else if(action.type==='gesture')app.playGesture(action.key);
    else if(action.type==='still')app.clear();
    else if(action.type==='seed')clock.seed(action.seed);
    else throw new Error('Unknown capture action.');
  };
  (window as Window&{inkWaterCapture?:unknown}).inkWaterCapture={
    ready:true,fps:clock.options.fps,
    apply:(...actions:CaptureAction[])=>{for(const action of actions)apply(action);},
    frames:(count=1)=>{for(let i=0;i<count;i++)clock.frame();},
    state:()=>app.snapshot(),
  };
}
