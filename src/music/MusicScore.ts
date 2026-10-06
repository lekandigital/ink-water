export type Pair=[number,number];
export type RainSection={name:string;start:number;end:number;density:Pair;force:Pair;scale:Pair;background:number;
  cluster:{probability:number;count:Pair;spacing:Pair;radius:number};
  spatial:{language:string;spread:number;wander:number;focus:Pair};breathing:number;note:string};
export type RainAccent={time:number;type:string;force:number;scale:number;count:number;spacing:number;anticipation:number;quiet:number;note:string};
export type RainScore={schema_version:1;track_id:string;seed:number;title:string;artist:string;duration:number;style:string;direction:string;
  recommended_demo:{start:number;end:number};alternate_demo:{start:number;end:number}|null;
  sections:RainSection[];accents:RainAccent[];breaths:{start:number;end:number;amount:number;note:string}[]};
export type PlaybackSource={video_id:string;source_start_seconds:number;source_end_seconds?:number;
  effective_duration_seconds?:number;validation_status:'verified'|'duration-only'|'unverified'|'mismatch';note?:string};
export type MusicTrack={id:string;index:number;title:string;artist:string;duration:number;score:string;analysis:string;
  reference_sha256:string;recommended_demo:{start:number;end:number};source:PlaybackSource|null;alternate_sources?:PlaybackSource[];source_status:string};
export type MusicManifest={schema_version:1;title:string;preferred_tone:'green-light';playlist_id:string|null;order:string[];tracks:MusicTrack[]};
export type MusicRainDrop={time:number;force:number;scale:number;position:Pair;seed:number;kind:'rain'|'cluster'|'accent'|'background'};
export type PlaybackSample={trackId:string;time:number;playing:boolean;seeking?:boolean};
export interface MusicRainClock{readonly enabled:boolean;updateMusicRain():MusicRainDrop[];setSimulationPaused(paused:boolean):void;rebase():void;}
export const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const playbackSources=(track:MusicTrack)=>track.source?[track.source,...(track.alternate_sources??[])]:[];
export function upperBound<T>(items:ReadonlyArray<T>,time:number,value:(item:T)=>number){
  let lo=0,hi=items.length;while(lo<hi){const m=(lo+hi)>>>1;if(value(items[m])<=time)lo=m+1;else hi=m;}return lo;
}
const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const range=(n:unknown,a:number,b:number)=>finite(n)&&n>=a&&n<=b;
const pair=(p:unknown,a:number,b:number)=>Array.isArray(p)&&p.length===2&&p.every(n=>range(n,a,b));

export function validateScore(score:RainScore){
  check(score?.schema_version===1&&typeof score.track_id==='string'&&Number.isInteger(score.seed)&&range(score.duration,.1,7200),'Invalid rain score identity.');
  check(Array.isArray(score.sections)&&score.sections.length&&Array.isArray(score.accents)&&Array.isArray(score.breaths),'Incomplete rain score.');
  let end=0;
  for(const s of score.sections){
    check(s.start===end&&finite(s.end)&&s.end>s.start&&s.end<=score.duration,'Score sections must cover the recording without gaps.');
    check(pair(s.density,0,3)&&pair(s.force,0,1.6)&&pair(s.scale,.2,1.8)&&range(s.background,0,1),'Invalid weather envelope.');
    check(range(s.cluster?.probability,0,1)&&pair(s.cluster.count,1,4)&&s.cluster.count.every(Number.isInteger)&&s.cluster.count[0]<=s.cluster.count[1]&&pair(s.cluster.spacing,.03,2)&&range(s.cluster.radius,0,.5),'Invalid cluster behavior.');
    check(pair(s.spatial?.focus,-1,1)&&range(s.spatial.spread,.1,1)&&range(s.spatial.wander,0,.5),'Invalid spatial behavior.');end=s.end;
  }
  check(end===score.duration,'The score must include the complete recording.');
  let previous=-1;
  for(const a of score.accents){
    check(range(a.time,0,score.duration)&&a.time>=previous&&range(a.force,0,1.6)&&range(a.scale,.2,1.8)&&Number.isInteger(a.count)&&range(a.count,1,4)&&range(a.spacing,0,2)&&range(a.anticipation,0,3)&&range(a.quiet,0,1),'Invalid authored accent.');previous=a.time;
  }
  for(const b of score.breaths)check(range(b.start,0,score.duration)&&range(b.end,b.start,score.duration)&&b.end>b.start&&range(b.amount,0,1),'Invalid authored breathing space.');
  for(const w of [score.recommended_demo,score.alternate_demo])if(w)check(range(w.start,0,score.duration)&&range(w.end,w.start,score.duration)&&w.end>w.start,'Invalid demo window.');
}

