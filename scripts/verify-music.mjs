import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

const {outputFiles}=await build({stdin:{contents:`export * from './music/MusicScore';export * from './music/RainScheduler';export * from './music/MusicRainEngine';export * from './music/PlaybackClock';export * from './music/PlaylistSession';`,loader:'ts',resolveDir:process.cwd()+'/src'},bundle:true,platform:'node',format:'esm',write:false});
const {RainScheduler,MusicRainEngine,PlaybackClock,PlaylistSession,validateScore,validateManifest,validatePlaylist,parsePlaylistId}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const manifest=await json('data/music/manifest.json'),authored=await json('data/music/source/ink-water-32-track-choreography.json');
validateManifest(manifest);
assert.equal(manifest.playlist_id,'PLTab0IXtn0Nw');
assert.deepEqual(manifest.order.map(id=>manifest.tracks.find(t=>t.id===id).index),authored.playlist_order_indices);
assert.equal(manifest.preferred_tone,'green-light');
const counts=[],scores=new Map();
for(const track of manifest.tracks){
 const score=await json('data/music/'+track.score),analysis=await json('data/music/'+track.analysis),direction=authored.tracks.find(t=>t.index===track.index);
 validateScore(score);scores.set(track.id,score);
 assert.equal(score.track_id,track.id);assert.equal(score.seed>>>0,score.seed);assert.equal(score.duration,track.duration);
 assert.equal(score.direction,direction.choreography_notes);assert.equal(score.style,direction.choreography_style);
 assert.deepEqual(score.recommended_demo,direction.recommended_highlight);assert.deepEqual(score.alternate_demo,direction.alternate_highlight);
 assert.equal(analysis.reference.sha256,track.reference_sha256);assert.ok(Math.abs(analysis.reference.duration_seconds-direction.duration_seconds)<.001);
 assert.ok(analysis.timeline.length>track.duration,'Full-track continuous measurements are preserved');
 const measuredPattern=score.accents.filter(a=>a.note.startsWith('Measured pattern:')),onsetTimes=new Set(analysis.onsets.map(o=>o.time));
 assert.ok(measuredPattern.length>0,'Every song has recurring authored musical patterns');
 assert.ok(measuredPattern.every(a=>onsetTimes.has(a.time)),'Every new pattern entrance follows an exact measured note, chord or paired answer');
 assert.ok(measuredPattern.every(a=>!score.breaths.some(b=>b.amount===0&&a.time>=b.start&&a.time<b.end)),'Additional choreography preserves authored silence and final fades');
 const first=new RainScheduler(score),second=new RainScheduler(structuredClone(score));
 assert.deepEqual(first.events,second.events,'Every event, position, force, scale and physical seed must reproduce');
 assert.ok(first.events.length>4&&first.events.every(e=>Number.isFinite(e.time)&&e.time<score.duration&&e.position.every(v=>Math.abs(v)<=.88)&&e.force>0&&e.force<1.8&&e.scale>.2&&e.scale<1.8));
 const excerpt=first.events.filter(e=>e.time>=score.recommended_demo.start&&e.time<score.recommended_demo.end);
 counts.push({id:track.id,count:first.events.length,highlight:excerpt.length,density:first.events.length/score.duration,
  signature:createHash('sha256').update(JSON.stringify(first.events)).digest('hex').slice(0,16)});
 const collect=fps=>{const scheduler=new RainScheduler(score);scheduler.seek(score.recommended_demo.start);const events=[];
  for(let i=1;i<=Math.ceil((score.recommended_demo.end-score.recommended_demo.start)*fps);i++)events.push(...scheduler.updateMusicRain(Math.min(score.recommended_demo.end,score.recommended_demo.start+i/fps)));
  return events;};
 assert.deepEqual(collect(30),collect(60));assert.deepEqual(collect(60),collect(120),'Capture and display cadence must not change the score');
 const scheduler=new RainScheduler(score),start=score.recommended_demo.start;
 scheduler.seek(start);assert.deepEqual(scheduler.updateMusicRain(start),[]);
 scheduler.seek(score.duration*.75);assert.deepEqual(scheduler.updateMusicRain(score.duration*.75),[],'Forward seek discards missed events');
 scheduler.seek(start);assert.deepEqual(scheduler.updateMusicRain(start+.4),first.events.filter(e=>e.time>start&&e.time<=start+.4),'Backward seek makes future events eligible again');
 assert.deepEqual(scheduler.updateMusicRain(score.duration*.9),[],'Unannounced seek cannot replay a backlog');
}
assert.equal(new Set(counts.map(c=>c.signature)).size,32,'No song shares a generic drop program');
const openingSong=new RainScheduler(scores.get('15-190304-05'));
assert.ok(openingSong.events.filter(event=>event.time<60).length>=70,'The first cinematic song has frequent discernible choreography throughout its first minute');
assert.ok(openingSong.events.length>=140,'The first cinematic song retains frequent choreography beyond its opening');
assert.ok(counts.find(c=>c.id.startsWith('09-')).density>counts.find(c=>c.id.startsWith('15-')).density,'The electronic and intimate scores retain distinct song-specific activity');
const logic=scores.get('02-fused-dj-kicks'),logicRain=new RainScheduler(logic);
const before=logicRain.events.filter(e=>e.time>=124.55&&e.time<127.617),after=logicRain.events.filter(e=>e.time>=127.617&&e.time<137.05);
assert.ok(before.length+after.length>=45,'The flagship highlight retains the requested frequent authored choreography');
assert.equal(logic.accents.find(a=>a.type==='arrival'&&a.time>124&&a.time<130).time,127.617,'Use the proven structural entrance, not its later maximum transient');
assert.deepEqual(logicRain.events.find(e=>e.kind==='accent'&&e.time===127.617),{
 time:127.617,force:1.08,scale:1.18,position:[-0.489422087306414,0.13335399364491024],seed:3414604112,kind:'accent'
},'Additional measured choreography preserves the approved primary arrival timing, position, weight and seed');
assert.ok(before.length>0,'The quiet flagship opening must contain restrained physical texture');
assert.ok(after.length>before.length*2&&after.some(e=>e.kind==='accent'),'Flagship excerpt must visibly acquire structure after its arrival');
const logicPattern=logic.accents.filter(a=>a.time>=127.617&&a.time<137.05&&a.note.startsWith('Measured pattern:'));
assert.ok(logicPattern.some(answer=>answer.type==='glint'&&logicPattern.some(principal=>principal.type==='phrase'&&
 principal.note.split(';')[0]===answer.note.split(';')[0]&&answer.time>principal.time&&answer.time-principal.time<.4&&answer.force<principal.force)),
 'The denser flagship uses measured lighter pair answers after its arrival, rather than depending on chance weather clusters');
