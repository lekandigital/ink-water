import {Color,LinearSRGBColorSpace} from 'three';
import type {Tone} from './DrawingPalette';

// Green paper and text retain their supplied colors. Caustics have a separate
// endpoint so the narrower green luminance range cannot mute focused light.
const colors={
  'green-light':{color:0x0b3825,contrast:3},
  'green-dark':{color:0xe0f4dd,contrast:2.55},
};

export function applyCausticTone(color:Color,tone:Tone):number{
  const palette=colors[tone as keyof typeof colors];
  color.setHex(palette?.color??0xffffff,LinearSRGBColorSpace);
  return palette?.contrast??0;
}
