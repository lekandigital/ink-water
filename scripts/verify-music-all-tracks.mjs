import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {shaderSource} from '../shader-loader.mjs';

// Full production adapter/clock/engine/scheduler/Puddle handoff regression.
// The external YouTube iframe and GPU drop targets are explicitly mocked;
// this verifies event delivery, not recording identity or visible GPU output.
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const html=await readFile('index.html','utf8');
const manifest=await json('data/music/manifest.json');
const inventory=await json('data/music/analysis/youtube-playlist-inventory.json');
const scores=new Map(await Promise.all(manifest.tracks.map(async track=>[track.score,await json('data/music/'+track.score)])));
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const source=(await readFile('src/main.ts','utf8'))
 .replace('void start();','export {Puddle,WaterControls,PlaylistMusic};')
 .replace('constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){','constructor(tile:THREE.Texture,sky:THREE.CubeTexture,controls:WaterControls){if((globalThis as any).__qaSkip)return;');
const initial=parseHTML(html);
Object.assign(globalThis,{window:initial.window,document:initial.document,requestAnimationFrame:()=>0,__qaSkip:true});
const built=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()+'/src'},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'shaders',setup(builder){builder.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}]});
const {Puddle,WaterControls,PlaylistMusic}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
const sources=track=>[track.source,...(track.alternate_sources??[])].filter(Boolean);
const key=event=>`${event.time}:${event.kind}:${event.seed}`;
const report={generated_at:new Date().toISOString(),scope:'Production PlaylistMusic → PlaybackClock → MusicRainEngine → RainScheduler → Puddle.emitRain',
 input_fingerprints:{manifest_sha256:fingerprint(manifest),inventory_sha256:fingerprint(inventory),scores_sha256:Object.fromEntries([...scores].map(([path,score])=>[path,fingerprint(score)]))},
 external_iframe:'mocked YouTube API port using the checked-in native playlist identities and durations',gpu:'mocked physical drop targets; real Puddle animation and force/position methods',
 recording_identity_verified:false,live_playback_verified:false,visible_gpu_output_verified:false,poll_interval_ms:80,cached_timestamp_intervals_ms:[80,500,800],playback_rate:1,
 physical_routes:['ordinary water solver','Dreamy rain layer'],tracks:[],terminal_regressions:[],failures:[]};

function equalEvents(actual,expected,message){
 const a=actual.map(key),b=expected.map(key);
 const mismatch=a.findIndex((value,index)=>value!==b[index]);
 assert.ok(a.length===b.length&&mismatch===-1,`${message}: expected ${b.length}, received ${a.length}; first difference ${mismatch}; missing ${b.filter(value=>!a.includes(value)).slice(0,6).join(', ')}`);
}

