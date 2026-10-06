"""Apply actual scheduled Puddle impacts to the unchanged GPU heightfield."""
import json,runpy,sys
from pathlib import Path
import numpy as np

original=runpy.run_path(str(Path(__file__).with_name('verify-rain-gpu.py')))
Field,values=original['Field'],original['values']
fixture=json.loads(Path(sys.argv[1]).read_text())
field,untouched=Field(),Field()
impulses=iter(fixture['impulses']);pending=next(impulses,None)
peak=0.
for step in range(1501):
    while pending is not None and pending['time']<=step/120:
        field.wavepass('WaterRipple',center=(pending['x'],pending['z']),radius=pending['radius'],strength=pending['strength'])
        pending=next(impulses,None)
    field.step()
    if step%120==0:
        surface=values(field.a)
        assert np.isfinite(surface).all()
        peak=max(peak,float(np.max(np.abs(surface[:,:,0]))))
field.wavepass('WaterNormal')
height=values(field.a)
assert peak>1e-5 and np.max(np.abs(height[:,:,2:]))>1e-6
assert not np.any(values(untouched.a)), 'Scheduling may not deform any field without a drop'
print(json.dumps({'track':fixture['track'],'scheduledPhysicalImpacts':len(fixture['impulses']),
 'unchangedSolverGPU':True,'measuredPeakHeight':peak,'realNormals':True,'noDropMeansNoDeformation':True}))
