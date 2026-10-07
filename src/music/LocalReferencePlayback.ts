import {clamp,validateManifest,type MusicManifest,type MusicTrack} from './MusicScore';

export type LocalReferenceEvent='loading'|'metadata'|'timeupdate'|'playing'|'pause'|'waiting'|'seeking'|'seeked'|'ratechange'|'ended';
export type LocalReferenceSample={trackId:string;time:number;duration:number;playing:boolean;rate:number;
  event:LocalReferenceEvent;ended:boolean;seeking:boolean;buffering:boolean};

/** Private File playback. Only exact reference hashes choose score identities.
 * One detached audio element owns the clock; no recording is fetched or sent.
 */
export class LocalReferencePlayback{
  private audio?:HTMLAudioElement;
  private files=new Map<string,File>();
  private tracks=new Map<string,MusicTrack>();
  private selected?:MusicTrack;
  private url?:string;
  private ready=false;
  private waiting=false;
  private start=0;
  private wantPlay=false;
  private loadRevision=0;
  private choice=0;
  private playRevision=0;
  private readyPromise?:Promise<boolean>;
  private pendingReady?:{resolve:(ready:boolean)=>void;reject:(error:Error)=>void};
  private pendingPlay?:{choice:number;promise:Promise<void>};

  constructor(private onSample:(sample:LocalReferenceSample)=>void,private onError:(error:Error)=>void=()=>{}){}

  private get media():HTMLAudioElement{
    if(this.audio)return this.audio;
    const audio=this.audio=new Audio();audio.preload='metadata';
    audio.addEventListener('loadedmetadata',()=>this.metadata());
    audio.addEventListener('timeupdate',()=>this.emit('timeupdate'));
    audio.addEventListener('playing',()=>{if(!this.currentSource())return;this.waiting=false;this.emit('playing');});
    audio.addEventListener('pause',()=>{if(!this.currentSource())return;this.waiting=false;this.emit('pause');});
    audio.addEventListener('waiting',()=>{if(!this.currentSource())return;this.waiting=true;this.emit('waiting');});
    audio.addEventListener('seeking',()=>this.emit('seeking'));
    audio.addEventListener('seeked',()=>this.emit('seeked'));
    audio.addEventListener('ratechange',()=>this.emit('ratechange'));
    audio.addEventListener('ended',()=>{if(!this.currentSource())return;this.wantPlay=false;this.waiting=false;this.emit('ended');});
    audio.addEventListener('error',()=>{
      if(!this.currentSource())return;
      this.fail(audio.error?.message||'The selected recording could not be decoded.');
    });
    return audio;
  }

  get loaded(){return this.files.size===32;}
  get trackId(){return this.selected?.id;}
  get time(){return this.ready&&this.audio&&Number.isFinite(this.audio.currentTime)?clamp(this.audio.currentTime,0,this.duration):this.start;}
  get duration(){return this.ready&&this.audio&&Number.isFinite(this.audio.duration)?this.audio.duration:this.selected?.duration??0;}
  get playing(){return !!this.audio&&this.ready&&!this.audio.paused&&!this.audio.ended&&!this.audio.seeking&&!this.waiting;}
  get rate(){return this.audio?.playbackRate||1;}

  async load(files:readonly File[],manifest:MusicManifest):Promise<string[]>{
    const revision=++this.loadRevision;
    validateManifest(manifest);
    if(files.length!==32)throw new Error('Choose all 32 downloaded reference songs together.');
    const byHash=new Map(manifest.tracks.map(track=>[track.reference_sha256,track]));
    if(byHash.size!==32)throw new Error('Reference recording hashes must identify each track uniquely.');
    const verified=new Map<string,File>();
    const current=()=>{if(revision!==this.loadRevision)throw new DOMException('File selection was cancelled.','AbortError');};
    // Process one file at a time; keep File handles rather than 32 decoded
    // buffers or audio elements. Names and folder order never infer identity.
    for(const file of files){
      current();const bytes=await file.arrayBuffer();current();
      const digest=await crypto.subtle.digest('SHA-256',bytes);current();
      const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      const track=byHash.get(hash);
      if(!track)throw new Error('A chosen file does not match any supplied reference recording. Choose the original 32 downloaded songs.');
      if(verified.has(track.id))throw new Error(`The selection contains ${track.title} twice. Choose each reference recording once.`);
      verified.set(track.id,file);
    }
    current();this.stopCurrent();
    this.files=verified;this.tracks=new Map(manifest.tracks.map(track=>[track.id,track]));
    return [...manifest.order];
  }

