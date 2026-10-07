#!/usr/bin/env python3
"""Compile deliberately authored per-song weather, supported by audio evidence.

The rows below are creative decisions, not a classifier or loudness-to-rain map.
Regeneration preserves the supplied directions, windows and cinematic order.
"""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def track_id(track):
    title = re.sub(r'\(1\)$', '', track['title']).strip()
    title = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode()
    return f"{track['index']:02d}-" + re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

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
 'glints': ('Frequent asymmetric note pinpricks, with paired glints answering selected attacks.', .92, .27),
 'needles': ('Narrow fast clusters cross the surface, separated by short lulls.', .83, .12),
 'showers': ('Localized showers reform elsewhere; leave deliberate spatial holes.', .88, .20),
 'drift': ('Frequent soft note marks wander through broad continuous envelopes.', .91, .30),
 'motif': ('Recurring cluster gestures move and change spacing without a beat grid.', .76, .19),
 'gather': ('Groups gather through the rise, then release into wider space.', .86, .24),
 'split': ('Fine simultaneous showers in separated regions, then brief silence.', .91, .13),
 'suspended': ('Suspended harmonic notes return as soft marks and lighter measured echoes, with short phrase breaths.', .85, .24),
 'granules': ('Frequent small granular note groups are distributed across the surface at restrained force.', .95, .24),
 'miniature': ('Close hand-marked feeling: frequent distinct piano-note marks, lighter pairs and short phrase breaths.', .64, .15),
 'rounded': ('Warm rounded clusters with loose asymmetry and unhurried entrances.', .79, .24),
 'flow': ('Graceful moving density curves; sustained passages pull back.', .91, .31),
 'haze': ('A soft field carries frequent measured note marks and broad phrase pulses.', .94, .29),
 'echo': ('Frequent measured phrase notes are followed by smaller physical echoes tied to separate attacks.', .78, .24),
 'alternate': ('Compact groups alternate across the surface, with a few anchors.', .83, .13),
 'negative': ('Small groups disappear completely; the absences are authored.', .92, .22),
 'memory': ('Return to earlier spatial regions while changing density and group size.', .79, .21),
 'pressure': ('Broad pressure and release carries frequent soft note marks and selected stronger arrivals.', .92, .31),
}

# Each list is an authored set of phrase-answer windows for this recording. The
# compiler chooses ONE measured attack within each window, then preserves that
# exact score time. These intentionally uneven answers are not a beat grid.
# Piano pieces get individual note answers and the denser songs get small
# showers. Logic1000's original structural arrival retains its physical identity.
PHRASE_WINDOWS = {
 1: [7,19,32,42,57,71,86,101,111,125,145,158,173,189,205,220],
 2: [7,20,32,47,58,74,88,99,112,120,145,159,175,188,201],
 3: [11,20,47,63,78,105,120,145,171,188,214,229,245,260],
 4: [5,22,34,53,67,93,117,131,146,166,199,215],
 5: [9,25,39,71,89,107,126,145,164,182,197,218,236,255,271,294,313,343,358,383,414,431,445],
 6: [7,28,55,73,96,119,146,171,188,213,237,261,286,312,349,365,393,419,443,457,484,508,533,550],
 7: [7,23,37,62,76,98,126,142,169,185,207,223,238],
 8: [9,24,49,65,83,97,114,138,154,173,189,207,226,241],
 9: [7,16,45,57,78,94,123,146,164,182,215],
 10:[5,19,36,44,64,81,99,117,134,166,183,207,229,240],
 11:[5,24,43,61,79,98,109,124],
 12:[9,23,37,50,68,84,99,118,136,157,183,196,211,223],
 13:[5,14,34,49,66,92,104,126,139,161,184,195],
 14:[4,19,33,46,66,80,95,111,126,146,157,172,188,198],
 15:[22,32,44,52,69,83,95,107,119,132],
 16:[9,25,42,59,75,94,111,126,159,185,200,226,243],
 17:[9,28,46,67,89,113,137,155,181,198,229,246,270,291,327,350,374,398,435,452,472],
 18:[8,28,58,72,88,103,126,149,169,189,202],
 19:[5,19,34,43,60,73,88,110,132,145,156],
 20:[9,25,42,71,105,117,137,151,168,193,214,230,248,262,277],
 21:[8,18,35,56,81,95,116,149,162,173,188,217,232],
 22:[9,20,38,61,83,103,113,133,147,157],
 23:[7,27,45,61,75,91,103,127,143,158,178,202,227,241,263,284,301,324,343,367,386,405,427,446],
 24:[8,27,51,70,88,99,116,143,161,178,199,218,241,264,289,312,331,355,378,395],
 25:[31,49,65,83,102,121,138,156,174,191,221,240,258,283,303,325,342,361,383,433,452,474,491,513,532,548,563],
 26:[5,20,29,43,64,89,104,117,130,150,164,185,194],
 27:[10,20,38,57,71,87,104,122,144,154,173,185],
 28:[7,25,40,57,69,84,104,122,146,156,183,200,214],
 29:[8,23,40,57,69,91,106,137,154,170,191,212,224,264,282,300,318,342,358,378,400,423,452,468,481],
 30:[9,20,37,54,72,87,105,127,144,164,178,198],
 31:[9,26,41,57,78,98,119,135,165,183,203,219,246,268,283,321,339,357,378,396],
 32:[6,18,37,51,67,79,103,114,133,148,174,188,202],
}

