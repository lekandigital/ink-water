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
  private previousWall=0;
  private monotone=0;
  discontinuity=false;
  reset(time=0,now=0){this.anchor=time;this.wall=now;this.monotone=time;this.previousRaw=undefined;this.running=false;this.discontinuity=false;}
  sample(time:number,now:number,playing:boolean,rate=1){
    if(!Number.isFinite(time)||!Number.isFinite(now))return;
    const elapsed=(now-this.previousWall)/1000;
    const delta=this.previousRaw===undefined?0:time-this.previousRaw;
    this.discontinuity=this.previousRaw!==undefined&&(delta<-.045||delta>Math.max(.24,elapsed*rate+.18));
    if(this.discontinuity||!playing)this.monotone=time;
    this.running=playing&&(this.previousRaw===undefined||delta>.002);
    this.anchor=time;this.wall=now;this.previousRaw=time;this.previousWall=now;
  }
  time(now:number,rate=1){
    const time=this.anchor+(this.running?clamp((now-this.wall)/1000,0,.12)*rate:0);
    // Do not go backwards for small sampling/quantization corrections.
    this.monotone=Math.max(this.monotone,time);return this.monotone;
  }
}
