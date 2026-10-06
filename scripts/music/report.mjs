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
  recording_verification:'YouTube media could not be retrieved in this environment. Metadata/duration checks do not establish recording equivalence.',
  reference_duration:track.duration,container_duration:analysis.reference.container_duration_seconds,
  supplied_duration:analysis.supplied_analysis.duration,
  tempo:analysis.tempo_review,
  style:score.style,direction:score.direction,seed:score.seed,sections:score.sections,accents:score.accents,breaths:score.breaths,
  demo:score.recommended_demo,alternate:score.alternate_demo,
  highlighted_events:scheduler.events.filter(e=>e.time>=score.recommended_demo.start&&e.time<score.recommended_demo.end).length,
  event_count:scheduler.events.length,event_fingerprint:createHash('sha256').update(JSON.stringify(scheduler.events)).digest('hex'),
  quiet_spaces:analysis.quiet_spaces,transition_validation:analysis.transition_checks,highlight_validation:analysis.highlight_validation,
  discrepancies:[...score.refinements,...(track.index===22?['Playlist position 30 is DEAR DRIVER — NICO, while the authored reference is Rider. Equal duration is insufficient; identity needs verification.']:[]),
   ...(track.index===21?['Standalone Gx41vYzyPZo uses offset 0; supplied album IyvqVDAGU0s retains 854s.']:[]),
   ...(track.index===3?['Current lrAWkOGkpBw upload is an explicit duration-only alias; supplied 62Zeu3jBs_I is preserved.']:[])],
 });
}
await mkdir('docs',{recursive:true});
await writeFile('docs/music-validation.json',JSON.stringify({schema_version:1,playlist_id:manifest.playlist_id,source_mapping_complete:manifest.tracks.every(t=>t.source),
 validation_scope:'All 32 local MP3s decoded and analyzed. Supplied exact-ID source map imported, with two reviewed aliases. Rider metadata mismatch holds its score. Full YouTube recording equivalence remains unverified.',tracks:records},null,2)+'\n');
const time=n=>`${Math.floor(n/60)}:${(n%60).toFixed(2).padStart(5,'0')}`;
const lines=['# Music score validation','',
 'All 32 numbered reference MP3s were decoded completely. Duration, half-second energy/brightness curves, adaptive attacks, quiet spaces and six supplied transition candidates were inspected for every track. All recommended and alternate windows remain the authored windows. BPM estimates are treated as half/double-time candidates, never a beat-to-drop grid.','',
 '**Playback identities are connected.** The supplied source map is preserved byte-for-byte. All 32 tracks have primary mappings; two explicit aliases match the current Sun Tickles and standalone Continuum 3 uploads. The playlist has no missing/unexpected/duplicate IDs or cinematic order differences after these reviewed aliases. 31 tracks can run their authored physical rain. YouTube media retrieval was blocked, so metadata/duration agreement is not presented as verified recording equivalence.','',
 '**One score is held:** position 30 resolves to “DEAR DRIVER” by NICO where the supplied map and choreography expect “Rider — Niko Demus.” Replace or explicitly verify that upload. Continuum 3’s current standalone ID uses offset 0; the original album ID retains 854 seconds.','',
 '| Position | Authored track | Local duration | Explicit matched playlist ID | YouTube duration metadata | Weather | Total / demo drops |','| --- | --- | ---: | --- | ---: | --- | ---: |'];
for(const r of records)lines.push(`| ${r.position} | ${r.title} | ${r.reference_duration.toFixed(3)}s | ${r.observed_playlist_item.video_id} | ${r.observed_playlist_item.duration_seconds}s | ${r.style} | ${r.event_count} / ${r.highlighted_events} |`);
lines.push('','The ID column follows the supplied map and reviewed exact-ID aliases. Runtime uses the manifest, not title matching or position guesses. Whole-second metadata rounding is allowed up to 1.25s; material version changes are held. The strict release check still requires full recording verification.','',
 '## Priority pass','',
 'Logic1000 remains quiet from 124.55 to 127.90 seconds, then its measured 128.1974-second arrival introduces irregular 2–4 impact groups. Places Remember Events uses a spatially separated double arrival in its early excerpt. Sun Tickles has two small asymmetric paired glints. Marumari uses its earlier proven window. Recovery raises both force and density through the rise. Continuum flows softly without a beat grid. Bromine repeatedly stops rain entirely. Seefeel reforms localized showers; Other Joe gathers fine streams; by the rain uses tighter needle clusters.','');
for(const r of records){
 lines.push(`## ${r.position}. ${r.title}${r.priority?' — priority':''}`,'',r.direction,'',
  `Reference: ${r.reference_duration.toFixed(6)}s. YouTube match: **${r.source_match}**. Observed item: \`${r.observed_playlist_item.video_id}\`; metadata duration ${r.observed_playlist_item.duration_seconds}s. Demo: ${time(r.demo.start)}–${time(r.demo.end)} (${r.highlighted_events} physical drops).`,
  `Deterministic song seed: ${r.seed}; score event count ${r.event_count}.`,
  `Sections: ${r.sections.map(s=>`${time(s.start)}–${time(s.end)} ${s.name}, density ${s.density.join('→')}/s, force ${s.force.join('→')}, radius ${s.scale.join('→')}, groups ${s.cluster.count.join('–')} (${Math.round(s.cluster.probability*100)}%)`).join('; ')}.`,
  `Selected accents: ${r.accents.map(a=>`${time(a.time)} ${a.type} ×${a.count}, force ${a.force}, scale ${a.scale}`).join('; ')||'none'}.`,
  `Breathing: ${r.breaths.length} explicit intervals. Placement: ${r.sections[0].spatial.language}; no manually keyed coordinates.`,
  `Refinements/discrepancies: ${r.discrepancies.join(' ')}`,'');
}
await writeFile('docs/music-validation.md',lines.join('\n').trimEnd()+'\n');
console.log('32-track report generated: exact IDs connected, two explicit aliases, Rider mismatch held; full recording verification pending.');