# force multiplier, scale multiplier, repeating counts, spacing, anticipation,
# clearing. Values are deliberately restrained: these are phrase answers, not
# an additional layer of heavy arrivals. Spatial placement stays in the song's
# existing language and deterministic physical scheduler.
PHRASE_SHAPES = {
 'streams': (.92,.98,[2,1,3,1],.15,.22,.30),
 'cells': (.92,1.00,[2,1,3],.23,.32,.45),
 'glints': (.88,.94,[1,2,1],.29,.18,.28),
 'needles': (.86,.93,[2,3,1],.095,.18,.35),
 'showers': (.88,1.00,[2,1,2,3],.31,.30,.38),
 'drift': (.85,1.05,[1,1,2,1],.72,.30,.25),
 'motif': (.93,.99,[2,1,2,3],.29,.25,.38),
 'gather': (.92,1.03,[1,2,1,3],.35,.42,.48),
 'split': (.86,.98,[2,1,2],0,.23,.36),
 'suspended': (.88,1.02,[1,1,1,2],.85,.65,.65),
 'granules': (.88,.95,[2,1,3],.18,.18,.30),
 'miniature': (.93,.99,[1,1,2,1],.53,.50,.62),
 'rounded': (.92,1.01,[1,2,1,2],.40,.35,.44),
 'flow': (.87,1.05,[1,1,2],.71,.38,.35),
 'haze': (.84,1.04,[1,1,2,1],.68,.40,.30),
 'echo': (.95,1.02,[1,2,1],.72,.62,.68),
 'alternate': (.91,.99,[2,1,3,1],.19,.25,.40),
 'negative': (.88,.97,[1,2,1],.49,.58,.66),
 'memory': (.92,1.01,[2,1,2,3],.31,.30,.45),
 'pressure': (.88,1.04,[1,1,2],.85,.58,.60),
}

