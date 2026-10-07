import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {createHash,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {shaderSource} from '../shader-loader.mjs';

// Exercise real full-file hash validation and the production local adapter,
// score scheduler and Puddle drop routes. Tiny harmless File fixtures replace
// private MP3 bytes; only audio decoding/playback hardware and GPU targets are
// mocked. Actual downloaded-file playback is verified separately in Chrome.
const originalManifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
const manifest=structuredClone(originalManifest);
const scores=new Map(await Promise.all(manifest.tracks.map(async track=>[track.score,JSON.parse(await readFile('data/music/'+track.score,'utf8'))])));
const files=manifest.tracks.map((track,index)=>{
 const bytes=Buffer.from('Private reference hash fixture: '+track.id);
 track.reference_sha256=createHash('sha256').update(bytes).digest('hex');
 // Deliberately unrelated filenames prove identity comes from complete bytes.
 return Object.assign(new File([bytes],`renamed-${index}.mp3`,{type:'audio/mpeg'}),{qaTrackId:track.id});
});
const html=await readFile('index.html','utf8');
const source=(await readFile('src/main.ts','utf8'))
 .replace('void start();','export {Puddle,WaterControls,PlaylistMusic};')
 .replace('constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){','constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){if((globalThis as any).__qaSkip)return;');
const initial=parseHTML(html);
Object.assign(globalThis,{window:initial.window,document:initial.document,requestAnimationFrame:()=>0,__qaSkip:true});
const built=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()+'/src'},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'shaders',setup(builder){builder.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
const {Puddle,WaterControls,PlaylistMusic}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
const key=event=>`${event.time}:${event.kind}:${event.seed}`;
const equalEvents=(actual,expected,message)=>assert.deepEqual(actual.map(key),expected.map(key),message);
const report={unique_tracks:manifest.order.length,physical_routes:2,timeupdate_intervals_ms:[80,500,800],
 actual_downloaded_files:false,audio_hardware:'mocked',hash_digest:'real WebCrypto SHA-256 over complete synthetic File bytes',
 full_timeline_cases:0,seek_cases:0,pause_resume_cases:0,buffering_cases:0,playback_rate_cases:0,physical_events:0,terminal_cases:0,
 youtube_unavailable_handoff_cases:0,queued_native_end_cancellation_cases:0,replay_after_completion_cases:0,deferred_score_pause_cases:0,
 deferred_library_pause_cases:0,deferred_library_play_cases:0,deferred_library_latest_load_cases:0,deferred_library_close_cases:0,hash_validation_cases:0,failures:[]};
const asynchronousFailure=error=>{const message=error instanceof Error?error.name+': '+error.message:String(error);report.failures.push({fixture:'asynchronous runtime',error:message});console.error(message);process.exitCode=1;};
process.on('unhandledRejection',asynchronousFailure);process.on('uncaughtException',asynchronousFailure);

function deferFirstFileRead(){
 const delayed=new File([Buffer.from('Private reference hash fixture: '+manifest.tracks[0].id)],'delayed-private-file.mp3',{type:'audio/mpeg'});
 delayed.qaTrackId=manifest.tracks[0].id;
 let release,entered;const gate=new Promise(resolve=>{release=resolve;}),readStarted=new Promise(resolve=>{entered=resolve;});
 // Delay the real File read, before WebCrypto hashes any byte. This exercises
 // the library chooser itself rather than the separate score/metadata races.
 Object.defineProperty(delayed,'arrayBuffer',{value:async()=>{entered();await gate;return File.prototype.arrayBuffer.call(delayed);}});
 return {files:[delayed,...files.slice(1)],readStarted,release};
}

async function harness(dreamyRain,timeupdateInterval){
 const {window,document}=parseHTML(html);let now=1000,audio,blobSequence=0,latest={},backgroundDrops=0;
 const ids=new Map([...document.querySelectorAll('[id]')].map(node=>[node.id,node]));
 const findId=document.getElementById.bind(document);document.getElementById=id=>ids.get(id)??findId(id);
 const blobs=new Map(),revoked=[],deferredScores=new Map();
 Object.defineProperty(URL,'createObjectURL',{configurable:true,value:file=>{const url='blob:ink-water-local-qa/'+(++blobSequence);blobs.set(url,file);return url;}});
 Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:url=>{revoked.push(url);blobs.delete(url);}});
 class AudioPort extends EventTarget{
  _src='';_time=0;duration=NaN;paused=true;ended=false;seeking=false;playbackRate=1;error=null;readyState=0;preload='';pauseCalls=0;
  constructor(){super();audio=this;}
  get src(){return this._src;}
  set src(value){this._src=value;this._time=0;this.ended=false;this.readyState=0;const file=blobs.get(value);this.duration=file?manifest.tracks.find(track=>track.id===file.qaTrackId).duration:NaN;}
  get currentSrc(){return this._src;}
  get currentTime(){return this._time;}
  set currentTime(value){this._time=value;this.ended=false;this.seeking=true;this.dispatchEvent(new Event('seeking'));queueMicrotask(()=>{this.seeking=false;this.dispatchEvent(new Event('seeked'));});}
  load(){const src=this._src;queueMicrotask(()=>{if(this._src!==src)return;this.readyState=1;this.dispatchEvent(new Event('loadedmetadata'));});}
  async play(){this.paused=false;this.ended=false;this.readyState=4;this.dispatchEvent(new Event('playing'));}
  pause(){this.pauseCalls++;if(this.paused)return;this.paused=true;this.dispatchEvent(new Event('pause'));}
  removeAttribute(name){if(name==='src'){this._src='';this._time=0;this.duration=NaN;this.readyState=0;}}
  tick(time,emit=false){this._time=time;if(emit)this.dispatchEvent(new Event('timeupdate'));}
  finish(){this._time=this.duration;this.ended=true;this.paused=true;this.dispatchEvent(new Event('ended'));}
 }
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
 Object.assign(globalThis,{window,document,location:{origin:'https://ink-water.test',search:''},Audio:AudioPort,performance:{now:()=>now},fetch:async url=>{
  const path=new URL(String(url)).pathname.replace('/music/','');assert.doesNotMatch(String(url),/\.mp3|youtube|googlevideo/i,'Private reference audio never uses network fetch');
  assert.ok(path==='manifest.json'||scores.has(path),'Only public manifest and score JSON are fetched');
  return {ok:true,json:async()=>{const gate=deferredScores.get(path);if(gate)await gate.promise;return structuredClone(path==='manifest.json'?manifest:scores.get(path));}};
 }});
 Object.defineProperty(document,'baseURI',{value:'https://ink-water.test/'});
 Object.defineProperty(document.getElementById('music-track'),'value',{value:'',writable:true});
 document.getElementById('stage').getBoundingClientRect=()=>({width:1440,height:900});
 const controls=new WaterControls();controls.change({dreamyRainSpeed:dreamyRain});
 const physical=[],events=[],water=[],rain=[];
 const music=new PlaylistMusic({publish:data=>{latest={...latest,...data};controls.publish(data);},playbackChange:playing=>controls.setMusicPlaying(playing)});
 const puddle=new Puddle();puddle.controls=controls;puddle.state=controls.state;
 puddle.water={addDrop:(...drop)=>water.push(drop),stepSimulation:()=>{},updateNormals:()=>{}};
 puddle.openBoundary={apply:()=>{}};puddle.waveLines={model:{addDrop:()=>{}}};puddle.rainLayer={advance:()=>{},addDrop:(...drop)=>rain.push(drop)};
 Object.assign(puddle,{animating:true,lastTime:0,accumulator:0,rainAccumulator:0,clearRainUntil:0,rainLayerActive:dreamyRain,draw:()=>{},clear:()=>{assert.fail('Local music transport must never clear the water');}});
 controls.onPauseChange=paused=>music.setSimulationPaused(paused);puddle.setMusicRain(music);
 const target=()=>dreamyRain?rain:water,emit=puddle.emitRain.bind(puddle);
 puddle.emitRain=event=>{
  const before=target().length;emit(event);
  if(event){events.push(event);assert.equal(target().length-before,1,'Each local musical cue reaches exactly one physical target');physical.push(target().at(-1));}
  else backgroundDrops++;
 };
 await music.open();await music.useDownloadedFiles(files);await flush();
 assert.equal(latest.musicTransport,'local','All verified local files select the local transport');
 async function choose(track){
  await music.select(track.id,true);await flush();puddle.animate(now);
  assert.equal(music.local.trackId,track.id);assert.equal(music.engine.scheduler.score.track_id,track.id);
  assert.equal(controls.state.rain,false,'Playing downloaded audio suppresses gentle rain');
  assert.equal(document.getElementById('rain').checked,false);assert.equal(document.getElementById('rain').disabled,true);
 }
 async function seek(time){const count=events.length;music.seek(time);await flush();puddle.animate(now);assert.equal(events.length,count,'Local seek discards skipped cue intervals');assert.ok(Math.abs(music.currentTime()-time)<1e-7);}
 async function run(start,duration,{playing=true,endBeforeRender=false,beforeTerminalRender}={}){
  const count=events.length,dropCount=physical.length,wall=now;let nextUpdate=timeupdateInterval;
  for(let frame=1;frame<=Math.ceil(duration*60);frame++){
   const elapsed=Math.min(duration,frame/60);now=wall+elapsed*1000;
   const songTime=start+(playing?elapsed*audio.playbackRate:0);
   const update=elapsed+1e-8>=nextUpdate;if(update)nextUpdate+=timeupdateInterval;
   audio.tick(songTime,update);
   if(endBeforeRender&&frame===Math.ceil(duration*60)){audio.finish();await Promise.resolve();await beforeTerminalRender?.();}
   puddle.animate(now);
  }
  assert.equal(physical.length-dropCount,events.length-count);
  assert.ok(physical.slice(dropCount).every(drop=>Number.isFinite(drop[2])&&drop[2]>0&&Number.isFinite(drop[3])&&drop[3]<0));
  return {events:events.slice(count),drops:physical.slice(dropCount),through:music.currentTime()};
 }
 function deferScore(track){
  music.scores.delete(track.id);let resolve;const promise=new Promise(done=>{resolve=done;});deferredScores.set(track.score,{promise});
  return ()=>{deferredScores.delete(track.score);resolve();};
 }
 return {music,controls,puddle,choose,seek,run,deferScore,audio:()=>audio,events,physical,blobs,revoked,latest:()=>latest,
  background:()=>backgroundDrops,render:()=>puddle.animate(now),advance:ms=>{now+=ms;}};
}

