import {MusicRainEngine} from './MusicRainEngine';
import {PlaybackClock} from './PlaybackClock';
import {PlaylistSession} from './PlaylistSession';
import {loadYouTubeAPI,YouTubePlayback,type YouTubeSnapshot} from './YouTubePlayback';
import {clamp,parsePlaylistId,validateManifest,validatePlaylist,type MusicManifest,type MusicRainClock,type MusicTrack,type RainScore} from './MusicScore';
import type {Tone} from '../DrawingPalette';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const label=(seconds:number)=>{const n=Math.max(0,Math.floor(seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
type Hooks={tone:()=>Tone;toneChosen:()=>boolean;setTone:(tone:Tone)=>void;publish:(state:Record<string,unknown>)=>void};
type Transport='none'|'youtube'|'local'|'capture';

/** UI/player adapter. Only MusicRainEngine and playback time choose drops.
 * This module never imports Water, Three.js, shaders, normals or caustics.
 */
export class PlaylistMusic implements MusicRainClock{
  readonly engine=new MusicRainEngine();
  private session?:PlaylistSession;
  private manifestLoading?:Promise<MusicManifest>;
  private scores=new Map<string,Promise<RainScore>>();
  private active=false;
  private syncRain=true;
  private transport:Transport='none';
  private simulationPaused=false;
  private resumeAfterSimulation=false;
  private player?:YouTubePlayback;
  private snapshot?:YouTubeSnapshot;
  private clock=new PlaybackClock();
  private rate=1;
  private revision=0;
  private opening=0;
  private connectionRevision=0;
  private pendingTrack:string|undefined;
  private pendingOffset=false;
  private validatingPlaylist:string|null=null;
  private awaitingEnd:string|undefined;
  private nativeVideos:string[]=[];
  private nativeIndex=0;
  private pendingNativeIndex:number|undefined;
  private unavailableVideos=new Set<string>();
  private playlistNote='';
  private pendingPause=false;
  private initialPlay=false;
  private endTimer?:number;
  private previousTone:Tone|undefined;
  private appliedMusicTone=false;
  private sourceMismatch=false;
  private lastUI=0;
  private referenceStart=0;
  private referenceWall=0;
  private referencePlaying=false;
  private localFiles=new Map<string,string>();
  readonly audio=$<HTMLAudioElement>('music-local-audio');

  constructor(private hooks:Hooks,readonly captureMode=false){
    $('music-open').addEventListener('click',()=>{if(this.active)this.close();else void this.open();});
    $('music-close').addEventListener('click',()=>this.close());
    $('music-play').addEventListener('click',()=>{void this.play();});
    $('music-pause').addEventListener('click',()=>this.pause());
    $('music-next').addEventListener('click',()=>{void this.next();});
    $('music-previous').addEventListener('click',()=>{void this.previous();});
    $('music-restart').addEventListener('click',()=>this.seek(0));
    $('music-highlight').addEventListener('click',()=>{if(this.session)this.seek(this.session.current.recommended_demo.start);});
    $('music-sync').addEventListener('click',()=>{this.syncRain=!this.syncRain;this.rebase();this.sync();});
    $('music-track').addEventListener('change',()=>{void this.select($<HTMLSelectElement>('music-track').value,this.isPlaying()).catch(error=>this.status(error.message));});
    $('music-playlist-form').addEventListener('submit',event=>{event.preventDefault();void this.loadPlaylist($<HTMLInputElement>('music-playlist-id').value);});
    $('music-local-files').addEventListener('change',()=>{void this.importLocalFiles();});
    $('reset-defaults').addEventListener('click',()=>this.close(false));
    if(new URLSearchParams(location.search).get('music-dev')==='1')$('music-dev').hidden=false;
    this.audio.addEventListener('play',()=>{if(this.simulationPaused||!this.active){this.audio.pause();return;}this.rebase();this.status('Playing reference recording');});
    for(const name of ['pause','seeking','seeked','waiting'])this.audio.addEventListener(name,()=>this.rebase());
    this.audio.addEventListener('ended',()=>{if(this.transport==='local')void this.next();});
    this.audio.addEventListener('error',()=>{this.engine.clearScore();this.status('The reference recording could not play.');});
    this.audio.addEventListener('loadedmetadata',()=>{
      if(this.transport==='local'&&this.session&&Math.abs(this.audio.duration-this.session.current.duration)>.15){
        this.sourceMismatch=true;this.pause();this.status('Reference duration mismatch. Choose the analyzed recording.');}
    });
    document.addEventListener('visibilitychange',()=>{this.rebase();});
    if(captureMode)this.exposeCapture();
    this.sync();
  }

  get enabled(){return this.active&&this.syncRain&&this.transport!=='none';}
  private status(message:string){$('music-status').textContent=message;}
  private async json<T>(path:string){const response=await fetch(new URL('music/'+path,document.baseURI));if(!response.ok)throw new Error('Music score could not load.');return response.json() as Promise<T>;}
  private async assets(){
    if(!this.manifestLoading)this.manifestLoading=this.json<MusicManifest>('manifest.json').then(manifest=>{validateManifest(manifest);return manifest;}).catch(error=>{this.manifestLoading=undefined;throw error;});
    const manifest=await this.manifestLoading;
    if(!this.session){this.session=new PlaylistSession(manifest);
      const select=$<HTMLSelectElement>('music-track');select.replaceChildren();
      for(const [i,track] of this.session.tracks.entries()){const option=document.createElement('option');option.value=track.id;option.textContent=`${i+1}. ${track.title}`;select.append(option);}
      if(manifest.playlist_id)$<HTMLInputElement>('music-playlist-id').value=manifest.playlist_id;
    }return manifest;
  }
  private score(track:MusicTrack){
    if(!this.scores.has(track.id))this.scores.set(track.id,this.json<RainScore>(track.score).then(score=>{
      if(score.track_id!==track.id||Math.abs(score.duration-track.duration)>.001)throw new Error('Track and score do not match.');return score;
    }).catch(error=>{this.scores.delete(track.id);throw error;}));return this.scores.get(track.id)!;
  }
  private enterTone(){
    if(this.hooks.toneChosen()||this.appliedMusicTone)return;
    this.previousTone=this.hooks.tone();this.hooks.setTone('green-light');this.appliedMusicTone=true;
  }
  async open(){
    const opening=++this.opening;this.active=true;this.sync();this.status('Loading authored weather…');
    try{await this.assets();if(!this.active||opening!==this.opening)return;this.progress();
      this.status(this.session!.manifest.tracks.every(t=>t.source)?'Ready — play the playlist':'Waiting for the supplied YouTube source map. Reference playback is available in development mode.');
    }catch(error){if(this.active)this.status(error instanceof Error?error.message:'Music could not load.');}
  }
  close(restoreTone=true){
    ++this.opening;++this.revision;++this.connectionRevision;this.active=false;this.transport='none';this.pendingTrack=undefined;this.snapshot=undefined;
    this.engine.clearScore();this.audio.pause();this.player?.destroy();this.player=undefined;this.validatingPlaylist=null;this.sourceMismatch=false;
    this.pendingNativeIndex=undefined;this.nativeVideos=[];this.nativeIndex=0;this.unavailableVideos.clear();this.pendingPause=false;this.pendingOffset=false;
    this.initialPlay=false;this.playlistNote='';$('music-playlist-note').textContent='';this.clock.reset();
    if(this.endTimer!==undefined)window.clearTimeout(this.endTimer);this.awaitingEnd=undefined;
    if(restoreTone&&this.appliedMusicTone&&this.previousTone&&!this.hooks.toneChosen()&&this.hooks.tone()==='green-light')this.hooks.setTone(this.previousTone);
    this.appliedMusicTone=false;this.previousTone=undefined;this.resumeAfterSimulation=false;this.referencePlaying=false;this.sync();
  }
  private sync(){
    $('music-panel').hidden=!this.active;$('music-open').setAttribute('aria-expanded',String(this.active));
    $('music-sync').setAttribute('aria-pressed',String(this.syncRain));$('music-sync').textContent=this.syncRain?'Rain sync on':'Rain sync off';
    $('music-local-audio').hidden=this.transport!=='local';$('youtube-frame').hidden=this.transport==='local'||this.transport==='capture';
    // A playing YouTube embed is destroyed before this wrapper can be hidden.
    this.hooks.publish({musicEnabled:this.enabled,musicTransport:this.transport});
  }
  async play(){
    try{
      if(!this.active)await this.open();const opening=this.opening,manifest=await this.assets();
      if(!this.active||opening!==this.opening)return;
      if(this.simulationPaused){this.status('Water paused — resume the water to play.');return;}
      if(this.transport==='local'){
        if(!this.audio.src)await this.select(this.session!.current.id,false);
        if(!this.audio.src){this.status('Choose this numbered reference MP3 in development mode.');return;}
        this.enterTone();await this.audio.play();return;
      }
      if(this.transport==='capture'){this.referenceWall=performance.now();this.referencePlaying=true;this.rebase();return;}
      if(this.captureMode)throw new Error('Capture mode uses the reference clock. Use a normal page URL for YouTube playback.');
      this.enterTone();
      if(!this.player){this.initialPlay=true;await this.createYouTube(manifest.playlist_id);}
      else if(!this.player.isReady){this.initialPlay=true;this.status('Connecting to YouTube…');}
      else if(this.session!.ended){this.moveToNative(0,true);}
      else this.player.port.playVideo();
    }catch(error){this.status(error instanceof Error?error.message:'Press play in the YouTube player.');}
  }
  private async createYouTube(playlistId:string|null=null){
    const opening=this.opening,connection=++this.connectionRevision,namespace=await loadYouTubeAPI();
    if(!this.active||opening!==this.opening||connection!==this.connectionRevision)return;
    this.audio.pause();this.transport='youtube';this.sync();this.status('Connecting to YouTube…');
    const holder=$('youtube-frame');holder.replaceChildren();const element=document.createElement('div');holder.append(element);
    this.player=new YouTubePlayback(namespace,element,{
      ready:()=>{if(!this.active||!this.player)return;
        if(playlistId){this.validatingPlaylist=playlistId;this.player.loadPlaylistId(playlistId);this.status('Checking playlist video IDs…');}
        else this.status('Enter the YouTube playlist ID to begin.');
      },sample:snapshot=>this.youTubeSample(snapshot),error:code=>this.youTubeError(code),
      blocked:()=>{this.snapshot=undefined;this.rebase();this.status('Playback was blocked. Press play in the visible YouTube player.');},
    });
  }
  async loadPlaylist(value:string){
    try{const id=parsePlaylistId(value);if(!id)throw new Error('Enter your YouTube playlist.');
      if(this.captureMode)throw new Error('Use a normal page URL for YouTube playback.');
      const opening=this.opening;await this.assets();if(!this.active||opening!==this.opening)return;
      this.player?.destroy();this.player=undefined;this.initialPlay=false;
      ++this.revision;this.pendingTrack=undefined;this.pendingNativeIndex=undefined;this.snapshot=undefined;this.clock.reset();
      this.nativeVideos=[];this.nativeIndex=0;this.unavailableVideos.clear();this.engine.clearScore();await this.createYouTube(id);
    }catch(error){this.status(error instanceof Error?error.message:'Playlist could not load.');}
  }
  private youTubeSample(snapshot:YouTubeSnapshot){
    if(!this.active||this.transport!=='youtube'||!this.session)return;
    if(this.validatingPlaylist){
      if(!snapshot.playlist.length)return;
      const complete=this.session.manifest.tracks.every(t=>t.source);
      const playlistId=this.validatingPlaylist;
      const result=validatePlaylist(this.session.manifest,snapshot.playlist);this.validatingPlaylist=null;this.nativeVideos=snapshot.playlist;
      this.hooks.publish({musicPlaylistValidation:{...result,mappingComplete:complete},musicPlaylistVideos:snapshot.playlist});
      this.playlistNote=!complete?'Source map is missing; no video identities will be guessed.':result.unknown.length||result.missing.length||result.duplicate.length?
        `Playlist differences: ${result.missing.length} missing, ${result.unknown.length} unexpected, ${result.duplicate.length} duplicates.`:
        result.orderMatches?'':'YouTube order differs from the intended cinematic order. Song scores stay unchanged.';
      $('music-playlist-note').textContent=this.playlistNote;
      const names=new Map(this.session.tracks.map(t=>[t.id,t.title]));
      $('music-source-report').textContent=[
        `Playlist: ${playlistId}`,
        complete?'Identity mapping: complete':'Identity mapping: missing supplied source map; comparison is pending',
        'Missing expected: '+(complete?result.missing.map(id=>names.get(id)).join(', ')||'none':'pending supplied identity map'),
        'Unexpected IDs: '+(complete?result.unknown.join(', ')||'none':'pending supplied identity map'),
        'Duplicate IDs: '+(result.duplicate.join(', ')||'none'),
        'Order differences: '+(complete?result.orderDifferences.map(d=>`${d.position}: ${names.get(d.expected??'')??'—'} → ${names.get(d.actual??'')??d.videoId??'—'}`).join('; ')||'none':'cannot compare without the source map'),
        'Unavailable/private: reported when YouTube rejects an item; omitted entries appear as missing',
        'Actual video IDs:\n'+snapshot.playlist.map((id,i)=>`${i+1}. ${id}`).join('\n'),
      ].join('\n\n');
      this.nativeIndex=Math.max(0,snapshot.index);this.pendingOffset=true;
      if(this.initialPlay){this.initialPlay=false;this.player!.port.playVideo();}else this.status('Playlist loaded. Press play.');return;
    }
    if(this.pendingNativeIndex!==undefined){
      if(snapshot.index!==this.pendingNativeIndex||snapshot.videoId!==this.nativeVideos[this.pendingNativeIndex])return;
      this.pendingNativeIndex=undefined;
    }
    this.nativeIndex=snapshot.index;this.nativeVideos=snapshot.playlist.length?snapshot.playlist:this.nativeVideos;
    const track=this.session.identify(snapshot.videoId,-1);
    if(!track){if(snapshot.videoId){
      ++this.revision;this.pendingTrack=undefined;this.engine.clearScore();this.snapshot=undefined;
      $('music-title').textContent='Unmapped YouTube video';$('music-artist').textContent=snapshot.videoId;
      $('music-position').textContent=`${snapshot.index+1} / ${this.nativeVideos.length}`;$('music-time').textContent=label(snapshot.time);
      this.status('This video has no verified source mapping. Rain sync is holding.');
      this.hooks.publish({musicUnmappedVideo:snapshot.videoId,musicPlaying:false});
    }return;}
    if(this.pendingTrack&&this.pendingTrack!==track.id)return;
    if(track.id!==this.session.current.id||(!this.engine.scheduler&&!this.pendingTrack)){
      // Native YouTube next/previous controls also follow exact video identity.
      this.pendingOffset=true;this.sourceMismatch=false;void this.activateScore(track,0);
    }
    this.snapshot=snapshot;this.rate=snapshot.rate;
    if(this.pendingPause&&snapshot.state===1){this.pendingPause=false;this.player!.port.pauseVideo();return;}
    if(this.pendingOffset&&track.source&&(snapshot.state===1||snapshot.state===5||snapshot.state===3)){
      this.pendingOffset=false;
      if(Math.abs(snapshot.time-track.source.source_start_seconds)>.2){this.player!.port.seekTo(track.source.source_start_seconds,true);this.clock.reset(track.source.source_start_seconds,performance.now());this.rebase();return;}
    }
    if(track.source?.validation_status==='mismatch'||this.session.durationMismatch(snapshot.duration)){
      this.sourceMismatch=true;this.status('This upload’s effective duration differs from the reference. Rain sync paused; replace its source mapping.');
    }
    this.clock.sample(snapshot.time,performance.now(),snapshot.state===1,snapshot.rate);
    if(this.clock.discontinuity)this.rebase();
    if(this.simulationPaused&&snapshot.state===1){this.player!.port.pauseVideo();return;}
    if(snapshot.state===0){this.scheduleEnded(track.id);return;}
    if(this.awaitingEnd&&this.awaitingEnd!==track.id){this.awaitingEnd=undefined;if(this.endTimer!==undefined)window.clearTimeout(this.endTimer);}
    if(snapshot.state===1&&this.session.atEnd(snapshot.time)){void this.next();return;}
    if(!this.sourceMismatch)this.status(snapshot.state===1?'Playing':snapshot.state===3?'Buffering — rain holds':snapshot.state===2?'Paused':'Ready — press play');
    this.progress();
  }
  private scheduleEnded(trackId:string){
    if(this.awaitingEnd===trackId)return;this.awaitingEnd=trackId;
    // Let native playlist advancement settle before advancing manually. Never
    // double-skip when YouTube already changed the item.
    this.endTimer=window.setTimeout(()=>{if(this.active&&this.awaitingEnd===trackId&&this.session?.current.id===trackId){this.awaitingEnd=undefined;void this.next();}},350);
  }
  private youTubeError(code:number){
    this.snapshot=undefined;this.engine.clearScore();
    if([100,101,150].includes(code)&&this.session){
      const actualIndex=this.pendingNativeIndex??this.player?.port.getPlaylistIndex()??this.nativeIndex;
      if(actualIndex>=0)this.nativeIndex=actualIndex;
      const videoId=this.nativeVideos[this.pendingNativeIndex??this.nativeIndex];
      const track=this.session.identify(videoId,-1),failed=track?.title??videoId??'This video';
      if(track)this.session.unavailable.add(track.id);if(videoId)this.unavailableVideos.add(videoId);
      this.hooks.publish({musicUnavailable:Array.from(this.session.unavailable),musicUnavailableVideos:Array.from(this.unavailableVideos)});
      $('music-source-report').textContent+=`\n\nUnavailable embed: ${videoId} (YouTube error ${code})`;
      this.status(`${failed} is unavailable here. Moving to the next track.`);void this.next();
    }else{this.player?.port.pauseVideo();this.status(code===153?'YouTube could not identify this embed. Reload from the deployed site.':'YouTube could not play this source. Try again or choose another track.');}
  }
  private async activateScore(track:MusicTrack,time:number){
    const revision=++this.revision;this.pendingTrack=track.id;this.engine.clearScore();
    this.session!.select(this.session!.tracks.findIndex(t=>t.id===track.id));this.progress();
    try{const score=await this.score(track);if(!this.active||revision!==this.revision)return;
      this.engine.setScore(score,this.pendingTrack===track.id?time:this.currentTime());this.pendingTrack=undefined;this.rebase();this.progress();
    }catch(error){if(revision===this.revision){this.pendingTrack=undefined;this.status(error instanceof Error?error.message:'Score could not load.');}}
  }
  async select(id:string,play:boolean){
    await this.assets();if(!this.active)return;
    const index=this.session!.tracks.findIndex(t=>t.id===id);if(index<0)throw new Error('Unknown track.');
    const target=this.session!.tracks[index];
    if(this.transport==='youtube'&&this.player){
      if(!target.source)throw new Error('This track has no supplied YouTube source mapping.');
      const native=this.nativeVideos.indexOf(target.source.video_id);
      if(native<0)throw new Error('This track is missing from the YouTube playlist.');
      this.moveToNative(native,play);return;
    }
    const track=this.session!.select(index);this.sourceMismatch=false;this.snapshot=undefined;this.clock.reset();
    this.pendingOffset=this.transport==='youtube';this.awaitingEnd=undefined;if(this.endTimer!==undefined)window.clearTimeout(this.endTimer);
    void this.activateScore(track,0);
    if(this.transport==='local'){
      this.audio.pause();const url=this.localFiles.get(id);
      if(!url){this.audio.removeAttribute('src');this.audio.load();this.status('Choose this numbered reference MP3 in development mode.');return;}
      this.audio.src=url;this.audio.load();if(play&&!this.simulationPaused)await this.audio.play().catch(()=>this.status('Press play to start the reference recording.'));
    }else if(this.transport==='capture'){this.referenceStart=0;this.referenceWall=performance.now();this.referencePlaying=play;}
    this.sync();this.progress();
  }
  async next(){
    if(!this.session)return;
    if(this.transport==='youtube'&&this.player){
      let index=this.nativeIndex+1;while(index<this.nativeVideos.length&&this.unavailableVideos.has(this.nativeVideos[index]))index++;
      if(index>=this.nativeVideos.length){this.session.ended=true;this.finish();}
      else this.moveToNative(index,true);
    }else{const track=this.session.next();if(track)await this.select(track.id,true);else this.finish();}
  }
  private async previous(){
    if(!this.session)return;
    if(this.transport==='youtube'&&this.player){
      let index=Math.max(0,this.nativeIndex-1);while(index>0&&this.unavailableVideos.has(this.nativeVideos[index]))index--;
      this.moveToNative(index,true);
    }else await this.select(this.session.previous().id,true);
  }
  private moveToNative(index:number,play:boolean){
    if(!this.player?.isReady||!this.session||index<0||index>=this.nativeVideos.length)return;
    ++this.revision;this.pendingTrack=undefined;this.engine.clearScore();this.snapshot=undefined;this.clock.reset();
    this.session.ended=false;this.pendingOffset=true;this.sourceMismatch=false;this.nativeIndex=index;this.pendingNativeIndex=index;
    this.awaitingEnd=undefined;if(this.endTimer!==undefined)window.clearTimeout(this.endTimer);
    this.pendingPause=!play||this.simulationPaused;this.player.port.playVideoAt(index);
  }
  private finish(){this.pause();this.engine.clearScore();this.status('Playlist complete. Play again to return to the opening.');this.progress();}
  pause(){
    if(this.transport==='youtube')this.player?.port.pauseVideo();
    else if(this.transport==='local')this.audio.pause();
    else if(this.transport==='capture'){this.referenceStart=this.currentTime();this.referencePlaying=false;}
    if(this.snapshot)this.snapshot={...this.snapshot,state:2};this.rebase();this.status('Paused');
  }
  seek(time:number){
    if(!this.session||this.pendingTrack||this.pendingNativeIndex!==undefined||(this.transport==='youtube'&&!this.snapshot))return;time=clamp(time,0,this.session.current.duration);
    if(this.transport==='youtube'){const sourceTime=this.session.seekSourceTime(time);this.player?.port.seekTo(sourceTime,true);this.clock.reset(sourceTime,performance.now());if(this.snapshot)this.snapshot={...this.snapshot,time:sourceTime};}
    else if(this.transport==='local')this.audio.currentTime=time;
    else if(this.transport==='capture'){this.referenceStart=time;this.referenceWall=performance.now();}
    this.engine.seek(time);this.progress();
  }
  private currentTime(){
    if(this.transport==='youtube')return this.session?.time(this.clock.time(performance.now(),this.rate))??0;
    if(this.transport==='local')return this.audio.currentTime;
    if(this.transport==='capture')return this.referenceStart+(this.referencePlaying?(performance.now()-this.referenceWall)/1000:0);
    return 0;
  }
  private isPlaying(){return !this.simulationPaused&&!this.sourceMismatch&&(this.transport==='youtube'?this.snapshot?.state===1:this.transport==='local'?!this.audio.paused&&!this.audio.ended&&!this.audio.seeking:this.transport==='capture'?this.referencePlaying:false);}
  rebase(){this.engine.seek(Math.max(0,this.currentTime()));}
  setSimulationPaused(paused:boolean){
    if(paused===this.simulationPaused)return;
    if(paused){this.resumeAfterSimulation=this.isPlaying();this.pause();}this.simulationPaused=paused;
    if(!paused&&this.resumeAfterSimulation){this.resumeAfterSimulation=false;void this.play();}
  }
  updateMusicRain(){
    const time=this.currentTime();this.progress();
    if(!this.enabled||!this.session||this.pendingNativeIndex!==undefined||this.validatingPlaylist)return [];
    return this.engine.updateMusicRain({trackId:this.session.current.id,time:Math.max(0,time),playing:this.isPlaying()&&time>=0,seeking:!!this.pendingTrack});
  }
  private progress(){
    if(!this.session||(this.transport==='youtube'&&(!this.snapshot||this.pendingNativeIndex!==undefined)))return;
    const track=this.session.current,time=clamp(this.currentTime(),0,track.duration);
    const now=performance.now();if(now-this.lastUI<90&&$<HTMLSelectElement>('music-track').value===track.id)return;this.lastUI=now;
    $('music-title').textContent=track.title;$('music-artist').textContent=track.artist;$('music-position').textContent=this.transport==='youtube'?`${this.nativeIndex+1} / ${this.nativeVideos.length||32}`:`${this.session.index+1} / ${this.session.tracks.length}`;
    $<HTMLSelectElement>('music-track').value=track.id;$('music-time').textContent=`${label(time)} / ${label(track.duration)}`;
    $('music-weather').textContent=this.engine.scheduler?.score.style??'Authored weather';
    this.hooks.publish({musicEnabled:this.enabled,musicTrack:track.id,musicIndex:this.session.index,musicTime:time,musicPlaying:this.isPlaying(),
      musicSection:this.engine.scheduler?.sectionAt(time).name??'',musicEmitted:this.engine.scheduler?.emitted??0,musicSourceMismatch:this.sourceMismatch});
  }
  private async importLocalFiles(){
    const verified=new Map<string,string>(),opening=this.opening;
    try{
      await this.assets();const files=Array.from($<HTMLInputElement>('music-local-files').files??[]);
      for(const file of files){const index=Number(/^(\d{2}) - /.exec(file.name)?.[1]);const track=this.session!.tracks.find(t=>t.index===index);if(!track)continue;
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
        if(digest!==track.reference_sha256)throw new Error(`${track.title}: this is not the analyzed reference MP3.`);
        verified.set(track.id,URL.createObjectURL(file));
      }
      if(!verified.size)throw new Error('Choose the numbered reference MP3 files.');
      if(!this.active||opening!==this.opening){for(const url of verified.values())URL.revokeObjectURL(url);return;}
      this.player?.destroy();this.player=undefined;for(const url of this.localFiles.values())URL.revokeObjectURL(url);
      this.localFiles=verified;this.transport='local';this.enterTone();this.sync();await this.select(this.session!.current.id,false);
      this.status(`${verified.size} reference recordings verified. Press play.`);
    }catch(error){for(const [id,url] of verified)if(this.localFiles.get(id)!==url)URL.revokeObjectURL(url);this.status(error instanceof Error?error.message:'Reference recordings could not load.');}
  }
  private exposeCapture(){
    (window as Window&{inkWaterMusicCapture?:unknown}).inkWaterMusicCapture={
      select:async(trackId:string,start?:number)=>{
        await this.open();this.player?.destroy();this.player=undefined;this.audio.pause();this.transport='capture';this.enterTone();
        await this.select(trackId,false);await this.score(this.session!.current);
        const score=await this.score(this.session!.current);this.engine.setScore(score,start??score.recommended_demo.start);
        this.pendingTrack=undefined;this.referenceStart=start??score.recommended_demo.start;this.referenceWall=performance.now();this.referencePlaying=true;this.sync();
        this.engine.updateMusicRain({trackId,time:this.referenceStart,playing:true});
      },seek:(time:number)=>this.seek(time),pause:()=>this.pause(),play:()=>this.play(),off:()=>this.close(),
      state:()=>({track:this.session?.current.id,time:this.currentTime(),enabled:this.enabled,events:this.engine.scheduler?.events.length,seed:this.engine.scheduler?.score.seed}),
    };
  }
}
