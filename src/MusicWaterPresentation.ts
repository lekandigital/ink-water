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
  private readonly layers:{element:HTMLElement;map:SVGElement;filter:SVGElement}[];
  private readonly host:HTMLElement;
  private readonly video=document.getElementById('youtube-frame')!;
  private readonly slot=document.getElementById('youtube-slot')!;
  constructor(private readonly panel:HTMLElement,map:SVGElement,private readonly presentation:{stable?:boolean;targets?:HTMLElement[];video?:boolean}={}){
    this.host=panel;
    // One physical sample can serve several independent controls. Filtering the
    // individual surfaces avoids treating a resized dock as one moving image.
    const template=map.parentElement as unknown as SVGElement;
    this.layers=(presentation.targets??[panel]).map((element,index)=>{
      const filter=presentation.targets?template.cloneNode(true) as SVGElement:template;
      const image=filter.querySelector('feImage') as SVGElement;
      if(presentation.targets){
        filter.id=`${template.id}-${index}`;image.id=`${map.id}-${index}`;
        template.parentElement!.appendChild(filter);
      }
      // Resolve against the page, not the external stylesheet's asset URL.
      element.style.setProperty('--water-refraction-filter',`url("${new URL('#'+filter.id,document.baseURI).href}")`);
      return {element,map:image,filter};
    });
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);
    this.canvas.width=this.canvas.height=80;this.context=this.canvas.getContext('2d');
    // Layout must still update when the simulation is paused and draws stop.
    if(window.ResizeObserver)new window.ResizeObserver(()=>this.positionVideo()).observe(this.host);
    window.addEventListener('resize',()=>this.positionVideo());
  }
  private positionVideo(){
    if(this.presentation.video===false||this.video.hidden||this.slot.hidden)return;
    const rect=this.slot.getBoundingClientRect();
    const page=document.querySelector<HTMLElement>('main');
    const fallback=page?.matches('.home-dream-in,.animate-theme-blur-in');
    const bounds=fallback?page!.getBoundingClientRect():null;
    const sx=bounds?bounds.width/page!.offsetWidth:1,sy=bounds?bounds.height/page!.offsetHeight:1;
    // A CSS fallback temporarily makes main the fixed-position containing block.
    // Convert the slot's screen bounds back to that block before placing video.
    this.video.style.left=`${(rect.left-(bounds?.left??0))/sx}px`;this.video.style.top=`${(rect.top-(bounds?.top??0))/sy}px`;
    this.video.style.width=`${rect.width/sx}px`;this.video.style.height=`${rect.height/sy}px`;
  }
  private available(){
    return !this.failed&&!!this.context&&!this.host.hidden&&
      !document.body.classList.contains('capture')&&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  // Touch browsers can retain :hover after a tap. Only a real hover pointer lifts
  // controls; keyboard focus remains available independently of pointer input.
  private hovering(element:HTMLElement){return window.matchMedia('(hover: hover) and (pointer: fine)').matches&&element.matches(':hover');}
  private controlsAvailable(){return this.available()&&(this.presentation.stable||(!this.hovering(this.host)&&!this.host.matches(':has(:focus-visible)')));}
  private videoAvailable(){return this.presentation.video!==false&&this.available()&&!this.video.hidden&&!this.slot.hidden&&(this.presentation.stable||!this.hovering(this.video));}
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
    if(!controls)for(const {element} of this.layers)element.classList.remove('water-refracting');
    if(!video&&this.presentation.video!==false)this.video.style.removeProperty('--water-video-transform');
    if(!controls&&!video)return;
    const rect=this.panel.getBoundingClientRect();if(!rect.width||!rect.height||!stage.width||!stage.height)return;
    const slotVisible=this.presentation.video!==false&&!this.slot.hidden;
    const frame=slotVisible?this.slot.getBoundingClientRect():null;
    if(this.pending||now-this.last<50)return;
    const layers=this.layers.map(layer=>({...layer,rect:layer.element.getBoundingClientRect()}));
    let left=rect.left,top=rect.bottom-rect.height,right=left+rect.width,bottom=rect.bottom;
    if(frame){
      left=Math.min(left,frame.left);top=Math.min(top,frame.top);
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
    this.last=now;this.pending=true;
    void renderer.readRenderTargetPixelsAsync(this.target,0,0,80,80,this.pixels).then(()=>{
      const controls=this.controlsAvailable(),video=this.videoAvailable();
      if(!controls&&!video)return;
      // Opening music or resizing must never remap an old GPU frame into new bounds.
      const sameRect=(a:DOMRect,b:DOMRect)=>Math.abs(a.left-b.left)<.25&&Math.abs(a.top-b.top)<.25&&Math.abs(a.width-b.width)<.25&&Math.abs(a.height-b.height)<.25;
      if(!sameRect(rect,this.panel.getBoundingClientRect())||slotVisible!==(this.presentation.video!==false&&!this.slot.hidden)||(frame&&!sameRect(frame,this.slot.getBoundingClientRect()))||layers.some(layer=>!sameRect(layer.rect,layer.element.getBoundingClientRect()))){
        // Keep the last completed image in place and request a fresh region next
        // frame. Clearing the filter here made controls jump sideways on click.
        this.last=0;return;
      }
      // GPU rows run up; SVG image rows run down.
      // Preserve Ink Water's exact amplitude and timing, without attenuation or
      // temporal smoothing. This is presentation only; neither solver is changed.
      for(let y=0;y<80;y++)this.image.data.set(this.pixels.subarray((79-y)*320,(80-y)*320),y*320);
      for(const layer of layers){
        if(!layer.rect.width||!layer.rect.height)continue;
        // WebKit's untransformed CSS reference filters position feImage in page
        // space. A transformed surface has its own local coordinate space, as
        // Chromium does. iOS Chrome and Firefox also use WebKit's behavior.
        // Only the map origin changes; its physical sample and 24px scale stay exact.
        const webkit=typeof navigator!=='undefined'&&(navigator.vendor==='Apple Computer, Inc.'||/(?:CriOS|FxiOS|EdgiOS)\//.test(navigator.userAgent));
        const transformed=typeof getComputedStyle==='function'&&getComputedStyle(layer.element).transform!=='none';
        const pageCoordinates=webkit&&!transformed;
        const region={x:left-(pageCoordinates?0:layer.rect.left),y:top-(pageCoordinates?0:layer.rect.top),width:right-left,height:bottom-top};
        for(const [key,value] of Object.entries(region)){layer.map.setAttribute(key,String(value));layer.filter.setAttribute(key,String(value));}
      }
      if(controls){
        this.context!.putImageData(this.image,0,0);
        const href=this.canvas.toDataURL('image/png');
        for(const layer of layers){
          if(!layer.rect.width||!layer.rect.height)continue;
          // Each filter has its own local origin, even though all share the same
          // completed physical field. Geometry and pixels commit together.
          layer.map.setAttribute('href',href);
          layer.element.classList.add('water-refracting');layer.element.dataset.waterRefraction='physical';
        }
        this.panel.dataset.waterRefraction='physical';
      }
      if(video)this.moveVideo({left,top,width:right-left,height:bottom-top});
    }).catch(()=>{
      this.failed=true;for(const {element} of this.layers)element.classList.remove('water-refracting');
      if(this.presentation.video!==false)this.video.style.removeProperty('--water-video-transform');
    }).finally(()=>{this.pending=false;});
  }
}