# The user asked for a much more legible, continuously choreographed surface.
# These are authored note/answer entrance rates for the seven musical sections,
# not BPM estimates. The compiler picks exact measured attacks inside uneven
# phrase cells. Electronic pieces have quicker independent lines; sustained and
# piano pieces answer less often, with more solitary marks and smaller echoes.
# The local reference, section architecture and primary arrivals stay intact.
DENSE_RATES = {
 1:[1.75,2.05,2.20,1.65,2.30,1.95,1.20],
 2:[.95,1.40,1.65,1.15,2.10,1.85,1.10],
 3:[1.20,1.65,1.35,1.75,1.30,1.60,1.00],
 4:[1.75,2.00,2.30,1.80,2.35,2.05,1.25],
 5:[1.45,1.85,1.55,2.10,1.50,1.90,1.15],
 6:[1.00,1.30,1.45,1.20,1.55,1.25,.90],
 7:[1.35,1.70,1.90,1.55,2.00,1.75,1.10],
 8:[.95,1.20,1.45,1.65,1.95,2.10,1.05],
 9:[1.85,2.20,2.35,1.90,2.40,2.15,1.25],
 10:[1.10,1.40,1.65,1.20,1.75,1.45,1.00],
 11:[1.05,1.30,1.10,1.45,1.55,1.25,.95],
 12:[.90,1.10,1.00,1.20,1.30,1.05,.80],
 13:[1.55,1.90,2.05,1.75,2.20,1.90,1.15],
 14:[1.00,1.20,1.05,1.35,1.10,1.25,.90],
 15:[1.05,1.20,1.10,1.25,1.05,1.15,.85],
 16:[1.40,1.75,2.00,1.70,2.15,1.80,1.10],
 17:[1.50,1.85,2.10,2.20,2.35,2.15,1.30],
 18:[1.05,1.55,1.85,2.00,1.75,1.45,1.00],
 19:[.95,1.20,1.05,1.35,1.10,1.25,.85],
 20:[1.05,1.45,2.00,1.30,1.85,2.25,1.10],
 21:[1.00,1.30,1.05,1.20,1.50,1.20,.95],
 22:[1.50,1.85,2.00,1.65,2.05,1.75,1.05],
 23:[1.15,1.45,1.65,1.30,1.80,1.55,1.00],
 24:[1.00,1.30,1.45,1.20,1.60,1.35,.90],
 25:[.90,1.10,.95,1.15,1.00,1.20,.85],
 26:[1.00,1.25,1.45,1.15,1.55,1.25,.90],
 27:[1.70,2.00,2.20,1.80,2.30,2.05,1.15],
 28:[1.00,1.25,1.40,1.15,1.55,1.30,.95],
 29:[1.15,1.50,1.65,1.25,1.55,1.60,1.00],
 30:[1.40,1.70,1.95,1.55,2.05,1.75,1.05],
 31:[1.00,1.20,1.40,1.15,1.60,1.35,.90],
 32:[1.45,1.80,2.00,1.85,1.95,1.55,1.00],
}

# Phrase-cell rate, principal-mark pressure, answer behavior. Repeated cells
# are the song's spatial refrain, but the selected attacks never form a grid.
# A paired note or echo is separately tied to a real attack, not a timed fake.
DENSE_CELLS = {
 'streams': [(1,.76,'pair'),(.83,.68,'single'),(1.12,.82,'single'),(.94,.73,'pair')],
 'cells': [(1,.82,'pair'),(.78,.65,'single'),(1.15,.86,'single'),(.9,.72,'pair')],
 'glints': [(1,.75,'single'),(1.16,.68,'pair'),(.81,.83,'single'),(1.05,.73,'single')],
 'needles': [(1,.73,'pair'),(1.12,.80,'single'),(.86,.67,'pair'),(1.06,.76,'single')],
 'showers': [(1,.77,'pair'),(.84,.70,'single'),(1.17,.83,'pair'),(.91,.72,'single')],
 'drift': [(1,.74,'single'),(.88,.67,'echo'),(1.08,.81,'single'),(.94,.73,'single')],
 'motif': [(1,.83,'pair'),(.82,.68,'single'),(1.12,.88,'single'),(.96,.75,'pair')],
 'gather': [(.9,.76,'single'),(1,.80,'pair'),(1.13,.86,'single'),(.95,.72,'pair')],
 'split': [(1,.78,'pair'),(.86,.68,'single'),(1.13,.83,'pair'),(.94,.72,'single')],
 'suspended': [(1,.78,'single'),(.84,.67,'single'),(1.11,.83,'echo'),(.92,.72,'single')],
 'granules': [(1,.76,'pair'),(1.14,.69,'single'),(.85,.82,'pair'),(1.03,.72,'single')],
 'miniature': [(1,.82,'single'),(.86,.72,'single'),(1.12,.90,'pair'),(.93,.78,'single'),(1.06,.85,'echo'),(.9,.74,'single')],
 'rounded': [(1,.81,'single'),(.87,.70,'pair'),(1.13,.87,'single'),(.95,.76,'pair')],
 'flow': [(1,.77,'single'),(.83,.69,'echo'),(1.12,.84,'single'),(.95,.74,'single')],
 'haze': [(1,.76,'single'),(.9,.67,'single'),(1.10,.82,'echo'),(.94,.72,'single')],
 'echo': [(1,.82,'echo'),(.84,.69,'single'),(1.13,.88,'echo'),(.93,.74,'single')],
 'alternate': [(1,.84,'pair'),(.87,.71,'single'),(1.12,.89,'pair'),(.93,.76,'single')],
 'negative': [(1,.77,'single'),(.83,.67,'pair'),(1.13,.84,'single'),(.94,.73,'single')],
 'memory': [(1,.82,'pair'),(.85,.69,'single'),(1.13,.88,'pair'),(.94,.75,'single')],
 'pressure': [(1,.79,'single'),(.86,.68,'echo'),(1.10,.85,'single'),(.94,.73,'single')],
}


