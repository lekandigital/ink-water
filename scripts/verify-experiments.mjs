import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';
import {shaderSource} from '../shader-loader.mjs';
async function moduleAt(path){
  const {outputFiles}=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
  return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
}
const {experimentDefaults:defaults,experimentSwitches:switches,experimentRanges:ranges,controlId,lightDirection,validateExperimentSettings}=await moduleAt('src/AppearanceExperiments.ts');
assert.ok(switches.every(key=>defaults[key]===false),'Every experiment must start off');
assert.deepEqual(lightDirection(defaults).toArray(),new THREE.Vector3(2,2,-1).normalize().toArray(),'Default light must remain exactly unchanged');
let lightCases=0;
for(const azimuth of [-180,-90,0,90,180])for(const elevation of [15,42,90]){
  const direction=lightDirection({...defaults,lightAzimuth:azimuth,lightElevation:elevation});
  assert.ok(direction.toArray().every(Number.isFinite));
  assert.ok(direction.y>0&&direction.x!==0&&direction.z!==0,'Original slab projection must not divide by zero');
  assert.ok(Math.abs(direction.length()-1)<1e-12);lightCases++;
}
assert.ok(lightDirection({...defaults,overheadLight:true}).y>.999999999);
for(const key of switches){validateExperimentSettings({[key]:true});assert.throws(()=>validateExperimentSettings({[key]:'true'}));}
for(const [key,{min,max}] of Object.entries(ranges)){
  validateExperimentSettings({[key]:min});validateExperimentSettings({[key]:max});
  for(const value of [NaN,Infinity,min-1,max+1,'0'])assert.throws(()=>validateExperimentSettings({[key]:value}));
}
for(const value of [-1,3,1.5,'0'])assert.throws(()=>validateExperimentSettings({bitmapPattern:value}));
for(const value of [0,1,2])validateExperimentSettings({bitmapPattern:value});
const html=await readFile('index.html','utf8');
for(const key of [...switches,...Object.keys(ranges)])assert.ok(html.includes('id="'+controlId(key)+'"'),'Missing visible control for '+key);
const {CausticPresentation}=await moduleAt('src/CausticPresentation.ts');
const pass=new CausticPresentation(),source=new THREE.Texture();let target=null,renders=0;
const renderer={getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render:()=>{assert.notEqual(target.texture,pass.material.uniforms.causticMap.value);renders++;}};
assert.equal(pass.texture(renderer,source,1),source);assert.equal(renders,0,'Default caustics must bypass the presentation pass');
for(const strength of [0,.4,2]){assert.equal(pass.texture(renderer,source,strength),pass.target.texture);assert.equal(target,null);assert.equal(pass.material.uniforms.strength.value,strength);}
if(process.argv[2]==='--export')await writeFile(process.argv[3],JSON.stringify({defaults,drawing:await shaderSource('src/shaders/Drawing.frag'),printDrawing:await shaderSource('src/shaders/DrawingExperiments.frag'),bitmapDrawing:await shaderSource('src/shaders/BitmapWater.frag'),presentationDrawing:await shaderSource('src/shaders/WaterPresentation.frag'),causticVertex:pass.material.vertexShader,causticFragment:pass.material.fragmentShader}));
console.log(JSON.stringify({optionalExperimentsStartOff:true,defaultLightPreserved:true,lightCases,allVisibleControls:true,finiteSettings:true,causticIntensityPasses:renders,defaultCausticsBypass:true}));
