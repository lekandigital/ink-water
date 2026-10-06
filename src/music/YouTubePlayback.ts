export type YouTubeSnapshot={videoId:string;index:number;time:number;duration:number;rate:number;state:number;playlist:string[]};
export interface YouTubePort{
  playVideo():void;pauseVideo():void;stopVideo():void;playVideoAt(index:number):void;seekTo(seconds:number,allowSeekAhead:boolean):void;
  cuePlaylist(options:{listType:'playlist';list:string;index?:number;startSeconds?:number}):void;
  getCurrentTime():number;getDuration():number;getVideoUrl():string;getPlaylist():string[];getPlaylistIndex():number;
  getPlaybackRate():number;getPlayerState():number;setLoop(loop:boolean):void;setShuffle(shuffle:boolean):void;
  getIframe():HTMLIFrameElement;destroy():void;
}
type YTNamespace={Player:new (element:HTMLElement,options:Record<string,unknown>)=>YouTubePort};
type YTWindow=Window&{YT?:YTNamespace;onYouTubeIframeAPIReady?:()=>void};
type Listener={ready:()=>void;sample:(snapshot:YouTubeSnapshot)=>void;error:(code:number)=>void;blocked:()=>void};
let loading:Promise<YTNamespace>|undefined;

export function loadYouTubeAPI():Promise<YTNamespace>{
  const win=window as YTWindow;if(win.YT?.Player)return Promise.resolve(win.YT);
  if(loading)return loading;
  loading=new Promise<YTNamespace>((resolve,reject)=>{
    const previous=win.onYouTubeIframeAPIReady;
    const timer=window.setTimeout(()=>{loading=undefined;reject(new Error('YouTube did not load. Please try again.'));},12000);
    win.onYouTubeIframeAPIReady=()=>{previous?.();window.clearTimeout(timer);if(win.YT?.Player)resolve(win.YT);else{loading=undefined;reject(new Error('YouTube is unavailable.'));}};
    const old=document.getElementById('youtube-iframe-api');if(old)old.remove();
    const script=document.createElement('script');script.id='youtube-iframe-api';script.src='https://www.youtube.com/iframe_api';script.async=true;
    script.onerror=()=>{window.clearTimeout(timer);loading=undefined;reject(new Error('YouTube could not load. Please try again.'));};document.head.append(script);
  });return loading;
}

export class YouTubePlayback{
  private timer?:number;
  private ready=false;
  private destroyed=false;
  readonly port:YouTubePort;
  constructor(namespace:YTNamespace,element:HTMLElement,private listener:Listener){
    this.port=new namespace.Player(element,{width:480,height:270,playerVars:{controls:1,playsinline:1,autoplay:0,origin:location.origin},events:{
      onReady:()=>{if(this.destroyed)return;this.ready=true;this.port.setLoop(false);this.port.setShuffle(false);
        const frame=this.port.getIframe();frame.title='YouTube — Ink Water playlist';frame.referrerPolicy='strict-origin-when-cross-origin';
        this.timer=window.setInterval(()=>this.poll(),80);this.listener.ready();this.poll();},
      onStateChange:()=>this.poll(),onPlaybackRateChange:()=>this.poll(),
      onError:(event:{data:number})=>{if(!this.destroyed)this.listener.error(event.data);},
      onAutoplayBlocked:()=>{if(!this.destroyed)this.listener.blocked();},
    }});
  }
  poll(){
    if(!this.ready||this.destroyed)return;
    let videoId='';try{videoId=new URL(this.port.getVideoUrl()).searchParams.get('v')??'';}catch{}
    this.listener.sample({videoId,index:this.port.getPlaylistIndex(),time:this.port.getCurrentTime(),duration:this.port.getDuration(),
      rate:this.port.getPlaybackRate()||1,state:this.port.getPlayerState(),playlist:this.port.getPlaylist()??[]});
  }
  get isReady(){return this.ready&&!this.destroyed;}
  loadPlaylistId(id:string){this.port.cuePlaylist({listType:'playlist',list:id});}
  destroy(){this.destroyed=true;if(this.timer!==undefined)window.clearInterval(this.timer);this.port.destroy();}
}
