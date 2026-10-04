import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Color, LinearSRGBColorSpace, ShaderMaterial } from 'three';

// Exercise the same typed palette function used by the app, with actual
// Three.js uniform objects. Shader-only tests bypass this color upload path.
const { outputFiles } = await build({
  entryPoints: ['src/DrawingPalette.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false,
});
const { applyDrawingTone, tones } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
function verifyGray(color) {
  const rgb = color.toArray();
  assert.ok(rgb.every(v => Number.isFinite(v) && v >= 0 && v <= 1),
    'Drawing colors must have finite RGB channels between zero and one');
  assert.equal(rgb[0], rgb[1], 'Drawing colors must be grayscale');
  assert.equal(rgb[1], rgb[2], 'Drawing colors must be grayscale');
}
// Reproduce the old call: the color-space string becomes the green channel.
assert.throws(() => verifyGray(new Color().set(tones.paper.paper, LinearSRGBColorSpace)));

const paper = new Color(), ink = new Color();
const material = new ShaderMaterial({ uniforms: { paper: { value: paper }, ink: { value: ink } } });
const palettes = {};
for (const tone of [...Object.keys(tones), 'paper']) {
  applyDrawingTone(material.uniforms.paper.value, material.uniforms.ink.value, tone);
  for (const name of ['paper', 'ink']) {
    const color = material.uniforms[name].value;
    verifyGray(color);
    assert.equal(color.getHex(LinearSRGBColorSpace), tones[tone][name]);
  }
  assert.ok(Math.abs(paper.r - ink.r) > .5, 'Ripples must contrast with the background');
  assert.equal(paper.r > ink.r, tone !== 'night', 'Dark paper needs light ripples');
  assert.equal(material.uniforms.paper.value, paper, 'Tone changes must retain uniform objects');
  assert.equal(material.uniforms.ink.value, ink);
  palettes[tone] = { paper: paper.toArray(), ink: ink.toArray() };
}
if (process.argv[2] === '--export') await writeFile(process.argv[3], JSON.stringify(palettes));
material.dispose();
console.log(JSON.stringify({drawingPalettesVerified: Object.keys(palettes).length, redScreenRegression: true}));
