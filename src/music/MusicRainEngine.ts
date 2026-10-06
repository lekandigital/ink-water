import {RainScheduler} from './RainScheduler';
import type {RainScore,PlaybackSample} from './MusicScore';

/** Player-independent score owner. Track and clock discontinuities discard
 * pending arrivals; existing water is deliberately outside this class.
 */
export class MusicRainEngine{
  scheduler?:RainScheduler;
  private wasPlaying=false;
  setScore(score:RainScore,time=0){this.scheduler=new RainScheduler(score);this.scheduler.seek(time);this.wasPlaying=false;}
  clearScore(){this.scheduler=undefined;this.wasPlaying=false;}
  seek(time:number){this.scheduler?.seek(time);}
  updateMusicRain(sample:PlaybackSample){
    const scheduler=this.scheduler;
    if(!scheduler||scheduler.score.track_id!==sample.trackId)return [];
    if(!sample.playing||sample.seeking){scheduler.seek(sample.time);this.wasPlaying=false;return [];}
    if(!this.wasPlaying){scheduler.seek(sample.time);this.wasPlaying=true;return [];}
    return scheduler.updateMusicRain(sample.time);
  }
}
