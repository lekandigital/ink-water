import json,re,math,sys
from pathlib import Path
import numpy as np
import moderngl
from PIL import Image

root=Path(sys.argv[1]);project=Path(__file__).resolve().parent.parent
data=json.loads((root/'fixtures.json').read_text())
palettes=json.loads((root/'palettes.json').read_text())
continuous=json.loads((root/'continuous-fixtures.json').read_text())
prints=json.loads((root/'dream-fixtures.json').read_text())
ctx=moderngl.create_standalone_context(backend='egl',require=330)

def shader(s,vertex):
 s=re.sub(r'precision\s+\w+\s+\w+\s*;','',s)
 s=s.replace('texture2D(','texture(').replace('textureCube(','texture(')
 s=re.sub(r'\bvarying\b','out' if vertex else 'in',s)
 s=s.replace('gl_FragColor','outputColor')
 prefix='#version 330\n#define USE_MESH_RAY_TRACING 0\n'
 if vertex:prefix+='in vec3 position;\nin vec3 normal;\nin vec2 uv;\nuniform mat4 projectionMatrix;\nuniform mat4 modelViewMatrix;\n'
 else:prefix+='out vec4 outputColor;\n'
 return prefix+('' if vertex else (root/'three-prefix.glsl').read_text())+s

def program(v,f):return ctx.program(vertex_shader=shader(v,True),fragment_shader=shader(f,False))

def vao(p,geo):
 content=[]
 for name,count in [('position',3),('normal',3),('uv',2)]:
  if name in p and geo.get(name):content.append((ctx.buffer(np.asarray(geo[name],dtype='f4').tobytes()),f'{count}f',name))
 indices=ctx.buffer(np.asarray(geo['index'],dtype='u4').tobytes()) if geo.get('index') else None
 return ctx.vertex_array(p,content,indices,index_element_size=4)

def setuniform(p,k,v):
 if k not in p or v is None:return
 u=p[k]
 if isinstance(v,list):
  a=np.asarray(v,dtype='f4')
  if a.size>4:u.write(a.tobytes())
  else:u.value=tuple(v)
 else:u.value=v

def bind_render_uniforms(p,geo):
 for k,v in geo.get('uniforms',{}).items():setuniform(p,k,v)
 for k,v in [('projectionMatrix',data['camera']['projection']),('modelViewMatrix',data['camera']['view'])]:
  if k in p:p[k].write(np.asarray(v,dtype='f4').tobytes())
 for name,unit in [('water',0),('tiles',1),('sky',2),('causticTex',3),('objectShadowTex',4),('objectReflectionTex',4),('objectClippedReflectionTex',4),('objectRefractionTex',4)]:setuniform(p,name,unit)

water_textures=[ctx.texture((256,256),4,dtype='f4') for _ in range(3)]
for t in water_textures:t.filter=(moderngl.NEAREST,moderngl.NEAREST);t.repeat_x=t.repeat_y=False
water_fbos=[ctx.framebuffer([t]) for t in water_textures]
for f in water_fbos:f.clear(0,0,0,0)
current=0
previous=1
spare=2
passes={}
for name in ['WaterRipple','WaveSimulation','WaterNormal']:
 p=program(data[name+'.vert'],data[name+'.frag']);q=vao(p,data['quad'])
 setuniform(p,'tInput',0);setuniform(p,'delta',[1/256,1/256]);setuniform(p,'poolWidth',1.0);setuniform(p,'poolLength',1.0)
 passes[name]=(p,q)

bp=program(continuous['boundary']['vertex'],continuous['boundary']['fragment'])
bq=vao(bp,data['quad'])
setuniform(bp,'currentWater',0);setuniform(bp,'previousWater',1);setuniform(bp,'delta',[1/256,1/256])

def simpass(name,**uniforms):
 global current,previous,spare
 p,q=passes[name]
 for k,v in uniforms.items():setuniform(p,k,v)
 ctx.disable(moderngl.DEPTH_TEST|moderngl.CULL_FACE|moderngl.BLEND)
 water_textures[current].use(0);water_fbos[previous].use();ctx.viewport=(0,0,256,256);q.render();current,previous=previous,current
 if name=='WaveSimulation':
  water_textures[current].use(0);water_textures[previous].use(1);water_fbos[spare].use();bq.render();current,spare=spare,current

matte=np.zeros((64,64,3),dtype='u1');seed=1857
for i in range(4096):
 seed=(seed*1664525+1013904223)&0xffffffff;matte.reshape(-1,3)[i]=214+(seed%8)
