import * as THREE from 'three';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/MusicRefraction.frag';

/** Read-only refraction of the compact DOM card, sampled from the displayed
 * physical heightfield. Native video stays in its original, interactive iframe;
 * neither its pixels nor either water solver are copied or modified. */
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
  constructor(private readonly panel:HTMLElement,private readonly map:SVGElement){
    this.host=panel.closest<HTMLElement>('.music-panel')??panel;
    // Resolve against the page, not the external stylesheet's asset URL.
    this.panel.style.setProperty('--water-refraction-filter',`url("${new URL('#music-water-refraction',document.baseURI).href}")`);
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);
    this.canvas.width=this.canvas.height=80;this.context=this.canvas.getContext('2d');
  }
  private available(){
    return !this.failed&&!!this.context&&!this.host.hidden&&
      !this.host.matches(':hover, :has(:focus-visible)')&&!document.body.classList.contains('capture')&&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  update(renderer:THREE.WebGLRenderer,water:THREE.Texture,inverse:THREE.Matrix4,eye:THREE.Vector3,stage:DOMRect,now=performance.now()){
    if(!this.available()){this.panel.classList.remove('water-refracting');return;}
    if(this.pending||now-this.last<50)return;
    const rect=this.panel.getBoundingClientRect();if(!rect.width||!rect.height||!stage.width||!stage.height)return;
    let left=rect.left,top=rect.bottom-rect.height,right=left+rect.width,bottom=rect.bottom;
    const video=this.panel.querySelector<HTMLElement>('.youtube-frame');
    if(video&&!video.hidden){
      const frame=video.getBoundingClientRect();left=Math.min(left,frame.left);top=Math.min(top,frame.bottom-frame.height);
      right=Math.max(right,frame.left+frame.width);bottom=Math.max(bottom,frame.bottom);
    }
    // Include the separate compact video pane and a 12px refraction margin.
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
      if(!this.available())return;
      // GPU rows run up; SVG image rows run down.
      for(let y=0;y<80;y++)this.image.data.set(this.pixels.subarray((79-y)*320,(80-y)*320),y*320);
      this.context!.putImageData(this.image,0,0);
      this.map.setAttribute('href',this.canvas.toDataURL('image/png'));
      this.panel.classList.add('water-refracting');this.panel.dataset.waterRefraction='physical';
    }).catch(()=>{this.failed=true;this.panel.classList.remove('water-refracting');}).finally(()=>{this.pending=false;});
  }
}
