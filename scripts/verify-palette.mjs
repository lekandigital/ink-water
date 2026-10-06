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

const expected = {
  paper: { paper: 0xaacdb3, ink: 0x12472f },
  silver: { paper: 0x9ec2a4, ink: 0x12472f },
  night: { paper: 0x12472f, ink: 0xaacdb3 },
};
assert.deepEqual(tones, expected, 'The Solid Doctor prototype palette must stay exact');

function verifyColor(color) {
  const rgb = color.toArray();
  assert.ok(rgb.every(v => Number.isFinite(v) && v >= 0 && v <= 1),
    'Drawing colors must have finite RGB channels between zero and one');
}
function luma(color) {
  return color.r * .2126 + color.g * .7152 + color.b * .0722;
}

const paper = new Color(), ink = new Color();
const material = new ShaderMaterial({ uniforms: { paper: { value: paper }, ink: { value: ink } } });
const palettes = {};
for (const tone of Object.keys(tones)) {
  applyDrawingTone(material.uniforms.paper.value, material.uniforms.ink.value, tone);
  for (const name of ['paper', 'ink']) {
    const color = material.uniforms[name].value;
    verifyColor(color);
    assert.equal(color.getHex(LinearSRGBColorSpace), tones[tone][name]);
  }
  assert.ok(Math.abs(luma(paper) - luma(ink)) > .3, 'Ripples must contrast with the background');
  assert.equal(luma(paper) > luma(ink), tone !== 'night', 'Dark mode needs light ripples');
  assert.equal(material.uniforms.paper.value, paper, 'Tone changes must retain uniform objects');
  assert.equal(material.uniforms.ink.value, ink);
  palettes[tone] = { paper: paper.toArray(), ink: ink.toArray() };
}
if (process.argv[2] === '--export') await writeFile(process.argv[3], JSON.stringify(palettes));
material.dispose();
console.log(JSON.stringify({drawingPalettesVerified: Object.keys(palettes).length, solidDoctorPalette: true}));
