import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';

// Compare against an unchanged checkout of main at 3e2dfef. Both checkouts need
// dependencies installed. The comparison reads complete GPU buffers, not just
// a simulation counter or screenshots that can hide a change in the water.
const source=resolve(process.env.INK_WATER_SOURCE||'../ink-water-base');
const artifactDir=resolve(process.env.ASCII_QA_OUTPUT||'../ascii-qa');
await mkdir(artifactDir,{recursive:true});
const servers=await Promise.all([process.cwd(),source].map((root,index)=>createServer({
  root,configFile:root+'/vite.config.mjs',cacheDir:process.cwd()+'/node_modules/.cache/ascii-'+index,
  server:{host:'127.0.0.1',port:4173+index,strictPort:true},
})));
const browser=await chromium.launch({
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
  args:['--no-sandbox','--no-zygote','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const errors=[];
const capture=async(page,actions=[],frames=0)=>page.evaluate(({actions,frames})=>{
  window.inkWaterCapture.apply(...actions);window.inkWaterCapture.frames(frames);window.puddle.draw();
},{actions,frames});
const fields=async page=>page.evaluate(async()=>{
  const app=window.puddle;
  const targets=[app.water.textureA,app.water.textureB,app.rainLayer.water.textureA,app.rainLayer.water.textureB];
  const hashes=[];
  for(const target of targets){
    const bytes=target.texture.type===1016?new Uint16Array(target.width*target.height*4):new Float32Array(target.width*target.height*4);
    await app.gl.readRenderTargetPixelsAsync(target,0,0,target.width,target.height,bytes);
    hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer))).map(n=>n.toString(16).padStart(2,'0')).join(''));
  }
  return {hashes,simulationSteps:app.simulationSteps,rainSteps:app.rainLayer.simulationSteps,stats:app.fieldStats()};
});
const image=async page=>page.evaluate(()=>{window.puddle.draw();return window.puddle.gl.domElement.toDataURL();});
try{
  await Promise.all(servers.map(server=>server.listen()));
  const pages=[];
  for(let index=0;index<2;index++){
    const page=await browser.newPage({viewport:{width:480,height:320},deviceScaleFactor:1,colorScheme:'dark'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+(4173+index)+'/?capture=1&seed=47');
    await page.waitForFunction(()=>window.inkWaterCapture?.ready);
    // Capture owns the clock; show the real controls for native UI checks.
    await page.evaluate(()=>document.body.classList.remove('capture'));
    pages.push(page);
  }
  for(const entry of [
    {name:'initial field',actions:[],frames:0},
    {name:'touch and drag impacts',actions:[{type:'settings',settings:{rain:false}},{type:'still'},{type:'touch',x:.2,y:-.3},{type:'touch',x:.35,y:-.15},{type:'touch',x:.5,y:0}],frames:12},
    {name:'independent rain field',actions:[{type:'settings',settings:{rain:true,rainRate:8}}],frames:24},
    {name:'repeatable C gesture',actions:[{type:'gesture',key:'c'}],frames:24},
  ]){
    for(const page of pages){
      // Skip the post-clear quiet grace period in both harnesses so this short
      // deterministic case actually includes real scheduled rain impacts.
      if(entry.name==='independent rain field')await page.evaluate(()=>{window.puddle.clearRainUntil=0;});
      await capture(page,entry.actions,entry.frames);
    }
    const actual=await fields(pages[0]),expected=await fields(pages[1]);
    assert.deepEqual(actual,expected,entry.name+' must preserve every GPU simulation channel');
    console.log(JSON.stringify({case:entry.name,exactGPUFields:true,...actual}));
  }
  const page=pages[0],before=await fields(page),ascii=await image(page);
  await page.locator('#stage canvas').screenshot({path:artifactDir+'/ascii-water-desktop.png'});
  await page.locator('#toggle-ascii').click();
  assert.equal(await page.locator('#toggle-ascii').getAttribute('aria-pressed'),'false');
  assert.equal(await image(page),await image(pages[1]),'Disabling ASCII must restore the exact original canvas');
  assert.deepEqual(await fields(page),before,'Toggling the renderer must preserve both solver buffers');
  await page.locator('#toggle-ascii').click();
  assert.equal(await image(page),ascii,'Re-enabling ASCII at the same tick must restore the same pixels');
  await page.locator('#toggle-controls').click();
  await page.locator('#ascii-accents').uncheck();
  await page.locator('#ascii-scale').press('End');
  await capture(page);
  assert.deepEqual(await fields(page),before,'Character size and accents cannot change water');
  assert.notEqual(await image(page),ascii,'ASCII controls must visibly change pixels');
  await page.locator('#pause').click();await capture(page,[],8);
  assert.deepEqual(await fields(page),before,'Pause must stop both original water fields');
  console.log(JSON.stringify({case:'render controls',pixelExactOriginalView:true,repeatableASCII:true,appearancePreservesFields:true,pause:true}));
  await page.locator('#close-controls').click();
  assert.equal(await page.locator('#controls').isVisible(),false);
  await page.locator('#stage canvas').press('a');await capture(page);
  assert.equal(await page.locator('#toggle-ascii').getAttribute('aria-pressed'),'false');
  await page.locator('#stage canvas').press('a');await capture(page);
  assert.equal(await page.locator('#toggle-ascii').getAttribute('aria-pressed'),'true');

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto('http://127.0.0.1:4173/?capture=1&seed=47');
  await mobile.waitForFunction(()=>window.inkWaterCapture?.ready);
  await mobile.evaluate(()=>document.body.classList.remove('capture'));
  await capture(mobile,[{type:'settings',settings:{rain:false}},{type:'still'}]);
  await mobile.touchscreen.tap(250,280);await capture(mobile,[],12);
  assert.ok((await fields(mobile)).stats.energy>0,'A native touch must disturb the real water');
  await mobile.locator('#stage canvas').screenshot({path:artifactDir+'/ascii-water-mobile.png'});
  const portrait=await mobile.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bufferWidth:window.puddle.gl.domElement.width,expected:Math.floor(innerWidth*window.puddle.gl.getPixelRatio())}));
  assert.equal(portrait.width,portrait.scroll);assert.equal(portrait.bufferWidth,portrait.expected);
  await mobile.setViewportSize({width:844,height:390});await mobile.evaluate(()=>window.puddle.resize());
  assert.equal(await mobile.locator('#error').isVisible(),false);
  assert.equal(await mobile.locator('#toggle-ascii').isVisible(),true);
  console.log(JSON.stringify({case:'mobile',nativeTouch:true,portraitAndLandscape:true,noOverflow:true,deviceScaleFactor:2}));
  assert.deepEqual(errors,[],'No page or shader errors');
  console.log(JSON.stringify({passed:true,artifacts:artifactDir,originalCanvasSHA256:createHash('sha256').update(await image(pages[1])).digest('hex')}));
}finally{
  await browser.close();await Promise.all(servers.map(server=>server.close()));
}
