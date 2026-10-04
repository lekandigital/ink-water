import type {Tone} from './DrawingPalette';
import {experimentDefaults} from './AppearanceExperiments';
import {motionDefaults} from './WaterMotion';
export type Mode='ink-wash'|'etching'|'graphite'|'original';
// This is the user's startup configuration, independent of the restored engine.
// Source physics defaults live in WaterMotion; source lighting in AppearanceExperiments.
export function startupSettings(){return {
  ...experimentDefaults,...motionDefaults,
  mode:'etching' as Mode,tone:'night' as Tone,lineWeight:.68,
  bitmapTones:true,hideSunDisc:true,
  hairlineRipples:false,caustics:true,sourceGeometry:true,
  lightAzimuth:170,lightElevation:90,causticsStrength:2,
  rain:false,rainRate:.2,dropSize:.038,paused:false,
};}
export type WaterSettings=ReturnType<typeof startupSettings>;
