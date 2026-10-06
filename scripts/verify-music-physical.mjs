import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {shaderSource} from '../shader-loader.mjs';
process.on('uncaughtException',error=>{console.error(error.name+': '+error.message+'\n'+error.stack.split('\n').filter(line=>!line.includes('data:text')).slice(1,5).join('\n'));process.exitCode=1;});
const {window,document}=parseHTML(await readFile('index.html','utf8'));
Object.assign(globalThis,{window,document,requestAnimationFrame:()=>0,__qaSkip:true});
document.getElementById('stage').getBoundingClientRect=()=>({width:960,height:960});
const source=(await readFile('src/main.ts','utf8')).replace('void start();','export {Puddle,WaterControls};export {MusicRainEngine} from "./music/MusicRainEngine";export {seededRandom} from "./CaptureMode";')
 .replace('constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){','constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){if((globalThis as any).__qaSkip)return;');
const {outputFiles}=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()+'/src'},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
const {Puddle,WaterControls,MusicRainEngine,seededRandom}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
function app(){
 const controls=new WaterControls();controls.change({rain:true,rainRate:2,dreamyRainSpeed:false,dreamy:false,subtle:false,gentleMotion:false,waveSpeed:1});
 const puddle=new Puddle(),physical=[],drawing=[],rain=[];
 puddle.controls=controls;puddle.state=controls.state;puddle.simulationSteps=0;
 puddle.water={addDrop:(...drop)=>physical.push({drop,step:puddle.simulationSteps}),stepSimulation:()=>{},updateNormals:()=>{}};
 puddle.openBoundary={apply:()=>{}};puddle.waveLines={model:{addDrop:(...drop)=>drawing.push(drop)}};
 puddle.rainLayer={advance:()=>{},addDrop:(...drop)=>rain.push({drop,step:puddle.simulationSteps})};
 Object.assign(puddle,{animating:true,lastTime:0,accumulator:0,gestureQueue:[],gestureElapsed:0,rainAccumulator:0,clearRainUntil:0,draw:()=>{}});
 return {puddle,controls,physical,drawing,rain};
}
function ordinary(clock){const a=app();Math.random=seededRandom(8437);if(clock)a.puddle.setMusicRain(clock);a.puddle.animate(1000);
 for(let time=1010;time<=4000;time+=10)a.puddle.animate(time);return a;}
const untouched=ordinary(),off=ordinary({enabled:false,updateMusicRain:()=>{throw new Error('Off must never schedule music.');},setSimulationPaused:()=>{},rebase:()=>{}});
assert.deepEqual(off.physical,untouched.physical,'Music OFF preserves the exact ordinary rain samples and simulation steps');
assert.deepEqual(off.drawing,untouched.drawing);assert.deepEqual(off.controls.state,untouched.controls.state);
const score=JSON.parse(await readFile('data/music/scores/02-fused-dj-kicks.json','utf8'));
const engine=new MusicRainEngine();engine.setScore(score,124.55);
const a=app(),settings={...a.controls.state};let now=1000,playing=true,rebaseCalls=0;
const clock={enabled:true,updateMusicRain:()=>engine.updateMusicRain({trackId:score.track_id,time:124.55+(now-1000)/1000,playing}),
 setSimulationPaused:value=>{playing=!value;},rebase:()=>{rebaseCalls++;engine.seek(124.55+(now-1000)/1000);}};
a.puddle.setMusicRain(clock);a.puddle.animate(now);
for(now=1010;now<=13500;now+=10)a.puddle.animate(now);
assert.ok(a.physical.length>=20,'The flagship choreography reaches the original physical drop path');
assert.equal(a.physical.length,engine.scheduler.events.filter(e=>e.time>124.55&&e.time<=137.05).length);
assert.equal(a.drawing.length,a.physical.length,'The existing ripple drawing uses exactly the physical impacts');
for(const {drop} of a.physical){assert.ok(drop[2]>0&&drop[3]<0);assert.equal(drop[4],1);assert.equal(drop[5],1);}
assert.deepEqual(a.controls.state,settings,'Music scheduling cannot rewrite existing water settings');
const b=app();b.puddle.rainLayerActive=true;b.puddle.emitRain(engine.scheduler.events.find(e=>e.kind==='accent'));
assert.equal(b.rain.length,1);assert.equal(b.physical.length,0,'Dreamy rain enters RainWaveLayer only');
b.puddle.disturb(.1,.1);assert.equal(b.physical.length,1);assert.equal(b.rain.length,1,'Touch remains in the independent full-speed field');
const c=app();c.puddle.emitRain(engine.scheduler.events[0]);const first=c.physical[0].drop;
Math.random=()=>.999;c.puddle.emitRain(engine.scheduler.events[0]);assert.deepEqual(c.physical[1].drop,first,'Reference capture is independent of unrelated random consumption');
playing=false;const before=a.physical.length;for(now=13510;now<=13900;now+=10)a.puddle.animate(now);assert.equal(a.physical.length,before);
assert.equal(rebaseCalls,0,'Track/seek changes never clear or manipulate the water');
const out=process.argv[2];if(out)await writeFile(out,JSON.stringify({track:score.track_id,start:124.55,duration:12.5,
 impulses:a.physical.map(({drop,step})=>({time:step/120,x:drop[0],z:drop[1],radius:drop[2],strength:drop[3]}))}));
console.log(JSON.stringify({actualPuddleRainPath:true,physicalMusicImpacts:a.physical.length,normalRainOffExact:true,
 noSurfaceDeformation:true,existingImpulseDistribution:true,rainLayerRoute:true,touchSeparate:true,seededPhysicalForces:true,settingsUnchanged:true}));