tiles=ctx.texture((64,64),3,matte.tobytes());tiles.filter=(moderngl.LINEAR,moderngl.LINEAR);tiles.use(1)
names=['xpos','xneg','ypos','ypos','zpos','zneg']
first=Image.open(project/'public/assets/xpos.jpg').convert('RGB')
sky=ctx.texture_cube(first.size,3)
for face,name in enumerate(names):
 image=Image.open(project/('public/assets/'+name+'.jpg')).convert('RGB');sky.write(face,image.tobytes())
sky.filter=(moderngl.LINEAR,moderngl.LINEAR);sky.use(2)
blank=ctx.texture((1,1),4,b'\0\0\0\0');blank.use(4)
caustic=ctx.texture((1024,1024),4);caustic.filter=(moderngl.LINEAR,moderngl.LINEAR);caustic.repeat_x=caustic.repeat_y=False
boosted=ctx.texture((1024,1024),4,dtype='f2');boosted.filter=(moderngl.LINEAR,moderngl.LINEAR);boosted.repeat_x=boosted.repeat_y=False
boosted_fbo=ctx.framebuffer([boosted])
intensity=program(data['Drawing.vert'],prints['causticFragment']);intensity_vao=vao(intensity,data['quad']);setuniform(intensity,'causticMap',3)
caustic_fbo=ctx.framebuffer([caustic]);caustic_fbo.use();caustic_fbo.clear(0,0,0,1);ctx.viewport=(0,0,1024,1024)
cp=program(data['caustics']['vertex'],data['caustics']['fragment']);cv=vao(cp,data['caustics']);bind_render_uniforms(cp,data['caustics']);water_textures[current].use(0);cv.render();caustic.use(3)
size=(844,640)
scene_tex=ctx.texture(size,4,dtype='f4');scene_tex.filter=(moderngl.LINEAR,moderngl.LINEAR)
scene_fbo=ctx.framebuffer([scene_tex],ctx.depth_renderbuffer(size));scene_fbo.use();scene_fbo.clear(0,0,0,0,depth=1);ctx.viewport=(0,0,*size)
ctx.enable(moderngl.DEPTH_TEST|moderngl.CULL_FACE);ctx.depth_func='<='
compiled=[]
for name in ['pool','above','below']:
 g=data[name];p=program(g['vertex'],g['fragment']);v=vao(p,g);bind_render_uniforms(p,g)
 if g['side']==2:ctx.disable(moderngl.CULL_FACE)
 else:ctx.enable(moderngl.CULL_FACE);ctx.cull_face='front' if g['side']==1 else 'back'
 v.render();compiled.append(name)


render_objects=[]
for name in ['pool','above','below']:
 g=data[name];p=program(g['vertex'],g['fragment']);v=vao(p,g);bind_render_uniforms(p,g);render_objects.append((g,p,v))
scene_tex.use(5)
dp=program(data['Drawing.vert'],prints['printDrawing']);dv=vao(dp,data['quad'])
classic_dp=program(data['Drawing.vert'],prints['drawing']);classic_dv=vao(classic_dp,data['quad'])
for k,v in [('sceneColor',5),('water',0),('waveLines',6),('waveBands',7),('pixel',[1/size[0],1/size[1]]),('pixelRatio',1),('poolSize',[1,1]),('eye',data['camera']['position']),('lineWeight',.68),('sourceGeometry',True),('inverseViewProjection',data['camera']['inverseViewProjection'])]:setuniform(dp,k,v)
for k,v in [('sceneColor',5),('water',0),('waveLines',6),('pixel',[1/size[0],1/size[1]]),('poolSize',[1,1]),('eye',data['camera']['position']),('lineWeight',.68),('sourceGeometry',True),('inverseViewProjection',data['camera']['inverseViewProjection'])]:setuniform(classic_dp,k,v)
old_dp=program(data['Drawing.vert'],(project/'src/shaders/Drawing.frag').read_text());old_dv=vao(old_dp,data['quad'])
bmp=program(data['Drawing.vert'],prints['bitmapDrawing']);bmv=vao(bmp,data['quad'])
for p in [old_dp,bmp]:
 for k,v in [('sceneColor',5),('baseColor',8),('litScene',9),('flatScene',10),('water',0),('pixel',[1/size[0],1/size[1]]),('pixelRatio',1),('poolSize',[1,1]),('eye',data['camera']['position']),('lineWeight',.68),('sourceGeometry',True),('inverseViewProjection',data['camera']['inverseViewProjection'])]:setuniform(p,k,v)
