// One recording, one interpretation. This module has no audio, DOM, rendering,
// water or wall-clock dependency: a playback clock supplies song time.
export type MusicSample={t:number;energy:number;brightness:number;onsetStrength:number};
export type MarumariAnalysis={duration:number;tempo:number;beats:number[];onsets:number[];state:MusicSample[]};
type Pair=[number,number];
export type RainSection={name:string;start:number;end:number;density:Pair;strength:Pair;scale:Pair;pulse:number;bias:Pair;note:string};
export type RainAccent={time:number;strength:number;scale:number;anticipation:number;quiet:number;note:string};
export type MarumariScore={version:number;artist:string;title:string;duration:number;seed:number;sections:RainSection[];accents:RainAccent[]};
export type MusicRainDrop={time:number;kind:'rain'|'accent';strength:number;scale:number;bias:Pair};
export type MusicRainClock={readonly enabled:boolean;updateMusicRain():MusicRainDrop[];setSimulationPaused(paused:boolean):void;rebase():void};

const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const lerp=(a:number,b:number,u:number)=>a+(b-a)*u;
const finite=(x:number)=>typeof x==='number'&&Number.isFinite(x);
const smooth=(u:number)=>u*u*(3-2*u);
function upperBound<T>(items:ReadonlyArray<T>,time:number,value:(item:T)=>number){
  let lo=0,hi=items.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(value(items[mid])<=time)lo=mid+1;else hi=mid;}
  return lo;
}
// Stable temporal randomness makes the same score independent of frame rate.
// The actual physical rain positions and per-drop variation stay random.
function noise(index:number,seed:number){
  let x=(seed^Math.imul(index+1,0x9e3779b1))>>>0;
  x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);
  return ((x^(x>>>15))>>>0)/4294967296;
}

function validate(analysis:MarumariAnalysis,score:MarumariScore){
  if(!analysis||!score||score.version!==1||score.artist!=='Marumari'||score.title!=='birch beer forest'||Math.abs(score.duration-211.487)>.01||Math.abs(analysis.duration-score.duration)>.01)throw new Error('This prototype requires the supplied Marumari recording and score.');
  if(!finite(analysis.tempo)||analysis.tempo<=0||!Number.isInteger(score.seed))throw new Error('Invalid Marumari timing data.');
  const ordered=(times:number[])=>Array.isArray(times)&&times.every((t,i)=>finite(t)&&t>=0&&t<=score.duration&&(i===0||t>times[i-1]));
  if(!ordered(analysis.beats)||!ordered(analysis.onsets)||!Array.isArray(analysis.state)||analysis.state.length<2||!ordered(analysis.state.map(s=>s.t)))throw new Error('Music timing samples must be finite and ordered.');
  for(const s of analysis.state)for(const key of ['energy','brightness','onsetStrength'] as const)if(!finite(s[key])||s[key]<0||s[key]>1)throw new Error('Invalid music feature value.');
  if(!Array.isArray(score.sections)||!score.sections.length||!Array.isArray(score.accents))throw new Error('The rain score is incomplete.');
  let end=0;
  for(const s of score.sections){
    if(!s.name||s.start!==end||!finite(s.end)||s.end<=s.start||s.end>score.duration||!finite(s.pulse)||s.pulse<0||s.pulse>.6)throw new Error('Rain sections must cover the recording without gaps.');
    for(const [pair,min,max] of [[s.density,0,3],[s.strength,.1,1.8],[s.scale,.3,1.6],[s.bias,-.25,.25]] as const)if(!Array.isArray(pair)||pair.length!==2||pair.some(v=>!finite(v)||v<min||v>max))throw new Error('Invalid rain section range.');
    end=s.end;
  }
  if(end!==score.duration)throw new Error('The rain score must include the complete recording.');
  let previous=-1;
  for(const a of score.accents){
    if(!finite(a.time)||a.time<=previous||a.time<0||a.time>score.duration||!finite(a.strength)||a.strength<.1||a.strength>1.8||!finite(a.scale)||a.scale<.3||a.scale>1.6||!finite(a.anticipation)||a.anticipation<0||a.anticipation>1.5||!finite(a.quiet)||a.quiet<0||a.quiet>1)throw new Error('Invalid selected rain accent.');
    const i=upperBound(analysis.onsets,a.time,t=>t);
    if(![analysis.onsets[i-1],analysis.onsets[i]].some(t=>t!==undefined&&Math.abs(t-a.time)<.002))throw new Error('Selected accents must use actual analysis onset times.');
    previous=a.time;
  }
}

export class MarumariRainScheduler{
  readonly events:ReadonlyArray<MusicRainDrop>;
  private previous:number|undefined;
  private cursor=0;
  emitted=0;
  discontinuities=0;

  constructor(readonly analysis:MarumariAnalysis,readonly score:MarumariScore){
    validate(analysis,score);
    this.events=this.plan();
  }

  private sample(time:number):MusicSample{
    const states=this.analysis.state,i=upperBound(states,time,s=>s.t),a=states[Math.max(0,i-1)],b=states[Math.min(i,states.length-1)];
    const u=a.t===b.t?0:clamp((time-a.t)/(b.t-a.t),0,1);
    return {t:time,energy:lerp(a.energy,b.energy,u),brightness:lerp(a.brightness,b.brightness,u),onsetStrength:lerp(a.onsetStrength,b.onsetStrength,u)};
  }

