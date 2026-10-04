import { waveProfile } from './WaveProfile';

export const WAVE_LIFETIME_STEPS = 720;
export const MAX_WAVE_IMPULSES = 512;
export type WaveStroke = { x: number; z: number; radius: number; opacity: number };
type Impulse = { x: number; z: number; size: number; strength: number; born: number };
type Profile = typeof waveProfile.profiles[number];

function sampleProfile(profile: Profile, step: number) {
  const t = Math.min(step, waveProfile.lastStep) / waveProfile.sampleEvery;
  const a = Math.floor(t), b = Math.min(a + 1, profile.radii.length - 1), f = t - a;
  let radius = profile.radii[a] * (1-f) + profile.radii[b] * f;
  let amplitude = profile.amplitudes[a] * (1-f) + profile.amplitudes[b] * f;
  if (step > waveProfile.lastStep) {
    const end = profile.radii.length - 1, span = 8;
    // Continue the measured outgoing speed after the calibration pulse reaches
    // the boundary. Circular spreading and the source damping set its envelope.
    const speed = (profile.radii[end] - profile.radii[end-span]) / (span * waveProfile.sampleEvery);
    radius += speed * (step - waveProfile.lastStep);
    amplitude *= Math.pow(waveProfile.damping, (step-waveProfile.lastStep)*.5)
      * Math.sqrt(profile.radii[end] / radius);
  }
  return { radius, amplitude };
}

export function sampleWaveStroke(size: number, strength: number, step: number) {
  step = Math.max(0, step);
  const profiles = waveProfile.profiles;
  let b = profiles.findIndex(profile => profile.dropRadius >= size);
  if (b < 0) b = profiles.length - 1;
  const a = Math.max(0, b-1), lower = profiles[a], upper = profiles[b];
  const f = a === b ? 0 : Math.max(0, Math.min(1, (size-lower.dropRadius)/(upper.dropRadius-lower.dropRadius)));
  const p = sampleProfile(lower, step), q = sampleProfile(upper, step);
  const radius = p.radius * (1-f) + q.radius * f;
  const amplitude = p.amplitude * (1-f) + q.amplitude * f;
  const tail = Math.max(0, Math.min(1, (WAVE_LIFETIME_STEPS-step)/180));
  const fade = tail*tail*(3-2*tail);
  // One scalar for the entire curve. Never mask individual angles using local
  // height, velocity, curvature, interference, or a pixel's activity threshold.
  const opacity = Math.min(1, Math.pow(amplitude, .28) * Math.sqrt(Math.abs(strength)/.02)) * fade;
  return { radius, opacity };
}

export class ContinuousWaveModel {
  private impulses: Impulse[] = [];

  addDrop(x: number, z: number, size: number, strength: number, step: number) {
    this.expire(step);
    // More than the maximum simultaneous impulses from sustained dragging plus
    // maximum rainfall over the full six-second fade, without evicting a stroke.
    if (this.impulses.length >= MAX_WAVE_IMPULSES) return;
    this.impulses.push({ x, z, size, strength, born: step });
  }

  clear() { this.impulses.length = 0; }

  private expire(step: number) {
    this.impulses = this.impulses.filter(impulse => step-impulse.born < WAVE_LIFETIME_STEPS);
  }

  strokes(step: number, halfX = 1, halfZ = 1): WaveStroke[] {
    this.expire(step);
    const result: WaveStroke[] = [];
    for (const impulse of this.impulses) {
      const { radius, opacity } = sampleWaveStroke(impulse.size, impulse.strength, step-impulse.born);
      if (opacity <= 0) continue;
      // First wall and corner reflections use mirrored copies, as appropriate
      // for the source's clamped square heightfield. They remain complete curves.
      const xs = [impulse.x, 2-impulse.x, -2-impulse.x];
      const zs = [impulse.z, 2-impulse.z, -2-impulse.z];
      for (const x of xs) for (const z of zs) {
        const nearest = Math.hypot(Math.max(0,Math.abs(x)-halfX),Math.max(0,Math.abs(z)-halfZ));
        const farthest = Math.hypot(Math.abs(x)+halfX,Math.abs(z)+halfZ);
        if (radius < nearest-.02 || radius > farthest+.02) continue;
        result.push({ x, z, radius, opacity });
      }
    }
    return result;
  }
}
