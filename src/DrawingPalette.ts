import { Color, LinearSRGBColorSpace } from 'three';

export const tones = {
  paper: { paper: 0xf5f5f5, ink: 0x232323 },
  silver: { paper: 0xdfdfdf, ink: 0x292929 },
  night: { paper: 0x161616, ink: 0xdddddd },
};
export type Tone = keyof typeof tones;

export function applyDrawingTone(paper: Color, ink: Color, tone: Tone): void {
  // The custom shader writes these grayscale values directly to the screen.
  // setHex accepts a color space; Color.set's extra arguments are RGB channels.
  paper.setHex(tones[tone].paper, LinearSRGBColorSpace);
  ink.setHex(tones[tone].ink, LinearSRGBColorSpace);
}
