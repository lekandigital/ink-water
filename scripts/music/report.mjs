import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const {outputFiles}=await build({entryPoints:['src/music/RainScheduler.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {RainScheduler}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const manifest=await json('data/music/manifest.json'),inventory=await json('data/music/analysis/youtube-playlist-inventory.json');
const records=[];
for(const [position,id] of manifest.order.entries()){
 const track=manifest.tracks.find(t=>t.id===id),analysis=await json('data/music/'+track.analysis),score=await json('data/music/'+track.score);
 const scheduler=new RainScheduler(score),candidate=inventory.entries[position];
 records.push({position:position+1,track_id:id,title:track.title,artist:track.artist,priority:inventory.priority_indices.includes(track.index),
  youtube_video_id:track.source?.video_id??null,source_offset:track.source?.source_start_seconds??null,
  observed_playlist_item:candidate,
  source_match:track.source?.validation_status??'awaiting-supplied-source-map',
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
   ...(track.index===21?['Playlist position 3 is a standalone Continuum 3 upload; do not carry over the old 854s album offset without its authoritative mapping.']:[])],
 });
}
await mkdir('docs',{recursive:true});
await writeFile('docs/music-validation.json',JSON.stringify({schema_version:1,playlist_id:manifest.playlist_id,source_mapping_complete:manifest.tracks.every(t=>t.source),
 validation_scope:'All 32 local MP3s decoded and analyzed. YouTube ID inventory obtained; exact source map missing and media equivalence unverified.',tracks:records},null,2)+'\n');
const time=n=>`${Math.floor(n/60)}:${(n%60).toFixed(2).padStart(5,'0')}`;
const lines=['# Music score validation','',
 'All 32 numbered reference MP3s were decoded completely. Duration, half-second energy/brightness curves, adaptive attacks, quiet spaces and six supplied transition candidates were inspected for every track. All recommended and alternate windows remain the authored windows. BPM estimates are treated as half/double-time candidates, never a beat-to-drop grid.','',
 '**Production verification is incomplete.** The requested `ink-water-youtube-source-map.json` was not among the attachments. No YouTube identities or offsets have been guessed into the playback manifest. The live playlist inventory has 32 items and no repeated IDs. Its metadata can be inspected, but missing/unexpected/order comparisons require that supplied map. YouTube media retrieval was blocked, so duration agreement is not presented as a version match.','',
 '**Two source checks:** position 30 is “DEAR DRIVER” by NICO where the choreography expects “Rider”; position 3 is a standalone “Continuum 3,” unlike the older album source at 854 seconds. Both need an explicit verified mapping.','',
 '| Position | Authored track | Local duration | Observed playlist ID (position only) | YouTube duration metadata | Weather | Total / demo drops |','| --- | --- | ---: | --- | ---: | --- | ---: |'];
for(const r of records)lines.push(`| ${r.position} | ${r.title} | ${r.reference_duration.toFixed(3)}s | ${r.observed_playlist_item.video_id} | ${r.observed_playlist_item.duration_seconds}s | ${r.style} | ${r.event_count} / ${r.highlighted_events} |`);
lines.push('','The ID column is an inventory by position, **not** an authoritative song mapping. The runtime never reads this inventory to choose a score.','',
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
console.log('32-track report generated. Source-map/version verification remains explicitly pending.');