export function validateManifest(manifest:MusicManifest,requireSources=false){
  check(manifest?.schema_version===1&&Array.isArray(manifest.tracks)&&manifest.tracks.length===32&&Array.isArray(manifest.order)&&manifest.order.length===32,'This playlist needs 32 tracks.');
  const ids=new Set(manifest.tracks.map(t=>t.id));
  check(ids.size===32&&new Set(manifest.order).size===32&&manifest.order.every(id=>ids.has(id)),'Playlist order must contain each score exactly once.');
  const videos=new Set<string>();
  for(const t of manifest.tracks){
    check(/^[0-9]{2}-[a-z0-9-]+$/.test(t.id)&&t.score===`scores/${t.id}.json`&&range(t.duration,.1,7200)&&/^[a-f0-9]{64}$/.test(t.reference_sha256),'Invalid track metadata.');
    if(!t.source){check(!requireSources,'Playback sources are incomplete: supply the YouTube source map.');continue;}
    for(const s of playbackSources(t)){
      check(/^[A-Za-z0-9_-]{11}$/.test(s.video_id)&&range(s.source_start_seconds,0,86400),'Invalid YouTube mapping.');
      check(s.source_end_seconds===undefined||(finite(s.source_end_seconds)&&s.source_end_seconds>s.source_start_seconds),'Invalid source end boundary.');
      check(['verified','duration-only','unverified','mismatch'].includes(s.validation_status),'Invalid source validation status.');
      check(!videos.has(s.video_id),'Video IDs must identify one recording unambiguously.');videos.add(s.video_id);
    }
  }
}

export function parsePlaylistId(value:string){
  value=value.trim();if(!value)return null;
  if(/^[A-Za-z0-9_-]{10,150}$/.test(value))return value;
  try{const url=new URL(value);if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname))throw new Error();
    const id=url.searchParams.get('list');if(id&&/^[A-Za-z0-9_-]{10,150}$/.test(id))return id;
  }catch{}throw new Error('Use a YouTube playlist URL or playlist ID.');
}

export function validatePlaylist(manifest:MusicManifest,videoIds:string[]){
  const mapped=new Map(manifest.tracks.flatMap(t=>playbackSources(t).map(s=>[s.video_id,t.id] as const)));
  const ids=videoIds.map(id=>mapped.get(id));
  const unknown=videoIds.filter(id=>!mapped.has(id));
  const missing=manifest.order.filter(id=>!ids.includes(id));
  const duplicate=videoIds.filter((id,i)=>videoIds.indexOf(id)!==i);
  const orderDifferences=Array.from({length:Math.max(ids.length,manifest.order.length)},(_,position)=>({
    position:position+1,expected:manifest.order[position]??null,actual:ids[position]??null,videoId:videoIds[position]??null,
  })).filter(item=>item.expected!==item.actual);
  const mismatched=videoIds.filter(videoId=>manifest.tracks.some(t=>playbackSources(t).some(s=>s.video_id===videoId&&s.validation_status==='mismatch')));
  return {unknown,missing,duplicate,mismatched,orderMatches:ids.length===manifest.order.length&&ids.every((id,i)=>id===manifest.order[i]),
    orderDifferences,mappedOrder:ids.filter((id):id is string=>id!==undefined)};
}

export function scoreTime(sourceTime:number,source:PlaybackSource){return sourceTime-source.source_start_seconds;}
export function effectiveEnd(track:MusicTrack){return Math.min(track.source?.source_end_seconds??Infinity,(track.source?.source_start_seconds??0)+track.duration);}
