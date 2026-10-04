import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';
import {shaderSource} from '../shader-loader.mjs';
async function moduleAt(path){
  const {outputFiles}=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
  return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
}
const {motionDefaults:defaults,motionRanges:ranges,rainImpulse,validateMotion}=await moduleAt('src/WaterMotion.ts');
assert.equal(defaults.waveSpeed,1,'Default motion must use the original simulation speed');
assert.ok(defaults.rippleScale>.65&&defaults.rippleScale<1,'Default size should be larger than the undersized version, while keeping room to adjust');
assert.ok(defaults.rainForce*1.2<.006,'Even the strongest new rain is weaker than the old lightest rain');
assert.ok(defaults.touchForce<.0095&&defaults.touchForce>defaults.rainForce,'Touch is slightly weaker than the previous average rain');
for(const random of [0,.5,1]){
  const drop=rainImpulse(defaults.rainForce,defaults.rippleScale,()=>random);
  assert.ok(drop.strength<0&&Math.abs(drop.strength)<.006&&drop.radius<.028);
}
for(const [key,{min,max}] of Object.entries(ranges)){
  validateMotion({[key]:min});validateMotion({[key]:max});
  for(const value of [NaN,Infinity,min-.01,max+.01,'0'])assert.throws(()=>validateMotion({[key]:value}));
}
const {WaterPresentation}=await moduleAt('src/WaterPresentation.ts');
const water={textureA:new THREE.WebGLRenderTarget(256,256,{type:THREE.FloatType}),textureB:new THREE.WebGLRenderTarget(256,256,{type:THREE.FloatType})};
const originalA=water.textureA,originalB=water.textureB,presentation=new WaterPresentation(water);
let target=null,presentationPasses=0;
const renderer={getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render:scene=>{
  const u=scene.children[0].material.uniforms;
  for(const sampler of ['previousWater','currentWater'])assert.notEqual(target.texture,u[sampler].value,'Interpolation must never read its output');
  assert.notEqual(target,water.textureA);assert.notEqual(target,water.textureB);presentationPasses++;
}};
presentation.capture(renderer,water);
for(const blend of [-1,0,.25,.5,1,2]){
  assert.equal(presentation.present(renderer,water,blend),presentation.target);
  assert.equal(presentation.material.uniforms.blend.value,Math.max(0,Math.min(1,blend)));assert.equal(target,null);
}
assert.equal(water.textureA,originalA);assert.equal(water.textureB,originalB,'Presentation cannot replace either solver buffer');
const {OpenWaterBoundary}=await moduleAt('src/OpenWaterBoundary.ts');
const boundary=new OpenWaterBoundary(water);let boundaryPasses=0;
const boundaryRenderer={getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render:scene=>{
  const u=scene.children[0].material.uniforms;
  assert.equal(u.currentWater.value,water.textureA.texture);assert.equal(u.previousWater.value,water.textureB.texture);
  assert.notEqual(target.texture,u.currentWater.value);assert.notEqual(target.texture,u.previousWater.value);boundaryPasses++;
}};
for(let i=0;i<12;i++){[water.textureA,water.textureB]=[water.textureB,water.textureA];boundary.apply(boundaryRenderer,water);assert.equal(target,null);assert.notEqual(water.textureA,water.textureB);}
const {gestureKeys,gesturePattern}=await moduleAt('src/GesturePatterns.ts');
for(const key of gestureKeys){
  const path=gesturePattern(key);assert.deepEqual(path,gesturePattern(key));assert.ok(path.length>=23);
  assert.ok(path.every((point,i)=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&Math.abs(point.x)<=.34&&Math.abs(point.y)<=.34&&(i===0||point.at>path[i-1].at)));
}
const xPath=gesturePattern('x');assert.ok(xPath[23].at-xPath[22].at>=150,'X must lift between strokes');
const {removeSunDisc}=await moduleAt('src/OpticsPresentation.ts');
const above=await shaderSource('src/shaders/WaterAbove.frag'),material=new THREE.ShaderMaterial({fragmentShader:above});
assert.ok(above.includes('5000.0'));removeSunDisc(material);assert.ok(!material.fragmentShader.includes('5000.0'));assert.equal(await shaderSource('src/shaders/WaterAbove.frag'),above,'Remove the sun disc at presentation time only');
const html=await readFile('index.html','utf8');assert.ok(!html.includes('hairline-ripples'));
console.log(JSON.stringify({gentleRain:true,touchBelowPreviousRain:true,smallerImpacts:true,presentationPasses,solverBuffersUntouched:true,boundaryPasses,repeatableGestures:3,sunDiscRemoved:true}));
