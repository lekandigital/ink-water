import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright-core';

// Verify painted pixels, not just a computed filter URL. WebKit can report a
// valid SVG filter while clipping all of the HTML text out of its output.
const server=await createServer({cacheDir:'node_modules/.cache/mobile-refraction',server:{host:'127.0.0.1',port:4173,strictPort:true}});
const engines=(process.env.BROWSERS||'chromium,webkit').split(',');
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
const queue=manifest.order.map(id=>manifest.tracks.find(track=>track.id===id).source.video_id);
const metrics=async(page,selector)=>{
 const rect=await page.locator(selector).evaluate(el=>{
  const r=el.getBoundingClientRect(),padding=16;
  return {left:Math.max(0,Math.floor(r.left-padding)),top:Math.max(0,Math.floor(r.top-padding)),right:Math.min(innerWidth,Math.ceil(r.right+padding)),bottom:Math.min(innerHeight,Math.ceil(r.bottom+padding))};
 });
 const isolated=await page.addStyleTag({content:'.blog-copy>*,.water-dock>*,.youtube-frame{visibility:hidden}'+selector+','+selector+' *{visibility:visible}'});
 const png=(await page.screenshot()).toString('base64');
 await isolated.evaluate(el=>el.remove());
 return page.evaluate(async({png,rect})=>{
  const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const paper=getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number);
  const pixels=ctx.getImageData(rect.left,rect.top,rect.right-rect.left,rect.bottom-rect.top).data;
  let count=0,x=0,y=0;const width=rect.right-rect.left;
  for(let i=0;i<pixels.length;i+=4){
   if(Math.max(...paper.map((v,k)=>Math.abs(v-pixels[i+k])))<35)continue;
   count++;x+=i/4%width;y+=Math.floor(i/4/width);
  }
  return {count,x:count?x/count:0,y:count?y/count:0};
 },{png,rect});
};
try{
 await server.listen();
 for(const engine of engines){
  assert.ok(['chromium','webkit'].includes(engine));
  const browser=await (engine==='webkit'?webkit.launch({headless:true}):chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,colorScheme:'light',userAgent:process.env.MOBILE_USER_AGENT||'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>{
    Object.defineProperty(window,'devicePixelRatio',{value:.5});
    const frame=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>frame(time=>setTimeout(()=>cb(time),100));
   });
   // Keep the real playlist adapter while making network/autoplay deterministic.
   await page.addInitScript(queue=>{window.YT={Player:class{
    constructor(element,options){this.options=options;this.state=5;this.index=0;this.frame=document.createElement('iframe');element.replaceWith(this.frame);setTimeout(()=>options.events.onReady(),10);}
    cuePlaylist(){this.queue=queue;this.options.events.onStateChange();}playVideo(){this.state=1;this.options.events.onStateChange();}pauseVideo(){this.state=2;this.options.events.onStateChange();}stopVideo(){this.state=0;}
    playVideoAt(index){this.index=index;this.playVideo();}seekTo(){}getCurrentTime(){return 0;}getDuration(){return 300;}getVideoUrl(){return 'https://www.youtube.com/watch?v='+queue[this.index];}getPlaylist(){return queue;}getPlaylistIndex(){return this.index;}getPlaybackRate(){return 1;}getPlayerState(){return this.state;}
    setLoop(){}setShuffle(){}getIframe(){return this.frame;}destroy(){this.frame.remove();}
   }};},queue);
   await page.goto('http://127.0.0.1:4173/');
   await page.waitForFunction(()=>window.puddle,{},{timeout:60000});
   await page.waitForFunction(()=>!document.documentElement.matches('.dream-pending,.dream-in'));
   const blog=await page.locator('.blog-links').count()>0;
   const surface=blog?'#music-open':'#water-dock';
   await page.waitForFunction(selector=>document.querySelector(selector).dataset.waterRefraction==='physical',surface);
   await page.evaluate(()=>{window.puddle.controls.change({paused:true,rain:false});});
   await page.waitForFunction(()=>{const app=window.puddle;return !app.pendingDraw&&!app.musicWater?.pending&&!app.linksWater?.pending;});
   await page.addStyleTag({content:'#stage canvas{visibility:hidden}'});
   const selectors=blog?['.blog-links',surface]:[surface];
   for(const selector of selectors){
    const original=await metrics(page,selector);assert.ok(original.count>25,engine+' must paint submerged '+selector);
   }
   // A uniform readback has a known displacement of -12 CSS pixels. This catches
   // a visible but ineffective filter and preserves the source's 24px scale.
   await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=80;
    const ctx=canvas.getContext('2d');ctx.fillStyle='rgb(255,128,0)';ctx.fillRect(0,0,80,80);
    const href=canvas.toDataURL(),decoded=new Image();decoded.src=href;await decoded.decode();
    for(const map of document.querySelectorAll('feImage'))if(map.hasAttribute('href'))map.setAttribute('href',href);
   });
   await page.waitForTimeout(100);
   const refracted=await (async()=>{const values=[];for(const selector of selectors)values.push(await metrics(page,selector));return values;})();
   const flatStyle=await page.addStyleTag({content:'.water-refracting{filter:none!important}'});
   const flat=await (async()=>{const values=[];for(const selector of selectors)values.push(await metrics(page,selector));return values;})();
   for(let i=0;i<selectors.length;i++){
    const shift=refracted[i].x-flat[i].x;
    assert.ok(refracted[i].count>flat[i].count*.8,engine+' must retain readable pixels in '+selectors[i]);
    assert.ok(Math.abs(shift+12)<2,engine+' must visibly displace '+selectors[i]+' by -12px; got '+shift);
   }
   await flatStyle.evaluate(el=>el.remove());
   await page.evaluate(()=>{document.querySelector('#stage canvas').style.visibility='';window.puddle.controls.change({paused:false});});
   if(blog){
    await page.locator('#blog-theme').tap();
    await page.waitForFunction(()=>!document.documentElement.dataset.blogTransition);
    await page.evaluate(()=>{
     window.__contactClicks=[];
     document.body.addEventListener('click',event=>{
      const link=event.target.closest?.('.blog-links a');if(!link)return;
      window.__contactClicks.push({href:link.href,prevented:event.defaultPrevented});event.preventDefault();
     });
    });
    const links=page.locator('.blog-links a'),hrefs=await links.evaluateAll(els=>els.map(el=>el.href));
    for(let i=0;i<hrefs.length;i++)await links.nth(i).tap();
    assert.deepEqual(await page.evaluate(()=>window.__contactClicks),hrefs.map(href=>({href,prevented:false})),'Every contact link receives a native tap without the water consuming it');
   }else await page.locator('[data-quick-tone="green-light"]').tap();
   assert.ok(await page.locator(surface).evaluate(el=>getComputedStyle(el).filter.startsWith('url(')),engine+' touch hover must keep controls submerged');
   await page.locator('#music-open').tap();
   await page.waitForFunction(()=>JSON.parse(document.getElementById('water-state').textContent).musicPlaying===true);
   await page.locator('#music-expand').tap();
   selectors.splice(selectors.indexOf(surface),1,'#music-bar','#music-details');
   for(const [width,height] of [[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#stage canvas').evaluate(el=>getComputedStyle(el).touchAction),'none','Vertical touch movement belongs to the water canvas');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),'Mobile layout stays in the viewport');
    await page.evaluate(()=>{window.puddle.controls.change({paused:true});document.querySelector('#stage canvas').style.visibility='hidden';});await page.waitForFunction(()=>{const app=window.puddle;return !app.pendingDraw&&!app.musicWater?.pending&&!app.linksWater?.pending;});
    for(const selector of selectors){const visible=await metrics(page,selector);assert.ok(visible.count>25,engine+' '+selector+' survives resize '+width+'x'+height);}
    await page.evaluate(()=>{document.querySelector('#stage canvas').style.visibility='';window.puddle.controls.change({paused:false});});
   }
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({engine,realWebGL:true,paintedControls:true,full12pxDisplacement:true,touchHoverRemainsSubmerged:true,nativeContactLinks:blog,expandedPlayerPainted:true,portraitAndLandscape:true,verticalTouchInput:true}));
  }finally{await browser.close();}
 }
}finally{await server.close();}