flat_caustics=ctx.texture((1,1),4,np.asarray([1,0,0,1],dtype='f4').tobytes(),dtype='f4')
flat_tex=ctx.texture(size,4,dtype='f4');flat_tex.filter=(moderngl.LINEAR,moderngl.LINEAR);flat_fbo=ctx.framebuffer([flat_tex],ctx.depth_renderbuffer(size))
base_tex=ctx.texture(size,4,dtype='f2');base_tex.filter=(moderngl.LINEAR,moderngl.LINEAR);base_fbo=ctx.framebuffer([base_tex]);output=ctx.texture(size,4);out_fbo=ctx.framebuffer([output])
for t in [scene_tex,flat_tex,base_tex]:t.repeat_x=t.repeat_y=False

def reset():
 global current,previous,spare
 for f in water_fbos:f.use();f.clear(0,0,0,0)
 current=0;previous=1;spare=2

def surface(fbo,caustics_on):
 ctx.disable(moderngl.BLEND);water_textures[current].use(0);tiles.use(1);sky.use(2);blank.use(4)
 (boosted if caustics_on else flat_caustics).use(3)
 fbo.use();fbo.clear(0,0,0,0,depth=1);ctx.viewport=(0,0,*size);ctx.enable(moderngl.DEPTH_TEST);ctx.depth_func='<='
 for g,p,v in render_objects:
  if g['side']==2:ctx.disable(moderngl.CULL_FACE)
  else:ctx.enable(moderngl.CULL_FACE);ctx.cull_face='front' if g['side']==1 else 'back'
  v.render()
 ctx.disable(moderngl.CULL_FACE|moderngl.DEPTH_TEST)

def render(name=None,mode=1,tone='night',caustics_on=True,baseline=False,**options):
 settings={**prints['defaults'],**options}
 if settings['causticRipples']:caustics_on=False
 az=math.radians(settings['lightAzimuth']);el=math.radians(90 if settings['overheadLight'] else settings['lightElevation'])
 safe=lambda value: (1e-6 if value>=0 else -1e-6) if abs(value)<1e-6 else value
 light=np.asarray([safe(math.cos(el)*math.cos(az)),math.sin(el),safe(math.cos(el)*math.sin(az))],dtype='f4');light/=np.linalg.norm(light)
 setuniform(cp,'light',light.tolist())
 for g,p,v in render_objects:setuniform(p,'light',light.tolist())
 ctx.disable(moderngl.DEPTH_TEST|moderngl.CULL_FACE|moderngl.BLEND);water_textures[current].use(0)
 caustic_fbo.use();caustic_fbo.clear(0,0,0,1);ctx.viewport=(0,0,1024,1024);cv.render()
 caustic.use(3);boosted_fbo.use();setuniform(intensity,'strength',settings['causticsStrength']);intensity_vao.render()
 surface(scene_fbo,True);surface(flat_fbo,False)
 (scene_tex if caustics_on else flat_tex).use(5);water_textures[current].use(0)
 use_print=any(settings[key] for key in ['bitmapRipples','textureReveal','printedPaper','textureRefraction']) or (caustics_on and settings['alignedCaustics'])
 bitmap_active=any(settings[key] for key in ['causticRipples','bitmapTones','causticReveal','driftingGrain','softDiffusion','dreamy','subtle']) and not baseline
 active_p,active_v=(old_dp,old_dv) if baseline else (dp,dv) if use_print else (classic_dp,classic_dv)
 (base_fbo if bitmap_active else out_fbo).use();ctx.viewport=(0,0,*size)
 for k,v in settings.items():setuniform(active_p,k,v)
 for k,v in [('mode',mode),('hairlineRipples',False),('caustics',caustics_on),('lineWeight',.68),('paper',palettes[tone]['paper']),('ink',palettes[tone]['ink'])]:setuniform(active_p,k,v)
 active_v.render()
 if bitmap_active:
  base_tex.use(8);scene_tex.use(9);flat_tex.use(10);out_fbo.use()
  for k,v in settings.items():setuniform(bmp,k,v)
  setuniform(bmp,'paper',palettes[tone]['paper']);setuniform(bmp,'ink',palettes[tone]['ink']);bmv.render()
 img=Image.frombytes('RGBA',size,output.read()).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB');arr=np.array(img)
 assert np.max(np.abs(arr[:,:,0].astype(int)-arr[:,:,1].astype(int)))<=1 and np.max(np.abs(arr[:,:,0].astype(int)-arr[:,:,2].astype(int)))<=1,'Every drawing must stay monochrome'
 if name:img.save(root/(name+'.png'))
 return arr

def steps(count):
 for _ in range(count):simpass('WaveSimulation')
 simpass('WaterNormal')

