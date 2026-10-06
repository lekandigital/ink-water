"""Render real Puddle music impulses with the existing ink/bitmap/caustic shaders.

Requires the normal exported GPU fixtures plus music-physical-fixtures.json.
Uses the shared regression renderer setup, without running its unrelated sweeps.
No browser timing or substitute ripple shader is used for this visibility check.
"""
import json, math, sys
from pathlib import Path
import numpy as np

helper=Path(__file__).with_name('verify-bitmap-gpu.py')
setup=helper.read_text().split("\nreset();simpass('WaterRipple'",1)[0]
exec(compile(setup,str(helper),'exec'),globals())
music=json.loads((root/'music-physical-fixtures.json').read_text())['fixtures']
options={'lightAzimuth':170,'lightElevation':90,'causticsStrength':2,'bitmapTones':True,'shortReferenceLines':True}
quiet={}
reset();simpass('WaterNormal')
for tone in ['paper','silver','night','green-light','green-dark']:quiet[tone]=render(tone=tone,**options)
records=[]
for song in music:
    # First mark and a principal selected accent, at the actual gentle defaults.
    # A force-zero control is tested separately in the JS physical path.
    row={'track':song['track'],'sample_visibility':[]}
    for sample in song['samples']:
        reset();simpass('WaterRipple',center=[sample['x'],sample['z']],radius=sample['radius'],strength=sample['strength']);steps(12)
        before=water_textures[current].read()
        for tone in ['night','green-light']:
            image=render(tone=tone,**options)
            difference=np.max(np.abs(image.astype(int)-quiet[tone].astype(int)),axis=2)
            changed=int(np.count_nonzero(difference>3));contrast=int(difference.max())
            assert changed>35 and contrast>8, f"Physical music mark is illegible: {song['track']} {tone} {sample['kind']} {changed} {contrast}"
            row['sample_visibility'].append({'tone':tone,'kind':sample['kind'],'changed_pixels':changed,'maximum_contrast':contrast,'physical_force':sample['strength']})
        assert before==water_textures[current].read(),'Rendering music cannot alter the physical solver'
    records.append(row)

# Full excerpt with the same slowed default rain clock. Sampling water motion
# remains separate from music time, which schedules each physical arrival.
for song in [s for s in music if s['track'] in ['02-fused-dj-kicks','18-birch-beer-forest','15-190304-05']]:
    reset();accumulator=0.;cursor=0;metrics=[]
    for frame in range(1,math.ceil(song['duration']*60)+1):
        elapsed=frame/60
        speed=song['selectedSpeed']*(.64-.22*math.cos(elapsed*math.pi/12))
        accumulator+=speed/60
        while accumulator>=1/60:
            steps(2);accumulator-=1/60
        while cursor<len(song['impulses']) and song['impulses'][cursor]['time']<=elapsed+1e-8:
            drop=song['impulses'][cursor];cursor+=1
            simpass('WaterRipple',center=[drop['x'],drop['z']],radius=drop['radius'],strength=drop['strength']);simpass('WaterNormal')
        if frame%60==0:
            name=f"{song['track']}-{frame//60:02d}" if frame//60 in [2,5,10,12] else None
            image=render(name,tone='green-light',**options)
            metrics.append(int(np.count_nonzero(np.max(np.abs(image.astype(int)-quiet['green-light'].astype(int)),axis=2)>3)))
    assert cursor==len(song['impulses']),'Full excerpt must consume the scheduled physical impacts exactly once'
    assert max(metrics)>100,'The default slowed music scene must visibly evolve'
    if song['track']=='02-fused-dj-kicks':
        assert max(metrics[:3])>100,'The flagship opening must have real pre-roll texture before its main arrival'
    records[next(i for i,r in enumerate(records) if r['track']==song['track'])]['excerpt']={'physical_impacts':cursor,'changed_pixels_per_second':metrics,'dreamy_rain_clock':True}
report={'schema_version':1,'renderer':ctx.info['GL_RENDERER'],'tracks':records,'defaultGentleMotion':True,'normalInkBitmapAndCaustics':True,'sourceSolverUnchanged':True}
(root/'music-render-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'realGPUInkRenderer':True,'visibleMusicTracks':len(records),'checkedDrawingTones':['night','green-light'],'fullSlowRainExcerpts':3,'readOnlyRendering':True,'report':str(root/'music-render-report.json')}))
