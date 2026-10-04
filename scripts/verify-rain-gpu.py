"""Actual shader regression for independently clocked rain and touch fields."""
import json,re
from pathlib import Path
import numpy as np
import moderngl

source=Path(__file__).resolve().parent.parent/'src/shaders'
ctx=moderngl.create_standalone_context(backend='egl',require=330)
size=(256,256)
quad=np.asarray([[-1,-1,0,0,0],[1,-1,0,1,0],[-1,1,0,0,1],[-1,1,0,0,1],[1,-1,0,1,0],[1,1,0,1,1]],dtype='f4')

def translate(text,vertex):
    text=re.sub(r'precision\s+\w+\s+\w+\s*;','',text)
    text=re.sub(r'\bvarying\b','out' if vertex else 'in',text)
    text=text.replace('texture2D(','texture(').replace('gl_FragColor','outputColor')
    return '#version 330\n'+('in vec3 position;\nin vec2 uv;\n' if vertex else 'out vec4 outputColor;\n')+text

def compile(vertex,fragment):
    p=ctx.program(vertex_shader=translate((source/vertex).read_text(),True),fragment_shader=translate((source/fragment).read_text(),False))
    attrs=[(ctx.buffer(quad[:,:3].tobytes()),'3f','position')]
    if 'uv' in p:attrs.append((ctx.buffer(quad[:,3:].tobytes()),'2f','uv'))
    return p,ctx.vertex_array(p,attrs)

passes={name:compile(name+'.vert',name+'.frag') for name in ['WaterRipple','WaveSimulation','WaterNormal']}
passes['boundary']=compile('Drawing.vert','OpenWaterBoundary.frag')
passes['sum']=compile('Drawing.vert','WaterLayers.frag')

def allocate():
    texture=ctx.texture(size,4,dtype='f4');texture.filter=(moderngl.NEAREST,moderngl.NEAREST);texture.repeat_x=texture.repeat_y=False
    fbo=ctx.framebuffer([texture]);fbo.clear(0,0,0,0)
    return texture,fbo

def render(name,target,textures,**uniforms):
    p,q=passes[name]
    for unit,(key,texture) in enumerate(textures.items()):texture.use(unit);p[key].value=unit
    for key,value in uniforms.items():
        if key in p:p[key].value=value
    target[1].use();ctx.viewport=(0,0,*size);q.render()

def values(target):return np.frombuffer(target[0].read(),dtype='f4').reshape(256,256,4).copy()

class Field:
    def __init__(self):self.a,self.b,self.spare=[allocate() for _ in range(3)]
    def wavepass(self,name,**options):
        render(name,self.b,{'tInput':self.a[0]},delta=(1/256,1/256),poolWidth=1.,poolLength=1.,**options)
        self.a,self.b=self.b,self.a
    def step(self):
        self.wavepass('WaveSimulation')
        render('boundary',self.spare,{'currentWater':self.a[0],'previousWater':self.b[0]},delta=(1/256,1/256))
        self.a,self.spare=self.spare,self.a

touch,rain,reference=Field(),Field(),Field()
for field in [touch,rain,reference]:field.wavepass('WaterRipple',center=(.08,-.04),radius=.024,strength=-.01)
for i in range(120):touch.step();reference.step()
for i in range(68):rain.step()
assert np.array_equal(values(touch.a),values(reference.a)),'Independent rain must not change the full-speed touch field'
assert not np.array_equal(values(touch.a)[:,:,:2],values(rain.a)[:,:,:2]),'Slow rain and touch must occupy different wave positions'
touch.wavepass('WaterNormal');rain.wavepass('WaterNormal')
before_touch=values(touch.a);before_rain=values(rain.a)
combined,normal=allocate(),allocate()
render('sum',combined,{'touchWater':touch.a[0],'rainWater':rain.a[0]},joinStrokes=False)
added=values(combined)
np.testing.assert_allclose(added[:,:,:2],before_touch[:,:,:2]+before_rain[:,:,:2],rtol=1e-6,atol=1e-9)
render('WaterNormal',normal,{'tInput':combined[0]},delta=(1/256,1/256),poolWidth=1.,poolLength=1.)
actual=values(normal);height=added[:,:,0]
dx=np.concatenate([height[:,1:]-height[:,:-1],np.zeros((256,1),dtype='f4')],axis=1)
dz=np.concatenate([height[1:,:]-height[:-1,:],np.zeros((1,256),dtype='f4')],axis=0)
denominator=np.sqrt((2/256)**2+dx*dx+dz*dz)
np.testing.assert_allclose(actual[:,:,2],-dx/denominator,rtol=2e-5,atol=2e-7)
np.testing.assert_allclose(actual[:,:,3],-dz/denominator,rtol=2e-5,atol=2e-7)
assert np.isfinite(actual).all()
assert np.array_equal(values(touch.a),before_touch) and np.array_equal(values(rain.a),before_rain),'The presentation must not mutate either solver'
# Optional hairline masks keep both complete wave trains using maximum coverage.
render('sum',combined,{'touchWater':touch.a[0],'rainWater':rain.a[0]},joinStrokes=True)
np.testing.assert_array_equal(values(combined),np.maximum(before_touch,before_rain))
print(json.dumps({'renderer':ctx.info['GL_RENDERER'],'newShaderLinksWithActualVertex':True,'touchSteps':120,'rainSteps':68,'touchRemainsExactSource':True,'combinedHeightAndVelocity':True,'normalsFromCombinedHeight':True,'presentationNeverChangesPhysics':True,'strokeMaskComposition':True}))
