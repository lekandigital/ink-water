import {clamp} from './MusicScore';

/** Reconciled YouTube samples, with bounded interpolation only between reads.
 * No accumulation: every sample anchors time to the player's master clock.
 * An unchanged sample (stall) immediately stops extrapolating.
 */
export class PlaybackClock{
  private anchor=0;
  private wall=0;
  private running=false;
  private previousRaw:number|undefined;
  private progressWall=0;
  private monotone=0;
  discontinuity=false;
  reset(time=0,now=0){this.anchor=time;this.wall=now;this.monotone=time;this.previousRaw=undefined;this.running=false;this.discontinuity=false;}
  sample(time:number,now:number,playing:boolean,rate=1){
    if(!Number.isFinite(time)||!Number.isFinite(now))return;
    // getCurrentTime reads the iframe's cached metadata. Repeated polls are
    // not new clock measurements: compare a step with wall time since the
    // last actual advance, rather than just the previous 80ms poll. Cap that
    // window so a long stall/reconnection can never discharge a backlog.
    const elapsed=clamp((now-this.progressWall)/1000,0,.65);
    const delta=this.previousRaw===undefined?0:time-this.previousRaw;
    this.discontinuity=this.previousRaw!==undefined&&(delta<-.045||delta>Math.max(.24,elapsed*rate+.18));
    if(this.discontinuity||!playing)this.monotone=time;
    this.running=playing&&(this.previousRaw===undefined||delta>.002);
    if(this.previousRaw===undefined||Math.abs(delta)>.002||!playing)this.progressWall=now;
    this.anchor=time;this.wall=now;this.previousRaw=time;
  }
  time(now:number,rate=1){
    const time=this.anchor+(this.running?clamp((now-this.wall)/1000,0,.12)*rate:0);
    // Do not go backwards for small sampling/quantization corrections.
    this.monotone=Math.max(this.monotone,time);return this.monotone;
  }
}
