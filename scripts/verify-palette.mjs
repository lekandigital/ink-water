import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
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
function contrast(a,b){
  const luminance=color=>color.toArray().map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const [dark,light]=[luminance(a),luminance(b)].sort((x,y)=>x-y);
  return (light+.05)/(dark+.05);
}
const legacy={paper:{paper:0xf5f5f5,ink:0x232323},silver:{paper:0xdfdfdf,ink:0x292929},night:{paper:0x161616,ink:0xdddddd}};
for(const [tone,palette] of Object.entries(legacy))assert.deepEqual(tones[tone],palette,'Existing palettes must remain exact');
// Reproduce the old call: the color-space string becomes the green channel.
assert.throws(() => verifyGray(new Color().set(tones.paper.paper, LinearSRGBColorSpace)));

const paper = new Color(), ink = new Color();
const material = new ShaderMaterial({ uniforms: { paper: { value: paper }, ink: { value: ink } } });
const palettes = {};
for (const tone of [...Object.keys(tones), 'paper']) {
  applyDrawingTone(material.uniforms.paper.value, material.uniforms.ink.value, tone);
  for (const name of ['paper', 'ink']) {
    const color = material.uniforms[name].value;
    assert.ok(color.toArray().every(v=>Number.isFinite(v)&&v>=0&&v<=1),'Every tone must upload finite RGB values');
    if(Object.hasOwn(legacy,tone))verifyGray(color);
    else assert.ok(color.g>color.r&&color.g>color.b,'The added tones must preserve their green print identity');
    assert.equal(color.getHex(LinearSRGBColorSpace), tones[tone][name]);
  }
  assert.ok(contrast(paper,ink)>=4.5,'Paper and ink must retain readable contrast');
  assert.equal(paper.r > ink.r, !['night','green-dark'].includes(tone), 'Dark paper needs light ripples');
  assert.equal(material.uniforms.paper.value, paper, 'Tone changes must retain uniform objects');
  assert.equal(material.uniforms.ink.value, ink);
  palettes[tone] = { paper: paper.toArray(), ink: ink.toArray() };
}
// Catch a canvas-only or HTML-only recolor and preserve readable green controls.
const css=await readFile('style.css','utf8');
for(const tone of ['green-light','green-dark']){
  const rule=css.match(new RegExp('body\\[data-tone="'+tone+'"\\]\\{([^}]+)\\}'))?.[1];
  assert.ok(rule,'Both green themes need complete UI tokens');
  const tokens=Object.fromEntries([...rule.matchAll(/--([\w-]+):#([0-9a-f]{6})/g)].map(m=>[m[1],parseInt(m[2],16)]));
  assert.equal(tokens.paper,tones[tone].paper,'UI and renderer paper must match');
  assert.equal(tokens.text,tones[tone].ink,'UI and renderer ink must match');
  const color=hex=>new Color().setHex(hex,LinearSRGBColorSpace);
  for(const foreground of ['text','muted'])assert.ok(contrast(color(tokens[foreground]),color(tokens.paper))>=4.5,'Green text must retain contrast');
  assert.ok(contrast(color(tokens.line),color(tokens.paper))>=3,'Green control tracks and borders must remain visible');
  assert.ok(contrast(color(tokens.selected),color(tokens['on-selected']))>=4.5,'Selected controls need readable inversion');
}
if (process.argv[2] === '--export') await writeFile(process.argv[3], JSON.stringify(palettes));
material.dispose();
console.log(JSON.stringify({drawingPalettesVerified: Object.keys(palettes).length, redScreenRegression: true,legacyPalettesExact:true,greenUiMatchesDrawing:true,greenTextContrast:true}));