assert.ok(after.length/(137.05-127.617)>before.length/(127.617-124.55),'The structural arrival increases impact frequency per second, not just the length of the tested passage');
const engine=new MusicRainEngine();engine.setScore(logic,124.55);
engine.updateMusicRain({trackId:logic.track_id,time:124.55,playing:true});
assert.deepEqual(engine.updateMusicRain({trackId:logic.track_id,time:126,playing:false}),[]);
assert.deepEqual(engine.updateMusicRain({trackId:logic.track_id,time:126,playing:true}),[],'Resume rebases to the master clock');
assert.deepEqual(engine.updateMusicRain({trackId:logic.track_id,time:160,playing:true,seeking:true}),[]);
assert.deepEqual(engine.updateMusicRain({trackId:logic.track_id,time:160,playing:true}),[]);
engine.setScore(scores.get('03-sun-tickles'));assert.deepEqual(engine.updateMusicRain({trackId:logic.track_id,time:160,playing:true}),[],'No pending events leak from the previous track');
engine.clearScore();assert.deepEqual(engine.updateMusicRain({trackId:logic.track_id,time:1,playing:true}),[]);
const clock=new PlaybackClock();clock.sample(100,1000,true);assert.equal(clock.time(1050),100.05);
clock.sample(100.08,1080,true);assert.equal(clock.time(1120),100.12);
clock.sample(100.08,1160,false);assert.equal(clock.time(9000),100.08,'Pause cannot drift');
clock.sample(100.08,1200,true);clock.sample(100.08,1280,true);
assert.equal(clock.time(1320),100.2,'Repeated playing metadata retains the last progress anchor');
assert.equal(clock.time(4000),100.98,'A player stuck in playing state can extrapolate only within finite grace');
clock.sample(180,1280,true);assert.equal(clock.discontinuity,true);assert.equal(clock.time(1280),180);
clock.sample(30,1360,true);assert.equal(clock.discontinuity,true);assert.equal(clock.time(1360),30);
clock.reset();clock.sample(1,2000,true,2);assert.equal(clock.time(2050,2),1.1);assert.equal(clock.time(20000,2),2.8,'Interpolation is bounded, never a second free-running music clock');

