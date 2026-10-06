import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {shaderSource} from '../shader-loader.mjs';
process.on('uncaughtException',error=>{console.error(error.name+': '+error.message+'\n'+error.stack.split('\n').filter(line=>!line.includes('data:text')).slice(1,5).join('\n'));process.exitCode=1;});

// Connect the production YouTube adapter to the real Puddle animation/drop
// methods. Only GPU targets and the external iframe are replaced by test ports.
// Unlike a synthetic MusicRainClock, this exercises every scheduling gate.
const html=await readFile('index.html','utf8');
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
const inventory=JSON.parse(await readFile('data/music/analysis/youtube-playlist-inventory.json','utf8'));
const scores=new Map(await Promise.all(manifest.tracks.map(async t=>[t.score,JSON.parse(await readFile('data/music/'+t.score,'utf8'))])));
const source=(await readFile('src/main.ts','utf8'))
 .replace('void start();','export {Puddle,WaterControls,PlaylistMusic};')
 .replace('constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){','constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){if((globalThis as any).__qaSkip)return;');
const {window:initialWindow,document:initialDocument}=parseHTML(html);
Object.assign(globalThis,{window:initialWindow,document:initialDocument,requestAnimationFrame:()=>0,__qaSkip:true});
const built=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()+'/src'},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
const {Puddle,WaterControls,PlaylistMusic}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
let total=0;