def dense_note_patterns(index, analysis, accents, breaths, sections, fade, force, scale, language, highlight):
    # Older anchors retain their event-local random identities when many new
    # note marks are inserted. In particular the Logic arrival remains exact.
    for i, accent in enumerate(sorted(accents,key=lambda a:a['time'])):
        accent.setdefault('random_index', i)
    # The old multi-second chance-weather lulls were deliberately sparse. A
    # shorter phrase breath now leaves the music legible without dead stretches.
    for breath in breaths:
        if breath['amount']==0 and 'Measured final fade' not in breath['note'] and not (index==2 and breath['start']==126.90):
            breath['end']=round(min(breath['end'],breath['start']+(1.15 if index in [15,19,25] else .9)),4)
            breath['note']='A short authored phrase breath leaves room for ring decay before the next measured notes.'
    # Keep a little uncued texture, with explicit note choreography dominant.
    # Physical force/solver calibration is unchanged.
    for section in sections:
        section['density']=[round(x*.12,4) for x in section['density']]
        section['background']=round(section['background']*.08,4)
        section['cluster']['probability']*=.45
        section['note']+=' Measured note patterns carry the main surface; incidental weather is held behind them.'
    onsets=analysis['onsets']
    added=0
    principal=0
    cells=DENSE_CELLS[language]
    def clear(at):
        return at<fade and not any(b['amount']==0 and b['start']<=at<b['end'] for b in breaths)
    def active(at):
        # Reject actual very quiet tails/holes, not sustained quiet instruments.
        near=[r for r in analysis['timeline'] if abs(r['time']-at)<=.55]
        return any(r['energy']>=.065 for r in near)
    def vacant(at,gap):
        return all(abs(a['time']-at)>gap for a in accents)
    for si, section in enumerate(sections):
        at=section['start']+.14
        slot=0
        while at<min(section['end'],fade):
            rate, weight, answer=cells[(slot+si)%len(cells)]
            rate*=DENSE_RATES[index][si]
            in_highlight=highlight['start']<=at<highlight['end']
            # The busy flagship cuts were already active in the former chance
            # weather. Their new authored surface gets a real extra voice,
            # rather than merely swapping that activity for measured notes.
            if in_highlight and index in [2,17,30]:
                rate*={2:1.85,17:1.65,30:1.45}[index]
            # Preserve the dramatic hush and exact flagship structural attack.
            if index==2 and 124.55<=at<127.617:rate*=.33
            span=1/rate
            target=at+span*.46
            window=max(.22,span*.47)
            candidates=[o for o in onsets if abs(o['time']-target)<=window and
                        section['start']<=o['time']<section['end'] and
                        clear(o['time']) and active(o['time']) and vacant(o['time'],max(.16,span*.31)) and
                        not (index==2 and 126.6<=o['time']<127.9)]
            if candidates:
                # Attack strength chooses between nearby notes; neither force
                # nor event count follows instantaneous loudness or the beat.
                onset=max(candidates,key=lambda o:o['strength']-.22*abs(o['time']-target)/window)
                note_force=force*weight
                if index==15:note_force=.42*weight
                main={'time':onset['time'],'type':'glint' if language in ['streams','glints','granules','needles','showers'] else 'phrase',
                      'force':round(note_force,4),'scale':round(scale*(.96 if slot%3 else 1.05),4),'count':1,'spacing':0,
                      'anticipation':.09,'quiet':.28,'random_index':1000+si*10000+slot*3,
                      'note':f'Measured pattern: {language} section {si+1}, refrain cell {slot%len(cells)+1}; selected exact note attack, principal mark.'}
                accents.append(main);added+=1;principal+=1
                if index==2 and in_highlight and onset['time']>=127.9 and slot%2==0:
                    # One recorded attack can be a chord. A softer simultaneous
                    # spatial note is an authored second voice, not a fake new
                    # transient or stochastic extra rain.
                    accents.append({'time':onset['time'],'type':'glint',
                              'force':round(note_force*.52,4),'scale':round(main['scale']*.82,4),
                              'count':1,'spacing':0,'anticipation':0,'quiet':.12,
                              'random_index':1002+si*10000+slot*3,
                              'note':f'Measured pattern: {language} section {si+1}, refrain cell {slot%len(cells)+1}; a lighter simultaneous chord voice on the same measured attack.'})
                    added+=1
                if answer!='single':
                    lo=.13 if answer=='pair' else .30
                    hi=min(.48 if answer=='pair' else .70,span*.70)
                    answers=[o for o in onsets if lo<=o['time']-onset['time']<=hi and
                             clear(o['time']) and active(o['time']) and vacant(o['time'],.14)]
                    if answers:
                        reply=max(answers,key=lambda o:o['strength']-.08*abs(o['time']-onset['time']-(lo+hi)/2))
                        accents.append({'time':reply['time'],'type':'glint' if answer=='pair' else 'phrase',
                              'force':round(note_force*(.67 if answer=='pair' else .60),4),
                              'scale':round(main['scale']*(.84 if answer=='pair' else .91),4),'count':1,'spacing':0,
                              'anticipation':0,'quiet':.16,'random_index':1001+si*10000+slot*3,
                              'note':f'Measured pattern: {language} section {si+1}, refrain cell {slot%len(cells)+1}; exact measured {answer} answer, lighter than its principal mark.'})
                        added+=1
            at+=span
            slot+=1
    return added,principal


