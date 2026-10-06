#!/usr/bin/env python3
"""Compile deliberately authored per-song weather, supported by audio evidence.

The rows below are creative decisions, not a classifier or loudness-to-rain map.
Regeneration preserves the supplied directions, windows and cinematic order.
"""
import hashlib
import json
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[2]
spec = spec_from_file_location('audio_validation', Path(__file__).with_name('validate-audio.py'))
helper = module_from_spec(spec)
spec.loader.exec_module(helper)

# index, seven section density targets (cluster entrances/sec), force, radius,
# cluster probability, cluster size, spacing, spatial language, background/sec,
# negative-space fraction, selected transition indices. Every row is authored.
ROWS = [
 (1, [.40,.62,.73,.48,.95,.68,.28], .48,.61,.70,[2,4],[.09,.23],'streams',.10,.10,[1,3,4]),
 (2, [.09,.28,.38,.16,.65,.47,.20], .66,.94,.77,[2,4],[.13,.37],'cells',.02,.22,[0,3,4]),
 (3, [.16,.36,.29,.42,.24,.35,.15], .36,.61,.65,[2,3],[.14,.42],'glints',.02,.18,[0,2,4]),
 (4, [.28,.51,.69,.47,.79,.57,.26], .50,.55,.80,[2,4],[.065,.16],'needles',.05,.16,[1,4]),
 (5, [.28,.47,.36,.62,.29,.48,.13], .45,.74,.67,[2,4],[.10,.38],'showers',.02,.24,[0,2,4]),
 (6, [.17,.28,.34,.25,.36,.24,.11], .30,.91,.15,[1,2],[.45,.95],'drift',.11,.05,[1,4]),
 (7, [.22,.43,.55,.36,.58,.44,.20], .57,.91,.67,[2,3],[.22,.52],'motif',.02,.20,[1,3,4]),
 (8, [.12,.21,.32,.45,.68,.84,.30], .69,1.03,.66,[2,3],[.22,.58],'gather',.02,.16,[3,4]),
 (9, [.39,.66,.82,.49,.94,.62,.24], .46,.59,.79,[2,4],[.08,.27],'split',.02,.24,[0,3,4]),
 (10,[.14,.24,.31,.22,.36,.26,.12], .27,.57,.26,[1,2],[.38,.82],'glints',.06,.08,[1,4]),
 (11,[.17,.28,.21,.33,.38,.23,.12], .45,.91,.31,[1,2],[.32,.75],'motif',.00,.30,[3,4]),
 (12,[.07,.15,.12,.19,.22,.15,.06], .27,1.02,.12,[1,2],[.50,1.20],'suspended',.015,.28,[2,4]),
 (13,[.20,.34,.39,.31,.48,.35,.16], .30,.47,.50,[2,3],[.13,.37],'granules',.015,.22,[1,3]),
 (14,[.09,.21,.14,.28,.17,.23,.09], .33,.76,.40,[1,2],[.32,.85],'miniature',.00,.35,[2,4]),
 (15,[.035,.070,.043,.065,.039,.075,.025],.24,.89,.14,[1,2],[.60,1.30],'miniature',.00,.42,[2]),
 (16,[.23,.37,.55,.42,.62,.47,.20], .55,1.02,.62,[2,3],[.25,.58],'rounded',.03,.18,[1,2,4]),
 (17,[.19,.32,.44,.56,.76,.63,.28], .43,.63,.78,[2,4],[.11,.33],'streams',.04,.12,[1,3,4]),
 (18,[.13,.38,.55,.62,.44,.32,.14], .49,.78,.63,[2,3],[.18,.47],'glints',.02,.19,[1,2,4]),
 (19,[.10,.22,.16,.29,.19,.24,.08], .32,.81,.42,[1,3],[.28,.75],'miniature',.00,.35,[2,4]),
 (20,[.12,.32,.73,.26,.55,.88,.24], .65,1.01,.64,[2,3],[.18,.41],'gather',.025,.15,[1,3,4]),
 (21,[.15,.35,.17,.28,.43,.26,.15], .35,.89,.24,[1,2],[.52,1.12],'flow',.05,.14,[0,3,4]),
 (22,[.29,.51,.66,.40,.64,.43,.16], .58,.79,.74,[2,3],[.10,.27],'motif',.02,.20,[2,4]),
 (23,[.14,.25,.34,.24,.37,.29,.13], .44,1.06,.32,[1,3],[.38,.85],'rounded',.025,.19,[1,4]),
 (24,[.17,.28,.34,.23,.43,.30,.12], .38,.94,.28,[1,2],[.43,.92],'haze',.12,.11,[3,4]),
 (25,[.07,.12,.08,.13,.09,.14,.055],.37,1.09,.17,[1,2],[.65,1.50],'suspended',.00,.36,[0,4]),
 (26,[.10,.19,.26,.16,.28,.18,.09], .46,1.04,.46,[2,3],[.45,.98],'echo',.00,.30,[1,2,4]),
 (27,[.35,.59,.76,.46,.83,.61,.23], .59,.82,.77,[2,4],[.12,.31],'alternate',.025,.19,[0,2,4]),
 (28,[.13,.23,.31,.20,.36,.27,.12], .29,.95,.25,[1,3],[.48,1.05],'drift',.045,.14,[2,3]),
 (29,[.09,.24,.29,.12,.23,.27,.105],.29,.73,.50,[2,3],[.32,.82],'negative',.00,.38,[0,3]),
 (30,[.24,.39,.53,.31,.61,.42,.16], .57,.96,.61,[2,4],[.18,.46],'memory',.015,.24,[2,4]),
 (31,[.12,.20,.29,.22,.41,.32,.12], .45,1.10,.21,[1,2],[.55,1.15],'pressure',.065,.12,[3,4]),
 (32,[.25,.42,.59,.48,.53,.32,.08], .54,.98,.62,[2,3],[.27,.63],'rounded',.025,.17,[1,3,4]),
]

