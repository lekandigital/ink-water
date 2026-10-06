import {clamp} from './MusicScore';

// The iframe may deliver the same cached metadata for several polls while its
// audio keeps playing. Keep a short grace window, then hold until it advances.
const PROGRESS_GRACE=.9;

/** Reconciled YouTube samples, with bounded interpolation from real progress.
 * No accumulation: advancing samples anchor time to the player's master clock.
 * Pause/buffering stops immediately; repeated playing metadata has finite grace.
 */
export class PlaybackClock{
  private anchor=0;
  private wall=0;
  private running=false;
  private previousRaw:number|undefined;
  private progressWall=0;
  private sampledRate=1;
  private monotone=0;
  discontinuity=false;
  reset(time=0,now=0){this.anchor=time;this.wall=now;this.progressWall=now;this.monotone=time;this.previousRaw=undefined;this.running=false;this.discontinuity=false;}
  sample(time:number,now:number,playing:boolean,rate=1){
    if(!Number.isFinite(time)||!Number.isFinite(now))return;
    // getCurrentTime reads the iframe's cached metadata. Repeated polls are
    // not new clock measurements: compare a step with wall time since the
    // last actual advance, rather than just the previous 80ms poll. Use the
    // same finite window as interpolation so long reconnections remain seeks.
    const delta=this.previousRaw===undefined?0:time-this.previousRaw;
    const projected=this.projectedTime(now,this.sampledRate);
    const expected=this.previousRaw===undefined?0:Math.max(0,projected-this.previousRaw);
    this.discontinuity=this.previousRaw!==undefined&&(delta<-.045||delta>Math.max(.24,expected+.18));
    if(this.discontinuity||!playing)this.monotone=time;
    // Duplicated playing polls are not fresh measurements and must not reset
    // the anchor or turn ordinary cached delivery into stop/start rain bursts.
    if(this.previousRaw===undefined||Math.abs(delta)>.002||!playing||!this.running||this.discontinuity){
      this.anchor=time;this.wall=now;this.progressWall=now;
    }else if(rate!==this.sampledRate){
      // Apply a rate change from this wall boundary, never retroactively to
      // the cached interval. It does not renew grace without raw progress.
      this.anchor=projected;this.wall=now;
    }
    this.running=playing;this.previousRaw=time;this.sampledRate=rate;
  }
  private projectedTime(now:number,rate:number){
    const grace=clamp(PROGRESS_GRACE-(this.wall-this.progressWall)/1000,0,PROGRESS_GRACE);
    return this.anchor+(this.running?clamp((now-this.wall)/1000,0,grace)*rate:0);
  }
  time(now:number,rate=this.sampledRate){
    const time=this.projectedTime(now,rate);
    // Do not go backwards for small sampling/quantization corrections.
    this.monotone=Math.max(this.monotone,time);return this.monotone;
  }
}