  private mean(time:number,radius:number):MusicSample{
    const rows=this.analysis.state;
    const a=Math.max(0,upperBound(rows,time-radius,s=>s.t)-1),b=Math.min(rows.length,upperBound(rows,time+radius,s=>s.t));
    let energy=0,brightness=0,onsetStrength=0;
    for(let i=a;i<b;i++){energy+=rows[i].energy;brightness+=rows[i].brightness;onsetStrength+=rows[i].onsetStrength;}
    const n=Math.max(1,b-a);return {t:time,energy:energy/n,brightness:brightness/n,onsetStrength:onsetStrength/n};
  }

  private section(time:number){return this.score.sections.find(s=>time<s.end)??this.score.sections[this.score.sections.length-1];}

  stateAt(time:number){
    time=clamp(time,0,this.score.duration);
    const section=this.section(time),u=clamp((time-section.start)/(section.end-section.start),0,1);
    const features=this.mean(time,.6),slow=this.mean(time,2);
    const onsets=this.analysis.onsets;
    const activity=clamp((upperBound(onsets,time+1.25,t=>t)-upperBound(onsets,time-1.25,t=>t))/10,0,1);
    // Authored sections determine the weather. Features only add bounded detail;
    // normalized loudness never becomes the rainfall rate directly.
    const detail=clamp(1+.10*(features.energy-slow.energy)+.09*(activity-.5)+.05*(features.onsetStrength-.2),.86,1.16);
    let density=lerp(...section.density,u)*detail;
    const beats=this.analysis.beats,bi=upperBound(beats,time,t=>t);
    if(bi>0&&bi<beats.length){
      const phase=(time-beats[bi-1])/(beats[bi]-beats[bi-1]);
      density*=1+section.pulse*Math.cos(2*Math.PI*phase);
    }
    for(const a of this.score.accents){
      if(time>=a.time-a.anticipation&&time<a.time){
        density*=1-a.quiet*smooth((time-(a.time-a.anticipation))/Math.max(.001,a.anticipation));
      }
      if(time>=a.time-.16&&time<=a.time+.18)density=0;
    }
    // Silence can have a high normalized centroid: do not turn it into sharp rain.
    const brightness=features.energy<.025?.35:features.brightness;
    return {section:section.name,density,scale:lerp(...section.scale,u)*(1-.12*(brightness-.35)),strength:lerp(...section.strength,u)*(1+.06*(features.onsetStrength-.2)),bias:[...section.bias] as Pair};
  }

  private plan(){
    const events:MusicRainDrop[]=[],resolution=.02;
    let last=-1;
    for(let i=0;i*resolution<this.score.duration;i++){
      const time=i*resolution,weather=this.stateAt(time);
      // Inhomogeneous random arrivals, evaluated in fixed song-time bins.
      if(noise(i,this.score.seed)>=1-Math.exp(-weather.density*resolution))continue;
      let at=time+resolution*noise(i,this.score.seed+1);
      const onsets=this.analysis.onsets,j=upperBound(onsets,at,t=>t);
      const nearest=[onsets[j-1],onsets[j]].filter(t=>t!==undefined).sort((a,b)=>Math.abs(a-at)-Math.abs(b-at))[0];
      // Attract a minority of already-selected arrivals to real attacks. Neither
      // beats nor onsets create drops on their own.
      if(this.section(at).pulse>.2&&noise(i,this.score.seed+2)<.3&&nearest!==undefined&&Math.abs(nearest-at)<.06)at=nearest;
      if(at-last<.12||this.stateAt(at).density===0||at>=this.score.duration)continue;
      events.push({time:at,kind:'rain',strength:weather.strength,scale:weather.scale,bias:weather.bias});last=at;
    }
    for(const accent of this.score.accents)events.push({time:accent.time,kind:'accent',strength:accent.strength,scale:accent.scale,bias:[...this.section(accent.time).bias]});
    return events.sort((a,b)=>a.time-b.time);
  }

  /** Rebase on play/seek/restart; do not replay a backlog of past impacts. */
  seek(currentTime:number){
    if(!finite(currentTime))throw new Error('Music time must be finite.');
    this.previous=clamp(currentTime,0,this.score.duration);
    this.cursor=upperBound(this.events,this.previous,e=>e.time);
  }

  /** The later YouTube clock can call this exact method with its currentTime. */
  updateMusicRain(currentTime:number):MusicRainDrop[]{
    if(!finite(currentTime))throw new Error('Music time must be finite.');
    const time=clamp(currentTime,0,this.score.duration);
    if(this.previous===undefined){this.seek(time);return [];}
    if(time<this.previous||time-this.previous>.5){this.discontinuities++;this.seek(time);return [];}
    if(time===this.previous)return [];
    const drops:MusicRainDrop[]=[];
    while(this.cursor<this.events.length&&this.events[this.cursor].time<=time){drops.push(this.events[this.cursor++]);}
    this.previous=time;this.emitted+=drops.length;return drops;
  }
}
