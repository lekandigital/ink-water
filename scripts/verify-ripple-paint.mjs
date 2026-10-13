import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {webkit} from 'playwright-core';
// Capture owns requestAnimationFrame. Poll GPU/image completion with a timer,
// and compare actual painted controls across physical waves and still water.
const server=await createServer({cacheDir:'node_modules/.cache/ripple-paint',server:{host:'127.0.0.1',port:4173,strictPort:true}});
await server.listen();const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
 await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5}));
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/')+'?capture=1&seed=47');
 await page.waitForFunction(()=>window.inkWaterCapture?.ready&&!document.documentElement.matches('.dream-in,.dream-pending'),{},{polling:100});
 await page.evaluate(()=>{document.body.classList.remove('capture');window.inkWaterCapture.apply({type:'settings',settings:{tone:'green-light',rain:false}},{type:'still'});});
 await page.addStyleTag({content:'#stage canvas,.blog-copy,.water-dock>*{visibility:hidden}#music-open,#music-open *{visibility:visible}'});
 const hash=value=>createHash('sha256').update(value).digest('hex'),frames=[];
 for(const phase of ['still','wave1','wave2','still']){
  await page.evaluate(phase=>{
   const app=window.puddle,c=window.inkWaterCapture;
   if(phase==='still')c.apply({type:'still'});
   else{
    if(phase==='wave1'){
     const r=document.getElementById('music-open').getBoundingClientRect();
     app.addDrop(((r.left+r.width*.55)/innerWidth*2-1)*.94*innerWidth/innerHeight,((r.top+r.height*.5)/innerHeight*2-1)*.94,.075,-.05);
    }
    c.frames(phase==='wave1'?8:16);
   }
  },phase);
  await page.waitForFunction(()=>!window.puddle.musicWater?.pending&&!window.puddle.linksWater?.pending,{},{polling:100});
  await page.evaluate(()=>{const app=window.puddle;app.musicWater.last=0;if(app.linksWater)app.linksWater.last=0;app.draw();});
  await page.waitForFunction(()=>!window.puddle.musicWater.pending&&!window.puddle.linksWater?.pending,{},{polling:100});
  const sample=await page.evaluate(()=>{
   const layer=window.puddle.musicWater.layers.find(layer=>layer.element.id==='music-open')||window.puddle.musicWater.layers[0];
   return{map:layer.map.getAttribute('href'),binding:layer.element.style.getPropertyValue('--water-refraction-filter')};
  });
  frames.push({phase,map:hash(sample.map),paint:hash(await page.screenshot()),binding:sample.binding});
 }
 assert.notEqual(frames[0].map,frames[1].map,'A physical ripple must change the sampled map');
 assert.notEqual(frames[1].map,frames[2].map,'The map must follow later ripple propagation');
 assert.notEqual(frames[0].paint,frames[1].paint,'A ripple must alter the painted button, not just its map URI');
 assert.notEqual(frames[1].paint,frames[2].paint,'Paint must follow later ripple propagation');
 assert.equal(frames[0].map,frames[3].map,'Still water restores a neutral physical map');
 assert.equal(frames[0].paint,frames[3].paint,'Still water restores the original button paint');
 assert.ok(new Set(frames.map(frame=>frame.binding)).size===2,'Completed frames alternate persistent filter bindings to invalidate cached mobile paint');
 console.log(JSON.stringify({realWebGL:true,deviceScaleFactor:3,physicalWavesChangePaint:true,propagationChangesPaint:true,stillWaterRestoresPaint:true,explicitFilterRepaint:true}));
}finally{await browser.close();await server.close();}
