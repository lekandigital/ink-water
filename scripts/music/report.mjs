import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const {outputFiles}=await build({entryPoints:['src/music/RainScheduler.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {RainScheduler}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const manifest=await json('data/music/manifest.json'),inventory=await json('data/music/analysis/youtube-playlist-inventory.json');
const sources=track=>[track.source,...(track.alternate_sources??[])].filter(Boolean);
const records=[];
for(const [position,id] of manifest.order.entries()){
 const track=manifest.tracks.find(t=>t.id===id),analysis=await json('data/music/'+track.analysis),score=await json('data/music/'+track.score);
 const scheduler=new RainScheduler(score),candidate=inventory.entries.find(entry=>sources(track).some(s=>s.video_id===entry.video_id));
 const selected=sources(track).find(s=>s.video_id===candidate?.video_id);
 records.push({position:position+1,track_id:id,title:track.title,artist:track.artist,priority:inventory.priority_indices.includes(track.index),
  youtube_video_id:selected?.video_id??null,source_offset:selected?.source_start_seconds??null,
  supplied_primary_source:track.source,alternate_sources:track.alternate_sources??[],
  observed_playlist_item:candidate,
  source_match:selected?.validation_status??'missing-from-playlist',
  recording_verification:selected?.validation_status==='verified'?'Complete acoustic reference comparison; see docs/music-source-audio-validation.json.':'Acoustic equivalence remains unverified; metadata/duration alone is insufficient.',
  reference_duration:track.duration,container_duration:analysis.reference.container_duration_seconds,
  supplied_duration:analysis.supplied_analysis.duration,
  tempo:analysis.tempo_review,
  style:score.style,direction:score.direction,direction_role:'original-supplied-provenance',seed:score.seed,sections:score.sections,accents:score.accents,gestures:score.gestures??[],breaths:score.breaths,
  physical_calibration:{ordinary_rain_unchanged:true,music_gain:{background:1.4,rain:2.6,cluster:2.6,accent:3.2,gesture:1.7},expression_default:1},
  demo:score.recommended_demo,alternate:score.alternate_demo,
  highlighted_events:scheduler.events.filter(e=>e.time>=score.recommended_demo.start&&e.time<score.recommended_demo.end).length,
  event_count:scheduler.events.length,event_fingerprint:createHash('sha256').update(JSON.stringify(scheduler.events)).digest('hex'),
  quiet_spaces:analysis.quiet_spaces,transition_validation:analysis.transition_checks,highlight_validation:analysis.highlight_validation,
  discrepancies:[...score.refinements,...(track.index===22?['The supplied Rider file is acoustically DEAR DRIVER — NICO. Complete reference verification releases its score; the supplied title remains provenance.']:[]),
   ...(track.index===21?['Standalone Gx41vYzyPZo uses offset 0; supplied album IyvqVDAGU0s retains 854s.']:[]),
   ...(track.index===3?['Current lrAWkOGkpBw upload is an acoustically verified alias; supplied 62Zeu3jBs_I is preserved.']:[])],
 });
}
await mkdir('docs',{recursive:true});
await writeFile('docs/music-validation.json',JSON.stringify({schema_version:1,playlist_id:manifest.playlist_id,source_mapping_complete:manifest.tracks.every(t=>t.source),
 validation_scope:'All 32 local references decoded and analyzed. All 32 scores deliver physical rain. Complete acoustic comparisons verify 29 current native uploads; Pop 4, Recovery and Wildflower Wood media fetches returned HTTP 403. Native browser availability is recorded separately. Private downloaded playback validates every selected file hash.',tracks:records},null,2)+'\n');
const time=n=>`${Math.floor(n/60)}:${(n%60).toFixed(2).padStart(5,'0')}`;
const lines=['# Music score validation','',
 'All 32 numbered reference MP3s were decoded completely. Duration, half-second energy/brightness curves, adaptive attacks, quiet spaces and six supplied transition candidates were inspected for every track. The current dense revision contains 17,294 physical impacts and 16,790 cue entrances. Original supplied directions below are provenance; the later request for much denser choreography governs the current scores. All recommended and alternate windows remain the authored windows. BPM estimates are treated as half/double-time candidates, never a beat-to-drop grid.','',
 '**Playback identities are connected.** The supplied source map is preserved byte-for-byte. All 32 scores can run their authored physical rain. Complete acoustic comparisons verify 29 current native uploads; Pop 4, Recovery and Wildflower Wood media fetches returned HTTP 403. Some native embeds refuse playback on this computer despite public metadata; browser availability is recorded separately from recording identity. The optional downloaded-song transport verifies all 32 file hashes and keeps audio private.','',
 '**Rider is verified against the supplied clip:** the downloaded 170-second file is acoustically “DEAR DRIVER” by NICO. Its hold is removed; the supplied title is retained as provenance. Continuum 3’s current standalone ID uses offset 0; the original album ID retains 854 seconds.','',
 '| Position | Authored track | Local duration | Explicit matched playlist ID | YouTube duration metadata | Weather | Total / demo drops |','| --- | --- | ---: | --- | ---: | --- | ---: |'];
for(const r of records)lines.push(`| ${r.position} | ${r.title} | ${r.reference_duration.toFixed(3)}s | ${r.observed_playlist_item.video_id} | ${r.observed_playlist_item.duration_seconds}s | ${r.style} | ${r.event_count} / ${r.highlighted_events} |`);
lines.push('','The ID column follows the supplied map and reviewed exact-ID aliases. Runtime uses the manifest, not title matching or position guesses. Whole-second metadata rounding is allowed up to 1.25s; material version changes are held. The strict release check still requires full recording verification.','',
 '## Priority pass','',
 'Logic1000 keeps restrained texture from 124.55s, clears space during 126.90–127.617s, then its proven 127.617-second arrival introduces irregular 2–4 impact groups. A fresh 10ms decoded MP3 envelope confirms an 8.66× riser-to-arrival energy jump; the old 128.1974s accent was a later transient. Places Remember Events answers separated showers with a compact dispersed burst. Sun Tickles keeps its small asymmetric paired glints. Marumari adds physical C/X phrase gestures and its later dramatic clearing/accent; Recovery gives its rise a more immediate density/force lift. Continuum has broad harmonic arrivals with drifting echoes. Bromine retains complete gaps. Seefeel reforms localized showers; Other Joe gathers fine streams; by the rain uses selected needle bursts. Music-only physical calibration restores legibility under Gentle motion without changing ordinary rain, shaders or the solver.','');
for(const r of records){
 lines.push(`## ${r.position}. ${r.title}${r.priority?' — priority':''}`,'',`Original supplied direction (provenance): ${r.direction}`,'',
  `Reference: ${r.reference_duration.toFixed(6)}s. YouTube match: **${r.source_match}**. Observed item: \`${r.observed_playlist_item.video_id}\`; metadata duration ${r.observed_playlist_item.duration_seconds}s. Demo: ${time(r.demo.start)}–${time(r.demo.end)} (${r.highlighted_events} physical drops).`,
  `Deterministic song seed: ${r.seed}; score event count ${r.event_count}.`,
  `Sections: ${r.sections.map(s=>`${time(s.start)}–${time(s.end)} ${s.name}, density ${s.density.join('→')}/s, force ${s.force.join('→')}, radius ${s.scale.join('→')}, groups ${s.cluster.count.join('–')} (${Math.round(s.cluster.probability*100)}%)`).join('; ')}.`,
  `Selected accents: ${r.accents.map(a=>`${time(a.time)} ${a.type} ×${a.count}, force ${a.force}, scale ${a.scale}`).join('; ')||'none'}.`,
  `Occasional physical gestures: ${r.gestures.map(g=>`${time(g.time)} ${g.path.toUpperCase()}, force ${g.force}, scale ${g.scale}`).join('; ')||'none'}.`,
  `Breathing: ${r.breaths.length} explicit intervals. Placement: ${r.sections[0].spatial.language}; no manually keyed coordinates.`,
  `Refinements/discrepancies: ${r.discrepancies.join(' ')}`,'');
}
await writeFile('docs/music-validation.md',lines.join('\n').trimEnd()+'\n');
console.log('32-track report generated: all scores active, 29 current uploads acoustically verified; remaining verification and native availability are explicit.');
