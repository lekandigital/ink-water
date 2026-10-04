import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';
import {shaderSource} from '../shader-loader.mjs';
async function moduleAt(path){
  const {outputFiles}=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
  return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
}

// The floor line patches the real water shader, and only in the drawing modes.
const {patchFloorLine,FloorLinePresentation}=await moduleAt('src/FloorLinePresentation.ts');
const source=await shaderSource('src/shaders/WaterAbove.frag'),patched=patchFloorLine(source);
assert.ok(patched.includes('getInkFloorColor(origin + ray'),'Refracted rays must reach the open floor');
assert.ok(!patched.includes('color = getWallColor(origin + ray * t.y);'),'No pool walls in the drawing modes');
assert.ok(!patched.includes('if (hit.y < 2.0 / 12.0) {'),'No reflected pool rim in the drawing modes');
assert.ok(patched.includes('clamp(point.xz, vec2(-0.99), vec2(0.99))'),'Caustic light must continue past the source floor');
assert.throws(()=>patchFloorLine(source.replace('color = getWallColor(origin + ray * t.y);','')),'A changed shader must fail loudly');
const presentation=new FloorLinePresentation(),material=new THREE.ShaderMaterial({fragmentShader:source});
presentation.apply(material,false);
const off={fragmentShader:source,uniforms:{}};material.onBeforeCompile(off);
assert.equal(off.fragmentShader,source,'Original keeps the source shader verbatim');
const version=material.version;presentation.apply(material,true);presentation.apply(material,true);
assert.equal(material.version,version+1,'Recompile only when the mode changes');
const on={fragmentShader:source,uniforms:{}};material.onBeforeCompile(on);
assert.equal(on.fragmentShader,patched);assert.equal(on.uniforms.inkFloorLine,presentation.line);
const drawingKey=material.customProgramCacheKey();presentation.apply(material,false);
assert.notEqual(material.customProgramCacheKey(),drawingKey,'Each mode compiles its own program');
// Two short lines near the top and bottom, never wider than a third of the screen.
const camera=new THREE.PerspectiveCamera(33,1,0.01,100);
const {fitWaterCamera}=await moduleAt('src/Viewport.ts');
for(const [width,height] of [[1920,1080],[1512,860],[1024,768],[390,844],[2560,1080]]){
  fitWaterCamera(camera,width,height);presentation.fit(camera,width);
  const [halfLength,halfWidth,z]=presentation.line.value.toArray();
  const halfScreen=camera.position.y*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect;
  const floorScale=1+1/(1.333*camera.position.y);
  assert.ok(halfLength/floorScale<halfScreen/3,'Each line must stay under a third of the screen at '+width+'×'+height);
  assert.ok(z>.5&&z<=.98,'Lines sit toward the top and bottom, at most on the former pool edge');
  assert.ok(halfWidth>0&&halfWidth<.01);
}

// Capture mode is opt-in and reproducible.
const {captureOptions,seededRandom}=await moduleAt('src/CaptureMode.ts');
for(const search of ['','?seed=4','?capture=0','?capture=false'])assert.equal(captureOptions(search),null,'Normal startup must not enter capture mode: '+search);
assert.deepEqual(captureOptions('?capture=1'),{seed:1,fps:60});
assert.deepEqual(captureOptions('?capture=1&seed=11&fps=30'),{seed:11,fps:30});
assert.deepEqual(captureOptions('?capture=1&seed=x&fps=-2'),{seed:1,fps:60});
const a=seededRandom(7),b=seededRandom(7),c=seededRandom(8);
const run=r=>Array.from({length:50},()=>r());
const first=run(a);assert.deepEqual(first,run(b),'The same seed must repeat exactly');assert.notDeepEqual(first,run(c));
assert.ok(first.every(v=>v>=0&&v<1));
console.log(JSON.stringify({floorLinePatchesRealShader:true,originalVerbatim:true,recompileOnModeChangeOnly:true,linesUnderAThird:5,captureOptIn:true,seededRandom:true}));
