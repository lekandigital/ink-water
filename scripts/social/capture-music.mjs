// Reference-clock capture only. Never loads YouTube or serves reference audio.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {serve,launchBrowser,openCapture,frameEncoder,run} from './capture-lib.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!/^--(track|start|duration|fps|audio)$/.test(args[i])||args[i+1]===undefined)throw new Error('Use --track ID [--start seconds] [--duration seconds] [--fps 60] [--audio /local/reference.mp3]');options[args[i].slice(2)]=args[i+1];}
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
const track=manifest.tracks.find(t=>t.id===(options.track??'02-fused-dj-kicks'));if(!track)throw new Error('Unknown authored track.');
const start=Number(options.start??track.recommended_demo.start),duration=Number(options.duration??12.5),fps=Number(options.fps??60);
if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||duration<=0||start+duration>track.duration||![30,60,120].includes(fps))throw new Error('Choose a window inside the recording and 30, 60 or 120 fps.');
if(options.audio&&createHash('sha256').update(await readFile(options.audio)).digest('hex')!==track.reference_sha256)throw new Error('The audio is not the analyzed reference recording.');
await run(process.execPath,['build.mjs']);await mkdir('.capture',{recursive:true});
const server=await serve('dist'),browser=await launchBrowser(),output=`.capture/music-${track.id}.mp4`,silent=`.capture/music-${track.id}-silent.mp4`;
try{
 const session=await openCapture(browser,server.url,{width:1080,height:1080,scale:1,seed:1,fps});
 await session.page.evaluate(()=>window.inkWaterCapture.apply({type:'settings',settings:{tone:'green-light',rain:false,paused:false}}));
 await session.page.evaluate(({id,start})=>window.inkWaterMusicCapture.select(id,start),{id:track.id,start});
 const encoder=frameEncoder(fps,['-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-an',options.audio?silent:output]);
 const hashes=[];
 for(let i=0;i<Math.round(duration*fps);i++){
  await session.page.evaluate(()=>window.inkWaterCapture.frames(1));const png=await session.grab();
  hashes.push(createHash('sha256').update(png).digest('hex'));await encoder.write(png);
 }
 await encoder.finish();if(session.errors.length)throw new Error(session.errors.join('\n'));
 if(options.audio)await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',silent,'-ss',String(start),'-t',String(duration),'-i',options.audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',output]);
 await writeFile(output+'.json',JSON.stringify({track:track.id,start,duration,fps,renderer:session.renderer,frames:hashes.length,
  frame_digest:createHash('sha256').update(hashes.join('')).digest('hex'),reference_audio:!!options.audio},null,2)+'\n');
 console.log(output);await session.page.close();
}finally{await browser.close();await server.close();}