// The iframe's cached clock can repeat several times before advancing.
// Cached delivery must preserve event timing as well as totals. A second
// scheduler jump guard must not silently discard valid advances at faster rates.
const cachedClockChecks=[];
for(const [quantum,rate] of [[.08,1],[.25,1],[.4,1],[.5,1],[.64,1],[.8,1],[.4,2],[.5,2],[.8,2]]){
 const sampled=new PlaybackClock(),rain=new MusicRainEngine(),emitted=[],latencies=[];
 const start=124.55,end=137.05;let nextPoll=0,discontinuities=0;
 sampled.reset(start,1000);rain.setScore(logic,start);
 // Let the last cached measurement arrive before comparing the complete cut.
 for(let frame=0;frame<=Math.ceil((12.5/rate+quantum+.16)*60);frame++){
  const elapsed=frame/60,now=1000+elapsed*1000;
  if(elapsed+1e-8>=nextPoll){
   sampled.sample(start+Math.floor((elapsed+1e-8)/quantum)*quantum*rate,now,true,rate);
   if(sampled.discontinuity){rain.seek(sampled.time(now,rate));discontinuities++;}
   nextPoll+=.08;
  }
  const drops=rain.updateMusicRain({trackId:logic.track_id,time:sampled.time(now,rate),playing:true});
  emitted.push(...drops);latencies.push(...drops.map(e=>({time:e.time,late:start+elapsed*rate-e.time})));
 }
 assert.equal(discontinuities,0,`Ordinary cached delivery is not a seek: ${quantum}s at ${rate}×`);
 assert.equal(rain.scheduler.discontinuities,0,'Continuous interpolation cannot trigger the scheduler jump guard');
 assert.deepEqual(emitted.filter(e=>e.time<=end),logicRain.events.filter(e=>e.time>start&&e.time<=end),`Every authored event survives cached delivery: ${quantum}s at ${rate}×`);
 const arrival=latencies.find(e=>e.time===127.617);
 assert.ok(arrival&&arrival.late<=.1*rate,'The flagship arrival must not wait for the next cached metadata burst');
 assert.ok(latencies.every(e=>e.late<=.1*rate),'All physical events stay within one metadata poll of the audible clock');
 cachedClockChecks.push({seconds:quantum,rate,arrivalLatenessSeconds:arrival.late,maximumLatenessSeconds:Math.max(...latencies.map(e=>e.late))});
}

