import {clamp,validateManifest,scoreTime,effectiveEnd,type MusicManifest,type MusicTrack} from './MusicScore';

/** Playlist identity and boundaries, independent of the YouTube transport. */
export class PlaylistSession{
  readonly tracks:MusicTrack[];
  index=0;
  ended=false;
  unavailable=new Set<string>();
  constructor(readonly manifest:MusicManifest){
    validateManifest(manifest);const byId=new Map(manifest.tracks.map(t=>[t.id,t]));
    this.tracks=manifest.order.map(id=>byId.get(id)!);
  }
  get current(){return this.tracks[this.index];}
  select(index:number){if(!Number.isInteger(index)||index<0||index>=this.tracks.length)throw new Error('Unknown playlist position.');this.index=index;this.ended=false;return this.current;}
  next(){
    for(let i=this.index+1;i<this.tracks.length;i++)if(!this.unavailable.has(this.tracks[i].id))return this.select(i);
    this.ended=true;return null;
  }
  previous(){for(let i=this.index-1;i>=0;i--)if(!this.unavailable.has(this.tracks[i].id))return this.select(i);return this.select(0);}
  markUnavailable(){this.unavailable.add(this.current.id);return this.next();}
  identify(videoId:string,index:number){
    const positioned=this.tracks[index];
    if(positioned?.source?.video_id===videoId)return positioned;
    const matches=this.tracks.filter(t=>t.source?.video_id===videoId);
    return matches.length===1?matches[0]:null;
  }
  time(sourceTime:number){return this.current.source?scoreTime(sourceTime,this.current.source):sourceTime;}
  atEnd(sourceTime:number){return sourceTime>=effectiveEnd(this.current);}
  seekSourceTime(time:number){return (this.current.source?.source_start_seconds??0)+clamp(time,0,this.current.duration);}
  durationMismatch(sourceDuration:number){
    const source=this.current.source;
    if(!source||sourceDuration<=0)return false;
    const end=Math.min(sourceDuration,source.source_end_seconds??(source.source_start_seconds>0?effectiveEnd(this.current):Infinity));
    return Math.abs(end-source.source_start_seconds-this.current.duration)>.8;
  }
}