async function harness(dreamyRain,quantum){
 const {window,document}=parseHTML(html);let now=1000,port,handle=0,idealSongTime=0;
 // Browsers index IDs. Linkedom scans the tree, which would dominate millions
 // of full-song render frames; all initial ID-bearing controls stay mounted.
 const initialIds=new Map([...document.querySelectorAll('[id]')].map(node=>[node.id,node]));
 const findId=document.getElementById.bind(document);
 document.getElementById=id=>initialIds.get(id)??findId(id);
 const timers=new Map(),deferredScores=new Map();
 const location={origin:'https://ink-water.test',search:''};
 Object.defineProperty(document,'baseURI',{value:location.origin+'/'});
 Object.defineProperty(document.getElementById('music-track'),'value',{value:'',writable:true});
 document.getElementById('stage').getBoundingClientRect=()=>({width:1440,height:900});
 class NativePort{
  index=0;time=0;duration=0;state=5;rate=1;playlist=[];moves=[];videoIdOverride=undefined;
  constructor(element,options){port=this;this.options=options;this.frame=document.createElement('iframe');element.replaceWith(this.frame);}
  cuePlaylist(options){assert.equal(options.list,manifest.playlist_id);this.playlist=inventory.entries.map(entry=>entry.video_id);}
  playVideo(){this.state=1;}pauseVideo(){this.state=2;}stopVideo(){this.state=0;}
  playVideoAt(index){this.moves.push(index);/* metadata stays stale until acknowledged */}
  seekTo(time){this.time=time;}
  getCurrentTime(){return this.time;}getDuration(){return this.duration;}getPlaylistIndex(){return this.index;}
  getVideoUrl(){return 'https://www.youtube.com/watch?v='+(this.videoIdOverride??this.playlist[this.index]);}
  getPlaylist(){return this.playlist;}getPlaybackRate(){return this.rate;}getPlayerState(){return this.state;}
  setLoop(){}setShuffle(){}getIframe(){return this.frame;}destroy(){this.frame.remove();}
 }
 Object.assign(window,{location,YT:{Player:NativePort},setTimeout:fn=>{timers.set(++handle,fn);return handle;},clearTimeout:id=>timers.delete(id),setInterval:()=>++handle,clearInterval:()=>{}});
 Object.assign(globalThis,{window,document,location,performance:{now:()=>now},fetch:async url=>{
  assert.doesNotMatch(String(url),/\.mp3/i);const path=new URL(String(url)).pathname.replace('/music/','');
  return {ok:true,json:async()=>{if(deferredScores.has(path))await deferredScores.get(path).promise;return structuredClone(path==='manifest.json'?manifest:scores.get(path));}};
 }});
 const controls=new WaterControls();controls.change({dreamyRainSpeed:dreamyRain});
 const rain=[],touch=[],events=[],arrivals=[];let latest={},clears=0,draws=0;
 const music=new PlaylistMusic({publish:data=>{latest={...latest,...data};controls.publish(data);},playbackChange:playing=>controls.setMusicPlaying(playing)});
 const puddle=new Puddle();puddle.controls=controls;puddle.state=controls.state;
 puddle.water={addDrop:(...drop)=>touch.push(drop),stepSimulation:()=>{},updateNormals:()=>{}};
 puddle.openBoundary={apply:()=>{}};puddle.waveLines={model:{addDrop:()=>{}}};
 puddle.rainLayer={advance:()=>{},addDrop:(...drop)=>rain.push(drop)};
 Object.assign(puddle,{animating:true,lastTime:0,accumulator:0,rainAccumulator:0,clearRainUntil:0,rainLayerActive:dreamyRain,
  draw:()=>{draws++;},clear:()=>{clears++;}});
 controls.onPauseChange=paused=>music.setSimulationPaused(paused);puddle.setMusicRain(music);
 const emit=puddle.emitRain.bind(puddle);
 puddle.emitRain=event=>{if(event){events.push(event);arrivals.push(idealSongTime-event.time);}emit(event);};
 const impacts=()=>dreamyRain?rain:touch;
 async function poll({advance=80,animate=true}={}){now+=advance;music.player.poll();await flush();if(animate)puddle.animate(now);}
 async function acknowledge(index,time=0,state=1){
  port.index=index;port.videoIdOverride=undefined;port.time=time;port.duration=inventory.entries[index].duration_seconds;port.state=state;idealSongTime=time;
  await poll();await poll({advance:0});
 }
 async function choose(track,state=1){
  const index=port.playlist.findIndex(video=>sources(track).some(source=>source.video_id===video));
  assert.ok(index>=0,`${track.id} has a mapped checked-in native playlist item`);
  const activeSource=sources(track).find(source=>source.video_id===port.playlist[index]);
  const before=events.length;
  await music.select(track.id,state===1);puddle.animate(now);
  assert.equal(events.length,before,'Track-change request cannot leak the old score');
  await acknowledge(index,activeSource.source_start_seconds,state);
  assert.equal(music.engine.scheduler?.score.track_id,track.id,'Acknowledged exact native video identity selects its own score');
  if(state===1){
   assert.equal(controls.state.rain,false,'Every playing native item suppresses gentle/background rain');
   assert.equal(document.getElementById('rain').checked,false,'Gentle rain checkbox matches the suppressed physical setting');
   assert.equal(document.getElementById('rain').disabled,true,'Music playback disables the gentle rain control');
  }
  return {index,activeSource};
 }
 async function seek(time){
  const before=events.length;music.seek(time);idealSongTime=time;await poll();await poll({advance:0});
  assert.equal(latest.musicSeeking,false,'Seek is acknowledged');
  assert.equal(events.length,before,'Seek never drains skipped events into the solver');
  assert.ok(Math.abs(music.currentTime()-time)<.001,'Seek rebases to the requested song time');
 }
 async function run(start,duration,playing=true,{nativeEndBeforeFinalRender=false,terminalState=0,beforeTerminalRender}={}){
  let nextPoll=.08;const wall=now,sourceStart=music.session.current.source?.source_start_seconds??0;
  const count=events.length,physical=impacts().length,arrivalCount=arrivals.length;
  // Deliver polls independently of render frames, exactly like the production
  // 80 ms timer. Cached iframe timestamps can be much slower than either.
  for(let frame=1;frame<=Math.ceil(duration*60);frame++){
   const elapsed=Math.min(duration,frame/60);now=wall+elapsed*1000;idealSongTime=start+(playing?elapsed:0);
   if(nativeEndBeforeFinalRender&&frame===Math.ceil(duration*60)){
    // YouTube's state callback may arrive after the last audio interval but
    // before its animation frame. Those final arrivals must survive state 0.
    port.time=sourceStart+start+elapsed;port.state=terminalState;
    music.player.poll();await Promise.resolve();
    await beforeTerminalRender?.();
   }else if(elapsed+1e-8>=nextPoll){
    port.time=sourceStart+start+(playing?Math.floor((elapsed+1e-8)/quantum)*quantum:0);
    // Selection/score fetching is settled by choose()/seek(). Stable playback
    // polls are synchronous, so a microtask turn suffices for native advancement.
    music.player.poll();await Promise.resolve();nextPoll+=.08;
   }
   puddle.animate(now);
  }
  assert.equal(impacts().length-physical,events.length-count,'Every scheduled event reaches exactly one physical target');
  assert.ok(impacts().slice(physical).every(drop=>drop[2]>0&&drop[3]<0),'Every delivered event has a finite physical rain radius and downward force');
  return {events:events.slice(count),drops:impacts().slice(physical),lateness:arrivals.slice(arrivalCount),through:music.currentTime()};
 }
 await music.play();port.options.events.onReady();await flush();
 return {music,controls,puddle,port,timers,deferredScores,events,arrivals,impacts,acknowledge,choose,seek,run,poll,
  latest:()=>latest,stats:()=>({clears,draws,physical:impacts().length}),setIdeal:time=>idealSongTime=time};
}