// Native rate callbacks can precede the next advancing metadata sample. Each
// boundary preserves elapsed music at the old rate and applies the new rate
// only to future wall time, including the next mixed-rate source measurement.
const cachedRateChanges=[];
for(const [from,to] of [[1,2],[2,1]]){
 const sampled=new PlaybackClock(),rain=new MusicRainEngine(),emitted=[],latencies=[];
 const start=126.2,change=.65,quantum=.8,songAt=t=>start+Math.min(t,change)*from+Math.max(0,t-change)*to;
 let nextPoll=0,rate=from,changed=false,raw=start;
 sampled.reset(start,1000);rain.setScore(logic,start);
 for(let frame=0;frame<=360;frame++){
  const elapsed=frame/60,now=1000+elapsed*1000;
  if(!changed&&elapsed>=change){
   const before=sampled.time(now,rate);rate=to;changed=true;sampled.sample(raw,now,true,rate);
   assert.equal(sampled.time(now,rate),before,'A cached rate callback cannot jump or rewind score time');
  }
  if(elapsed+1e-8>=nextPoll){
   raw=songAt(Math.floor((elapsed+1e-8)/quantum)*quantum);sampled.sample(raw,now,true,rate);
   assert.equal(sampled.discontinuity,false,'Mixed-rate progress is not a native seek');nextPoll+=.08;
  }
  const drops=rain.updateMusicRain({trackId:logic.track_id,time:sampled.time(now,rate),playing:true});
  emitted.push(...drops);latencies.push(...drops.map(e=>({time:e.time,late:songAt(elapsed)-e.time})));
 }
 const through=sampled.time(7000,rate),arrival=latencies.find(e=>e.time===127.617);
 assert.equal(rain.scheduler.discontinuities,0,'A rate callback cannot skip events through the scheduler jump guard');
 assert.deepEqual(emitted,logicRain.events.filter(e=>e.time>start&&e.time<=through),'Rate changes preserve every eligible physical event');
 assert.ok(arrival&&arrival.late>=-1e-7&&arrival.late<=.1*Math.max(from,to),'A cached slowdown cannot freeze the approaching musical arrival');
 assert.ok(latencies.every(e=>e.late>=-1e-7&&e.late<=.1*Math.max(from,to)),'Rate changes preserve physical event timing');
 cachedRateChanges.push({from,to,arrivalLatenessSeconds:arrival.late,impacts:emitted.length});
}

// Rate callbacks are not evidence of source progress. Repeated changes while
// a source is stalled must consume, rather than renew, its existing grace.
{
 const sampled=new PlaybackClock();sampled.sample(100,1000,true,1);
 sampled.sample(100,1640,true,2);assert.equal(sampled.time(1640),100.64);
 assert.ok(Math.abs(sampled.time(1720)-100.8)<1e-9,'A cached speedup starts at its wall boundary');
 sampled.sample(100,1800,true,1);const bound=sampled.time(1900);
 assert.ok(Math.abs(bound-101.06)<1e-9,'Mixed-rate interpolation uses only the original 900ms grace');
 for(let now=2000;now<=9000;now+=80){sampled.sample(100,now,true,now%160?1:2);assert.equal(sampled.time(now),bound,'Repeated rate changes cannot extend a stalled clock');}
 sampled.sample(100,9080,false,1);assert.equal(sampled.time(20000),100,'Buffering clears projected progress after rate changes');
}

// If the player never announces buffering, repeated playing metadata gets a
// bounded grace period, never indefinite phantom rainfall or a reconnect storm.
{
 const sampled=new PlaybackClock(),rain=new MusicRainEngine();sampled.reset(124.55,1000);rain.setScore(logic,124.55);
 for(let frame=0;frame<240;frame++){
  const now=1000+frame*1000/60;sampled.sample(124.55,now,true);
  rain.updateMusicRain({trackId:logic.track_id,time:sampled.time(now),playing:true});
 }
 assert.equal(sampled.time(9000),125.45,'An unannounced stall stops at the interpolation bound');
 const stopped=rain.scheduler.emitted;
 sampled.sample(124.55,9000,true);assert.deepEqual(rain.updateMusicRain({trackId:logic.track_id,time:sampled.time(9000),playing:true}),[]);
 assert.equal(rain.scheduler.emitted,stopped,'A stalled clock cannot keep generating rain');
 sampled.sample(140,9080,true);assert.equal(sampled.discontinuity,true,'Reconnection is a discontinuity, not a delayed rain backlog');
 rain.seek(sampled.time(9080));assert.deepEqual(rain.updateMusicRain({trackId:logic.track_id,time:sampled.time(9080),playing:true}),[]);
 sampled.sample(140.08,9160,false);assert.equal(sampled.time(20000),140.08,'Pause/buffering stops immediately without interpolation grace');
 assert.deepEqual(rain.updateMusicRain({trackId:logic.track_id,time:sampled.time(20000),playing:false}),[]);
 sampled.sample(140.08,20000,true);assert.equal(sampled.time(20000),140.08,'Resume starts from the fresh player sample');
 assert.deepEqual(rain.updateMusicRain({trackId:logic.track_id,time:sampled.time(20000),playing:true}),[],'Resume cannot release paused events');
 sampled.sample(140.48,20080,true);assert.equal(sampled.discontinuity,true,'A small genuine native seek still exceeds normal wall-clock progress');
 sampled.sample(140.4,20160,true);assert.equal(sampled.discontinuity,true,'A native backward seek still rebases');
}

