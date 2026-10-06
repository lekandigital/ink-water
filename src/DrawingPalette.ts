import { Color, LinearSRGBColorSpace } from 'three';

export const tones = {
  paper: { paper: 0xf5f5f5, ink: 0x232323 },
  silver: { paper: 0xdfdfdf, ink: 0x292929 },
  night: { paper: 0x161616, ink: 0xdddddd },
  // The Solid Doctor label: lighter unprinted paper and median green ink.
  'green-light': { paper: 0xaacdb2, ink: 0x144a32 },
  'green-dark': { paper: 0x144a32, ink: 0xaacdb2 },
};
export type Tone = keyof typeof tones;

export function applyDrawingTone(paper: Color, ink: Color, tone: Tone): void {
  // The custom drawing shader writes these display RGB values directly.
  // setHex accepts a color space; Color.set's extra arguments are RGB channels.
  paper.setHex(tones[tone].paper, LinearSRGBColorSpace);
  ink.setHex(tones[tone].ink, LinearSRGBColorSpace);
}
