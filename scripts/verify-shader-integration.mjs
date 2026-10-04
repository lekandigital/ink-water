import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {ShaderChunk,ColorManagement,Vector3} from 'three';

// Use the helper source from the installed Three.js release, including its
// injected luminance function. Standalone GLSL tests can miss these collisions.
const program=await readFile(new URL('../node_modules/three/src/renderers/webgl/WebGLProgram.js',import.meta.url),'utf8');
const helper=program.slice(program.indexOf('function getLuminanceFunction()'),program.indexOf('function generateVertexExtensions'));
const luminance=new Function('ColorManagement','_v0',helper+';return getLuminanceFunction();')(ColorManagement,new Vector3());
export const fragmentHelpers=ShaderChunk.colorspace_pars_fragment+'\n'+luminance+'\nvec4 linearToOutputTexel(vec4 value){return sRGBTransferOETF(value);}\n';
function verify(source){
  const names=[...source.matchAll(/\b(?:float|vec[234]|mat[234]|void|bool|int)\s+(\w+)\s*\([^;{}]*\)\s*\{/g)].map(x=>x[1]);
  assert.equal(new Set(names).size,names.length,'Shader function conflicts with Three.js injected helpers');
}
assert.throws(()=>verify(fragmentHelpers+'float luminance(vec3 c){return c.x;}'));
for(const name of ['Drawing.frag','DrawingExperiments.frag','ContinuousWave.frag','OpenWaterBoundary.frag','CausticPresentation.frag'])verify(fragmentHelpers+await readFile(new URL('../src/shaders/'+name,import.meta.url),'utf8'));
if(process.argv[2]==='--export')await writeFile(process.argv[3],fragmentHelpers);
console.log(JSON.stringify({threeInjectedHelpersVerified:true,luminanceConflictRegression:true}));
