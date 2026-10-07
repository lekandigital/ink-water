import * as THREE from 'three';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/MusicRefraction.frag';

/** Read-only presentation sampled from the displayed physical heightfield.
 * Controls use a displacement map; the separate native iframe uses a bounded
 * affine approximation because Chrome does not composite it into SVG filters.
 * Neither video pixels nor either water solver are copied or modified. */
export class MusicWaterPresentation{
  private readonly target=new THREE.WebGLRenderTarget(80,80,{type:THREE.UnsignedByteType,depthBuffer:false});
  private readonly scene=new THREE.Scene();
  private readonly camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  readonly material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{water:{value:null},inverseViewProjection:{value:new THREE.Matrix4()},viewProjection:{value:new THREE.Matrix4()},eye:{value:new THREE.Vector3()},screenRect:{value:new THREE.Vector4()},screenSize:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false,toneMapped:false});
  private readonly canvas=document.createElement('canvas');
  private readonly pixels=new Uint8Array(80*80*4);
  private readonly image=new ImageData(80,80);
  private readonly context:CanvasRenderingContext2D|null;
  private last=0;
  private pending=false;
  private failed=false;
  private readonly host:HTMLElement;
  private readonly video=document.getElementById('youtube-frame')!;
  private readonly slot=document.getElementById('youtube-slot')!;
  constructor(private readonly panel:HTMLElement,private readonly map:SVGElement){
    this.host=panel;
    // Resolve against the page, not the external stylesheet's asset URL.
    this.panel.style.setProperty('--water-refraction-filter',`url("${new URL('#music-water-refraction',document.baseURI).href}")`);
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);
    this.canvas.width=this.canvas.height=80;this.context=this.canvas.getContext('2d');
    // Layout must still update when the simulation is paused and draws stop.
    if(window.ResizeObserver)new window.ResizeObserver(()=>this.positionVideo()).observe(this.host);
    window.addEventListener('resize',()=>this.positionVideo());
  }
  private positionVideo(){
    if(this.video.hidden||this.slot.hidden)return;
    const rect=this.slot.getBoundingClientRect();
    this.video.style.left=`${rect.left}px`;this.video.style.top=`${rect.top}px`;
    this.video.style.width=`${rect.width}px`;this.video.style.height=`${rect.height}px`;
  }
  private available(){
    return !this.failed&&!!this.context&&!this.host.hidden&&
      !document.body.classList.contains('capture')&&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  private controlsAvailable(){return this.available()&&!this.host.matches(':hover, :has(:focus-visible)');}
  private videoAvailable(){return this.available()&&!this.video.hidden&&!this.slot.hidden&&!this.video.matches(':hover');}
  private moveVideo(region:{left:number;top:number;width:number;height:number}){
    const rect=this.slot.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const sample=(x:number,y:number)=>{
      const px=Math.max(0,Math.min(79,Math.round((x-region.left)/region.width*79)));
      const py=Math.max(0,Math.min(79,Math.round((y-region.top)/region.height*79)));
      const offset=(py*80+px)*4;
      return {x:(this.image.data[offset]/255-.5)*24,y:(this.image.data[offset+1]/255-.5)*24};
    };
    const center=sample(rect.left+rect.width/2,rect.top+rect.height/2);
    const left=sample(rect.left,rect.top+rect.height/2),right=sample(rect.right,rect.top+rect.height/2);
    const top=sample(rect.left+rect.width/2,rect.top),bottom=sample(rect.left+rect.width/2,rect.bottom);
    const bound=(n:number,limit:number)=>Math.max(-limit,Math.min(limit,n));
    // SVG displacement samples the source in the opposite direction to the
    // visible image motion. Use the same sign for this native-layer approximation.
    const dx=bound(-(center.x+left.x+right.x+top.x+bottom.x)/5,12);
    const dy=bound(-(center.y+left.y+right.y+top.y+bottom.y)/5,12);
    const shearY=bound(-(right.y-left.y)/rect.width,.025),shearX=bound(-(bottom.x-top.x)/rect.height,.025);
    this.video.style.setProperty('--water-video-transform',`matrix(1,${shearY},${shearX},1,${dx},${dy})`);
    this.video.dataset.waterRefraction='physical-affine';
  }
  update(renderer:THREE.WebGLRenderer,water:THREE.Texture,inverse:THREE.Matrix4,eye:THREE.Vector3,stage:DOMRect,now=performance.now()){
    this.positionVideo();
    const controls=this.controlsAvailable(),video=this.videoAvailable();
    if(!controls)this.panel.classList.remove('water-refracting');
    if(!video)this.video.style.removeProperty('--water-video-transform');
    if(!controls&&!video)return;
    if(this.pending||now-this.last<50)return;
    const rect=this.panel.getBoundingClientRect();if(!rect.width||!rect.height||!stage.width||!stage.height)return;
    let left=rect.left,top=rect.bottom-rect.height,right=left+rect.width,bottom=rect.bottom;
    if(!this.slot.hidden){
      const frame=this.slot.getBoundingClientRect();left=Math.min(left,frame.left);top=Math.min(top,frame.top);
      right=Math.max(right,frame.left+frame.width);bottom=Math.max(bottom,frame.bottom);
    }
    // Include the native video and a 12px refraction margin.
    left-=12;top-=12;right+=12;bottom+=12;
    const u=this.material.uniforms;
    u.water.value=water;u.inverseViewProjection.value.copy(inverse);u.viewProjection.value.copy(inverse).invert();u.eye.value.copy(eye);
    u.screenSize.value.set(stage.width,stage.height);
    u.screenRect.value.set((left-stage.left)/stage.width,1-(bottom-stage.top)/stage.height,(right-left)/stage.width,(bottom-top)/stage.height);
    const previous=renderer.getRenderTarget();
    try{renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera);}finally{renderer.setRenderTarget(previous);}
    const region={x:left-rect.left,y:top-(rect.bottom-rect.height),width:right-left,height:bottom-top};
    for(const [key,value] of Object.entries(region)){this.map.setAttribute(key,String(value));this.map.parentElement!.setAttribute(key,String(value));}
    this.last=now;this.pending=true;
    void renderer.readRenderTargetPixelsAsync(this.target,0,0,80,80,this.pixels).then(()=>{
      const controls=this.controlsAvailable(),video=this.videoAvailable();
      if(!controls&&!video)return;
      // GPU rows run up; SVG image rows run down.
      for(let y=0;y<80;y++)this.image.data.set(this.pixels.subarray((79-y)*320,(80-y)*320),y*320);
      if(controls){
        this.context!.putImageData(this.image,0,0);
        this.map.setAttribute('href',this.canvas.toDataURL('image/png'));
        this.panel.classList.add('water-refracting');this.panel.dataset.waterRefraction='physical';
      }
      if(video)this.moveVideo({left,top,width:right-left,height:bottom-top});
    }).catch(()=>{this.failed=true;this.panel.classList.remove('water-refracting');this.video.style.removeProperty('--water-video-transform');}).finally(()=>{this.pending=false;});
  }
}
