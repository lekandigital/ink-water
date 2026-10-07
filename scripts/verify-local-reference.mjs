import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {build} from 'esbuild';

// Real SHA-256 over tiny, explicitly synthetic File fixtures. Only browser
// audio decoding is substituted; no downloaded recording enters this test.
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
const fixture=structuredClone(manifest),durations=new WeakMap();
const files=fixture.tracks.map((track,i)=>{
  const bytes=new TextEncoder().encode(`private reference fixture ${i}`);
  track.reference_sha256=createHash('sha256').update(bytes).digest('hex');
  const file=new File([bytes],`unrelated-name-${31-i}.mp3`,{type:'audio/mpeg'});
  durations.set(file,track.duration);return file;
});
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
let requests=0,urlSerial=0;
const urls=new Map(),revoked=[],audios=[];
globalThis.fetch=()=>{requests++;throw new Error('Private playback must never send or fetch a recording.');};
URL.createObjectURL=file=>{const url=`blob:private-fixture/${++urlSerial}`;urls.set(url,file);return url;};
URL.revokeObjectURL=url=>{revoked.push(url);urls.delete(url);};
class AudioHardware extends EventTarget{
  src='';currentSrc='';currentTime=0;duration=NaN;paused=true;ended=false;seeking=false;playbackRate=1;
  autoMetadata=true;playCalls=0;playFailure=undefined;error=null;
  constructor(){super();audios.push(this);}
  load(){
    this.ended=false;
    if(!this.src){this.currentSrc='';this.duration=NaN;this.currentTime=0;return;}
    this.currentSrc=this.src;
    if(this.autoMetadata)queueMicrotask(()=>this.metadata(this.src));
  }
  metadata(url,duration=durations.get(urls.get(url))){
    this.currentSrc=url;this.duration=duration;this.dispatchEvent(new Event('loadedmetadata'));
  }
  async play(){
    this.playCalls++;if(this.playFailure)throw this.playFailure;
    this.paused=false;this.ended=false;this.dispatchEvent(new Event('playing'));
  }
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  removeAttribute(name){if(name==='src')this.src='';}
}
const {outputFiles}=await build({entryPoints:['src/music/LocalReferencePlayback.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {LocalReferencePlayback}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const samples=[],errors=[];
delete globalThis.Audio;
const playback=new LocalReferencePlayback(sample=>samples.push(sample),error=>errors.push(error));
assert.equal(playback.loaded,false);assert.equal(playback.time,0);assert.equal(playback.playing,false);playback.close();
assert.equal(audios.length,0,'Default YouTube use never allocates a local audio element');
globalThis.Audio=AudioHardware;
assert.deepEqual(await playback.load([...files].reverse(),fixture),fixture.order,'Only content hashes identify and order all 32 files');
assert.equal(playback.loaded,true);assert.equal(audios.length,0);assert.equal(urls.size,0,'Hash checking does not allocate audio or blob URLs');

const first=fixture.tracks[0],second=fixture.tracks[1];
assert.equal(await playback.select(first.id,true,7.125),true);
const audio=audios[0],firstUrl=audio.src;
assert.equal(audios.length,1);assert.equal(urls.size,1);assert.equal(playback.trackId,first.id);assert.equal(playback.time,7.125);assert.equal(playback.playing,true);
audio.currentTime=12.375;
assert.equal(playback.time,12.375,'The media clock is read directly even before the next timeupdate event');
audio.dispatchEvent(new Event('timeupdate'));assert.equal(samples.at(-1).time,12.375);
audio.dispatchEvent(new Event('waiting'));assert.equal(playback.playing,false);assert.equal(samples.at(-1).buffering,true);
audio.dispatchEvent(new Event('playing'));assert.equal(playback.playing,true);
audio.playbackRate=1.5;audio.dispatchEvent(new Event('ratechange'));assert.equal(samples.at(-1).rate,1.5);
playback.seek(31.25);assert.equal(audio.currentTime,31.25);assert.equal(playback.time,31.25);
playback.pause();assert.equal(playback.playing,false);assert.equal(audio.paused,true);
await playback.play();assert.equal(playback.playing,true);
const wrong=new File(['different recording'],files[0].name,{type:'audio/mpeg'});
await assert.rejects(playback.load([wrong,...files.slice(1)],fixture),/does not match/);
assert.equal(playback.loaded,true);assert.equal(playback.trackId,first.id);assert.equal(playback.playing,true);
assert.equal(audio.src,firstUrl,'Rejected replacement is atomic and preserves an existing valid selection');
await assert.rejects(playback.load([...files.slice(0,31),files[0]],fixture),/twice/);
await assert.rejects(playback.load(files.slice(1),fixture),/all 32/);
assert.equal(urls.size,1);

audio.autoMetadata=false;
const abandoned=playback.select(first.id,true,3),abandonedUrl=audio.src;
const replacement=playback.select(second.id,false,17.25),replacementUrl=audio.src;
assert.equal(await abandoned,false,'A replaced selection settles rather than waiting forever for obsolete metadata');
assert.ok(revoked.includes(abandonedUrl));
const beforeStale=samples.length;
audio.metadata(abandonedUrl,first.duration);
assert.equal(samples.length,beforeStale,'Metadata belonging to an old blob cannot identify or start the new track');
audio.metadata(replacementUrl,second.duration);
assert.equal(await replacement,true);assert.equal(playback.trackId,second.id);assert.equal(playback.time,17.25);assert.equal(playback.playing,false);
assert.equal(audios.length,1,'Track changes reuse one audio element');assert.equal(urls.size,1);

const pausedBeforeReady=playback.select(first.id,true,6),pausedUrl=audio.src,plays=audio.playCalls;
playback.pause();audio.metadata(pausedUrl,first.duration);
assert.equal(await pausedBeforeReady,true);assert.equal(audio.playCalls,plays,'Pause during metadata loading cancels requested autoplay');
const cancelled=playback.select(second.id,true,9);
playback.close();assert.equal(await cancelled,false);assert.equal(playback.loaded,false);assert.equal(audio.src,'');assert.equal(urls.size,0);
assert.equal(playback.time,0);assert.equal(playback.playing,false);

// Cancelling hashing never commits a partial set or constructs media.
let release;
const delayed=new File([await files[0].arrayBuffer()],'delayed.mp3');
delayed.arrayBuffer=()=>new Promise(resolve=>{release=resolve;});
const loading=playback.load([delayed,...files.slice(1)],fixture);
playback.close();release(await files[0].arrayBuffer());
await assert.rejects(loading,error=>error.name==='AbortError');
assert.equal(playback.loaded,false);assert.equal(urls.size,0);

await playback.load(files,fixture);
const invalidDuration=playback.select(first.id,true);
audio.metadata(audio.src,first.duration+3);
await assert.rejects(invalidDuration,/duration does not match/);
assert.equal(playback.playing,false);assert.equal(errors.at(-1).message,'The decoded recording duration does not match its reference.');
audio.autoMetadata=true;audio.playFailure=new Error('Playback was blocked.');
await assert.rejects(playback.select(second.id,true),/blocked/);
assert.equal(playback.playing,false);audio.playFailure=undefined;
await playback.play();assert.equal(playback.playing,true,'An explicit retry can recover after an autoplay rejection');
audio.currentTime=second.duration;audio.ended=true;audio.paused=true;audio.dispatchEvent(new Event('ended'));
assert.equal(samples.at(-1).event,'ended');assert.equal(samples.at(-1).time,second.duration);assert.equal(samples.at(-1).playing,false);
playback.close();assert.equal(urls.size,0);assert.equal(requests,0);assert.equal(audios.length,1);
console.log(JSON.stringify({hashVerifiedFixtures:32,filenameGuessing:false,oneLazyAudioElement:true,privateBlobPlayback:true,
  directMediaClock:true,wrongHashRejected:true,duplicateRejected:true,atomicReplacement:true,cancelledHashLoad:true,
  staleMetadataIgnored:true,pauseBeforeMetadata:true,seekPauseRateEnded:true,autoplayRetry:true,allBlobURLsRevoked:true,networkRequests:requests}));
