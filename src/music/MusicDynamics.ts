import {clamp,type MusicRainDrop} from './MusicScore';

/** Authored force is a musical proportion, not a second Gentle-motion setting.
 * Calibrate it against the existing physical rain impulse. Ordinary rain never
 * passes through this function; all water force/size controls still apply. */
export function musicImpact(event:MusicRainDrop,expression=1){
  const gain={background:1.4,rain:2.6,cluster:2.6,accent:3.2,gesture:1.7}[event.kind];
  const size=event.kind==='background'?1:event.kind==='gesture'?1.08:1.18;
  return {force:event.force*gain*clamp(expression,.5,1.75),scale:event.scale*size};
}
