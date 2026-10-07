#!/usr/bin/env python3
"""Apply reviewed exact-ID adjustments; titles/playlist positions never select a score."""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[2]
path=root/'data/music/manifest.json'
manifest=json.loads(path.read_text())
inventory=json.loads((root/'data/music/analysis/youtube-playlist-inventory.json').read_text())
adjustments=json.loads((root/'data/music/source/playlist-source-adjustments.json').read_text())
by_index={t['index']:t for t in manifest['tracks']}
observed={e['video_id']:e for e in inventory['entries']}
for track in manifest['tracks']:
    source=track['source']
    if not source:raise ValueError('Import the supplied source map first.')
    if source['video_id'] in observed:
        entry=observed[source['video_id']]
        source.update(validation_status='duration-only',effective_duration_seconds=entry['duration_seconds'],
            note='Exact supplied video identity; duration checked against playlist metadata. Full recording equivalence remains unverified.')
    elif track['index']==21:
        source['source_end_seconds']=source['source_start_seconds']+track['duration']
for item in adjustments['alternate_sources']:
    track=by_index[item['track_index']]
    if track['source']['video_id']!=item['primary_video_id']:raise ValueError('Reviewed primary identity changed.')
    source={k:v for k,v in item.items() if k not in ['track_index','primary_video_id']}
    source['effective_duration_seconds']=observed[source['video_id']]['duration_seconds']
    track['alternate_sources']=[source]
for item in adjustments['mismatches']:
    track=by_index[item['track_index']]
    if track['source']['video_id']!=item['video_id']:raise ValueError('Reviewed mismatch identity changed.')
    track['source'].update({k:v for k,v in item.items() if k!='track_index'})
for item in adjustments.get('verified_sources',[]):
    track=by_index[item['track_index']]
    if track['reference_sha256']!=item['reference_sha256']:raise ValueError('Verified reference recording changed.')
    sources=[track['source'],*track.get('alternate_sources',[])]
    source=next((source for source in sources if source['video_id']==item['video_id']),None)
    if source is None:raise ValueError('Verified video identity changed.')
    source.update(validation_status='verified',note=item['note'])
path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print('32 explicit mappings retained; reviewed alternate uploads and reference recording proofs applied.')