for(const dreamyRain of [false,true])for(const quantum of [.08,.5,.8]){
 const h=await harness(dreamyRain,quantum);
 for(const id of manifest.order){
  const track=manifest.tracks.find(track=>track.id===id);
  const result={track_id:id,title:track.title,route:dreamyRain?'Dreamy rain layer':'ordinary water solver',cached_timestamp_ms:quantum*1000,duration_seconds:track.duration};
  try{
   const {index,activeSource}=await h.choose(track);
   result.video_id=activeSource.video_id;result.source_validation=activeSource.validation_status;
   const planned=h.music.engine.scheduler.events;
   result.planned_events=planned.length;result.opening_events_12_5_seconds=planned.filter(event=>event.time>0&&event.time<=12.5).length;
   if(activeSource.validation_status==='mismatch'){
    const before=h.events.length;await h.run(0,track.duration);
    assert.equal(h.events.length,before,'An explicitly mismatched recording must never release authored events');
    assert.equal(h.controls.state.rain,false,'A held but playing song still suppresses gentle/background rain');
    result.status='held_source_mismatch';result.physical_events=0;
   }else{
    assert.equal(h.latest().musicSourceMismatch,false,'Matching native metadata releases the score');
    await h.seek(0);const full=await h.run(0,track.duration);
    equalEvents(full.events,planned.filter(event=>event.time>0),'Full song emits every eligible authored event in order');
    assert.ok(full.lateness.every(late=>late>=-1e-7&&late<=.1),`Full song arrivals stay within 100 ms at ${quantum}s cached delivery; range ${Math.min(...full.lateness)}–${Math.max(...full.lateness)}`);
    result.physical_events=full.events.length;result.maximum_arrival_lateness_ms=Math.max(0,...full.lateness)*1000;
    result.first_impact_seconds=full.events[0]?.time??null;result.last_impact_seconds=full.events.at(-1)?.time??null;
    result.full_song='pass';
    // Full-score playback can have requested native advancement by now. Select
    // and acknowledge the same recording again before per-song transport checks.
    await h.choose(track);
    const windows=[0,Math.max(0,track.duration/2-2),Math.max(0,track.duration-12.5)];
    result.seek_windows=[];
    for(const start of windows){
     await h.seek(start);const duration=Math.min(4,track.duration-start-.1);
     const segment=await h.run(start,duration),expected=planned.filter(event=>event.time>start&&event.time<=segment.through);
     equalEvents(segment.events,expected,'Seek into beginning/middle/end emits all and only following events');
     await h.seek(start);const repeated=await h.run(start,duration);
     equalEvents(repeated.events,segment.events,'Backward seek repeats exact authored events');
     assert.deepEqual(repeated.drops,segment.drops,'Backward seek repeats exact physical positions, radii and forces');
     result.seek_windows.push({start_seconds:start,duration_seconds:duration,physical_events:segment.events.length,deterministic:true});
    }
    const nextEvent=planned.find(event=>event.time>track.duration/2)??planned.at(-1);
    const pauseAt=Math.max(0,(nextEvent?.time??1)-.12);
    await h.seek(pauseAt);h.controls.change({paused:true});const paused=h.events.length;
    await h.run(pauseAt,1,false);assert.equal(h.events.length,paused,'Water/music pause physically emits nothing');
    h.controls.change({paused:false});await flush();h.port.time=activeSource.source_start_seconds+pauseAt;h.port.state=1;await h.poll();await h.poll({advance:0});
    const resumed=await h.run(pauseAt,Math.min(1,track.duration-pauseAt-.02));
    equalEvents(resumed.events,planned.filter(event=>event.time>pauseAt&&event.time<=resumed.through),'Resume keeps the immediately approaching note');
    result.pause_resume='pass';result.status='pass';
    // Use the actual authored tail of every song, with the native ended
    // callback delivered before the final render (rather than after it).
    await h.choose(track);const tailStart=Math.max(0,track.duration-.25);
    await h.seek(tailStart);
    const terminal=await h.run(tailStart,track.duration-tailStart,true,{nativeEndBeforeFinalRender:true});
    equalEvents(terminal.events,planned.filter(event=>event.time>tailStart),'Native ended callback preserves every remaining authored tail event');
    result.native_end_before_render={status:'pass',start_seconds:tailStart,physical_events:terminal.events.length};
   }
   // Native end must cancel its manual-advance fallback when YouTube changes
   // the item itself, and must finish rather than wrap on the final item.
   await h.choose(track);h.port.time=activeSource.source_start_seconds+track.duration;h.port.state=0;
   const endedBefore=h.events.length,moves=h.port.moves.length;await h.poll();
   assert.equal(h.events.length,endedBefore,'A discontinuous native-ended jump cannot discharge skipped score events');
   if(index+1<h.port.playlist.length){
    await h.acknowledge(index+1,0,1);
    for(const fn of [...h.timers.values()])fn();await flush();
    assert.equal(h.port.moves.length,moves,'Native playlist advancement never double-skips');
   }else{
    for(const fn of [...h.timers.values()])fn();h.timers.clear();await flush();
    assert.equal(h.music.session.ended,true,'Final native item finishes the playlist');
    assert.equal(h.music.engine.scheduler,undefined,'Playlist completion clears future authored events');
   }
   result.native_end='pass';assert.equal(h.stats().clears,0,'All songs preserve existing water on seeks and transitions');
  }catch(error){result.status='fail';result.error=error.message;report.failures.push({track_id:id,route:result.route,cached_timestamp_ms:quantum*1000,error:error.message});}
  report.tracks.push(result);
 }
 // The real scores need not put a note in the final animation interval.
 // One clearly labelled score fixture guarantees coverage of that boundary
 // and confirms explicit transport actions can discard a queued terminal note.
 const openingTrack=manifest.tracks.find(track=>track.id===manifest.order[0]);
 const finalTrack=manifest.tracks.find(track=>sources(track).some(source=>source.video_id===inventory.entries.at(-1).video_id));
 const terminalFixture=track=>{
  const fixture=structuredClone(scores.get(track.score));
  fixture.sections.forEach(section=>{section.density=[0,0];section.background=0;});
  fixture.accents=[{time:fixture.duration-.003,type:'arrival',force:1,scale:1,count:1,spacing:0,anticipation:0,quiet:0,note:'Terminal-interval regression fixture.'}];
  fixture.gestures=[];fixture.breaths=[];return fixture;
 };
 const cancellations={seek:()=>h.music.seek(0),pause:()=>h.music.pause(),next:()=>h.music.next(),simulation_pause:()=>h.controls.change({paused:true}),close:()=>h.music.close()};
 for(const action of ['natural_state_0','natural_state_1','natural_native_advance','natural_next_identity_without_ending_sample','natural_incoherent_index_before_identity','natural_final_state_0','natural_final_state_1',...Object.keys(cancellations)]){
  const fixtureTrack=action.includes('final')?finalTrack:openingTrack,fixture=terminalFixture(fixtureTrack);
  const regression={fixture_track_id:fixtureTrack.id,route:dreamyRain?'Dreamy rain layer':'ordinary water solver',cached_timestamp_ms:quantum*1000,action,authored_fixture_events:1};
  try{
   h.controls.change({paused:false});await h.music.play();await h.choose(fixtureTrack);
   const start=fixture.duration-.25;h.music.engine.setScore(fixture,start);await h.seek(start);
   const beforeTerminalRender=action==='natural_native_advance'?async()=>{
    h.port.index++;h.port.time=0;h.port.duration=inventory.entries[h.port.index].duration_seconds;h.port.state=1;
    h.music.player.poll();await flush();
   }:action==='natural_final_state_0'?()=>{
    for(const fn of [...h.timers.values()])fn();h.timers.clear();
   }:cancellations[action];
   let terminal;
   if(action==='natural_next_identity_without_ending_sample'||action==='natural_incoherent_index_before_identity'){
    // Stop rendering one frame before the terminal note. The next coherent
    // identity is the first indication that the native playlist advanced.
    await h.run(start,14/60);const before=h.events.length,beforePhysical=h.impacts().length,nextIndex=h.port.index+1;
    if(action==='natural_incoherent_index_before_identity'){
     const moves=h.port.moves.length,oldVideo=h.port.playlist[h.port.index];
     h.port.index=nextIndex;h.port.videoIdOverride=oldVideo;h.port.time=fixture.duration;h.port.state=1;
     await h.poll({advance:80,animate:false});
     assert.equal(h.port.moves.length,moves,'An advanced native index paired with stale video identity cannot skip the next song');
     assert.equal(h.music.session.current.id,fixtureTrack.id,'An incoherent identity/index sample holds the old score until coherent acknowledgement');
     regression.metadata_ordering='new index → stale old identity/end → coherent new identity';
    }else regression.metadata_ordering='coherent new identity, without an old-video ended sample';
    await h.acknowledge(nextIndex,0,1);terminal={events:h.events.slice(before)};
    assert.equal(h.impacts().length-beforePhysical,terminal.events.length,'A terminal cue preserved across asynchronous native metadata reaches exactly one physical target');
   }else terminal=await h.run(start,.25,true,{nativeEndBeforeFinalRender:true,terminalState:action.endsWith('state_1')?1:0,beforeTerminalRender});
   assert.equal(terminal.events.length,action.startsWith('natural')?1:0,'Only natural ending preserves the final queued interval; explicit transport actions cancel it');
   if(action.includes('final'))assert.equal(h.music.session.ended,true,'The final native playlist item finishes while preserving its terminal note');
   const before=h.events.length;h.puddle.animate(100+performance.now());
   assert.equal(h.events.length,before,'A terminal interval is delivered at most once');
   regression.status='pass';regression.physical_events=terminal.events.length;
  }catch(error){regression.status='fail';regression.error=error.message;report.failures.push(regression);}
  report.terminal_regressions.push(regression);
 }
 h.music.close();
 console.log(JSON.stringify({route:dreamyRain?'Dreamy':'ordinary',cached_timestamp_ms:quantum*1000,finished_tracks:manifest.order.length,failures:report.failures.length}));
}
report.summary={unique_tracks:manifest.order.length,full_timeline_cases:report.tracks.filter(track=>track.full_song==='pass').length,
 native_end_before_render_cases:report.tracks.filter(track=>track.native_end_before_render?.status==='pass').length,
 native_end_before_render_events:report.tracks.reduce((sum,track)=>sum+(track.native_end_before_render?.physical_events??0),0),
 held_source_mismatch_cases:report.tracks.filter(track=>track.status==='held_source_mismatch').length,passed_cases:report.tracks.filter(track=>track.status==='pass').length,
 terminal_regression_cases:report.terminal_regressions.length,terminal_regressions_passed:report.terminal_regressions.filter(regression=>regression.status==='pass').length,
 failed_cases:report.failures.length,physical_events:report.tracks.reduce((sum,track)=>sum+(track.physical_events??0),0)};
await writeFile('docs/music-all-tracks-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
if(report.failures.length){console.error(JSON.stringify(report.failures,null,2));process.exitCode=1;}
