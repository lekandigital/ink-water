import {MarumariRainScheduler,type MarumariAnalysis,type MarumariScore,type MusicRainClock} from './MarumariRainScheduler';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const timeLabel=(time:number)=>{time=Math.max(0,Math.floor(Number.isFinite(time)?time:0));return Math.floor(time/60)+':'+String(time%60).padStart(2,'0');};
type Diagnostics=(state:Record<string,unknown>)=>void;

// The only player in this prototype. Native audio controls provide play, pause,
// volume and seek. Playback events rebase the independent song-time scheduler.
export class MusicRainPlayer implements MusicRainClock{
  enabled=false;
  private scheduler?:MarumariRainScheduler;
  private loading?:Promise<MarumariRainScheduler>;
  private revision=0;
  private simulationPaused=false;
  private resumeAfterSimulation=false;
  private seekWasPlaying=false;
  readonly audio=$<HTMLAudioElement>('music-audio');
  private readonly toggle=$<HTMLButtonElement>('music-sync-toggle');
  private readonly panel=$('music-player');
  private readonly status=$('music-status');

  constructor(private publish:Diagnostics){
    this.toggle.addEventListener('click',()=>{void this.setEnabled(!this.enabled);});
    $('music-restart').addEventListener('click',()=>this.restart());
    this.audio.addEventListener('play',()=>{
      if(!this.enabled||this.simulationPaused){this.audio.pause();return;}
      this.rebase();this.status.textContent='Playing';
    });
    this.audio.addEventListener('pause',()=>{this.rebase();if(this.enabled)this.status.textContent=this.audio.ended?'Ended':'Paused';});
    this.audio.addEventListener('seeking',()=>{this.seekWasPlaying=!this.audio.paused;this.rebase();});
    this.audio.addEventListener('seeked',()=>{
      this.rebase();
      if(this.enabled&&this.seekWasPlaying)this.status.textContent='Playing';
      this.seekWasPlaying=false;
    });
    this.audio.addEventListener('ended',()=>{this.rebase();this.status.textContent='Ended';});
    this.audio.addEventListener('waiting',()=>{if(this.enabled)this.status.textContent='Buffering';});
    this.audio.addEventListener('playing',()=>{if(this.enabled)this.status.textContent='Playing';});
    this.audio.addEventListener('error',()=>{
      if(!this.enabled)return;
      void this.setEnabled(false);this.status.textContent='The local recording could not load.';
    });
    for(const name of ['timeupdate','loadedmetadata','seeked','pause'])this.audio.addEventListener(name,()=>this.progress());
    this.toggle.disabled=false;
    this.sync();
  }

  private assets(){
    if(!this.loading)this.loading=Promise.all([
      this.loadJson<MarumariAnalysis>('marumari-full-analysis.json'),
      this.loadJson<MarumariScore>('marumari-rain-score.json'),
    ]).then(([analysis,score])=>new MarumariRainScheduler(analysis,score)).catch(error=>{this.loading=undefined;throw error;});
    return this.loading;
  }

  private async loadJson<T>(name:string):Promise<T>{
    const response=await fetch(new URL('music/'+name,document.baseURI));
    if(!response.ok)throw new Error('Music timing data could not load.');
    return response.json() as Promise<T>;
  }

  async setEnabled(enabled:boolean){
    const revision=++this.revision;
    this.enabled=enabled;this.resumeAfterSimulation=false;this.sync();
    if(!enabled){this.audio.pause();this.rebase();this.status.textContent='Off';return;}
    this.status.textContent='Loading the score…';
    try{
      const scheduler=await this.assets();
      if(!this.enabled||revision!==this.revision)return;
      this.scheduler=scheduler;
      if(!this.audio.getAttribute('src'))this.audio.src=new URL('music/marumari-birch-beer-forest.mp3',document.baseURI).href;
      this.audio.controls=true;this.rebase();
      this.status.textContent=this.simulationPaused?'Water paused — resume to play':'Ready — press play';
      this.progress();
    }catch(error){
      if(revision!==this.revision)return;
      this.enabled=false;this.sync();this.status.textContent=error instanceof Error?error.message:'Music mode could not start.';
    }
  }

  private sync(){
    this.toggle.setAttribute('aria-checked',String(this.enabled));
    this.toggle.textContent=this.enabled?'On':'Off';
    this.panel.hidden=!this.enabled;
    if(!this.enabled)this.audio.controls=false;
    this.publish({musicEnabled:this.enabled});
  }

  rebase(){this.scheduler?.seek(this.audio.currentTime);this.progress();}

  restart(){
    if(!this.enabled||!this.scheduler)return;
    const playing=!this.audio.paused;
    this.audio.currentTime=0;this.scheduler.seek(0);this.progress();
    if(playing&&!this.simulationPaused)void this.audio.play().catch(()=>{this.status.textContent='Press play to resume';});
  }

  setSimulationPaused(paused:boolean){
    if(paused===this.simulationPaused)return;
    this.simulationPaused=paused;
    if(paused){
      this.resumeAfterSimulation=this.enabled&&!this.audio.paused;
      this.audio.pause();this.rebase();
      if(this.enabled)this.status.textContent='Water paused';
    }else if(this.resumeAfterSimulation&&this.enabled){
      this.resumeAfterSimulation=false;
      void this.audio.play().catch(()=>{this.status.textContent='Press play to resume';});
    }
  }

  updateMusicRain(){
    this.progress();
    if(!this.enabled||!this.scheduler)return [];
    if(this.simulationPaused||this.audio.paused||this.audio.seeking||this.audio.ended){this.scheduler.seek(this.audio.currentTime);return [];}
    return this.scheduler.updateMusicRain(this.audio.currentTime);
  }

  private progress(){
    const time=this.audio.currentTime;
    $('music-time').textContent=timeLabel(time)+' / '+timeLabel(this.scheduler?.score.duration??211.487);
    this.publish({musicEnabled:this.enabled,musicTime:time,musicPlaying:this.enabled&&!this.audio.paused&&!this.simulationPaused,musicSection:this.scheduler?.stateAt(time).section??'',musicEmitted:this.scheduler?.emitted??0});
  }
}
