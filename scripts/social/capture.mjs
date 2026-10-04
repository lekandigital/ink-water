// Renders the launch video, aesthetic loop and README demo GIF on Dark and Light
// paper, plus the social preview, from the real app in deterministic capture mode.
//   npm run social                 everything
//   npm run social -- gif social   only some outputs (see `outputs` below)
// Requires Google Chrome (or INK_WATER_CHROME) and ffmpeg with libx264 on PATH.
import {mkdir,writeFile,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {serve,launchBrowser,openCapture,runSequence,frameEncoder,run} from './capture-lib.mjs';
import {launch,loop,demo,social} from './sequences.mjs';

const cache='.capture';
// Dark paper is the main version of each asset; Light sits beside it.
const outputs={
  launch:'assets/ink-water-launch.mp4','launch-light':'assets/ink-water-launch-light.mp4',
  loop:'assets/ink-water-loop.mp4','loop-light':'assets/ink-water-loop-light.mp4',
  gif:'assets/ink-water.gif','gif-light':'assets/ink-water-light.gif',social:'public/social.jpg',
};
const tones=[['','night'],['-light','paper']];
// Measured paper value of each tone in the rendered frames.
const paper={night:27,paper:240};
const requested=process.argv.slice(2);
for(const name of requested)if(!outputs[name])throw new Error(`Unknown output "${name}". Choose from: ${Object.keys(outputs).join(', ')}.`);
const wanted=new Set(requested.length?requested:Object.keys(outputs));

// RGB frames become BT.709 limited-range 4:2:0, tagged so players do not shift colour.
const bt709=['-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv'];
const toYuv='scale=out_color_matrix=bt709:out_range=tv,format=yuv420p';
// High profile H.264 at 60 fps within X's upload limits; faststart for streaming.
const deliveryArgs=['-c:v','libx264','-preset','slow','-crf','23','-tune','animation','-profile:v','high','-level:v','4.2','-maxrate','20M','-bufsize','40M','-g','120','-pix_fmt','yuv420p',...bt709,'-movflags','+faststart','-an'];
// A visually lossless intermediate, kept in .capture/ for re-encoding without re-rendering.
const masterCodec=['-c:v','libx264','-preset','fast','-crf','6','-pix_fmt','yuv444p',...bt709];
const ffmpeg=(...args)=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);

await mkdir(cache,{recursive:true});await mkdir('assets',{recursive:true});
console.log('Building the app…');
await run('node',['build.mjs']);
const server=await serve('dist');
const browser=await launchBrowser();
try{
  for(const [suffix,tone] of tones){
    if(wanted.has('launch'+suffix))await record(launch(tone),{deliver:outputs['launch'+suffix]});
    if(wanted.has('loop'+suffix)){
      const sequence=loop(tone);
      await ffmpeg('-i',await seamless(sequence,await record(sequence)),'-vf',toYuv,...deliveryArgs,outputs['loop'+suffix]);
    }
    if(wanted.has('gif'+suffix)){
      const sequence=demo(tone);
      await gif(await seamless(sequence,await record(sequence)),outputs['gif'+suffix],paper[tone]);
    }
  }
  if(wanted.has('social'))await still(social,outputs.social);
}finally{
  await browser.close();await server.close();
}
for(const name of wanted){const {size}=await stat(outputs[name]);console.log(`${outputs[name].padEnd(30)} ${(size/1e6).toFixed(2)} MB`);}

async function record(sequence,{deliver}={}){
  const started=Date.now(),session=await openCapture(browser,server.url,sequence),master=`${cache}/${sequence.name}-master.mkv`;
  console.log(`Recording ${sequence.name}: ${session.canvas.width}×${session.canvas.height} at ${sequence.fps} fps on ${session.renderer}`);
  const args=['-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv444p',...masterCodec,master];
  if(deliver)args.push('-vf',toYuv,...deliveryArgs,deliver);
  const encoder=frameEncoder(sequence.fps,args),hashes=[];
  await runSequence(session,sequence,async(frame,grab)=>{
    const png=await grab();hashes.push(createHash('sha1').update(png).digest('hex'));
    await encoder.write(png);
  });
  await encoder.finish();await session.page.close();
  if(session.errors.length)throw new Error(`${sequence.name}: the page reported errors\n${session.errors.join('\n')}`);
  // Identical digests across runs show the sequence reproduced frame for frame.
  await writeFile(`${cache}/${sequence.name}-frames.txt`,hashes.join('\n')+'\n');
  const digest=createHash('sha1').update(hashes.join('')).digest('hex').slice(0,12);
  console.log(`  ${hashes.length} frames in ${((Date.now()-started)/1000).toFixed(0)} s, frame digest ${digest}`);
  return master;
}

// Blend the tail into the head: the last `crossfade` seconds fade from the recording's
// end into its first frames, so the final frame leads straight back to frame 0.
async function seamless(sequence,master){
  const fade=sequence.crossfade,length=sequence.duration-fade,output=`${cache}/${sequence.name}-seamless.mkv`;
  await ffmpeg('-i',master,'-filter_complex',
    `[0:v]split[a][b];[a]trim=start=${fade},setpts=PTS-STARTPTS[body];[b]trim=end=${fade},setpts=PTS-STARTPTS[head];`+
    `[body][head]xfade=transition=fade:duration=${fade}:offset=${length-fade}[v]`,
    '-map','[v]',...masterCodec,output);
  return output;
}

// Refraction makes the paper's faint grain shimmer in every frame, which defeats GIF's
// changed-rectangle storage. Flattening tones near the paper value keeps the ink and
// the etched texture, and cuts the file size several times. No dithering, for the same reason.
async function gif(input,output,paperValue){
  const filters=`fps=15,scale=960:-1:flags=lanczos,format=gray,lut=c0=if(lte(abs(val-${paperValue})\\,10)\\,${paperValue}\\,val),format=rgb24`;
  const palette=`${cache}/palette.png`;
  await ffmpeg('-i',input,'-vf',`${filters},palettegen=max_colors=32:stats_mode=full:reserve_transparent=0`,palette);
  await ffmpeg('-i',input,'-i',palette,'-lavfi',`${filters}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`,'-loop','0',output);
}

async function still(sequence,output){
  const session=await openCapture(browser,server.url,sequence),target=Math.round(sequence.frame*sequence.fps);
  let png;
  await runSequence(session,sequence,async(frame,grab)=>{if(frame===target)png=await grab();});
  await session.page.close();
  if(!png)throw new Error('The social frame was not captured.');
  const source=`${cache}/social-source.png`;await writeFile(source,png);
  // Render at twice the size, then downsample for finer engraving-like lines.
  await ffmpeg('-i',source,'-vf',`scale=${sequence.width}:${sequence.height}:flags=lanczos`,'-q:v','2',output);
  await rm(source);
  console.log(`  social frame ${target} digest ${createHash('sha1').update(png).digest('hex').slice(0,12)}`);
}