LANGUAGES = {
 'streams': ('Independent fine streams; complexity comes from superposition.', .86, .14),
 'cells': ('Irregular 2–4 drop groups occupy different cells, with air between them.', .74, .18),
 'glints': ('Asymmetric pinpricks and widely separated paired glints.', .92, .27),
 'needles': ('Narrow fast clusters cross the surface, separated by short lulls.', .83, .12),
 'showers': ('Localized showers reform elsewhere; leave deliberate spatial holes.', .88, .20),
 'drift': ('Broad softly wandering weather, with long continuous envelopes.', .91, .30),
 'motif': ('Recurring cluster gestures move and change spacing without a beat grid.', .76, .19),
 'gather': ('Groups gather through the rise, then release into wider space.', .86, .24),
 'split': ('Fine simultaneous showers in separated regions, then brief silence.', .91, .13),
 'suspended': ('Mostly open water; soft solitary drops and occasional slow pairs.', .85, .24),
 'granules': ('Tiny widely distributed granular groups at very low force.', .95, .24),
 'miniature': ('Close hand-marked feeling: isolated drops, pairs and long gaps.', .64, .15),
 'rounded': ('Warm rounded clusters with loose asymmetry and unhurried entrances.', .79, .24),
 'flow': ('Graceful moving density curves; sustained passages pull back.', .91, .31),
 'haze': ('A faint continuous field, gently lifted by a few broad pulses.', .94, .29),
 'echo': ('Phrase entrances followed by smaller, softer physical echoes.', .78, .24),
 'alternate': ('Compact groups alternate across the surface, with a few anchors.', .83, .13),
 'negative': ('Small groups disappear completely; the absences are authored.', .92, .22),
 'memory': ('Return to earlier spatial regions while changing density and group size.', .79, .21),
 'pressure': ('Slow broad pressure and release; rare stronger, soft impacts.', .92, .31),
}


def nearest_onset(analysis, time, radius=1.4):
    near = [o for o in analysis['onsets'] if abs(o['time']-time) <= radius]
    return max(near, key=lambda o:o['strength']-.14*abs(o['time']-time)) if near else None


