import * as THREE from 'three';

/** Pointer input is separate from rendering so captures cannot swallow a ripple. */
export function connectWaterPointer({canvas,camera,inside,disturb,disturbSegment,continuous,dropSize}:{
  canvas:HTMLCanvasElement;
  camera:THREE.PerspectiveCamera;
  inside:(x:number,z:number,margin:number)=>boolean;
  disturb:(x:number,z:number)=>void;
  disturbSegment?:(x0:number,z0:number,x1:number,z1:number)=>void;
  continuous?:()=>boolean;
  dropSize:()=>number;
}){
  const raycaster=new THREE.Raycaster();
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  let activePointer:number|null=null;
  let lastPoint:THREE.Vector3|null=null;
  let lastTime=0;
  const pointAt=(event:PointerEvent)=>{
    const rect=canvas.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return null;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    return raycaster.ray.intersectPlane(plane,new THREE.Vector3());
  };
  canvas.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const p=pointAt(event);
    if(!p||!inside(p.x,p.z,0.015))return;
    event.preventDefault();
    activePointer=event.pointerId;lastPoint=p;lastTime=event.timeStamp;
    // Apply the interaction first. Capture is optional in embedded or synthetic input.
    disturb(p.x,p.z);
    try{canvas.setPointerCapture(event.pointerId);}catch{}
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==activePointer)return;
    const p=pointAt(event);
    if(!p||!inside(p.x,p.z,0.02))return;
    if(lastPoint){
      const distance=p.distanceTo(lastPoint);
      if(continuous?.()&&disturbSegment&&distance>dropSize()*0.22){
        disturbSegment(lastPoint.x,lastPoint.z,p.x,p.z);lastPoint=p;lastTime=event.timeStamp;
      }else if(!continuous?.()&&distance>dropSize()*0.8&&event.timeStamp-lastTime>28){
        disturb(p.x,p.z);lastPoint=p;lastTime=event.timeStamp;
      }
    }
  });
  const finish=(event:PointerEvent)=>{
    if(event.pointerId!==activePointer)return;
    activePointer=null;lastPoint=null;
  };
  canvas.addEventListener('pointerup',finish);
  canvas.addEventListener('pointercancel',finish);
  canvas.addEventListener('lostpointercapture',finish);
}
