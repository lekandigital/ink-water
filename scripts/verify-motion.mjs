import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/WaterMotion.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {motionDefaults,effectiveMotion,rainImpulse}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const neutral={...motionDefaults,dreamy:false,subtle:false,gentleMotion:false};
assert.deepEqual(effectiveMotion(neutral),{speed:1,scale:1,rainForce:.0095,touchForce:.02});
for(const r of [0,.1,.5,.999]){let calls=0;const drop=rainImpulse(.0095,1,()=>{calls++;return r;});assert.equal(calls,2);assert.equal(drop.radius,.016+r*.012);assert.equal(drop.strength,-.006-r*.007);}
assert.equal(effectiveMotion({...neutral,dreamy:true}).speed,.65);
assert.equal(effectiveMotion({...neutral,subtle:true}).speed,1);
assert.equal(effectiveMotion({...neutral,dreamy:true,subtle:true}).touchForce,.02*.55);
console.log(JSON.stringify({neutralSourcePhysics:true,exactOriginalRainDistribution:true,independentDreamySubtle:true}));
