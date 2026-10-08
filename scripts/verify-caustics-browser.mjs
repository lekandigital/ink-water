import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';

// Point INK_WATER_SOURCE at an unchanged checkout of commit
// 097638c1583ca758da97703f809771e04445129e to compare the caustic change.
// Both checkouts need their npm dependencies installed.
const root=fileURLToPath(new URL('../',import.meta.url));
const upstream=resolve(process.env.INK_WATER_SOURCE||resolve(root,'../ink-water-base'));
process.chdir(root);
const servers=await Promise.all([root,upstream].map((directory,index)=>createServer({
 root:directory,configFile:directory+'/vite.config.mjs',cacheDir:root+'/node_modules/.cache/ink-comparison-'+index,
 server:{host:'127.0.0.1',port:4173+index,strictPort:true},
})));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 await Promise.all(servers.map(server=>server.listen()));
 const pages=[];
 for(let index=0;index<2;index++){
  const page=await browser.newPage({viewport:{width:480,height:320},colorScheme:'dark'});
  await page.goto('http://127.0.0.1:'+(4173+index)+'/?capture=1&seed=47');
  await page.waitForFunction(()=>window.inkWaterCapture?.ready);
  // Legacy paper keeps the intentional green caustic recoloring out of the
  // source-renderer comparison. A separate check below covers that enhancement.
  await page.evaluate(()=>window.inkWaterCapture.apply({type:'settings',settings:{tone:'paper',shortReferenceLines:false}},{type:'still'}));
  pages.push(page);
 }
 const cases=[
  {name:'touch and drag waves',actions:[{type:'touch',x:-.3,y:.2},{type:'touch',x:.2,y:-.1}],frames:8},
  {name:'independent dreamy rain field',actions:[{type:'settings',settings:{rainRate:8}}],frames:28},
  {name:'ink and bitmap ripple presentation',actions:[{type:'settings',settings:{mode:'ink-wash',hairlineRipples:true,bitmapRipples:true}}],frames:5},
 ];
 for(const entry of cases){
  for(const page of pages)await page.evaluate(({actions,frames})=>{window.inkWaterCapture.apply(...actions);window.inkWaterCapture.frames(frames);},entry);
  // Read only the canvas, excluding text and the intentionally changed controls.
  const images=[];
  for(const page of pages)images.push(await page.evaluate(()=>{window.puddle.draw();return window.puddle.gl.domElement.toDataURL();}));
  assert.equal(images[0],images[1],entry.name+' must render identically to upstream');
  console.log(JSON.stringify({case:entry.name,matchingCanvas:true,pngSHA256:createHash('sha256').update(images[0]).digest('hex')}));
 }
 // Check the intentional green presentation change separately from source parity.
 for(const viewport of [{width:480,height:320},{width:320,height:568}]){
  await pages[0].setViewportSize(viewport);
  // Capture owns requestAnimationFrame; resize explicitly without advancing physics.
  await pages[0].evaluate(()=>window.puddle.resize());
  await pages[0].waitForFunction(({width,height})=>{const app=window.puddle,canvas=app.gl.domElement,ratio=app.gl.getPixelRatio();return canvas.width===Math.floor(width*ratio)&&canvas.height===Math.floor(height*ratio);},viewport);
  for(const tone of ['green-light','green-dark']){
   const result=await pages[0].evaluate(async tone=>{
    const app=window.puddle,c=window.inkWaterCapture;
    c.apply({type:'settings',settings:{tone,mode:'etching',hairlineRipples:false,bitmapRipples:false,bitmapTones:true,caustics:true,rain:false,shortReferenceLines:true}},{type:'still'},{type:'touch',x:.15,y:-.15},{type:'touch',x:.5,y:.4});
    c.frames(12);app.draw();
    const canvas=app.gl.domElement,copy=document.createElement('canvas');
    copy.width=canvas.width;copy.height=canvas.height;
    const context=copy.getContext('2d');
    const pixels=()=>{context.drawImage(canvas,0,0);return context.getImageData(0,0,copy.width,copy.height).data;};
    const fields=async()=>{
     const hashes=[];
     for(const [target,Type] of [[app.water.textureA,Float32Array],[app.engine.caustics.target,Uint8Array]]){
      const data=new Type(target.width*target.height*4);
      await app.gl.readRenderTargetPixelsAsync(target,0,0,target.width,target.height,data);
      if(!data.some(value=>Number.isFinite(value)&&value!==0))throw new Error('The GPU field read must contain live water or light data');
      hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data.buffer))).map(b=>b.toString(16).padStart(2,'0')).join(''));
     }
     return hashes;
    };
    const enhanced=pixels(),newFields=await fields();
    app.bitmapDrawing.uniforms.causticContrast.value=0;app.draw();
    const legacy=pixels(),oldFields=await fields();
    c.apply({type:'settings',settings:{caustics:false}});app.draw();
    const flat=pixels(),disabled=canvas.toDataURL();
    app.bitmapDrawing.uniforms.causticContrast.value=0;app.draw();
    const difference=image=>{
     let total=0;
     for(let i=0;i<image.length;i+=4)total+=Math.abs((image[i]-flat[i])*.2126+(image[i+1]-flat[i+1])*.7152+(image[i+2]-flat[i+2])*.0722);
     return total/(image.length/4);
    };
    return {before:difference(legacy),after:difference(enhanced),newFields,oldFields,disabledUnchanged:disabled===canvas.toDataURL()};
   },tone);
   assert.deepEqual(result.newFields,result.oldFields,'Caustic palette changes cannot modify GPU water or projected-light fields');
   assert.ok(result.before>0&&result.after>result.before*1.5,'Green caustics must visibly exceed the old palette contrast');
   assert.equal(result.disabledUnchanged,true,'Disabled caustics cannot leave a palette effect');
   console.log(JSON.stringify({case:'green caustic contrast',tone,viewport,contrastRatio:Number((result.after/result.before).toFixed(2)),waterAndProjectedLightUnchanged:true,disabledUnchanged:true}));
  }
 }
}finally{await browser.close();await Promise.all(servers.map(server=>server.close()));}