  async select(trackId:string,play:boolean,start=0):Promise<boolean>{
    const file=this.files.get(trackId),track=this.tracks.get(trackId);
    if(!file||!track)throw new Error('Load the 32 downloaded songs before choosing a local track.');
    this.stopCurrent();const choice=this.choice;
    this.selected=track;this.start=clamp(start,0,track.duration);this.wantPlay=play;this.waiting=true;
    const ready=new Promise<boolean>((resolve,reject)=>{this.pendingReady={resolve,reject};});
    this.readyPromise=ready;
    const audio=this.media;this.url=URL.createObjectURL(file);audio.src=this.url;
    this.onSample({trackId:track.id,time:this.start,duration:track.duration,playing:false,rate:this.rate,
      event:'loading',ended:false,seeking:false,buffering:play});
    audio.load();
    if(!await ready||choice!==this.choice)return false;
    if(this.wantPlay)await this.play();
    return choice===this.choice;
  }

  play():Promise<void>{
    if(!this.selected)return Promise.reject(new Error('Choose a downloaded song first.'));
    this.wantPlay=true;
    if(this.pendingPlay?.choice===this.choice)return this.pendingPlay.promise;
    const choice=this.choice,revision=++this.playRevision;
    const promise=(async()=>{
      if(!this.ready&&(!await this.readyPromise||choice!==this.choice))return;
      if(choice!==this.choice||!this.wantPlay)return;
      this.waiting=true;this.emit('waiting');
      try{
        await this.media.play();
        if(choice===this.choice&&revision===this.playRevision&&!this.wantPlay)this.audio?.pause();
      }catch(error){
        if(choice!==this.choice||revision!==this.playRevision||!this.wantPlay)return;
        this.waiting=false;this.wantPlay=false;
        const message=error instanceof Error?error.message:'Press Play to start the downloaded song.';
        this.onError(new Error(message));throw error;
      }finally{
        if(this.pendingPlay?.choice===choice&&revision===this.playRevision)this.pendingPlay=undefined;
      }
    })();
    this.pendingPlay={choice,promise};return promise;
  }

  pause(){
    this.wantPlay=false;this.waiting=false;++this.playRevision;this.pendingPlay=undefined;
    this.audio?.pause();
    if(this.ready)this.emit('pause');
  }

  seek(seconds:number){
    if(!this.selected||!Number.isFinite(seconds))return;
    this.start=clamp(seconds,0,this.selected.duration);
    if(this.ready&&this.audio){this.audio.currentTime=this.start;this.emit('seeking');}
  }

  close(){++this.loadRevision;this.stopCurrent();this.files.clear();this.tracks.clear();}

  private currentSource(){return !!this.selected&&!!this.url&&this.audio?.currentSrc===this.url;}
  private emit(event:LocalReferenceEvent){
    if(!this.currentSource())return;
    this.onSample({trackId:this.selected!.id,time:this.time,duration:this.duration,playing:this.playing,rate:this.rate,event,
      ended:event==='ended'||this.audio!.ended,seeking:this.audio!.seeking,buffering:this.waiting&&this.wantPlay});
  }
  private metadata(){
    if(!this.currentSource())return;
    const duration=this.audio!.duration;
    if(!Number.isFinite(duration)||Math.abs(duration-this.selected!.duration)>.25){
      this.fail('The decoded recording duration does not match its reference.');return;
    }
    this.ready=true;this.audio!.currentTime=this.start;
    this.emit('metadata');this.pendingReady?.resolve(true);this.pendingReady=undefined;
  }
  private fail(message:string){
    this.wantPlay=false;this.waiting=false;this.ready=false;this.audio?.pause();
    this.pendingReady?.reject(new Error(message));this.pendingReady=undefined;this.onError(new Error(message));
  }
  private stopCurrent(){
    ++this.choice;++this.playRevision;this.pendingPlay=undefined;
    this.pendingReady?.resolve(false);this.pendingReady=undefined;this.readyPromise=undefined;
    this.selected=undefined;this.ready=false;this.waiting=false;this.wantPlay=false;this.start=0;
    if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}
    if(this.url)URL.revokeObjectURL(this.url);this.url=undefined;
  }
}
