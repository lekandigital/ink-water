import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import * as THREE from 'three';
import { shaderSource } from '../shader-loader.mjs';

async function moduleAt(path) {
  const { outputFiles } = await build({
    entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'water-shaders', setup(b) {
      b.onLoad({ filter: /\.(vert|frag|glsl)$/ }, async args => ({ contents: await shaderSource(args.path), loader: 'text' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
}
const { ContinuousWaveModel, sampleWaveStroke, WAVE_LIFETIME_STEPS, MAX_WAVE_IMPULSES, RINGS_PER_IMPACT } = await moduleAt('src/ContinuousWaveModel.ts');
const { ContinuousWaveLines } = await moduleAt('src/ContinuousWaveLines.ts');
const { OpenWaterBoundary } = await moduleAt('src/OpenWaterBoundary.ts');
const { waveProfile } = await moduleAt('src/WaveProfile.ts');
const { fitWaterCamera } = await moduleAt('src/Viewport.ts');
for (const [name, hash] of Object.entries(waveProfile.shaderHashes)) {
  const actual = await readFile('src/shaders/' + name + '.frag');
  assert.equal(createHash('sha256').update(actual).digest('hex'), hash,
    'Stroke calibration must match the actual upstream shader');
}

let lifetimeChecks = 0;
for (const size of [.012,.019,.025,.038,.051,.065]) {
  for (const strength of [-.006,-.02,.012]) {
    let previousRadius = 0, previousOpacity = 1;
    for (let step = 0; step <= WAVE_LIFETIME_STEPS; step += 2) {
      const wave = sampleWaveStroke(size,strength,step);
      assert.ok(Number.isFinite(wave.radius) && Number.isFinite(wave.opacity));
      assert.ok(wave.radius >= previousRadius, 'A fading wave must never shrink into a droplet');
      assert.ok(wave.opacity <= previousOpacity + 1e-12, 'A whole wave must fade consistently');
      assert.ok(wave.opacity >= 0 && wave.opacity <= 1);
      previousRadius = wave.radius; previousOpacity = wave.opacity;
      lifetimeChecks++;
    }
    assert.equal(previousOpacity,0,'A wave must reach zero opacity before retirement');
  }
}
const synchronized = new ContinuousWaveModel();
synchronized.addDrop(.1,-.2,.038,-.02,10);
const paused = synchronized.strokes(40);
assert.deepEqual(synchronized.strokes(40),paused,'Pause and style changes must preserve stroke positions');
const advanced = synchronized.strokes(42);
assert.ok(advanced[0].radius > paused[0].radius,'Strokes must follow the source simulation-step clock');
assert.equal(advanced[0].x,.1); assert.equal(advanced[0].z,-.2);
synchronized.clear();assert.equal(synchronized.strokes(42).length,0,'Clear must remove the drawing as well as the heightfield');
const train = new ContinuousWaveModel();
train.addDrop(.1,-.2,.038,-.02,0);
const firstTrain = train.strokes(140,10,10), laterTrain = train.strokes(280,10,10);
assert.equal(firstTrain.length,RINGS_PER_IMPACT,'Each impact must create a concentric wave train');
assert.equal(laterTrain.length,RINGS_PER_IMPACT);
for(let i=0;i<RINGS_PER_IMPACT;i++){
  assert.equal(firstTrain[i].x,.1);assert.equal(firstTrain[i].z,-.2,'No reflected or mirrored centers');
  if(i>0)assert.ok(firstTrain[i-1].radius>firstTrain[i].radius,'The circles must be nested');
  assert.ok(laterTrain[i].radius>firstTrain[i].radius,'Every ring moves outward');
  assert.ok(laterTrain[i].opacity<firstTrain[i].opacity,'Every complete ring fades');
}
assert.equal(train.strokes(720,10,10).length,0,'An expired train must never return');

const busy = new ContinuousWaveModel();
let count = 0;
for(let step=0;step<720;step+=4){
  busy.addDrop(0,0,.038,-.02,step);count++;
  if(step%12===0){busy.addDrop(0,0,.025,-.01,step);count++;}
}
assert.ok(count < MAX_WAVE_IMPULSES);
const crowded=busy.strokes(719,10,10);
assert.ok(crowded.length>count*3,'Sustained dragging plus heavy rain must retain live trains');
assert.ok(crowded.every(w=>w.x===0&&w.z===0),'No boundary may create new disturbance centers');
assert.equal(crowded[0].radius,sampleWaveStroke(.038,-.02,719).radius,'Old waves must fade instead of being evicted');

const hostWater={textureA:new THREE.WebGLRenderTarget(256,256,{type:THREE.FloatType}),textureB:new THREE.WebGLRenderTarget(256,256,{type:THREE.FloatType})};
const boundary=new OpenWaterBoundary(hostWater);
let renderTarget=null,boundaryPasses=0;
const host={getRenderTarget:()=>renderTarget,setRenderTarget:target=>{renderTarget=target;},render(scene){
  const u=scene.children[0].material.uniforms;
  assert.equal(u.currentWater.value,hostWater.textureA.texture);
  assert.equal(u.previousWater.value,hostWater.textureB.texture);
  assert.notEqual(renderTarget.texture,u.currentWater.value,'Boundary must not read its output texture');
  assert.notEqual(renderTarget.texture,u.previousWater.value,'Boundary needs an independent third target');
  boundaryPasses++;
}};
for(let i=0;i<12;i++){
  [hostWater.textureA,hostWater.textureB]=[hostWater.textureB,hostWater.textureA];
  boundary.apply(host,hostWater);
  assert.equal(renderTarget,null,'The boundary pass must restore the renderer target');
  assert.notEqual(hostWater.textureA,hostWater.textureB);
}

const lines = new ContinuousWaveLines();
const positions = lines.geometry.attributes.position.array;
assert.equal(positions[0],positions[positions.length-6]);
assert.equal(positions[1],positions[positions.length-5],'The annulus mesh must close exactly at its seam');
assert.equal(lines.material.blendEquation,THREE.MaxEquation,'Crossing waves must retain their individual strokes');
const camera = new THREE.PerspectiveCamera(33,844/640,.01,100);
fitWaterCamera(camera,844,640);
const renderer = {
  getDrawingBufferSize: v => v.set(844,640), getPixelRatio: () => 1,
  setRenderTarget() {}, setClearColor() {}, clear() {}, render() {},
};
function snapshot(model,step) {
  lines.model.clear();
  for (const drop of model) lines.model.addDrop(drop.x,drop.z,drop.size,drop.strength,drop.born);
  lines.render(renderer,camera,step,.68);
  const count = lines.geometry.instanceCount;
  return { step, count, strokes: Array.from(lines.strokes.array.slice(0,count*4)) };
}
const single = [{x:.12,z:-.1,size:.038,strength:-.02,born:0}];
const drag = Array.from({length:10},(_,i)=>({x:-.5+i*.09,z:.12*Math.sin(i*.4),size:.038,strength:-.02,born:i*6}));
const rain = [[-.44,-.27,1],[.34,.25,40],[-.02,-.38,82],[.6,-.15,132]]
  .map(([x,z,born])=>({x,z,born,size:.025,strength:-.01}));
const scenarios = {
  single: snapshot(single,100), drag: snapshot(drag,96), rain: snapshot(rain,200),
  faded: snapshot(single,660), retired: snapshot(single,720),
};
assert.equal(scenarios.retired.count,0);
if(process.argv[2]==='--export') {
  const lifetime = [0,8,44,140,280,480,600,660,700,718].map(step=>{
    const wave = sampleWaveStroke(.038,-.02,step);
    const camera = new THREE.PerspectiveCamera(33,1,.01,100);
    camera.position.set(0,wave.radius*1.35/Math.tan(THREE.MathUtils.degToRad(16.5)),0);
    camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    return {step,...wave,projection:camera.projectionMatrix.toArray(),view:camera.matrixWorldInverse.toArray(),worldPixel:wave.radius*2.7/512};
  });
  await writeFile(process.argv[3],JSON.stringify({
    position:Array.from(lines.geometry.attributes.position.array),
    uv:Array.from(lines.geometry.attributes.uv.array),index:Array.from(lines.geometry.index.array),
    vertex:lines.material.vertexShader,fragment:lines.material.fragmentShader,
    uniforms:Object.fromEntries(Object.entries(lines.material.uniforms).map(([k,u])=>[k,u.value])),
    camera:{position:camera.position.toArray(),projection:camera.projectionMatrix.toArray(),view:camera.matrixWorldInverse.toArray()},
    scenarios,lifetime,profile:waveProfile,boundary:{vertex:boundary.material.vertexShader,fragment:boundary.material.fragmentShader},
  }));
}
lines.geometry.dispose();lines.material.dispose();lines.target.dispose();
console.log(JSON.stringify({continuousWaveLifetimeChecks:lifetimeChecks,sourceShaderCalibration:true,
  uniformWholeWaveFade:true,noShrinking:true,pauseAndClear:true,sustainedDragAndRain:true,closedMeshSeam:true,
  concentricRings:RINGS_PER_IMPACT,noMirroredDisturbances:true,boundaryBufferRotationChecks:boundaryPasses}));
