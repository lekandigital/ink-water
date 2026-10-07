import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {shaderSource} from '../shader-loader.mjs';
process.on('uncaughtException',error=>{console.error(error.name+': '+error.message+'\n'+error.stack.split('\n').filter(line=>!line.includes('data:text')).slice(1,8).join('\n'));process.exitCode=1;});
const {window,document}=parseHTML(await readFile('index.html','utf8'));
Object.assign(globalThis,{window,document,requestAnimationFrame:()=>0,__qaSkip:true});
const source=(await readFile('src/main.ts','utf8')).replace('void start();','export {Puddle,THREE,WaterControls,experimentDefaults};').replace('constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){','constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){if((globalThis as any).__qaSkip)return;');
const {outputFiles}=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()+'/src'},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
const {Puddle,THREE,WaterControls,experimentDefaults}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const controls=new WaterControls(),initial={...controls.state};
assert.equal(initial.hideSunDisc,true,'Latest preference hides the reflected sun by default');
assert.equal(initial.dreamyRainSpeed,true,'Configuration A enables the independent rain clock');
assert.equal(initial.bitmapTones,true);assert.equal(initial.gentleMotion,true);assert.equal(initial.shortReferenceLines,true);
const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,'IDs must be unique');
assert.deepEqual(Object.fromEntries(['mode','tone','lineWeight','hairlineRipples','caustics','lightAzimuth','lightElevation','causticsStrength','rain','rainRate','dropSize','paused','waveSpeed','rippleScale','rainForce','touchForce'].map(k=>[k,initial[k]])),{mode:'etching',tone:'night',lineWeight:.68,hairlineRipples:false,caustics:true,lightAzimuth:170,lightElevation:90,causticsStrength:2,rain:true,rainRate:.2,dropSize:.038,paused:false,waveSpeed:1,rippleScale:1,rainForce:.0095,touchForce:.02});
const $=id=>document.getElementById(id);
const keyFor=id=>id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
let changes=0,clears=0;controls.hooks={change:()=>changes++,clear:()=>clears++,gesture:()=>{}};
// The page body carries data-tone too; a bubbling click must not re-apply the paper tone,
// which would undo the switch being clicked before its input event.
{const before=changes;$('rain').dispatchEvent(new window.Event('click',{bubbles:true}));document.body.dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(changes,before,'Clicks outside the tone, mode and pattern buttons must not change settings');}
function input(id,value){const el=$(id);if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new window.Event('input',{bubbles:true}));return el;}
const toneButtons=[...document.querySelectorAll('button[data-tone]')];
const quickTones=[...document.querySelectorAll('button[data-quick-tone]')];
assert.deepEqual(quickTones.map(b=>b.dataset.quickTone),['paper','silver','night','green-light','green-dark']);
assert.equal($('quick-tones').closest('#controls'),null,'The quick palette must be available outside technical controls');
assert.deepEqual(toneButtons.map(b=>b.dataset.tone),['paper','silver','night','green-light','green-dark']);
assert.deepEqual(toneButtons.map(b=>b.textContent),['Light','Silver','Dark','Green Light','Green Dark']);
const icon=document.querySelector('link[rel="icon"]'),theme=document.querySelector('meta[name="theme-color"]');
const originalChrome={icon:icon.getAttribute('href'),color:theme.content};
for(const tone of ['green-light','green-dark','paper','silver','night','green-dark','green-light','night']){
 const before={...controls.state};toneButtons.find(b=>b.dataset.tone===tone).click();
 assert.equal(controls.state.tone,tone);assert.equal(document.body.dataset.tone,tone);
 assert.equal(JSON.parse($('water-state').textContent).tone,tone);
 for(const button of [...toneButtons,...quickTones])assert.equal(button.getAttribute('aria-pressed'),String((button.dataset.tone??button.dataset.quickTone)===tone));
 for(const [key,value] of Object.entries(before))if(key!=='tone')assert.equal(controls.state[key],value,'A palette change must preserve every water setting');
 if(tone.startsWith('green-')){
  const paper=tone==='green-light'?'#aacdb2':'#144a32',ink=tone==='green-light'?'#144a32':'#aacdb2';
  assert.equal(theme.content,paper);const svg=decodeURIComponent(icon.getAttribute('href').split(',')[1]);assert.ok(svg.includes('fill="'+paper+'"')&&svg.includes('stroke="'+ink+'"'));
  const href=icon.getAttribute('href');input('wave-speed',.87);input('bitmap-tones',false);input('bitmap-tones',true);
  assert.equal(controls.state.tone,tone);assert.equal(icon.getAttribute('href'),href,'Unrelated controls must not disturb browser chrome');assert.equal(controls.state.waveSpeed,.87);
 }else assert.deepEqual({icon:icon.getAttribute('href'),color:theme.content},originalChrome,'Returning to an existing tone must restore the original browser chrome');
}
for(const tone of ['paper','silver','night','green-light','green-dark','night']){
 const before={...controls.state};assert.ok(document.body.classList.contains('controls-hidden'));
 quickTones.find(b=>b.dataset.quickTone===tone).click();assert.equal(controls.state.tone,tone);
 assert.equal(document.body.dataset.tone,tone);assert.equal(JSON.parse($('water-state').textContent).tone,tone);
 for(const b of [...toneButtons,...quickTones])assert.equal(b.getAttribute('aria-pressed'),String((b.dataset.tone??b.dataset.quickTone)===tone));
 for(const [key,value] of Object.entries(before))if(key!=='tone')assert.equal(controls.state[key],value,'Quick colors preserve every other setting');
 assert.ok(document.body.classList.contains('controls-hidden'),'Quick colors must not open the technical panel');
}
controls.reset();assert.equal(controls.state.tone,'night');assert.deepEqual({icon:icon.getAttribute('href'),color:theme.content},originalChrome);
const beforeBadTone={...controls.state};assert.throws(()=>controls.change({tone:'toString'}));assert.deepEqual(controls.state,beforeBadTone,'Invalid inherited property names are not tones');
let cycles=0;
for(const el of document.querySelectorAll('input[type="checkbox"]')){
 controls.reset();const key=keyFor(el.id);
 input(el.id,false);const before={...controls.state};
 for(const checked of [true,false,true]){
  input(el.id,checked);assert.equal(el.checked,checked);assert.equal(controls.state[key],checked);
  assert.equal(JSON.parse($('water-state').textContent)[key],checked,'Published state must be actual committed state');
  for(const [other,value] of Object.entries(before))if(![key,'caustics','causticRipples'].includes(other))assert.equal(controls.state[other],value,'Unrelated setting reset: '+key+' -> '+other);
 }
 cycles++;
}
// Sliders remain independent of switches, with input bindings and visible outputs.
let sliders=0;
for(const el of document.querySelectorAll('#controls input[type="range"]')){
 controls.reset();const key=keyFor(el.id),value=Number(el.getAttribute('min'))+(Number(el.getAttribute('max'))-Number(el.getAttribute('min')))*.4;
 input(el.id,value);assert.equal(controls.state[key],value);
 for(const checked of [true,false,true]){input('bitmap-tones',checked);assert.equal(controls.state[key],value);}
 input(el.id,Number(el.getAttribute('min')));assert.equal(controls.state[key],Number(el.getAttribute('min')));sliders++;
}
controls.reset();input('caustic-ripples',true);assert.equal(controls.state.caustics,false);input('caustic-ripples',false);assert.equal(controls.state.caustics,true,'Leaving caustic ink restores prior lighting');
for(const id of ['bitmap-tones','caustic-reveal','drifting-grain','soft-diffusion']){input(id,true);assert.equal(controls.state.caustics,true);assert.ok(['bitmapRipples','textureReveal','printedPaper','textureRefraction'].every(k=>!controls.state[k]));}
input('aligned-caustics',true);input('overhead-light',true);input('light-azimuth',43);assert.equal(controls.state.alignedCaustics,true);assert.equal(controls.state.overheadLight,true,'Light sliders must not reset switches');
function keypress(key,target=document.body,code=''){const e=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key,code,repeat:false});target.dispatchEvent(e);assert.ok(e.defaultPrevented);}
for(const button of document.querySelectorAll('button')){
 const before={...controls.state};keypress(' ',button,'Space');
 assert.deepEqual(controls.state,{...before,paused:!before.paused},'Focused Space may only change pause: '+(button.id||button.textContent));
 const held=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(held,{key:' ',code:'Space',repeat:true});button.dispatchEvent(held);
 assert.equal(held.defaultPrevented,true);assert.equal(controls.state.paused,!before.paused,'Held Space cannot toggle repeatedly');
 const up=new window.Event('keyup',{bubbles:true,cancelable:true});Object.assign(up,{key:' ',code:'Space'});button.dispatchEvent(up);
 assert.equal(up.defaultPrevented,true,'Cancel native Space activation on key-up too');
 keypress(' ',button,'Space');assert.deepEqual(controls.state,before);
}
controls.reset();keypress(' ',$('bitmap-tones'),'Space');assert.equal(controls.state.paused,true);keypress(' ',$('wave-speed'),'Space');assert.equal(controls.state.paused,false);assert.ok(document.body.classList.contains('controls-hidden'),'Controls start hidden');assert.equal($('toggle-controls').textContent,'Show controls');keypress('h');assert.ok(!document.body.classList.contains('controls-hidden'));assert.equal($('toggle-controls').textContent,'Hide controls');keypress('h');assert.ok(document.body.classList.contains('controls-hidden'));
controls.change({dreamy:true,subtle:true,waveSpeed:.7,tone:'night'});const stillSettings={...controls.state};$('clear').click();assert.equal(clears,1);assert.deepEqual(controls.state,stillSettings,'Still only invokes wave clearing');$('reset-defaults').click();assert.deepEqual(controls.state,initial,'Defaults must restore the separate startup preset');
const beforeInvalid={...controls.state};assert.throws(()=>controls.change({tone:'night',touchForce:NaN}));assert.deepEqual(controls.state,beforeInvalid,'Settings updates must be atomic');
// Musical playback masks background rain without overwriting its saved preference
// or changing the separate Gentle motion setting.
controls.reset();const beforeMusic={...controls.state},musicChanges=changes;
controls.setMusicPlaying(true);
assert.deepEqual(controls.state,{...beforeMusic,rain:false});
assert.equal($('rain').checked,false);assert.equal($('rain').disabled,true);assert.equal($('rain-value').textContent,'Off');
assert.equal(JSON.parse($('water-state').textContent).rain,false);
controls.setMusicPlaying(true);assert.equal(changes,musicChanges,'Playback rain handoff must not trigger graphics/pause hooks');
controls.setMusicPlaying(false);assert.deepEqual(controls.state,beforeMusic);assert.equal($('rain').checked,true);assert.equal($('rain').disabled,false);
controls.change({rain:false});controls.setMusicPlaying(true);controls.setMusicPlaying(false);
assert.equal(controls.state.rain,false,'An existing rain-off preference stays off after playback');
controls.change({rain:true});controls.setMusicPlaying(true);controls.change({rain:false});controls.setMusicPlaying(false);
assert.equal(controls.state.rain,false,'A preference changed during playback is restored on pause');
controls.setMusicPlaying(true);controls.change({rain:true});assert.equal(controls.state.rain,false);
controls.setMusicPlaying(false);assert.equal(controls.state.rain,true);
controls.change({rain:false});controls.setMusicPlaying(true);controls.reset();
assert.equal(controls.state.rain,false,'Reset keeps background rain masked until music stops');
controls.setMusicPlaying(false);assert.deepEqual(controls.state,initial,'Reset restores the startup rain preference when music stops');
// Exercise the application clock and clearing methods, not an alternate solver.
function neutral(){controls.reset();controls.change({bitmapTones:false,hideSunDisc:false,rain:false,gentleMotion:false,dreamyRainSpeed:false,shortReferenceLines:false});}
neutral();
const app=new Puddle();app.controls=controls;app.state=controls.state;app.camera=new THREE.PerspectiveCamera(33,1,0.01,100);app.camera.position.set(0,4.5,0);app.camera.up.set(0,0,-1);app.camera.lookAt(0,0,0);app.camera.updateMatrixWorld();
let steps=0,normals=0;const drops=[];app.simulationSteps=0;app.water={addDrop:(...v)=>drops.push({values:v,step:app.simulationSteps}),stepSimulation:()=>steps++,updateNormals:()=>normals++,textureA:{},textureB:{}};
app.openBoundary={apply:()=>{}};app.waveLines={model:{addDrop:()=>{},clear:()=>{}}};app.animating=true;app.lastTime=0;app.accumulator=0;app.gestureQueue=[];app.gestureElapsed=0;app.rainAccumulator=0;app.draw=()=>{};
app.animate(1000);for(let now=1010;now<=2000;now+=10)app.animate(now);assert.ok(steps>=118&&steps<=120);assert.equal(normals,0,'Neutral advance retains original normal-update schedule');
controls.state.waveSpeed=.32;steps=0;app.accumulator=0;app.lastTime=0;app.animate(3000);for(let now=3010;now<=4000;now+=10)app.animate(now);assert.equal(steps,38);
controls.state.dreamy=true;steps=0;app.accumulator=0;app.lastTime=0;app.animate(5000);for(let now=5010;now<=6000;now+=10)app.animate(now);assert.equal(steps,24);
let recaptures=0;app.waterPresentation={capture:()=>recaptures++};neutral();app.prepareMotion();
for(const enabled of [true,false,true]){controls.state.dreamy=enabled;app.accumulator=.01;app.prepareMotion();if(enabled)assert.equal(app.accumulator,0);}
assert.equal(recaptures,2,'Each slow-motion entry must capture the current surface');
app.waterPresentation=undefined;
let rainSeconds=0,rainDrops=0,rainClears=0,rainMerges=0;
app.rainLayer={advance:seconds=>rainSeconds+=seconds,addDrop:()=>rainDrops++,mergeInto:()=>rainMerges++,clear:()=>rainClears++};
neutral();controls.state.waveSpeed=.4;controls.state.dreamy=true;controls.state.gentleMotion=true;controls.state.dreamyRainSpeed=true;
app.prepareMotion();assert.equal(app.motion.speed,1);assert.equal(app.rainLayerActive,true);
controls.state.rain=true;controls.state.rainRate=8;app.randomPoint=()=>new THREE.Vector2(.1,.2);app.clearRainUntil=0;
steps=0;drops.length=0;app.lastTime=0;app.accumulator=0;app.rainAccumulator=0;
app.animate(7000);for(let now=7010;now<=8000;now+=10)app.animate(now);
assert.ok(steps>=118&&steps<=120,'Touch solver must advance at 100% throughout slow rain');
assert.ok(rainDrops>=7&&rainDrops<=8);assert.equal(drops.length,0,'Rain must enter only the independent rain field');assert.ok(Math.abs(rainSeconds-1)<1e-9);
controls.state.paused=true;const pausedRainSeconds=rainSeconds;app.animate(8010);assert.equal(rainSeconds,pausedRainSeconds,'Pause must stop the rain clock too');
controls.state.paused=false;app.disturb(.1,.1);assert.equal(drops.length,1,'Touch must enter only the full-speed field');
controls.state.dreamyRainSpeed=false;app.waterPresentation={capture:()=>{}};app.prepareMotion();assert.equal(rainMerges,1);assert.equal(app.rainLayerActive,false);
controls.state.dreamyRainSpeed=true;app.prepareMotion();assert.equal(app.rainLayerActive,true,'The option must work after re-enabling');
controls.state.dreamyRainSpeed=false;app.prepareMotion();app.waterPresentation=undefined;
neutral();app.disturb(.1,.1);assert.equal(drops.at(-1).values[2],.038);assert.equal(drops.at(-1).values[3],-.02);controls.state.subtle=true;app.disturb(.1,.1);assert.equal(drops.at(-1).values[3],-.02*.55);
neutral();let replaySamples=0;
for(const key of ['c','x','/']){
 const replay=()=>{drops.length=0;app.simulationSteps=0;app.lastTime=0;app.playGesture(key);app.animate(10000);for(let t=10010;t<=12000;t+=10)app.animate(t);return structuredClone(drops);};
 const first=replay();assert.deepEqual(replay(),first,'Exact gesture samples and solver steps must repeat');replaySamples+=first.length;
}
app.gl={getRenderTarget:()=>null,getClearColor:()=>{},getClearAlpha:()=>1,setClearColor:()=>{},setRenderTarget:()=>{},clear:()=>{}};controls.change({tone:'night',dreamy:true,subtle:true,bitmapTones:true,waveSpeed:.45});const beforeClear={...controls.state};Puddle.prototype.clear.call(app);assert.deepEqual(controls.state,beforeClear);assert.equal(app.gestureQueue.length,0);
assert.equal(rainClears,1,'Still the water must clear both wave fields');
console.log(JSON.stringify({domControlCycles:cycles,cycle:'off-on-off-on',sliders,toneOptions:toneButtons.length,reversibleGreenChrome:true,toneChangesPreserveSettings:true,sourceClockPreserved:true,sourceTouchForcePreserved:true,independentRainClock:true,pauseStopsRain:true,configurationAStartup:true,darkComicDefault:true,hideSunDefaultOn:true,alignmentDefaultOff:true,deterministicGestures:3,replaySamples,stillPreservesEverySetting:true,resetMatchesStartup:true,musicMasksBackgroundRain:true,musicRestoresRainPreference:true,independentSwitches:true,changes,browserRenderingTest:false}));
