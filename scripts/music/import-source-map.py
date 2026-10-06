#!/usr/bin/env python3
"""Import explicit identities; never match recordings by a title or playlist position."""
import argparse,json,math,re,shutil
from pathlib import Path
from urllib.parse import urlparse,parse_qs

ROOT=Path(__file__).resolve().parents[2]

def import_map(path,check_only=False):
    raw=json.loads(path.read_text())
    entries=raw if isinstance(raw,list) else raw.get('tracks',raw.get('sources'))
    if not isinstance(entries,list) or len(entries)!=32:
        raise ValueError('The source map must contain 32 explicit tracks/sources.')
    manifest=json.loads((ROOT/'data/music/manifest.json').read_text())
    by_id={t['id']:t for t in manifest['tracks']};by_index={t['index']:t for t in manifest['tracks']}
    seen=set();videos=set()
    for item in entries:
        tid=item.get('track_id');index=item.get('track_index',item.get('index'))
        track=by_id.get(tid) if tid else by_index.get(index)
        if not track or (index is not None and track['index']!=index):
            raise ValueError('Use an explicit known track_id or original numbered track_index; title matching is forbidden.')
        if track['id'] in seen:raise ValueError('Duplicate track identity: '+track['id'])
        source=item.get('source',item.get('youtube',item))
        video=source.get('video_id',source.get('youtube_video_id'))
        if video is None and source.get('youtube_url'):
            url=urlparse(source['youtube_url'])
            if url.scheme!='https' or url.hostname not in ['youtube.com','www.youtube.com','m.youtube.com','youtu.be']:
                raise ValueError('Use an HTTPS YouTube source URL.')
            video=url.path.lstrip('/') if url.hostname=='youtu.be' else parse_qs(url.query).get('v',[None])[0]
        if not isinstance(video,str) or not re.fullmatch(r'[A-Za-z0-9_-]{11}',video):raise ValueError('Invalid video ID: '+str(video))
        if video in videos:raise ValueError('This map has an ambiguous shared video ID; author explicit interval identity before importing.')
        start=source.get('source_start_seconds',0)
        if not isinstance(start,(int,float)) or not math.isfinite(start) or not 0<=start<=86400:raise ValueError('Invalid source offset.')
        normalized={'video_id':video,'source_start_seconds':start,'validation_status':source.get('validation_status','unverified')}
        if normalized['validation_status'] not in ['verified','duration-only','unverified','mismatch']:raise ValueError('Invalid validation status.')
        for key in ['source_end_seconds','effective_duration_seconds','note']:
            if key in source:normalized[key]=source[key]
        end=normalized.get('source_end_seconds')
        if end is not None and (not isinstance(end,(int,float)) or not math.isfinite(end) or end<=start):raise ValueError('Invalid source end boundary.')
        track['source']=normalized;track['source_status']='supplied-source-map'
        track['expected_version']=item.get('expected_version',item.get('version',track['title']))
        if item.get('artist'):track['artist']=item['artist']
        elif ' — ' in item.get('title',''):track['artist']=item['title'].rsplit(' — ',1)[1]
        seen.add(track['id']);videos.add(video)
    # Mutate only after the whole map validates. Keep the input byte-for-byte.
    if check_only:
        print('Validated 32 explicit source identities without modifying files.');return
    destination=ROOT/'data/music/source/ink-water-youtube-source-map.json'
    if path.resolve()!=destination.resolve():shutil.copyfile(path,destination)
    if isinstance(raw,dict) and raw.get('playlist_id'):manifest['playlist_id']=raw['playlist_id']
    (ROOT/'data/music/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Imported 32 explicit video identities. Recording verification and music:release-check remain required.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source_map',type=Path);parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    try:import_map(args.source_map,args.check)
    except (ValueError,OSError,KeyError) as error:parser.exit(1,str(error)+'\n')