def phrase_answers(index, analysis, accents, breaths, duration, force, scale, language):
    last_active = max((r['time']+.5 for r in analysis['timeline'] if r['energy'] >= .22), default=duration)
    fade = min(duration, last_active)
    if duration-fade >= 1.5:
        breaths.append({'start':fade,'end':duration,'amount':0,
                        'note':'Measured final fade: let the remaining rings decay without new impacts.'})
    f, z, counts, spacing, anticipation, quiet = PHRASE_SHAPES[language]
    added = 0
    if index==2:
        # Stable event-local randomness preserves the original anchors' exact
        # positions and physical seeds when answers are inserted before them.
        for i, accent in enumerate(sorted(accents,key=lambda a:a['time'])):
            accent['random_index']=i
    def clear(at, count):
        end=at+(count-1)*spacing
        return end < fade and not any(b['amount']==0 and at < b['end'] and end >= b['start'] for b in breaths)
    def active(at):
        return any(r['energy'] >= .22 for r in analysis['timeline'] if abs(r['time']-at) <= .65)
    for i, target in enumerate(PHRASE_WINDOWS[index]):
        count=counts[i%len(counts)]
        candidates=[o for o in analysis['onsets'] if abs(o['time']-target) <= 2.4 and
                    o['strength'] >= .08 and active(o['time']) and clear(o['time'],count) and
                    all(abs(a['time']-o['time']) > 2.0 for a in accents) and
                    (index!=2 or not 123.4 <= o['time'] <= 138.2)]
        if not candidates:continue
        onset=max(candidates,key=lambda o:o['strength']-.12*abs(o['time']-target))
        # Authored variation follows the answer sequence, never loudness or BPM.
        weight=[.96,1.04,.92,1.0][i%4]
        accents.append({'time':onset['time'],'type':'split' if language=='split' else 'glint' if language in ['streams','glints','granules','needles','showers'] else 'phrase',
                        'force':round(force*f*weight,4),'scale':round(scale*z,4),'count':count,'spacing':spacing,
                        'anticipation':anticipation,'quiet':quiet,
                        'note':f'Selected {language} answer near {target:g}s, anchored to a measured attack; surrounding weather stays unquantized.'})
        if index==2:accents[-1]['random_index']=100+i
        added+=1
    return added, fade

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
        index=track['index']; tid=track_id(track)
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
        refinements=['Duration uses decoded reference samples; supplied highlight window is retained.',
                     'Selected arrivals use independently measured attacks; density remains authored.',
                     'Section force follows the authored pressure/release arc; music-only impulse calibration makes it legible with Gentle motion.',
                     'The current frequency revision follows the user’s request for much denser discernible choreography; original sparse direction remains recording provenance, while exact measured note patterns now lead the surface.']
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
        answers, fade=phrase_answers(index,a,accents,breaths,duration,force,scale,language)
        refinements.append(f'{answers} additional song-specific phrase answers use selected measured attacks, with authored force/count and no beat grid; explicit zero breathing spaces remain open.')
        dense,principal=dense_note_patterns(index,a,accents,breaths,sections,fade,force,scale,language,track['recommended_highlight'])
        refinements.append(f'{dense} dense measured note marks ({principal} principal entrances) follow authored section rates and recurring {language} refrain cells; exact measured lighter answers and short phrase breaths replace the sparse surface. Incidental weather is subordinate to this choreography.')
        if fade < duration:
            refinements.append(f'The measured final fade at {fade:g}s releases into ring decay rather than continuing chance rain through silence.')
        score={'schema_version':2,'track_id':tid,'seed':int.from_bytes(hashlib.sha256(('ink-water-weather-v1:'+tid).encode()).digest()[:4],'little'),
            'title':track['title'].removesuffix('(1)').strip(),'artist':saved.get(tid,{}).get('artist') or artists.get(index,''),'duration':duration,
            'style':track['choreography_style'],'direction':track['choreography_notes'],
            'authored_density':track['rain_density'],'authored_force':track['impact_force'],
            'recommended_demo':track['recommended_highlight'],'alternate_demo':track['alternate_highlight'],
            'sections':sections,'accents':sorted(accents,key=lambda x:x['time']),'gestures':sorted(gestures,key=lambda x:x['time']),
            'breaths':sorted(breaths,key=lambda x:x['start']),'refinements':refinements,
            'provenance':{'choreography':f'source/ink-water-32-track-choreography.json#tracks/{index-1}',
                          'analysis':f'analysis/{tid}.json','reference_sha256':a['reference']['sha256']}}
        write(ROOT/'data/music/scores'/f'{tid}.json',score)
        tracks.append({'id':tid,'index':index,'title':score['title'],'artist':score['artist'],'duration':duration,
                       'score':f'scores/{tid}.json','analysis':f'analysis/{tid}.json','reference_sha256':a['reference']['sha256'],
                       'recommended_demo':score['recommended_demo'],
                       'source':None,'source_status':'awaiting-supplied-source-map'})
    manifest={'schema_version':1,'title':'Ink Water — authored weather','preferred_tone':'green-light',
              'playlist_id':'PLTab0IXtn0Nw','order':[track_id(c['tracks'][i-1]) for i in c['playlist_order_indices']], 'tracks':tracks}
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
    write(path,manifest)
    print('32 full-song authored scores; cinematic order and all supplied highlights retained.')


if __name__=='__main__':compile_scores()
