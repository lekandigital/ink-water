// Neutral values retain the exact 0124a47 radius, force distribution, and clock.
export const motionDefaults={waveSpeed:1,rippleScale:1,rainForce:.0095,touchForce:.02};
export const motionRanges={waveSpeed:{min:.15,max:1.5},rippleScale:{min:.4,max:1.6},rainForce:{min:0,max:.019},touchForce:{min:0,max:.04}};
export function validateMotion(input:Record<string,unknown>){
  for(const [key,{min,max}] of Object.entries(motionRanges)){
    const value=input[key];
    if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max))throw new Error(key+' is outside its range.');
  }
}
export function rainImpulse(force:number,scale:number,random=Math.random){
  return {radius:(.016+random()*.012)*scale,strength:(-.006-random()*.007)*(force/motionDefaults.rainForce)};
}
type MotionState=typeof motionDefaults&{dreamy:boolean;subtle:boolean;gentleMotion:boolean;dreamyRainSpeed?:boolean};
export function selectedWaveSpeed(state:MotionState){
  return state.waveSpeed*(state.dreamy?.65:1)*(state.gentleMotion?.75:1);
}
// Slow, continuous breathing rather than a new random speed at each frame.
// Simulation time drives this curve, so pausing freezes both its phase and waves.
export function rainWaveSpeed(seconds:number,multiplier=1){
  return multiplier*(.64+.14*Math.sin(seconds*.23-1.2)+.08*Math.sin(seconds*.11+.7));
}
export function effectiveMotion(state:MotionState){
  const force=(state.subtle?.55:1)*(state.gentleMotion?.4:1);
  return {speed:state.dreamyRainSpeed?1:selectedWaveSpeed(state),scale:state.rippleScale,
    rainForce:state.rainForce*force,touchForce:state.touchForce*force};
}
