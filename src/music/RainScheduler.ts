import {clamp,finite,upperBound,validateScore,type RainScore,type RainSection,type MusicRainDrop,type Pair} from './MusicScore';

// Stable event-local randomness, including physical positions/force variation.
// Seeking does not consume a global generator or change future weather.
export function randomAt(index:number,seed:number,salt=0){
  let x=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))>>>0;
  x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);
  return ((x^(x>>>15))>>>0)/4294967296;
}
const lerp=(a:number,b:number,u:number)=>a+(b-a)*u;
const smooth=(u:number)=>u*u*(3-2*u);

export class RainScheduler{
  readonly events:ReadonlyArray<MusicRainDrop>;
  private previous:number|undefined;
  private cursor=0;
  emitted=0;
  discontinuities=0;
  constructor(readonly score:RainScore){validateScore(score);this.events=this.plan();}

  sectionAt(time:number){return this.score.sections.find(s=>time<s.end)??this.score.sections.at(-1)!;}
  stateAt(time:number){
    const s=this.sectionAt(clamp(time,0,this.score.duration));
    const u=smooth(clamp((time-s.start)/(s.end-s.start),0,1));
    let amount=1;
    for(const b of this.score.breaths)if(time>=b.start&&time<b.end)amount*=b.amount;
    for(const a of this.score.accents){
      if(time>=a.time-a.anticipation&&time<a.time)amount*=1-a.quiet*smooth((time-a.time+a.anticipation)/Math.max(.001,a.anticipation));
      if(time>=a.time-.12&&time<a.time+.22)amount=0;
    }
    return {section:s,density:lerp(...s.density,u)*amount,background:s.background*amount,force:lerp(...s.force,u),scale:lerp(...s.scale,u),amount};
  }

  private position(time:number,index:number,s:RainSection,salt=0):Pair{
    const r=(k:number)=>randomAt(index,this.score.seed,k+salt);
    let x=(r(3)*2-1)*s.spatial.spread,y=(r(4)*2-1)*s.spatial.spread;
    const language=s.spatial.language;
    if(['cells','showers','motif','memory','alternate','streams'].includes(language)){
      // Temporal regions are generative; no drop coordinates are hand keyed.
      const region=Math.floor(time/(language==='streams'?7.3:11.7));
      const centerX=(randomAt(region,this.score.seed,40)*2-1)*.58;
      const centerY=(randomAt(language==='memory'?region%5:region,this.score.seed,41)*2-1)*.58;
      x=centerX+x*.38;y=centerY+y*.38;
      if(language==='alternate')x=(index%2?1:-1)*Math.abs(x);
    }
    const drift=s.spatial.wander;
    x+=Math.sin(time*.071+r(31)*6.28)*drift;y+=Math.cos(time*.057+r(32)*6.28)*drift;
    return [clamp(x+s.spatial.focus[0],-.88,.88),clamp(y+s.spatial.focus[1],-.88,.88)];
  }

  private plan(){
    const events:MusicRainDrop[]=[],resolution=.04;
    const push=(time:number,index:number,salt:number,kind:MusicRainDrop['kind'],force:number,scale:number,position:Pair)=>{
      if(time<0||time>=this.score.duration)return;
      events.push(Object.freeze({time,force,scale,position:Object.freeze(position) as unknown as Pair,
        seed:(Math.floor(randomAt(index,this.score.seed,salt+20)*4294967296))>>>0,kind}));
    };
    for(let i=0;i*resolution<this.score.duration;i++){
      const time=i*resolution,w=this.stateAt(time),s=w.section;
      const background=randomAt(i,this.score.seed,1)<1-Math.exp(-w.background*resolution);
      if(background)push(time+randomAt(i,this.score.seed,2)*resolution,i,3,'background',w.force*.48,w.scale*.72,this.position(time,i,s,90));
      if(randomAt(i,this.score.seed,0)>=1-Math.exp(-w.density*resolution))continue;
      const clustered=randomAt(i,this.score.seed,5)<s.cluster.probability;
      const count=clustered?Math.floor(lerp(s.cluster.count[0],s.cluster.count[1]+1,randomAt(i,this.score.seed,6))):1;
      const point=this.position(time,i,s),angle=randomAt(i,this.score.seed,7)*Math.PI*2;
      let at=time+randomAt(i,this.score.seed,8)*resolution;
      for(let j=0;j<count;j++){
        if(j)at+=lerp(...s.cluster.spacing,randomAt(i,this.score.seed,10+j));
        if(this.stateAt(at).amount===0)continue;
        let p:Pair=[...point];
        if(s.spatial.language==='split'&&j%2)p=[-point[0],-point[1]];
        else if(j){const distance=s.cluster.radius*Math.sqrt(randomAt(i,this.score.seed,50+j));
          p=[clamp(point[0]+Math.cos(angle+j*1.9)*distance,-.88,.88),clamp(point[1]+Math.sin(angle+j*1.9)*distance,-.88,.88)];}
        const echo=s.spatial.language==='echo'?Math.pow(.72,j):1;
        push(at,i,j,clustered?'cluster':'rain',w.force*echo*(.85+.30*randomAt(i,this.score.seed,60+j)),w.scale*(.86+.26*randomAt(i,this.score.seed,70+j)),p);
      }
    }
    for(let i=0;i<this.score.accents.length;i++){
      const a=this.score.accents[i],s=this.sectionAt(a.time),p=this.position(a.time,100000+i,s);
      for(let j=0;j<a.count;j++){
        const at=a.time+j*a.spacing;
        const point:Pair=a.type==='split'&&j%2?[-p[0],-p[1]]:a.type==='glint'&&j?
          this.position(at,100000+i,s,j*83):[...p];
        push(at,100000+i,j,'accent',a.force,a.scale,point);
      }
    }
    return Object.freeze(events.sort((a,b)=>a.time-b.time));
  }

  seek(currentTime:number){
    if(!finite(currentTime))throw new Error('Music time must be finite.');
    this.previous=clamp(currentTime,0,this.score.duration);this.cursor=upperBound(this.events,this.previous,e=>e.time);
  }
  /** Any player can supply score time. No DOM, audio, solver or wall clock here. */
  updateMusicRain(currentTime:number):MusicRainDrop[]{
    if(!finite(currentTime))throw new Error('Music time must be finite.');
    const time=clamp(currentTime,0,this.score.duration);
    if(this.previous===undefined){this.seek(time);return [];}
    // Explicit seeks rebase too. This is a defensive guard for native seeks,
    // hidden tabs or a disconnected player: never discharge a rain backlog.
    if(time<this.previous-.002||time-this.previous>.5){this.seek(time);this.discontinuities++;return [];}
    if(time<=this.previous)return [];
    const drops:MusicRainDrop[]=[];
    while(this.cursor<this.events.length&&this.events[this.cursor].time<=time)drops.push(this.events[this.cursor++]);
    this.previous=time;this.emitted+=drops.length;return drops;
  }
}