def compile_scores():
    c = json.loads((ROOT/'data/music/source/ink-water-32-track-choreography.json').read_text())
    manifest_path=ROOT/'data/music/manifest.json'
    existing=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    saved={t['id']:t for t in existing.get('tracks',[])}
    profiles = {r[0]:r for r in ROWS}
    tracks = []
    artists = {1:'Other Joe',2:'Logic1000',3:'Salamanda',4:'Buttechno & TRIS',5:'Seefeel',7:'Lusine',
               9:'Eerie Enterprise',12:'Wilson Tanner',13:'Argento',18:'Marumari',20:'Rival Consoles',21:'Nala Sinephro',29:'Chevel'}
    for track in c['tracks']:
        index=track['index']; tid=helper.track_id(track)
        a=json.loads((ROOT/'data/music/analysis'/f'{tid}.json').read_text())
        _, densities, force, scale, chance, count, spacing, language, background, breathing, selected = profiles[index]
        description, spread, wander = LANGUAGES[language]
        duration=a['reference']['duration_seconds']
        bounds=[0,*track['detected_section_boundaries_seconds'],duration]
        sections=[]
        for i,(start,end) in enumerate(zip(bounds,bounds[1:])):
            # Authored weather chooses density. Measured brightness only gives a
            # bounded size tendency; nothing is computed from a beat count.
            samples=[r for r in a['timeline'] if start <= r['time'] < end]
            bright=sum(r['brightness'] for r in samples)/max(1,len(samples))
            size=round(scale*(1-.10*(bright-.5)),4)
            target=densities[i]; previous=densities[max(0,i-1)]
            sections.append({'name':f'{language}: '+('opening' if i==0 else 'release' if i==6 else f'phrase {i}'),
                'start':start,'end':end,'density':[previous,target],
                'force':[round(force*(.70+.50*(previous/max(densities))**.5),4),
                         round(force*(.70+.50*(target/max(densities))**.5),4)],
                'scale':[size,size], 'background':background,
                'cluster':{'probability':chance,'count':count,'spacing':spacing,'radius': .17 if language!='showers' else .26},
                'spatial':{'language':language,'spread':spread,'wander':wander,'focus':[0,0]},
                'breathing':breathing,'note':description})
        accents=[]
        for i in selected:
            onset=nearest_onset(a,bounds[i+1])
            if onset:
                accents.append({'time':onset['time'],'type':'arrival','force':round(min(1.15,force*1.35+.10*onset['low_share']),4),
                    'scale':round(min(1.55,scale*1.18+.10*onset['low_share']),4),'count':1,
                    'spacing':.25,'anticipation':.65,'quiet':.72,'note':f'Selected phrase arrival near {bounds[i+1]:g}s; measured attack, not every transient.'})
        breaths=[]
        # Full-song negative space stays explicit in the score, separate from
        # signal silence. Different tracks have different breathing cadence.
        for i,s in enumerate(sections):
            if breathing >= .18:
                span=s['end']-s['start']
                at=s['start']+span*(.47 if i%2 else .67)
                length=min(5.5, max(1.2, span*breathing*.18))
                breaths.append({'start':round(at,4),'end':round(min(s['end'],at+length),4),'amount':0,'note':'Authored room for decay and interference.'})
        # Quiet/intimate opening demos should visibly contain a small deliberate
        # gesture, while retaining stillness; these are ordinary physical drops.
        if index in [15,25]:
            for time in ([1.3,7.2] if index==15 else [7.2,14.5]):
                o=nearest_onset(a,time,.8)
                if o:accents.append({'time':o['time'],'type':'solitary','force':force,'scale':scale,'count':1,'spacing':.5,'anticipation':.8,'quiet':.9,'note':'A deliberate soft opening mark, followed by space.'})
        refinements=['Duration uses decoded reference samples; supplied highlight is unchanged.',
                     'Selected arrivals use independently measured attacks; density remains authored.',
                     'Section force follows the authored pressure/release arc; music-only impulse calibration makes it legible with Gentle motion.']
        gestures=[]
        def mark(at,kind,f,z,count=1,spacing=.25,anticipation=.5,quiet=.7,note=''):
            o=nearest_onset(a,at,.18)
            if o:accents.append({'time':o['time'],'type':kind,'force':f,'scale':z,'count':count,'spacing':spacing,
                                'anticipation':anticipation,'quiet':quiet,'note':note})
        def gesture(at,key,f,z,spread,note):
            o=nearest_onset(a,at,.18)
            if o:gestures.append({'time':o['time'],'path':key,'force':f,'scale':z,'spread':spread,'note':note})
        if index==2:
            # The demo transcript's 127.617s arrival, independently checked
            # against the decoded 10ms MP3 envelope (8.66x energy jump).
            # 128.1974s is a later loud attack, not the structural entrance.
            breaths += [{'start':124.55,'end':126.90,'amount':.20,'note':'Restrained texture before the flagship riser.'},
                        {'start':126.90,'end':127.617,'amount':0,'note':'Anticipation lets the structural arrival land clearly.'}]
            mark(123.1586,'fleck',.28,.75,1,.25,.25,.4,'A light preparatory impact gives the authentic pre-roll a visible first frame.')
            mark(124.8305,'fleck',.30,.74,1,.25,.25,.4,'One quiet opening fleck: restrained texture, not completely dead water.')
            arrival=nearest_onset(a,127.617,.15)
            if arrival:
                sections[3]['end']=127.617; sections[4]['start']=127.617
                sections[4]['density']=[.88,.65];sections[4]['force']=[.79,.70]
                for accent in accents:
                    if abs(accent['time']-128)<2:accent.update(time=127.617,force=1.08,scale=1.18,quiet=.95,anticipation=1.1,
                        note='The proven demo arrival, confirmed by decoded reference energy; not the later maximum transient.')
                breaths.append({'start':133.55,'end':134.25,'amount':.12,'note':'A small clearing inside the structured rain, not a constant wall.'})
                refinements.append('Demo transcript corrects the main arrival to 127.617s; decoded MP3 jump starts around 127.597s and peaks at 127.617s. The old 128.1974s event was late.')
        if index==1:
            mark(137.9498,'glint',.46,.56,3,.13,.28,.45,'One fine separated shower inside the dense mist; force stays modest.')
        if index==4:
            mark(181.2317,'glint',.43,.51,3,.09,.35,.65,'A selected needle burst, then release; not every percussion hit.')
        if index==5:
            mark(57.4694,'glint',.61,.82,2,.31,.65,.8,'Two spatially separate showers reform in the uncanny highlight.')
        if index==29:
            breaths += [{'start':s['start']+(s['end']-s['start'])*p,'end':min(s['end'],s['start']+(s['end']-s['start'])*p+4.3),
                         'amount':0,'note':'Negative space is part of this track’s language.'} for s in sections for p in [.27,.79]]
        if index==9:
            # Separate showers in the early demonstration, not a borrowed
            # Logic1000 increase. One compact asymmetric double arrival.
            o=nearest_onset(a,25.75,.2)
            if o:accents.append({'time':o['time'],'type':'split','force':.45,'scale':.62,'count':2,'spacing':0,'anticipation':.4,'quiet':.65,'note':'Two spatially separate impacts in the preferred early window.'})
            mark(30.6968,'glint',.38,.53,3,.085,.25,.5,'A short dispersed technical answer to the separated pair.')
        if index==3:
            # Two tiny asymmetric glints make the charming early excerpt read;
            # restrained chance rain alone left this fixed seed too empty.
            for at in [27.3,34.5]:
                o=nearest_onset(a,at,.45)
                if o:accents.append({'time':o['time'],'type':'glint','force':.28,'scale':.49,'count':2,
                    'spacing':.23 if at<30 else .39,'anticipation':.25,'quiet':.40,
                    'note':'A small asymmetric paired glint in the preferred early window.'})
        if index==20:
            for s in sections[1:3]:s['force']=[.50,.78]
            sections[2]['density']=[.88,.73];sections[2]['force']=[.80,.90]
            mark(91.8117,'arrival',.64,.98,2,.40,.45,.7,'A rounded answering pair after the cinematic arrival.')
            breaths.append({'start':93.2,'end':94.4,'amount':.18,'note':'The rise briefly opens out so its larger waves can breathe.'})
            gesture(201.25,'c',.26,.64,.90,'A single curved physical sweep at the later crest, followed by open water.')
        if index==18:
            mark(118.422,'arrival',.93,1.13,1,.25,1.15,.95,'The dramatic later Marumari accent from the earlier prototype, with a clearing before it.')
            gesture(41.657,'c',.28,.64,.82,'A physical C at the proven launch phrase, using the existing deterministic touch path.')
            gesture(44.211,'x',.23,.61,.76,'A rare crossing gesture at the next proven phrase; each sample enters through rain.')
            refinements.append('The supplied demo transcript informed C/X phrase gestures and the later ~118.422s breathing/accent moment; gestures are physical rain samples, not drawn overlays.')
        if index==21:
            mark(132.7949,'arrival',.43,1.04,1,.25,.65,.65,'A broad harmonic arrival; flowing rain remains soft and unquantized.')
            mark(136.0225,'glint',.26,.73,2,.52,.3,.35,'Two small drifting echoes after the sustained arrival.')
        if index==8:
            for s in sections[:3]:s['scale']=[.78,.91]
            sections[4]['scale']=[1.02,1.17];sections[5]['scale']=[1.17,1.08]
            gesture(sections[5]['start']+2,'/',.25,.65,.85,'One slash-shaped physical sweep in the late gathered section; no repetitive letter motif.')
        if index==17:
            for i,s in enumerate(sections):s['cluster']['probability']=min(.85,.35+i*.085)
        score={'schema_version':2,'track_id':tid,'seed':int.from_bytes(hashlib.sha256(('ink-water-weather-v1:'+tid).encode()).digest()[:4],'little'),
            'title':track['title'].removesuffix('(1)').strip(),'artist':saved.get(tid,{}).get('artist') or artists.get(index,''),'duration':duration,
            'style':track['choreography_style'],'direction':track['choreography_notes'],
            'authored_density':track['rain_density'],'authored_force':track['impact_force'],
            'recommended_demo':track['recommended_highlight'],'alternate_demo':track['alternate_highlight'],
            'sections':sections,'accents':sorted(accents,key=lambda x:x['time']),'gestures':sorted(gestures,key=lambda x:x['time']),
            'breaths':sorted(breaths,key=lambda x:x['start']),'refinements':refinements,
            'provenance':{'choreography':f'source/ink-water-32-track-choreography.json#tracks/{index-1}',
                          'analysis':f'analysis/{tid}.json','reference_sha256':a['reference']['sha256']}}
        helper.write(ROOT/'data/music/scores'/f'{tid}.json',score)
        tracks.append({'id':tid,'index':index,'title':score['title'],'artist':score['artist'],'duration':duration,
                       'score':f'scores/{tid}.json','analysis':f'analysis/{tid}.json','reference_sha256':a['reference']['sha256'],
                       'recommended_demo':score['recommended_demo'],
                       'source':None,'source_status':'awaiting-supplied-source-map'})
    manifest={'schema_version':1,'title':'Ink Water — authored weather','preferred_tone':'green-light',
              'playlist_id':'PLTab0IXtn0Nw','order':[helper.track_id(c['tracks'][i-1]) for i in c['playlist_order_indices']], 'tracks':tracks}
    path=manifest_path
    # Regenerating artistic data must not erase subsequently supplied mappings.
    if path.exists():
        old=json.loads(path.read_text());manifest['playlist_id']=old.get('playlist_id')
        sources={t['id']:t for t in old['tracks']}
        for t in tracks:
            # Retain mapping/version review metadata added after authoring.
            for key,value in sources.get(t['id'],{}).items():
                if key not in t:t[key]=value
            if sources.get(t['id'],{}).get('source'):
                t['source']=sources[t['id']]['source'];t['source_status']=sources[t['id']]['source_status']
                if sources[t['id']].get('alternate_sources'):t['alternate_sources']=sources[t['id']]['alternate_sources']
                if sources[t['id']].get('artist'):t['artist']=sources[t['id']]['artist']
    helper.write(path,manifest)
    print('32 full-song authored scores; cinematic order and all supplied highlights retained.')


if __name__=='__main__':compile_scores()
