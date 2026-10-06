import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {createHash} from 'node:crypto';
process.on('uncaughtException',error=>{console.error(error.name+': '+error.message+'\n'+error.stack.split('\n').filter(line=>!line.includes('data:text')).slice(1,5).join('\n'));process.exitCode=1;});

const json=async file=>JSON.parse(await readFile(file,'utf8'));
const manifest=await json('data/music/manifest.json'),fixture=structuredClone(manifest);
fixture.tracks.forEach((t,i)=>{t.source={video_id:`test${String(i).padStart(7,'0')}`,source_start_seconds:t.index===21?854:0,validation_status:'verified'};});
const scores=new Map(await Promise.all(manifest.tracks.map(async t=>[t.score,await json('data/music/'+t.score)])));
const {window,document}=parseHTML(await readFile('index.html','utf8'));
let now=1000,handle=0,tone='night',toneChosen=false,latest={},requests=[];
const timers=new Map(),intervals=new Map();
const location={origin:'https://ink-water.test',search:'?music-dev=1'};
Object.assign(window,{location,YT:{},setTimeout:fn=>{timers.set(++handle,fn);return handle;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{intervals.set(++handle,fn);return handle;},clearInterval:id=>intervals.delete(id)});
Object.assign(globalThis,{window,document,location,performance:{now:()=>now},fetch:async url=>{
 requests.push(String(url));const path=new URL(String(url)).pathname.replace('/music/','');
 return {ok:true,json:async()=>structuredClone(path==='manifest.json'?fixture:scores.get(path))};
}});
Object.defineProperty(document,'baseURI',{value:'https://ink-water.test/'});
Object.defineProperty(document.getElementById('music-track'),'value',{value:'',writable:true});
const audio=document.getElementById('music-local-audio');
Object.defineProperty(audio,'src',{get(){return this.getAttribute('src')??'';},set(value){this.setAttribute('src',value);}});
Object.assign(audio,{paused:true,ended:false,seeking:false,currentTime:0,duration:0,
 pause(){this.paused=true;this.dispatchEvent(new window.Event('pause'));},
 play(){this.paused=false;this.dispatchEvent(new window.Event('play'));return Promise.resolve();},load(){}});
const ports=[];
class Port{
 constructor(element,options){this.options=options;this.calls=[];this.index=0;this.time=0;this.duration=0;this.rate=1;this.state=5;this.playlist=[];
  this.frame=document.createElement('iframe');element.replaceWith(this.frame);ports.push(this);}
 ready(){this.options.events.onReady();}
 cuePlaylist(value){assert.equal(typeof value.list,'string','Playback loads a playlist ID, never a hardcoded video list');this.calls.push(['cuePlaylist',value]);this.playlist=fixture.order.map(id=>fixture.tracks.find(t=>t.id===id).source.video_id);}
 playVideo(){this.calls.push(['play']);this.state=1;}
 pauseVideo(){this.calls.push(['pause']);this.state=2;}
 stopVideo(){this.state=0;}
 playVideoAt(index){this.calls.push(['playVideoAt',index]);/* deliberately retain old metadata until delivered */}
 seekTo(time){this.calls.push(['seek',time]);this.time=time;}
 getPlaylist(){return [...this.playlist];}getPlaylistIndex(){return this.index;}getCurrentTime(){return this.time;}getDuration(){return this.duration;}
 getVideoUrl(){return 'https://www.youtube.com/watch?v='+this.playlist[this.index];}getPlayerState(){return this.state;}getPlaybackRate(){return this.rate;}
 setLoop(value){this.calls.push(['loop',value]);}setShuffle(value){this.calls.push(['shuffle',value]);}getIframe(){return this.frame;}
 destroy(){this.calls.push(['destroy']);this.frame.remove();}
}
window.YT.Player=Port;
const {outputFiles}=await build({entryPoints:['src/music/PlaylistMusic.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {PlaylistMusic}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const music=new PlaylistMusic({tone:()=>tone,toneChosen:()=>toneChosen,setTone:value=>tone=value,publish:state=>latest={...latest,...state}});
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const poll=async(port,index,time,state=1)=>{
 port.index=index;port.time=time;port.state=state;const track=fixture.tracks.find(t=>t.source?.video_id===port.playlist[index]);
 port.duration=track?(track.source.source_start_seconds?1800:track.duration):300;
 now+=80;music.player.poll();await flush();
};
await music.open();assert.equal(tone,'night','Opening the panel alone must not alter ordinary water');assert.equal(music.enabled,false);
await music.play();const port=ports.at(-1);port.ready();await flush();
assert.deepEqual(port.calls.find(c=>c[0]==='cuePlaylist')[1],{listType:'playlist',list:'PLTab0IXtn0Nw'});
assert.equal(port.frame.title,'YouTube — Ink Water playlist');assert.equal(tone,'green-light');assert.equal(music.enabled,true);
assert.equal(latest.musicPlaylistValidation.orderMatches,true);assert.equal(latest.musicPlaylistValidation.mappingComplete,true);
const openingId=fixture.order[0];await poll(port,0,0);assert.equal(music.engine.scheduler.score.track_id,openingId);
music.updateMusicRain();const n=music.engine.scheduler.emitted;
await poll(port,0,40);assert.deepEqual(music.updateMusicRain(),[],'Native forward seek does not discharge missed drops');assert.equal(music.engine.scheduler.emitted,n);
await poll(port,0,2);assert.deepEqual(music.updateMusicRain(),[],'Native backward seek rebases');
music.pause();now+=3000;assert.deepEqual(music.updateMusicRain(),[]);await poll(port,0,2,2);assert.equal(latest.musicPlaying,false);
await music.play();await poll(port,0,2.08);music.updateMusicRain();assert.ok(music.engine.scheduler.emitted<=n+2);
await music.next();assert.equal(port.calls.at(-1)[1],1);await poll(port,0,2.16);assert.equal(music.engine.scheduler,undefined,'Late samples cannot revive the previous track');
await poll(port,1,0);assert.equal(music.engine.scheduler.score.track_id,fixture.order[1]);
document.getElementById('music-previous').click();await flush();assert.equal(port.calls.at(-1)[1],0);await poll(port,0,0);
await poll(port,2,0);assert.equal(music.engine.scheduler.score.track_id,'21-continuum-3');
assert.ok(port.calls.some(c=>c[0]==='seek'&&c[1]===854),'Native changes apply the source offset');
await poll(port,2,854);music.seek(126.11);assert.equal(port.calls.at(-1)[1],980.11);assert.equal(music.engine.scheduler.score.track_id,'21-continuum-3');
music.setSimulationPaused(true);assert.equal(port.state,2);assert.deepEqual(music.updateMusicRain(),[]);
music.setSimulationPaused(false);await flush();assert.equal(port.state,1);
await poll(port,2,854+fixture.tracks.find(t=>t.index===21).duration);assert.equal(port.calls.at(-1)[1],3,'Segment end manually advances a longer album source');
port.index=3;port.time=0;port.options.events.onError({data:100});await flush();assert.equal(port.calls.at(-1)[1],4,'Native error identity must be read even before the next polling sample');
assert.ok(latest.musicUnavailableVideos.includes(port.playlist[3]));await poll(port,4,0);
port.options.events.onAutoplayBlocked();assert.deepEqual(music.updateMusicRain(),[]);assert.match(document.getElementById('music-status').textContent,/visible YouTube/);
await poll(port,4,0);port.playlist[5]='unknown1234';await poll(port,5,30);
assert.equal(music.engine.scheduler,undefined);assert.equal(document.getElementById('music-title').textContent,'Unmapped YouTube video');
await music.next();assert.equal(port.calls.at(-1)[1],6);await poll(port,6,0);
// A changed native order selects scores by IDs, not canonical indices.
[port.playlist[6],port.playlist[7]]=[port.playlist[7],port.playlist[6]];await poll(port,7,0);
assert.equal(music.engine.scheduler.score.track_id,fixture.order[6]);assert.deepEqual(music.session.manifest.order,fixture.order);
await poll(port,31,0);await music.next();assert.equal(music.session.ended,true);assert.equal(music.engine.scheduler,undefined);
await music.play();assert.equal(port.calls.at(-1)[1],0);await poll(port,0,0);
for(const enabled of [false,true,false,true]){
 document.getElementById('music-sync').click();assert.equal(music.enabled,enabled);assert.equal(document.getElementById('music-sync').getAttribute('aria-pressed'),String(enabled));
 if(!enabled)assert.deepEqual(music.updateMusicRain(),[]);
}
tone='green-dark';toneChosen=true;music.close();assert.equal(tone,'green-dark','Closing cannot override a deliberate user tone');
assert.equal(music.enabled,false);assert.equal(intervals.size,0);assert.ok(port.calls.some(c=>c[0]==='destroy'));
assert.equal(document.getElementById('music-panel').hidden,true);assert.equal(document.querySelector('iframe'),null,'Off/hidden mode never leaves playing YouTube offscreen');
toneChosen=false;tone='night';await music.open();await music.play();const again=ports.at(-1);again.ready();await flush();music.close();assert.equal(tone,'night','Leaving an automatic music palette restores ordinary appearance');
tone='silver';toneChosen=true;await music.open();await music.play();assert.equal(tone,'silver');music.close();
// Missing supplied mappings hold synchronization rather than guessing by order.
fixture.tracks.forEach(t=>t.source=null);toneChosen=false;await music.open();music.manifestLoading=undefined;music.session=undefined;
await music.assets();await music.play();const absent=ports.at(-1);
absent.cuePlaylist=function(value){this.calls.push(['cuePlaylist',value]);this.playlist=['lipZU8lu07M'];};absent.ready();await flush();await poll(absent,0,30);
assert.equal(music.engine.scheduler,undefined);assert.equal(latest.musicPlaylistValidation.mappingComplete,false);music.close();
// Browser-file selection is tested with disposable local fixtures, no media
// transfer, external upload or copyrighted reference asset required by CI.
const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,revoked=[];
URL.createObjectURL=()=>`blob:local-fixture`;URL.revokeObjectURL=url=>revoked.push(url);
const bytes=new TextEncoder().encode('disposable reference fixture');
const localTrack=fixture.tracks.find(t=>t.index===2);localTrack.reference_sha256=createHash('sha256').update(bytes).digest('hex');
const file={name:'02 - fused (DJ-Kicks).mp3',arrayBuffer:async()=>bytes.buffer};
Object.defineProperty(document.getElementById('music-local-files'),'files',{value:[file],writable:true});
await music.open();music.manifestLoading=undefined;music.session=undefined;await music.assets();
await music.importLocalFiles();assert.equal(music.transport,'local');assert.equal(document.querySelector('iframe'),null);
await music.select(localTrack.id,false);await flush();audio.duration=localTrack.duration;audio.dispatchEvent(new window.Event('loadedmetadata'));
assert.equal(music.engine.scheduler.score.track_id,localTrack.id);assert.equal(audio.src,'blob:local-fixture');
await music.play();music.updateMusicRain();audio.currentTime=124.55;audio.dispatchEvent(new window.Event('seeking'));
assert.deepEqual(music.updateMusicRain(),[],'Local seek uses the audio master clock with no replay storm');
music.pause();const localCount=music.engine.scheduler.emitted;now+=4000;assert.deepEqual(music.updateMusicRain(),[]);
await music.play();music.updateMusicRain();audio.currentTime+=.1;music.updateMusicRain();assert.ok(music.engine.scheduler.emitted<=localCount+2);
music.seek(40);assert.equal(audio.currentTime,40);music.seek(120);assert.equal(audio.currentTime,120);
await music.select('21-continuum-3',false);await flush();assert.equal(audio.src,'','A missing local file must detach the previous recording');
await music.play();assert.equal(audio.paused,true,'A missing local recording cannot play the previous song under a different score');
await music.select(localTrack.id,false);await flush();
document.getElementById('music-local-files').files=[{...file,arrayBuffer:async()=>new TextEncoder().encode('wrong recording').buffer}];
await music.importLocalFiles();assert.match(document.getElementById('music-status').textContent,/not the analyzed reference MP3/);
assert.equal(audio.src,'blob:local-fixture','Rejected imports leave the existing reference selection intact');
music.close();assert.equal(audio.paused,true);URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
// The development reference/capture clock uses the exact same score owner.
const capture=new PlaylistMusic({tone:()=>tone,toneChosen:()=>true,setTone:value=>tone=value,publish:()=>{}},true);
await window.inkWaterMusicCapture.select('02-fused-dj-kicks',124.55);
assert.equal(capture.engine.scheduler.score.track_id,'02-fused-dj-kicks');assert.equal(capture.enabled,true);
capture.updateMusicRain();now+=100;capture.updateMusicRain();const fixed=window.inkWaterMusicCapture.state();
assert.equal(fixed.seed,scores.get('scores/02-fused-dj-kicks.json').seed);assert.ok(Math.abs(fixed.time-124.65)<1e-9);
window.inkWaterMusicCapture.pause();now+=10000;assert.equal(window.inkWaterMusicCapture.state().time,fixed.time);
window.inkWaterMusicCapture.seek(35);assert.equal(window.inkWaterMusicCapture.state().time,35);capture.close();
assert.ok(requests.every(url=>!url.endsWith('.mp3')));
console.log(JSON.stringify({nativePlaylistOnly:true,visiblePlayer:true,idMatching:true,sourceOffsets:true,lateSamplesDiscarded:true,trackChanges:true,
 nativeOrderPreserved:true,pauseResume:true,seeksNoStorm:true,unavailableSkipped:true,autoplayHandled:true,playlistEnd:true,musicOffDestroysEmbed:true,
 syncSwitchCycle:true,deliberateTonesPreserved:true,missingMapHoldsRain:true,captureClockDeterministic:true,referenceAudioNeverFetched:true,
 localHashesValidated:true,localAudioMasterClock:true,localSeeksAndPause:true,missingLocalFilesDetachPreviousAudio:true}));
