import { Color, LinearSRGBColorSpace } from 'three';

// Palette sampled from the "THE SOLID DOCTOR" label reference.
// The existing tone keys stay intact so this remains a presentation-only prototype:
// paper = reference light, silver = sage midpoint, night = inverted dark.
export const tones = {
  paper: { paper: 0xaacdb3, ink: 0x12472f },
  silver: { paper: 0x9ec2a4, ink: 0x12472f },
  night: { paper: 0x12472f, ink: 0xaacdb3 },
};
export type Tone = keyof typeof tones;

export function applyDrawingTone(paper: Color, ink: Color, tone: Tone): void {
  // The custom shader writes these palette values directly to the screen.
  // setHex accepts a color space; Color.set's extra arguments are RGB channels.
  paper.setHex(tones[tone].paper, LinearSRGBColorSpace);
  ink.setHex(tones[tone].ink, LinearSRGBColorSpace);
}
