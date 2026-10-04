"""Optional GPU continuity regression: pass exported stroke fixtures and Three.js helpers.

Requires moderngl, numpy and scipy. See README.md for the exact commands.
"""
import json,re,sys
from pathlib import Path
import numpy as np
import moderngl
from scipy import ndimage

data=json.loads(Path(sys.argv[1]).read_text())
helpers=Path(sys.argv[2]).read_text()
ctx=moderngl.create_standalone_context(backend='egl',require=330)
def shader(s,vertex):
 s=re.sub(r'precision\s+\w+\s+\w+\s*;','',s)
 s=s.replace('attribute ','in ').replace('varying ','out ' if vertex else 'in ')
 s=s.replace('gl_FragColor','outputColor')
 prefix='#version 330\n'
 if vertex:prefix+='in vec3 position;in vec2 uv;uniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;\n'
 else:prefix+='out vec4 outputColor;\n'+helpers
 return prefix+s
program=ctx.program(vertex_shader=shader(data['vertex'],True),fragment_shader=shader(data['fragment'],False))
instances=ctx.buffer(reserve=16)
vao=ctx.vertex_array(program,[(ctx.buffer(np.asarray(data['position'],dtype='f4').tobytes()),'3f','position'),(ctx.buffer(np.asarray(data['uv'],dtype='f4').tobytes()),'2f','uv'),(instances,'4f /i','waveStroke')],ctx.buffer(np.asarray(data['index'],dtype='u4').tobytes()),index_element_size=4)
texture=ctx.texture((512,512),4,dtype='f2')
frame=ctx.framebuffer([texture]);frame.use();ctx.viewport=(0,0,512,512)
ctx.enable(moderngl.BLEND);ctx.blend_equation=moderngl.MAX;ctx.blend_func=(moderngl.ONE,moderngl.ONE)
checks=0;maximum_difference=0.
for width in [.35,.68,1.25]:
 for ratio in [1.,1.75]:
  reference=None;previous_energy=float('inf')
  program['lineWeight'].value=width;program['pixelRatio'].value=ratio
  for wave in data['lifetime']:
   for name,key in [('projectionMatrix','projection'),('modelViewMatrix','view')]:program[name].write(np.asarray(wave[key],dtype='f4').tobytes())
   program['worldPixel'].value=wave['worldPixel']
   instances.write(np.asarray([0,0,wave['radius'],wave['opacity']],dtype='f4').tobytes())
   frame.clear(0,0,0,1);vao.render(instances=1)
   image=np.frombuffer(texture.read(),dtype='f2').reshape(512,512,4)[:,:,0].astype('f4')
   assert np.isfinite(image).all()
   mask=image>wave['opacity']*.03
   labels,count=ndimage.label(mask,np.ones((3,3)))
   assert count==1,(width,ratio,wave['step'],'A closed stroke broke into components',count)
   holes=ndimage.binary_fill_holes(mask)&~mask
   assert holes.sum()>100_000,(width,ratio,wave['step'],'Ring is not closed')
   normalized=image/wave['opacity']
   if reference is None:reference=normalized.copy()
   else:
    difference=float(np.max(np.abs(normalized-reference)))
    assert difference<.03,(wave['step'],'Fading changed the shape of a stroke',difference)
    maximum_difference=max(maximum_difference,difference)
   energy=float(image.sum())
   assert energy<=previous_energy*1.005,(wave['step'],'A wave brightened during fading')
   previous_energy=energy;checks+=1
report={'gpuClosedStrokeChecks':checks,'allStrokesOneConnectedClosedRing':True,'widths':[.35,.68,1.25],'pixelRatios':[1,1.75],'fullLifetimeIncludingNearZeroOpacity':True,'wholeWaveFadeShapeError':maximum_difference}
print(json.dumps(report))
