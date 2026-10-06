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
assert.ok(counts.find(c=>c.id.startsWith('09-')).density>counts.find(c=>c.id.startsWith('15-')).density*5);
const logic=scores.get('02-fused-dj-kicks'),logicRain=new RainScheduler(logic);
const before=logicRain.events.filter(e=>e.time>=124.55&&e.time<127.617),after=logicRain.events.filter(e=>e.time>=127.617&&e.time<137.05);
assert.equal(logic.accents.find(a=>a.type==='arrival'&&a.time>124&&a.time<130).time,127.617,'Use the proven structural entrance, not its later maximum transient');
assert.ok(before.length>0,'The quiet flagship opening must contain restrained physical texture');
assert.ok(after.length>before.length*2&&after.some(e=>e.kind==='cluster')&&after.some(e=>e.kind==='accent'),'Flagship excerpt must visibly acquire structure after its arrival');
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
clock.sample(100.08,1200,true);assert.equal(clock.time(4000),100.08,'An unchanged stalled sample cannot drift');
clock.sample(180,1280,true);assert.equal(clock.discontinuity,true);assert.equal(clock.time(1280),180);
clock.sample(30,1360,true);assert.equal(clock.discontinuity,true);assert.equal(clock.time(1360),30);
clock.reset();clock.sample(1,2000,true,2);assert.equal(clock.time(2050,2),1.1);assert.equal(clock.time(20000,2),1.24,'Interpolation is bounded, never a second free-running music clock');

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
 seeksNoStorm:true,pauseNoDrift:true,sourceOffset854:true,exactVideoIdentity:true,unavailableAndPlaylistEnd:true,noBundledAudio:true,
 productionMappings:manifest.tracks.filter(t=>t.source).length,counts}));
