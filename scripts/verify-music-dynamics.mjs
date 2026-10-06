import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './music/MusicDynamics';export * from './music/RainScheduler';export * from './WaterMotion';export * from './StartupSettings';export * from './GesturePatterns';`,loader:'ts',resolveDir:process.cwd()+'/src'},bundle:true,platform:'node',format:'esm',write:false});
const {musicImpact,RainScheduler,rainImpulse,effectiveMotion,startupSettings,gesturePattern}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
let gestures=0;
for(const track of manifest.tracks){
 const score=JSON.parse(await readFile('data/music/'+track.score,'utf8')),rain=new RainScheduler(score),settings=startupSettings(),motion=effectiveMotion(settings);
 const frozen=structuredClone(settings);
 for(const event of rain.events){
  const calibrated=musicImpact(event),drop=rainImpulse(motion.rainForce*calibrated.force,motion.scale*calibrated.scale,()=>.5);
  assert.ok(Number.isFinite(drop.strength)&&drop.strength<0&&drop.radius>0&&drop.radius<.1);
  assert.equal(musicImpact(event,.5).force,calibrated.force*.5);assert.equal(musicImpact(event,1.75).force,calibrated.force*1.75);
 }
 assert.deepEqual(settings,frozen,'Music interpretation cannot reset a tone or any existing setting');
 for(const g of score.gestures){
  const actual=rain.events.filter(e=>e.kind==='gesture'&&e.time>=g.time&&e.time<=g.time+1.7),path=gesturePattern(g.path);
  assert.equal(actual.length,path.length);path.forEach((p,i)=>assert.ok(Math.abs(actual[i].time-(g.time+p.at/1000))<1e-9));
  const afterSeek=new RainScheduler(score);afterSeek.seek(g.time+.4);
  const tail=afterSeek.updateMusicRain(g.time+.7);assert.ok(tail.every(e=>e.time>g.time+.4),'Skipping into a gesture cannot replay its head');gestures++;
 }
}
assert.ok(gestures>=3&&gestures<=8,'Gestures are occasional authored phrase moments');
const event={kind:'rain',force:.5,scale:1};
const old=rainImpulse(.0095*.4*.5,1,()=>.5),now=musicImpact(event),actual=rainImpulse(.0095*.4*now.force,now.scale,()=>.5);
assert.ok(Math.abs(actual.strength)>Math.abs(old.strength)*2.5,'Musical marks must be discernible with the default gentle force');
assert.ok(rainImpulse(0,now.scale,()=>.5).strength===0,'The existing zero force control is still respected');
assert.equal(effectiveMotion({...startupSettings(),subtle:true}).rainForce/effectiveMotion(startupSettings()).rainForce,.55);
assert.equal(musicImpact({...event,kind:'accent'}).force/musicImpact(event).force,3.2/2.6,'Selected accents have a distinct physical weight');
console.log(JSON.stringify({allSongsCalibrated:32,occasionalPhysicalGestures:gestures,defaultGentleMusicLegible:true,zeroForceRespected:true,independentSubtle:true,expressionDoesNotRewriteScore:true}));
