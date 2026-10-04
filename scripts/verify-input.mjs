import assert from 'node:assert/strict';
import { build } from 'esbuild';
import * as THREE from 'three';
// Test real Three.js projection and pointer routing without requiring a browser GPU.
const {outputFiles}=await build({entryPoints:['src/PointerInteraction.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {connectWaterPointer}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));

class Canvas extends EventTarget{
  constructor(rect,failCapture=false){super();this.rect=rect;this.failCapture=failCapture;}
  getBoundingClientRect(){return this.rect;}
  setPointerCapture(){if(this.failCapture)throw new Error('Capture unavailable');}
}
function pointer(canvas,type,{x,z,camera,rect,id=1,time=100,pointerType='touch',button=0}){
  const point=new THREE.Vector3(x,0,z).project(camera);
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries({clientX:rect.left+(point.x+1)*rect.width/2,clientY:rect.top+(1-point.y)*rect.height/2,pointerId:id,timeStamp:time,pointerType,button}))Object.defineProperty(event,key,{value});
  canvas.dispatchEvent(event);
}
let scenarios=0;
for(const [width,height] of [[920,640],[390,420],[844,640]]){
  for(const failCapture of [false,true]){
    const rect={left:38,top:90,width,height},canvas=new Canvas(rect,failCapture),calls=[];
    const camera=new THREE.PerspectiveCamera(33,width/height,.01,100);
    camera.position.set(0,1.29/(Math.tan(THREE.MathUtils.degToRad(16.5))*Math.min(1,width/height)),0);
    camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    connectWaterPointer({canvas,camera,inside:(x,z,m)=>Math.hypot(x,z)<1-m,disturb:(x,z)=>calls.push([x,z]),dropSize:()=>.038});
    const send=(type,values)=>pointer(canvas,type,{camera,rect,...values});
    // Embedded touch can have button=-1; it is still a primary contact.
    send('pointerdown',{x:.3,z:-.2,button:-1});
    assert.equal(calls.length,1,'First touch must add a ripple despite capture failure');
    assert.ok(Math.abs(calls[0][0]-.3)<1e-9&&Math.abs(calls[0][1]+.2)<1e-9,'Ripple must land under the pointer');
    send('pointermove',{x:.46,z:-.1,time:145});assert.equal(calls.length,2,'Drag must disturb the water');
    send('pointermove',{x:.6,z:-.1,time:180,id:2});assert.equal(calls.length,2,'Another pointer must not hijack drag');
    send('pointercancel',{x:.46,z:-.1,time:190});
    send('pointermove',{x:.7,z:.2,time:240});assert.equal(calls.length,2,'Canceled drag must stop');
    send('pointerdown',{x:1.2,z:0,time:300});assert.equal(calls.length,2,'Dry area must not disturb water');
    send('pointerdown',{x:0,z:0,time:340,pointerType:'mouse',button:2});assert.equal(calls.length,2,'Right click must not disturb water');
    send('pointerdown',{x:0,z:0,time:380,pointerType:'mouse',button:0});assert.equal(calls.length,3,'Mouse click must add a ripple');
    scenarios++;
  }
}
console.log(JSON.stringify({inputScenariosPassed:scenarios,mouse:true,touch:true,drag:true,captureFailure:true,coordinateMapping:true}));
