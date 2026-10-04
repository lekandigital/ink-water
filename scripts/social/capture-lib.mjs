// Shared helpers for the deterministic social capture: a static server for dist/,
// a headless browser, and a frame-by-frame timeline runner.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain'};

export async function serve(root){
  const server=createServer(async(request,response)=>{
    const path=normalize(decodeURIComponent(new URL(request.url,'http://localhost').pathname)).replace(/^(\.\.[/\\])+/,'');
    try{
      const file=join(root,path.endsWith('/')?path+'index.html':path);
      const body=await readFile(file);
      response.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});response.end(body);
    }catch{response.writeHead(404);response.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(resolve=>server.close(resolve))};
}

// System Chrome runs WebGL 2 on the GPU in headless mode. Set INK_WATER_CHROME to
// another Chromium executable, or install one with `npx playwright-core install chromium`.
export async function launchBrowser(){
  const args=['--force-color-profile=srgb','--ignore-gpu-blocklist','--hide-scrollbars','--mute-audio'];
  const executablePath=process.env.INK_WATER_CHROME;
  if(executablePath)return chromium.launch({executablePath,headless:true,args});
  try{return await chromium.launch({channel:'chrome',headless:true,args});}
  catch(error){
    try{return await chromium.launch({headless:true,args});}
    catch{throw new Error('No Chromium browser found. Install Google Chrome, set INK_WATER_CHROME, or run `npx playwright-core install chromium`.\n'+error.message);}
  }
}

/** Opens the app in capture mode and waits until the water is running. */
export async function openCapture(browser,baseUrl,{width,height,scale=1,seed=1,fps=60}){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:scale});
  // Screenshots go through this session. Attaching it resets the emulated pixel
  // ratio, so set the metrics here, before the water reads devicePixelRatio.
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile:false});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`${baseUrl}?capture=1&seed=${seed}&fps=${fps}`);
  await page.waitForFunction(()=>window.inkWaterCapture?.ready||!document.getElementById('error').hidden,null,{timeout:60000});
  const failure=await page.evaluate(()=>document.getElementById('error').hidden?'':document.getElementById('error').textContent);
  if(failure)throw new Error('The water could not start in capture mode: '+failure+(errors.length?'\n'+errors.join('\n'):''));
  const renderer=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),info=gl?.getExtension('WEBGL_debug_renderer_info');return info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'unknown';});
  const canvas=await page.evaluate(()=>{const c=document.querySelector('canvas');return {width:c.width,height:c.height,ratio:devicePixelRatio};});
  const expected={width:Math.floor(width*Math.min(scale,1.75)),height:Math.floor(height*Math.min(scale,1.75))};
  if(canvas.width!==expected.width||canvas.height!==expected.height)throw new Error(`Canvas is ${canvas.width}×${canvas.height}, expected ${expected.width}×${expected.height}.`);
  // A lossless PNG with fast compression, several times quicker than page.screenshot().
  const clip={x:0,y:0,width,height,scale:1};
  const grab=async()=>Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',optimizeForSpeed:true,clip})).data,'base64');
  const size=(await grab()).subarray(16,24);
  if(size.readUInt32BE(0)!==Math.round(width*scale)||size.readUInt32BE(4)!==Math.round(height*scale))throw new Error(`Screenshots are ${size.readUInt32BE(0)}×${size.readUInt32BE(4)}, expected ${width*scale}×${height*scale}.`);
  return {page,errors,renderer,canvas,grab};
}

/**
 * Runs a sequence one frame at a time. Events whose time is negative happen during
 * the unrecorded pre-roll, so the first recorded frame is already in motion.
 * onFrame(frame, grab) receives each recorded frame; grab() returns its PNG.
 */
export async function runSequence({page,grab},sequence,onFrame){
  const fps=sequence.fps??60,first=-Math.round((sequence.preroll??0)*fps),last=Math.round(sequence.duration*fps);
  const byFrame=new Map();
  for(const event of sequence.events){
    const frame=Math.round(event.at*fps);
    if(frame<first||frame>=last)throw new Error(`${sequence.name}: event at ${event.at}s is outside the sequence.`);
    byFrame.set(frame,[...(byFrame.get(frame)??[]),...[event.do].flat()]);
  }
  await page.evaluate(actions=>window.inkWaterCapture.apply(...actions),[...(sequence.setup??[])]);
  for(let frame=first;frame<last;frame++){
    const actions=byFrame.get(frame);
    await page.evaluate(actions=>{if(actions)window.inkWaterCapture.apply(...actions);window.inkWaterCapture.frames(1);},actions??null);
    if(frame>=0)await onFrame(frame,grab);
  }
}

export function run(command,args,{input}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:[input?'pipe':'ignore','ignore','pipe']});
    let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error(`${command} exited with ${code}\n${stderr}`)));
    if(input)input(child.stdin);
  });
}

/** Starts an ffmpeg process that reads PNG frames from stdin. */
export function frameEncoder(fps,outputArgs){
  let stdin;
  const done=run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-c:v','png','-framerate',String(fps),'-i','-',...outputArgs],{input:stream=>{stdin=stream;}});
  return {
    write:buffer=>new Promise((resolve,reject)=>stdin.write(buffer,error=>error?reject(error):resolve())),
    finish:()=>{stdin.end();return done;},
  };
}
