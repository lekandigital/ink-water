import * as THREE from 'three';

export const printSwitches = ['bitmapRipples','textureReveal','printedPaper','textureRefraction'] as const;
export const lightSwitches = ['overheadLight','alignedCaustics'] as const;
export const waterBitmapSwitches = ['bitmapTones','causticReveal','driftingGrain','softDiffusion'] as const;
export const experimentSwitches = [...printSwitches,...lightSwitches,...waterBitmapSwitches,'causticRipples','dreamy','subtle','gentleMotion','dreamyRainSpeed','hideSunDisc'] as const;
export const printPatterns = ['Comic dots','Stipple','Pixel dither'];
export const experimentRanges = {
  bitmapScale: {min:2,max:10}, bitmapStrength: {min:0,max:1},
  textureFaint: {min:0,max:.2}, revealWidth: {min:2,max:24},
  refractionStrength: {min:0,max:1}, causticsStrength: {min:0,max:2},
  lightAzimuth: {min:-180,max:180}, lightElevation: {min:15,max:90},
  waterBitmapScale:{min:1,max:8},waterBitmapLevels:{min:2,max:10},waterBitmapContrast:{min:0,max:1},
  causticInk:{min:.5,max:4},dreamSoftness:{min:1,max:10},
};
export const experimentDefaults = {
  bitmapRipples:false, textureReveal:false, printedPaper:false, textureRefraction:false,
  bitmapPattern:0, bitmapScale:3.5, bitmapStrength:.7, textureFaint:.045, revealWidth:8, refractionStrength:.45,
  overheadLight:false, alignedCaustics:false, causticsStrength:1,
  bitmapTones:false,causticReveal:false,driftingGrain:false,softDiffusion:false,
  causticRipples:false,dreamy:false,subtle:false,gentleMotion:false,dreamyRainSpeed:false,hideSunDisc:false,
  waterBitmapScale:2,waterBitmapLevels:5,waterBitmapContrast:.55,causticInk:1.5,dreamSoftness:3,
  lightAzimuth:THREE.MathUtils.radToDeg(Math.atan2(-1,2)),
  lightElevation:THREE.MathUtils.radToDeg(Math.atan2(2,Math.sqrt(5))),
};
export type ExperimentState = typeof experimentDefaults;
export const controlId = (key:string)=>key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());

export function lightDirection(state:Pick<ExperimentState,'overheadLight'|'lightAzimuth'|'lightElevation'>){
  if(!state.overheadLight&&state.lightAzimuth===experimentDefaults.lightAzimuth&&state.lightElevation===experimentDefaults.lightElevation){
    return new THREE.Vector3(2,2,-1).normalize();
  }
  const elevation=THREE.MathUtils.degToRad(state.overheadLight?90:state.lightElevation);
  const azimuth=THREE.MathUtils.degToRad(state.lightAzimuth);
  // A negligible horizontal component avoids division by zero in the original
  // slab-intersection shaders at an exactly vertical or axis-aligned light.
  const safe=(value:number)=>Math.abs(value)<1e-6?(value<0?-1:1)*1e-6:value;
  return new THREE.Vector3(safe(Math.cos(elevation)*Math.cos(azimuth)),Math.sin(elevation),safe(Math.cos(elevation)*Math.sin(azimuth))).normalize();
}

export function validateExperimentSettings(input:Record<string,unknown>){
  for(const key of experimentSwitches)if(input[key]!==undefined&&typeof input[key]!=='boolean')throw new Error(key+' must be boolean.');
  for(const [key,{min,max}] of Object.entries(experimentRanges)){
    const value=input[key];
    if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max))throw new Error(key+' is outside its range.');
  }
  if(input.bitmapPattern!==undefined&&(!Number.isInteger(input.bitmapPattern)||Number(input.bitmapPattern)<0||Number(input.bitmapPattern)>=printPatterns.length))throw new Error('Unknown print pattern.');
}