for(const dreamyRain of [false,true])for(const timeupdateInterval of [.08,.5,.8]){
 const h=await harness(dreamyRain,timeupdateInterval),route=dreamyRain?'Dreamy rain layer':'ordinary water solver';
 for(const id of manifest.order){
  const track=manifest.tracks.find(track=>track.id===id);
  try{
   await h.choose(track);const planned=h.music.engine.scheduler.events,beforeBackground=h.background();
   await h.seek(0);const full=await h.run(0,track.duration);
   equalEvents(full.events,planned.filter(event=>event.time>0),'Every full-track local cue follows the directly read HTML audio clock');
   assert.equal(h.background(),beforeBackground,'No gentle rain mixes with playing downloaded audio');
   report.full_timeline_cases++;report.physical_events+=full.events.length;
   for(const start of [0,Math.max(0,track.duration/2-2),Math.max(0,track.duration-8)]){
    await h.seek(start);const duration=Math.min(4,track.duration-start-.1),segment=await h.run(start,duration);
    equalEvents(segment.events,planned.filter(event=>event.time>start&&event.time<=segment.through),'Local seek emits all and only following authored cues');
    await h.seek(start);const repeated=await h.run(start,duration);equalEvents(repeated.events,segment.events,'Backward local seek repeats cue timestamps');
    assert.deepEqual(repeated.drops,segment.drops,'Backward local seek repeats physical positions, radii and forces');report.seek_cases++;
   }
   const approaching=planned.find(event=>event.time>track.duration/2)??planned.at(-1),pauseAt=Math.max(0,(approaching?.time??1)-.12);
   await h.seek(pauseAt);h.controls.change({paused:true});const before=h.events.length;
   await h.run(pauseAt,1,{playing:false});assert.equal(h.events.length,before,'Pausing water/local audio emits no authored cues');
   h.controls.change({paused:false});await flush();h.render();
   const resumed=await h.run(pauseAt,Math.min(1,track.duration-pauseAt-.02));
   equalEvents(resumed.events,planned.filter(event=>event.time>pauseAt&&event.time<=resumed.through),'Local resume preserves the approaching cue');report.pause_resume_cases++;
  }catch(error){report.failures.push({track_id:id,route,timeupdate_interval_ms:timeupdateInterval*1000,error:error.message});}
 }
 const fixtureTrack=manifest.tracks.find(track=>track.id===manifest.order[0]),finalTrack=manifest.tracks.find(track=>track.id===manifest.order.at(-1));
 try{
  await h.choose(fixtureTrack);const nextId=manifest.order[1];
  h.music.session.unavailable.add(nextId);h.music.unavailableVideos.add(manifest.tracks.find(track=>track.id===nextId).source.video_id);
  await h.music.useDownloadedFiles(files);await flush();
  assert.equal(h.music.session.unavailable.size,0,'YouTube embed failures cannot mark exact downloaded recordings unavailable');
  assert.equal(h.music.unavailableVideos.size,0,'Switching to downloaded files clears obsolete YouTube video failures');
  await h.music.next(true);await flush();h.render();
  assert.equal(h.music.local.trackId,nextId,'The local playlist follows its complete authored order after a previous YouTube failure');report.youtube_unavailable_handoff_cases++;
 }catch(error){report.failures.push({fixture:'YouTube unavailable → verified local playlist',route,error:error.message});}
 // A native End may already have queued its delayed manual advancement when
 // the user switches to private files. Even an already queued callback must
 // not skip the selected local song after its native timer has been cancelled.
 {
  const setTimeout=window.setTimeout,clearTimeout=window.clearTimeout;
  let queuedEnd;const cancelled=[];const timerId=10001;
  try{
   await h.choose(fixtureTrack);
   window.setTimeout=(callback,delay)=>{assert.equal(delay,350);queuedEnd=callback;return timerId;};
   window.clearTimeout=id=>cancelled.push(id);
   h.music.scheduleEnded(fixtureTrack.id);
   assert.equal(h.music.awaitingEnd,fixtureTrack.id);assert.equal(typeof queuedEnd,'function');
   await h.music.useDownloadedFiles(files);await flush();
   assert.ok(cancelled.includes(timerId),'Switching to downloaded songs cancels the pending native End timer');
   assert.equal(h.music.awaitingEnd,undefined,'The obsolete native End identity is cleared');
   queuedEnd();await flush();h.render();
   assert.equal(h.music.session.current.id,fixtureTrack.id,'A queued native End callback cannot advance the local playlist');
   assert.equal(h.music.local.trackId,fixtureTrack.id,'The selected downloaded opening song remains playing');
   report.queued_native_end_cancellation_cases++;
  }catch(error){report.failures.push({fixture:'queued native End → verified local playlist',route,error:error.message});}
  finally{window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;}
 }
 for(const action of ['music_pause','water_pause']){
  let release;
  try{
   h.controls.change({paused:false});await h.choose(fixtureTrack);
   const target=manifest.tracks.find(track=>track.id===manifest.order[1]);release=h.deferScore(target);
   const selection=h.music.select(target.id,true);await flush();
   assert.equal(h.music.pendingTrack,target.id,'The score response remains pending when the pause arrives');
   if(action==='water_pause')h.controls.change({paused:true});else h.music.pause();
   release();release=undefined;await selection;await flush();
   assert.equal(h.music.local.trackId,target.id);assert.equal(h.music.local.playing,false,'A delayed score response cannot override a later pause');
   assert.equal(h.audio().paused,true,'The selected private audio element remains paused after its delayed score arrives');
   const before=h.events.length;await h.run(0,.5,{playing:false});assert.equal(h.events.length,before,'Completing a paused local selection releases no authored cues');
   report.deferred_score_pause_cases++;
  }catch(error){report.failures.push({fixture:'deferred score then pause',action,route,error:error.message});}
  finally{release?.();h.controls.change({paused:false});await flush();}
 }
 for(const action of ['pause','pause_then_play','newer_library','close']){
  const deferred=deferFirstFileRead();let pending;
  try{
   h.controls.change({paused:false});await h.choose(fixtureTrack);h.music.pause();
   pending=h.music.useDownloadedFiles(deferred.files);await deferred.readStarted;await flush();
   if(action==='pause'||action==='pause_then_play'){
    h.music.pause();
    if(action==='pause_then_play')await h.music.play();
    deferred.release();await pending;pending=undefined;await flush();h.render();
    const playing=action==='pause_then_play';
    assert.equal(h.music.local.trackId,fixtureTrack.id,'The verified file library selects the current authored track');
    assert.equal(h.music.local.playing,playing,'Hash completion preserves the latest explicit Pause or Play action');
    assert.equal(h.audio().paused,!playing,'Hash completion gives the audio element the latest transport intent');
    assert.equal(h.controls.state.rain,!playing,'Only playing downloaded audio suppresses the saved gentle rain preference');
    assert.equal(document.getElementById('rain').disabled,playing,'The gentle rain control follows the resulting audio transport');
    if(!playing){
     const before=h.events.length;await h.run(0,.5,{playing:false});assert.equal(h.events.length,before,'A library finishing after Pause releases no musical cues');
     report.deferred_library_pause_cases++;
    }else report.deferred_library_play_cases++;
   }else if(action==='newer_library'){
    await h.music.useDownloadedFiles(files);await flush();h.render();
    const selected=h.music.local.trackId,src=h.audio().src,status=document.getElementById('music-local-state').textContent;
    h.music.pause();
    deferred.release();await pending;pending=undefined;await flush();h.render();
    assert.equal(h.music.local.trackId,selected,'An older hash response cannot replace the latest verified library selection');
    assert.equal(h.audio().src,src,'An older hash response cannot replace or revoke the latest private audio URL');
    assert.equal(h.music.local.playing,false,'An older hash response cannot override Pause after the newer library completed');
    assert.equal(document.getElementById('music-local-state').textContent,status,'Cancellation of the older chooser leaves the latest verified library status intact');
    report.deferred_library_latest_load_cases++;
   }else{
    h.music.close();const status=document.getElementById('music-local-state').textContent;
    deferred.release();await pending;pending=undefined;await flush();h.render();
    assert.equal(h.music.active,false,'Closing music during a private file read remains closed when hashing returns');
    assert.equal(h.music.transport,'none');assert.equal(h.music.local.loaded,false,'An older file read cannot reload a library after music closes');
    assert.equal(h.blobs.size,0,'Closing during hashing leaves no private audio URLs');
    assert.equal(document.getElementById('music-local-state').textContent,status,'A cancelled file read cannot overwrite the closed file chooser status');
    report.deferred_library_close_cases++;
   }
  }catch(error){report.failures.push({fixture:'deferred full-library hashing',action,route,timeupdate_interval_ms:timeupdateInterval*1000,error:error.message});}
  finally{
   deferred.release();if(pending)await pending;
   if(!h.music.active)await h.music.open();
   await h.music.useDownloadedFiles(files);await flush();
  }
 }
 try{
  await h.choose(fixtureTrack);const planned=h.music.engine.scheduler.events;
  const start=Math.max(0,planned.find(event=>event.time>0).time-.12);await h.seek(start);
  h.audio().dispatchEvent(new Event('waiting'));const before=h.events.length,beforeBackground=h.background();
  await h.run(start,1,{playing:false});assert.equal(h.events.length,before,'Waiting for local audio holds authored cues');
  assert.equal(h.controls.state.rain,false,'Buffering local playback keeps gentle rain suppressed');
  assert.equal(h.background(),beforeBackground,'Buffering does not substitute unrelated gentle rain');
  h.audio().dispatchEvent(new Event('playing'));h.render();
  const resumed=await h.run(start,.5);equalEvents(resumed.events,planned.filter(event=>event.time>start&&event.time<=resumed.through),'Buffering resume preserves the approaching local cue');report.buffering_cases++;
  h.audio().playbackRate=2;h.audio().dispatchEvent(new Event('ratechange'));await h.seek(fixtureTrack.recommended_demo.start);
  const sped=await h.run(fixtureTrack.recommended_demo.start,2);
  equalEvents(sped.events,planned.filter(event=>event.time>fixtureTrack.recommended_demo.start&&event.time<=sped.through),'Local 2x playback follows audio.currentTime directly');report.playback_rate_cases++;
  h.audio().playbackRate=1;h.audio().dispatchEvent(new Event('ratechange'));
 }catch(error){report.failures.push({fixture:'buffering and playback rate',route,timeupdate_interval_ms:timeupdateInterval*1000,error:error.message});}
 for(const action of ['natural_next','natural_final','seek','pause','next','simulation_pause']){
  try{
   h.controls.change({paused:false});const track=action==='natural_final'?finalTrack:fixtureTrack;await h.choose(track);
   const fixture=structuredClone(scores.get(track.score));fixture.sections.forEach(section=>{section.density=[0,0];section.background=0;});fixture.breaths=[];fixture.gestures=[];
   fixture.accents=[{time:fixture.duration-.003,type:'arrival',force:1,scale:1,count:1,spacing:0,anticipation:0,quiet:0,note:'Local terminal delivery fixture.'}];
   const start=fixture.duration-.25;h.music.engine.setScore(fixture,start);await h.seek(start);
   const cancel={seek:()=>h.music.seek(0),pause:()=>h.music.pause(),next:()=>h.music.next(),simulation_pause:()=>h.controls.change({paused:true})}[action];
   const pauseCalls=h.audio().pauseCalls;
   const terminal=await h.run(start,.25,{endBeforeRender:true,beforeTerminalRender:cancel});
   assert.equal(terminal.events.length,action.startsWith('natural')?1:0,'Local natural end preserves the last interval, while explicit actions cancel queued terminal cues');
   await flush();h.render();const count=h.events.length;h.render();assert.equal(h.events.length,count,'A local terminal cue is delivered at most once');
   if(action==='natural_next')assert.equal(h.music.session.current.id,manifest.order[1],'Local ended advances to the next authored playlist item');
   if(action==='natural_final'){
    assert.equal(h.music.session.ended,true,'The final local song completes the playlist');
    assert.equal(h.audio().pauseCalls-pauseCalls,1,'An ended property that remains true during pause cannot recursively finish the playlist');
    await h.music.play();await flush();h.render();
    assert.equal(h.music.local.trackId,manifest.order[0],'Play after local playlist completion returns to the opening song');
    assert.equal(h.music.session.ended,false);assert.equal(h.music.engine.scheduler.score.track_id,manifest.order[0]);
    assert.equal(h.music.currentTime(),0,'Replaying the completed local playlist starts at zero');
    const opening=h.music.engine.scheduler.events,replayed=await h.run(0,5);
    equalEvents(replayed.events,opening.filter(event=>event.time>0&&event.time<=replayed.through),'Replaying a completed local playlist emits the opening song cues');
    report.replay_after_completion_cases++;
   }
   report.terminal_cases++;
  }catch(error){report.failures.push({fixture:'terminal',action,route,timeupdate_interval_ms:timeupdateInterval*1000,error:error.message});}
 }
 // Validate failed replacements atomically with real SHA-256 and exact set
 // matching. A prior verified library must remain selected after rejection.
 for(const [name,invalid] of [
  ['missing',files.slice(0,-1)],
  ['duplicate',[...files.slice(0,-1),files[0]]],
  ['wrong bytes',[...files.slice(0,-1),new File(['corrupted reference'],files.at(-1).name,{type:'audio/mpeg'})]],
 ]){
  try{const selected=h.music.local.trackId;await assert.rejects(h.music.local.load(invalid,manifest));assert.equal(h.music.local.loaded,true,'An invalid replacement leaves the previous verified local library intact');assert.equal(h.music.local.trackId,selected,'Failed hash validation preserves the current private recording');report.hash_validation_cases++;}
  catch(error){report.failures.push({fixture:'hash validation',name,route,error:error.message});}
 }
 h.music.close();assert.equal(h.blobs.size,0,'Stopping local playback revokes every active private blob URL');
 console.log(JSON.stringify({route,timeupdate_interval_ms:timeupdateInterval*1000,full_tracks:manifest.order.length,failures:report.failures.length}));
}
await flush();console.log(JSON.stringify({...report,failed_cases:report.failures.length}));
if(report.failures.length)process.exitCode=1;
