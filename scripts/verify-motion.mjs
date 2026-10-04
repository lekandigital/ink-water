import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/WaterMotion.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {motionDefaults,effectiveMotion,rainImpulse,rainWaveSpeed,selectedWaveSpeed}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const neutral={...motionDefaults,dreamy:false,subtle:false,gentleMotion:false};
assert.deepEqual(effectiveMotion(neutral),{speed:1,scale:1,rainForce:.0095,touchForce:.02});
for(const r of [0,.1,.5,.999]){let calls=0;const drop=rainImpulse(.0095,1,()=>{calls++;return r;});assert.equal(calls,2);assert.equal(drop.radius,.016+r*.012);assert.equal(drop.strength,-.006-r*.007);}
assert.equal(effectiveMotion({...neutral,dreamy:true}).speed,.65);
assert.equal(effectiveMotion({...neutral,subtle:true}).speed,1);
assert.equal(effectiveMotion({...neutral,dreamy:true,subtle:true}).touchForce,.02*.55);
const rainMode={...neutral,dreamyRainSpeed:true,waveSpeed:.45,dreamy:true,subtle:true,gentleMotion:true};
assert.equal(effectiveMotion(rainMode).speed,1,'Rain variation must not slow clicks or gestures, even with other slow controls');
assert.equal(effectiveMotion(rainMode).touchForce,effectiveMotion({...rainMode,dreamyRainSpeed:false}).touchForce,'Speed variation must not change force');
assert.equal(selectedWaveSpeed(rainMode),.45*.65*.75,'Existing speed controls still set the rain pace');
let previous=rainWaveSpeed(0),min=Infinity,max=-Infinity;
for(let seconds=0;seconds<=120;seconds+=.01){
 const speed=rainWaveSpeed(seconds);assert.ok(speed>=.42&&speed<=.86);assert.ok(Math.abs(speed-previous)<.00042,'No abrupt speed changes');
 assert.equal(rainWaveSpeed(seconds),speed,'Speed variation is deterministic');previous=speed;min=Math.min(min,speed);max=Math.max(max,speed);
}
assert.ok(max-min>.3,'The rain pace must visibly vary');
assert.equal(rainWaveSpeed(19,.5),rainWaveSpeed(19)*.5);
console.log(JSON.stringify({neutralSourcePhysics:true,exactOriginalRainDistribution:true,independentDreamySubtle:true,dreamyRainAlwaysFullSpeedTouch:true,smoothRainSpeed:true,rainSpeedRange:[min,max]}));