// Explicit source fixtures exercise mapping semantics without guessing absent
// production mappings. A separate release check requires the supplied map.
const mapped=structuredClone(manifest);
mapped.tracks.forEach((t,i)=>{t.source={video_id:`test${String(i).padStart(7,'0')}`,source_start_seconds:0,validation_status:'verified'};});
validateManifest(mapped,true);const session=new PlaylistSession(mapped);
const native=session.tracks.map(t=>t.source.video_id);
assert.equal(validatePlaylist(mapped,native).orderMatches,true);
const swapped=[...native];[swapped[0],swapped[3]]=[swapped[3],swapped[0]];
const differences=validatePlaylist(mapped,swapped);assert.equal(differences.orderMatches,false);assert.equal(differences.orderDifferences.length,2);
assert.deepEqual(session.manifest.order,manifest.order,'YouTube order cannot rewrite the choreography');
assert.equal(session.identify(swapped[0],0).id,session.tracks[3].id,'Identity follows exact video IDs even if order differs');
const invalid=[...native.slice(1),'bad00000000',native[2]],report=validatePlaylist(mapped,invalid);
assert.ok(report.missing.includes(session.tracks[0].id)&&report.unknown.includes('bad00000000')&&report.duplicate.includes(native[2]));
const continuum=session.tracks.find(t=>t.index===21);continuum.source.source_start_seconds=854;session.select(session.tracks.indexOf(continuum));
assert.equal(session.time(980.11),126.11000000000001);assert.equal(session.seekSourceTime(126.11),980.11);
assert.equal(session.atEnd(854+continuum.duration-.01),false);assert.equal(session.atEnd(854+continuum.duration),true);
assert.equal(session.durationMismatch(3600),false,'A longer album source is valid only for its explicit track interval');
continuum.source.source_end_seconds=854+continuum.duration;assert.equal(session.durationMismatch(854+continuum.duration-4),true);
session.select(0);assert.equal(session.durationMismatch(session.current.duration+10),true);
const failed=session.current.id,following=session.markUnavailable();assert.ok(session.unavailable.has(failed)&&following.id!==failed);
session.select(31);assert.equal(session.next(),null);assert.equal(session.ended,true);assert.ok(session.previous());assert.equal(session.ended,false);
assert.equal(parsePlaylistId('https://www.youtube.com/watch?v=lipZU8lu07M&list=PLTab0IXtn0Nw'),'PLTab0IXtn0Nw');
assert.throws(()=>parsePlaylistId('https://example.org/?list=PLTab0IXtn0Nw'));assert.throws(()=>validateScore({...logic,sections:logic.sections.slice(1)}));
for(const path of ['src/music/RainScheduler.ts','src/music/MusicRainEngine.ts','src/music/PlaylistMusic.ts'])assert.doesNotMatch(await readFile(path,'utf8'),/import .*?(?:Water'|three'|shaders\/)/,'Scheduling and UI cannot deform the water');
const walk=async root=>{const files=[];for(const entry of await readdir(root,{withFileTypes:true})){const p=root+'/'+entry.name;files.push(...(entry.isDirectory()?await walk(p):[p]));}return files;};
for(const file of [...await walk('public'),...await walk('data/music')])assert.doesNotMatch(file,/\.(?:mp3|m4a|wav|ogg|aac|flac)$/i);
console.log(JSON.stringify({authoredScores:32,fullAnalysisRecords:32,cinematicOrderPreserved:true,captureCadences:[30,60,120],deterministic:true,
 cachedClockChecks,cachedRateChanges,boundedUnannouncedStall:true,bufferingStopsImmediately:true,
 seeksNoStorm:true,pauseNoDrift:true,sourceOffset854:true,exactVideoIdentity:true,unavailableAndPlaylistEnd:true,noBundledAudio:true,
 productionMappings:manifest.tracks.filter(t=>t.source).length,counts}));