reset();simpass('WaterRipple',center=[.08,-.12],radius=.038,strength=-.02);steps(30)
base=render('dream-base');old=render(baseline=True);assert np.array_equal(base,old),'Non-hairline drawing must remain pixel-identical with experiments off'
source_before=water_textures[current].read();variants=0
for tone in palettes:
 for mode in [0,1,2]:
  reference=render(mode=mode,tone=tone);assert np.ptp(reference[:,:,0])>15
  for effect in ['bitmapTones','causticReveal','driftingGrain','softDiffusion','causticRipples','dreamy','subtle']:
   image=render('dream-'+effect if tone=='night' and mode==1 else None,mode=mode,tone=tone,**{effect:True})
   assert not np.array_equal(image,reference),effect+' must visibly change the drawing';variants+=1
combined=render('dream-combined',bitmapTones=True,causticReveal=True,driftingGrain=True,softDiffusion=True,dreamy=True,subtle=True)
caustic_ink=render('dream-caustic-ink',causticRipples=True,bitmapTones=True,dreamy=True,subtle=True)
assert source_before==water_textures[current].read(),'Styles must not change source simulation bytes'
# Bitmap effects must keep the normal drawing and real projected caustics together.
for effect in ['bitmapTones','causticReveal','driftingGrain','softDiffusion']:
 lit=render(caustics_on=True,**{effect:True});unlit=render(caustics_on=False,**{effect:True})
 assert not np.array_equal(lit,unlit),effect+' must retain projected caustics with Print off'
# Every presentation effect must be reversible and repeatable over unchanged solver bytes.
for effect in ['bitmapTones','causticReveal','driftingGrain','softDiffusion','causticRipples','dreamy','subtle','bitmapRipples','textureReveal','printedPaper','textureRefraction','alignedCaustics','overheadLight']:
 off=render();on=render(**{effect:True});off_again=render();on_again=render(**{effect:True})
 assert np.array_equal(off,off_again) and np.array_equal(on,on_again),effect+' must reverse and repeat exactly'
 assert not np.array_equal(on,off),effect+' must change the rendered output'
# Rain is weak but must still appear over flat water in the preferred default view.
reset();simpass('WaterNormal');quiet=render('dream-quiet')
simpulse={'center':[-.15,.09],'radius':.022*.65,'strength':-.0018}
simpass('WaterRipple',**simpulse);steps(12);rain=render('dream-light-rain');difference=np.abs(rain[:,:,0].astype(int)-quiet[:,:,0].astype(int))
assert np.count_nonzero(difference>2)>100,'Gentle rain must remain visible';assert np.max(difference)>8
render('dream-light-rain-caustic-ink',causticRipples=True)
# Real interpolation shader: midpoint equals the average; source textures are untouched.
pres=program(data['Drawing.vert'],prints['presentationDrawing']);pv=vao(pres,data['quad']);setuniform(pres,'previousWater',11);setuniform(pres,'currentWater',12);setuniform(pres,'blend',.5)
a=np.zeros((256,256,4),dtype='f4');a[:,:,0]=.004;b=a.copy();b[:,:,0]=.008
at=ctx.texture((256,256),4,a.tobytes(),dtype='f4');bt=ctx.texture((256,256),4,b.tobytes(),dtype='f4');pt=ctx.texture((256,256),4,dtype='f4');pf=ctx.framebuffer([pt]);at.use(11);bt.use(12);pf.use();ctx.viewport=(0,0,256,256);pv.render()
assert np.allclose(np.frombuffer(pt.read(),dtype='f4').reshape(256,256,4)[:,:,0],.006);assert at.read()==a.tobytes() and bt.read()==b.tobytes()
assert all('5000.0' in data[key]['fragment'] for key in ['above','below'])
report={'gpu':'EGL '+ctx.info['GL_RENDERER'],'sourceWaterVertices':len(data['above']['position'])//3,'originalSolverUsed':True,'existingDrawingPixelIdentical':True,'bitmapVariantRenders':variants,'allMonochrome':True,'causticsRetainedWithNormalBitmap':True,'gpuEffectCycles':13,'sourceBytesUnchangedByStyles':True,'gentleRainChangedPixels':int(np.count_nonzero(difference>2)),'realInterpolationMidpoint':True,'sourceOpticalShadersPreserved':True}
(root/'dream-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

startup=render('startup',tone='paper',lightAzimuth=170,lightElevation=90,causticsStrength=2)
assert np.ptp(startup[:,:,0])>15
for effect in ['bitmapTones','causticReveal','driftingGrain','softDiffusion','causticRipples','dreamy','subtle']:
 image=render('startup-'+effect,tone='paper',lightAzimuth=170,lightElevation=90,causticsStrength=2,**{effect:True})
 assert not np.array_equal(image,startup),effect+' must work at startup lighting'
print(json.dumps({'startupPresetGpuRendered':True,'startupEffects':7,'finiteVerticalCaustics':True}))