for(const dreamyRain of [false,true])for(const quantum of [.08,.4,.5,.64,.8])for(const playbackRate of [1,2]){
 const {window,document}=parseHTML(html);let now=1000,port;
 const location={origin:'https://ink-water.test',search:''};
 Object.defineProperty(document,'baseURI',{value:location.origin+'/'});
 Object.defineProperty(document.getElementById('music-track'),'value',{value:'',writable:true});
 document.getElementById('stage').getBoundingClientRect=()=>({width:1440,height:900});
 class NativePort{
  index=0;time=0;duration=0;state=5;rate=playbackRate;playlist=[];
  constructor(element,options){port=this;this.options=options;this.frame=document.createElement('iframe');element.replaceWith(this.frame);}
  cuePlaylist(options){assert.equal(options.list,'PLTab0IXtn0Nw');this.playlist=inventory.entries.map(e=>e.video_id);}
  playVideo(){this.state=1;}pauseVideo(){this.state=2;}stopVideo(){this.state=0;}
  playVideoAt(index){this.index=index;}seekTo(time){this.time=time;}
  getCurrentTime(){return this.time;}getDuration(){return this.duration;}getPlaylistIndex(){return this.index;}
  getVideoUrl(){return 'https://www.youtube.com/watch?v='+this.playlist[this.index];}
  getPlaylist(){return this.playlist;}getPlaybackRate(){return this.rate;}getPlayerState(){return this.state;}
  setLoop(){}setShuffle(){}getIframe(){return this.frame;}destroy(){this.frame.remove();}
 }
 Object.assign(window,{location,YT:{Player:NativePort},setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{}});
 Object.assign(globalThis,{window,document,location,performance:{now:()=>now},fetch:async url=>{
  assert.doesNotMatch(String(url),/\.mp3/i);const path=new URL(String(url)).pathname.replace('/music/','');
  return {ok:true,json:async()=>structuredClone(path==='manifest.json'?manifest:scores.get(path))};
 }});
 const controls=new WaterControls();controls.change({dreamyRainSpeed:dreamyRain});
 const settings={...controls.state},rain=[],touch=[],timing=[];let latest={},draws=0,clears=0,idealSongTime=0;
 const music=new PlaylistMusic({publish:data=>{latest={...latest,...data};controls.publish(data);}});
 const puddle=new Puddle();puddle.controls=controls;puddle.state=controls.state;
 puddle.water={addDrop:(...drop)=>touch.push(drop),stepSimulation:()=>{},updateNormals:()=>{}};
 puddle.openBoundary={apply:()=>{}};puddle.waveLines={model:{addDrop:()=>{}}};
 puddle.rainLayer={advance:()=>{},addDrop:(...drop)=>rain.push(drop)};
 Object.assign(puddle,{animating:true,lastTime:0,accumulator:0,rainAccumulator:0,clearRainUntil:0,rainLayerActive:dreamyRain,
  draw:()=>{draws++;},clear:()=>{clears++;}});
 controls.onPauseChange=paused=>music.setSimulationPaused(paused);puddle.setMusicRain(music);
 const emit=puddle.emitRain.bind(puddle);
 puddle.emitRain=event=>{if(event)timing.push({time:event.time,late:(idealSongTime-event.time)/playbackRate});emit(event);};
 await music.play();port.options.events.onReady();await flush();
 // The first new video ID deliberately arrives with old duration metadata.
 port.index=8;port.duration=154;port.state=1;now+=80;music.player.poll();await flush();
 assert.equal(latest.musicSourceMismatch,true);puddle.animate(now);
 assert.equal(rain.length+touch.length,0,'A transient metadata mismatch safely holds physical rain');
 port.duration=inventory.entries[8].duration_seconds;now+=80;music.player.poll();await flush();
 assert.equal(latest.musicSourceMismatch,false,'Current recording metadata releases the hold');
 const score=music.engine.scheduler.score,planned=music.engine.scheduler.events;
 const impacts=()=>dreamyRain?rain:touch;
 async function seek(time){
  music.seek(time);now+=80;music.player.poll();await flush();puddle.animate(now);
  assert.equal(latest.musicSeeking,false);
 }
 async function run(start,duration,playing=true){
  let nextPoll=.08;const wall=now;
  for(let frame=1;frame<=Math.ceil(duration*60);frame++){
   const elapsed=frame/60;now=wall+elapsed*1000;
   if(elapsed+1e-8>=nextPoll){
    port.time=start+(playing?Math.floor((elapsed+1e-8)/quantum)*quantum*playbackRate:0);
    music.player.poll();await flush();nextPoll+=.08;
   }
   idealSongTime=start+(playing?elapsed*playbackRate:0);puddle.animate(now);
  }
 }
 const start=124.55,end=137.05;
 await seek(start);const before=impacts().length,timingBefore=timing.length;
 await run(start,end-start+quantum+.16);
 const complete=impacts().slice(before),through=music.currentTime();
 assert.equal(complete.length,planned.filter(e=>e.time>start&&e.time<=through).length,'Every eligible authored event enters the physical solver through the production handoff');
 assert.ok(complete.length>=25,'The flagship accent and clustered passage remain physically visible');
 const passageTiming=timing.slice(timingBefore),arrival=passageTiming.find(e=>Math.abs(e.time-127.617)<.001);
 assert.ok(arrival,'The flagship musical arrival reaches the physical solver');
 assert.ok(passageTiming.every(e=>e.late>=-1e-7&&e.late<=.1),`Physical arrivals follow playback within 100ms, including cached ${quantum}s timestamps at ${playbackRate}x`);
 assert.ok(complete.every(drop=>drop[2]>0&&drop[3]<0));
 assert.equal(JSON.parse(document.getElementById('water-state').textContent).musicPhysicalImpacts,impacts().length);
 assert.deepEqual(controls.state,settings,'Playback never rewrites water or palette settings');
 const first=[...complete];
 await seek(start);const repeatBefore=impacts().length;
 await run(start,end-start+quantum+.16);
 assert.deepEqual(impacts().slice(repeatBefore),first,'Backward seek reproduces exactly the physical impacts, including positions and force variation');
 await seek(126.9);controls.change({paused:true});const pausedCount=impacts().length;
 await run(126.9,3,false);assert.equal(impacts().length,pausedCount,'Water/music pause emits nothing');
 controls.change({paused:false});await flush();port.time=126.9;now+=80;music.player.poll();await flush();puddle.animate(now);
 await run(126.9,1.2+quantum);
 assert.ok(impacts().length>pausedCount,'Resume delivers the approaching musical arrival');
 const beforeSeek=impacts().length;await seek(180);
 assert.equal(impacts().length,beforeSeek,'Forward seek discards the skipped passage rather than emitting a storm');
 const previousCount=impacts().length;
 await music.next();puddle.animate(now);assert.equal(impacts().length,previousCount,'No previous-song event survives an unacknowledged track change');
 port.index=9;port.time=0;port.duration=inventory.entries[9].duration_seconds;now+=80;music.player.poll();await flush();puddle.animate(now);
 assert.equal(music.engine.scheduler.score.track_id,'07-lusine-without-a-plan');
 assert.equal(clears,0,'Seeks and track changes never clear the water');
 music.close();const ordinaryBefore=impacts().length;
 for(let frame=1;frame<=660;frame++){now+=1000/60;puddle.animate(now);}
 assert.ok(impacts().length>ordinaryBefore,'Music OFF restores ordinary physical rain');
 if(dreamyRain){const separate=rain.length;puddle.disturb(.1,.1);assert.equal(touch.length,1);assert.equal(rain.length,separate,'Touch stays in the separate full-speed field');}
 assert.ok(draws>0);total+=complete.length;
}
console.log(JSON.stringify({productionPlaybackToPuddle:true,unevenClockCadences:[.08,.4,.5,.64,.8],playbackRates:[1,2],arrivalWithin100ms:true,physicalRoutes:2,physicalImpacts:total,
 staleMetadataRecovers:true,deterministicBackwardSeek:true,pauseResume:true,forwardSeekNoStorm:true,trackChangeNoLeak:true,
 musicOffRestoresRain:true,noWaterClearing:true,noReferenceAudio:true}));
