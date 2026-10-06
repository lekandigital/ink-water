"""Refraction maps must depend on the actual solver, and never write to it."""
import json,runpy
from pathlib import Path
import numpy as np

gpu=runpy.run_path(str(Path(__file__).with_name('verify-rain-gpu.py')))
ctx,Field,values,compile=gpu['ctx'],gpu['Field'],gpu['values'],gpu['compile']
p,quad=compile('Drawing.vert','MusicRefraction.frag')
size=(80,80)
texture=ctx.texture(size,4,dtype='f4')
target=ctx.framebuffer([texture])
# Orthographic straight-down view maps x/z into screen x/y. Explicit matrix
# exercises the same projection math without depending on a browser driver.
inverse=np.asarray([[1,0,0,0],[0,0,-2,2],[0,-1,0,0],[0,0,0,1]],dtype='f4')
p['inverseViewProjection'].write(inverse.T.tobytes())
p['viewProjection'].write(np.linalg.inv(inverse).T.astype('f4').tobytes())
p['eye'].value=(0,4.5,0);p['screenRect'].value=(0,0,1,1);p['screenSize'].value=(1000,1000);p['water'].value=0
def sample(field):
    field.a[0].use(0);target.use();ctx.viewport=(0,0,*size);quad.render()
    return np.frombuffer(texture.read(),dtype='f4').reshape(80,80,4).copy()
field=Field();flat=sample(field)
# Perspective arithmetic may leave <0.0002px of numerical displacement.
np.testing.assert_allclose(flat[:,:,:2],.5,atol=5e-6)
field.wavepass('WaterRipple',center=(.1,-.04),radius=.04,strength=-.01)
for _ in range(12):field.step()
field.wavepass('WaterNormal');before=values(field.a);ripple=sample(field)
assert np.isfinite(ripple).all()
assert np.max(np.abs(ripple[:,:,:2]-.5))>.01,'A physical impact must visibly bend the map'
np.testing.assert_array_equal(before,values(field.a))
assert np.all((ripple[:,:,:2]>=0)&(ripple[:,:,:2]<=1))
# A second, independently clocked field is composed using the existing layer
# shader; its contribution must also bend the player, not just touch waves.
rain=Field();rain.wavepass('WaterRipple',center=(-.2,.15),radius=.06,strength=-.008)
for _ in range(7):rain.step()
rain.wavepass('WaterNormal')
combined=Field();gpu['render']('sum',combined.a,{'touchWater':field.a[0],'rainWater':rain.a[0]},joinStrokes=False)
combined.wavepass('WaterNormal');mixed=sample(combined)
assert np.max(np.abs(mixed-ripple))>.005
np.testing.assert_array_equal(before,values(field.a))
print(json.dumps({'flatWaterNoWarp':True,'physicalImpactBendsPlayer':True,'rainAndTouchCombined':True,'boundedRefraction':True,'solverReadOnly':True,'renderer':ctx.info['GL_RENDERER']}))
