import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {shaderSource} from '../shader-loader.mjs';

const analysis=JSON.parse(await readFile('public/music/marumari-full-analysis.json','utf8'));
const score=JSON.parse(await readFile('public/music/marumari-rain-score.json','utf8'));
for(const [file,key] of [[score.source.recording,'recordingSha256'],[score.source.analysis,'analysisSha256']])assert.equal(createHash('sha256').update(await readFile('public/music/'+file)).digest('hex'),score.source[key],'Keep the supplied input bytes intact');
const plugins=[{name:'shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}];
async function moduleSource(contents,resolveDir=process.cwd()){
  const {outputFiles}=await build({stdin:{contents,resolveDir,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,plugins});
  return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
}
const {MarumariRainScheduler,MusicRainPlayer}=await moduleSource("export {MarumariRainScheduler} from './src/music/MarumariRainScheduler';export {MusicRainPlayer} from './src/music/MusicRainPlayer';");
const scheduler=new MarumariRainScheduler(analysis,score);
assert.equal(score.accents.length,14);assert.equal(score.sections.length,12);
assert.ok(scheduler.events.length>70&&scheduler.events.length<250,'Keep the score restrained');
assert.ok(scheduler.events.length<analysis.beats.length,'Not one raindrop per beat');
assert.ok(scheduler.events.every(e=>!('x' in e)&&!('z' in e)&&Number.isFinite(e.time)&&e.scale>0&&e.strength>0),'The score must not prescribe every drop position');
assert.ok(!scheduler.events.some(e=>e.time<8||e.time>=208),'Leave the opening and final tail still');
assert.equal(scheduler.events.filter(e=>e.kind==='accent').length,14);
assert.ok(scheduler.events.filter(e=>e.time>=120&&e.time<180).length>scheduler.events.filter(e=>e.time<36).length*3,'The full-song structure must shape rainfall');
assert.ok(!scheduler.events.some(e=>e.kind==='rain'&&e.time>=118.262&&e.time<=118.602),'Clear room around the isolated accent');
assert.ok(scheduler.stateAt(118.35).density<scheduler.stateAt(117.4).density,'Anticipation must ease the rain away');
const intervals=scheduler.events.filter(e=>e.kind==='rain').map(e=>e.time).map((t,i,all)=>i?t-all[i-1]:null).filter(t=>t!==null);
const average=intervals.reduce((a,b)=>a+b,0)/intervals.length;
const cv=Math.sqrt(intervals.reduce((a,b)=>a+(b-average)**2,0)/intervals.length)/average;
assert.ok(cv>.45,'The rain must remain irregular rather than a visual metronome');
function playback(fps){const s=new MarumariRainScheduler(analysis,score),events=[];s.seek(0);for(let t=1/fps;t<score.duration;t+=1/fps)events.push(...s.updateMusicRain(t));events.push(...s.updateMusicRain(score.duration));return events;}
for(const fps of [30,60,144])assert.deepEqual(playback(fps),scheduler.events,'Frame rate must not change the music schedule');
scheduler.seek(118.40);const accent=scheduler.updateMusicRain(118.43);assert.equal(accent.length,1);assert.equal(accent[0].time,118.422);
for(let i=0;i<60;i++)assert.equal(scheduler.updateMusicRain(118.43).length,0,'Paused song time must create no drops');
scheduler.seek(150.24);assert.equal(scheduler.updateMusicRain(150.27)[0].time,150.256,'Forward seek must land on the new section');
assert.equal(scheduler.updateMusicRain(80).length,0,'Backward jumps rebase without a backlog');
assert.equal(scheduler.updateMusicRain(150).length,0,'Large forward jumps must not create a catch-up storm');
scheduler.seek(0);assert.deepEqual(playback(60),new MarumariRainScheduler(analysis,score).events,'Restart must repeat the same temporal interpretation');
assert.throws(()=>scheduler.updateMusicRain(NaN));assert.throws(()=>new MarumariRainScheduler({...analysis,duration:999},score));

// Native-media event semantics with an injected audio clock. There is no RAF or
// independently running wall clock in the player or scheduler under test.
const {window,document}=parseHTML(await readFile('index.html','utf8'));
Object.assign(globalThis,{window,document,requestAnimationFrame:()=>0,__qaSkip:true});
Object.defineProperty(document,'baseURI',{value:'https://example.test/ink-water/'});
const audio=document.getElementById('music-audio');
Object.assign(audio,{currentTime:0,paused:true,seeking:false,ended:false,controls:false});
audio.pause=()=>{if(!audio.paused){audio.paused=true;audio.dispatchEvent(new window.Event('pause'));}};
audio.play=async()=>{audio.paused=false;audio.dispatchEvent(new window.Event('play'));};
let loads=0;globalThis.fetch=async url=>{loads++;return {ok:true,json:async()=>String(url).endsWith('marumari-full-analysis.json')?analysis:score};};
const diagnostics={};const player=new MusicRainPlayer(state=>Object.assign(diagnostics,state));
assert.equal(player.enabled,false);assert.equal(loads,0,'Off must not fetch audio or analysis');
await player.setEnabled(true);assert.equal(loads,2);assert.equal(document.getElementById('music-sync-toggle').getAttribute('aria-checked'),'true');assert.equal(document.getElementById('music-player').hidden,false);
assert.equal(player.updateMusicRain().length,0,'Enabling the mode must not autoplay or emit rain');
audio.currentTime=118.4;await audio.play();audio.currentTime=118.43;assert.equal(player.updateMusicRain()[0].time,118.422);
audio.pause();audio.currentTime=118.44;assert.equal(player.updateMusicRain().length,0);
await audio.play();assert.equal(player.updateMusicRain().length,0,'Resume must not repeat the old accent');
audio.seeking=true;audio.currentTime=150.24;audio.dispatchEvent(new window.Event('seeking'));assert.equal(player.updateMusicRain().length,0);audio.seeking=false;audio.dispatchEvent(new window.Event('seeked'));audio.currentTime=150.27;assert.equal(player.updateMusicRain()[0].time,150.256);
player.setSimulationPaused(true);assert.equal(audio.paused,true);assert.equal(player.updateMusicRain().length,0);player.setSimulationPaused(false);await Promise.resolve();assert.equal(audio.paused,false,'Resuming global pause resumes music only if it was playing');
audio.pause();player.setSimulationPaused(true);player.setSimulationPaused(false);assert.equal(audio.paused,true,'An intentional music pause must remain paused');
audio.currentTime=80;player.restart();assert.equal(audio.currentTime,0);assert.equal(audio.paused,true,'Restart while paused must stay paused');
await audio.play();audio.currentTime=80;player.restart();await Promise.resolve();assert.equal(audio.currentTime,0);assert.equal(audio.paused,false,'Restart while playing remains playing');
for(const enabled of [false,true,false,true]){await player.setEnabled(enabled);assert.equal(player.enabled,enabled);assert.equal(document.getElementById('music-sync-toggle').getAttribute('aria-checked'),String(enabled));assert.equal(document.getElementById('music-player').hidden,!enabled);}
assert.equal(loads,2,'Repeated mode entry must reuse the validated score');
await player.setEnabled(false);assert.equal(audio.paused,true);
// An off click during asynchronous loading must win over the later response.
const completions=[];globalThis.fetch=url=>new Promise(resolve=>{completions.push(()=>resolve({ok:true,json:async()=>String(url).endsWith('marumari-full-analysis.json')?analysis:score}));});
const pendingPlayer=new MusicRainPlayer(()=>{}),pending=pendingPlayer.setEnabled(true);await pendingPlayer.setEnabled(false);
for(const finish of completions)finish();await pending;
assert.equal(pendingPlayer.enabled,false,'Off must remain committed during loading');

// Exercise the application bridge with actual source Water and RainWaveLayer
// materials. Check that music invokes the original physical drop shader.
const source=(await readFile('src/main.ts','utf8')).replace('void start();','export {Puddle,THREE,WaterControls,Water,RainWaveLayer};').replace('constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){','constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){if((globalThis as any).__qaSkip)return;');
const {Puddle,THREE,WaterControls,Water,RainWaveLayer}=await moduleSource(source,process.cwd()+'/src');
const controls=new WaterControls();controls.hooks.reset=()=>{void player.setEnabled(false);};await player.setEnabled(true);controls.reset();assert.equal(player.enabled,false,'Reset to defaults must disable the music experiment');controls.change({gentleMotion:false,dreamyRainSpeed:false,rain:false});
document.getElementById('stage').getBoundingClientRect=()=>({width:1000,height:600});
let target=null;const passes=[];
const gl={capabilities:{isWebGL2:true},extensions:{has:()=>true},getRenderTarget:()=>target,getClearColor:c=>c.set(0),getClearAlpha:()=>1,setClearColor:()=>{},setRenderTarget:t=>{target=t;},clear:()=>{},render:scene=>{const m=scene.children[0].material;for(const u of Object.values(m.uniforms))assert.notEqual(u.value,target?.texture,'Never feed a drawing back into the solver');passes.push({fragment:m.fragmentShader,uniforms:Object.fromEntries(Object.entries(m.uniforms).map(([k,v])=>[k,v.value?.isVector2||v.value?.isVector3?v.value.clone():v.value]))});}};
const app=new Puddle(null,null,controls);app.controls=controls;app.state=controls.state;app.gl=gl;app.water=new Water(gl);app.rainLayer=new RainWaveLayer(gl);app.draw=()=>{};app.simulationSteps=0;
const physicalShader=await shaderSource('src/shaders/WaterRipple.frag');
const originalRandom=Math.random;let randomCalls=0;const values=[.1,.9,.3,.7];Math.random=()=>values[randomCalls++%4];
let begin=passes.length;app.emitRain();let drops=passes.slice(begin).filter(p=>p.fragment===physicalShader);assert.equal(drops.length,1);assert.equal(randomCalls,4,'Normal rain keeps its exact random sample order');
const mainRadius=drops[0].uniforms.radius,mainStrength=drops[0].uniforms.strength;
app.rainLayerActive=true;begin=passes.length;app.emitRain(1.5,1.3);drops=passes.slice(begin).filter(p=>p.fragment===physicalShader);assert.equal(drops.length,1);assert.ok(Math.abs(drops[0].uniforms.radius/mainRadius-1.3)<1e-12);assert.ok(Math.abs(drops[0].uniforms.strength/mainStrength-1.5)<1e-12);
const primaryBefore=app.water.textureA;app.disturb(.12,.15);assert.notEqual(app.water.textureA,primaryBefore,'Touch still enters the primary solver');
let musicalCalls=0;app.emitRain=()=>musicalCalls++;app.advance=()=>{};app.animating=true;app.lastTime=1000;app.accumulator=0;app.clearRainUntil=0;app.pendingDraw=false;controls.state.rain=true;controls.state.rainRate=8;app.rainAccumulator=.9;app.rainLayer.advance=()=>{};
const clock={enabled:true,updateMusicRain:()=>[{time:10,strength:1,scale:1,bias:[0,0]}],setSimulationPaused:()=>{},rebase:()=>{}};app.setMusicRain(clock);app.animate(1034);assert.equal(musicalCalls,1,'Music must override normal scheduling, not add a second rain scheduler');assert.equal(app.rainAccumulator,.9,'Normal rain accumulation is held while music owns scheduling');
clock.enabled=false;musicalCalls=0;app.animate(1068);assert.equal(musicalCalls,1,'Turning music off resumes normal physical rain');
Math.random=originalRandom;
const summary={recordingAndAnalysisBytesPreserved:true,sections:score.sections.length,selectedAccents:score.accents.length,physicalEvents:scheduler.events.length,detectedOnsets:analysis.onsets.length,irregularity:Math.round(cv*100)/100,frameRates:[30,60,144],pauseSeekRestart:true,modeOffOnOffOn:true,normalRainRestored:true,actualSourceDropShader:true,separateRainAndTouch:true,noShaderChanges:true};
if(process.argv.includes('--export'))await writeFile('music-test-events.json',JSON.stringify({events:scheduler.events,summary}));
console.log(JSON.stringify(summary));
