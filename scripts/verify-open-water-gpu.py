"""Optional open-edge regression. Requires moderngl and numpy.

Run from the repo: python scripts/verify-open-water-gpu.py
Executes the original wave/drop shaders plus the actual open-boundary shader.
"""
import json,re
from pathlib import Path
import numpy as np
import moderngl

root=Path(__file__).resolve().parents[1]
ctx=moderngl.create_standalone_context(backend='egl',require=330)
vertex='''#version 330
in vec2 position;out vec2 coord;
void main(){coord=position*.5+.5;gl_Position=vec4(position,0,1);}
'''
passes={}
for name in ['WaterRipple','WaveSimulation','OpenWaterBoundary']:
 source=(root/'src/shaders'/(name+'.frag')).read_text()
 fragment=re.sub(r'precision\s+\w+\s+\w+\s*;','',source)
 fragment=fragment.replace('varying vec2 coord;','in vec2 coord;').replace('texture2D(','texture(').replace('gl_FragColor','outputColor')
 p=ctx.program(vertex_shader=vertex,fragment_shader='#version 330\nout vec4 outputColor;\n'+fragment)
 q=ctx.vertex_array(p,[(ctx.buffer(np.asarray([-1,-1,1,-1,-1,1,1,1],dtype='f4').tobytes()),'2f','position')])
 if 'tInput' in p:p['tInput'].value=0
 if 'delta' in p:p['delta'].value=(1/256,1/256)
 for u in ['poolWidth','poolLength']:
  if u in p:p[u].value=1.
 if 'currentWater' in p:p['currentWater'].value=0;p['previousWater'].value=1
 passes[name]=(p,q)
ctx.viewport=(0,0,256,256)
xy=(np.arange(256)+.5)/128-1
x,z=np.meshgrid(xy,xy)
interior=(np.abs(x)<.55)&(np.abs(z)<.55)
unchanged=(np.abs(x)<=.6875)&(np.abs(z)<=.6875)

def simulate(center,opened):
 textures=[ctx.texture((256,256),4,dtype='f4') for _ in range(3)]
 for t in textures:t.filter=(moderngl.NEAREST,moderngl.NEAREST);t.repeat_x=t.repeat_y=False
 frames=[ctx.framebuffer([t]) for t in textures]
 for f in frames:f.clear(0,0,0,0)
 current,previous,spare=0,1,2
 def source_pass(name):
  nonlocal current,previous
  textures[current].use(0);frames[previous].use();passes[name][1].render(moderngl.TRIANGLE_STRIP)
  current,previous=previous,current
 p=passes['WaterRipple'][0];p['center'].value=center;p['radius'].value=.038;p['strength'].value=-.02
 source_pass('WaterRipple')
 late_energy=0.;peak=0.;first=None
 for step in range(1,721):
  source_pass('WaveSimulation')
  if opened:
   textures[current].use(0);textures[previous].use(1);frames[spare].use();passes['OpenWaterBoundary'][1].render(moderngl.TRIANGLE_STRIP)
   current,spare=spare,current
  if step==1:first=np.frombuffer(textures[current].read(),dtype='f4').reshape(256,256,4).copy()
  if step>=400 and step%8==0:
   state=np.frombuffer(textures[current].read(),dtype='f4').reshape(256,256,4)
   assert np.isfinite(state).all()
   h=state[:,:,0].astype('f8');v=state[:,:,1].astype('f8')
   gx,gz=np.gradient(h)
   # Energy of the source wave equation: kinetic velocity plus spatial slope.
   # A constant residual height is not a travelling/returning ripple.
   late_energy+=float(np.sum((v*v+.5*(gx*gx+gz*gz))[interior]))
   peak=max(peak,float(np.max(np.abs(h[interior]))))
 for f in frames:f.release()
 for t in textures:t.release()
 return late_energy,peak,first

results=[]
for center in [(0.,0.),(.52,.1),(.52,.52)]:
 closed=simulate(center,False);opened=simulate(center,True)
 assert np.array_equal(closed[2][unchanged],opened[2][unchanged]),'Open edges must preserve the original interior update'
 ratio=opened[0]/closed[0]
 assert ratio<.01,('Returning wave energy is not sufficiently absorbed',center,ratio)
 results.append({'center':center,'lateInteriorEnergyRatio':ratio,'openLatePeakHeight':opened[1]})
print(json.dumps({'openBoundaryCases':results,'interiorSourceUpdatePreserved':True,'lateReturningEnergyReducedByMoreThan99Percent':True}))
