import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {build} from 'esbuild';
process.on('uncaughtException',error=>{console.error(error.name+': '+error.message+'\n'+error.stack.split('\n').filter(line=>!line.includes('data:text')).slice(1,5).join('\n'));process.exitCode=1;});

// The reference retains the original full accent scan in memory. This isolates
// the optimization from the musical program, random generator and planner.
const fullScanStateAt = `  stateAt(time:number){
    const s=this.sectionAt(clamp(time,0,this.score.duration));
    const u=smooth(clamp((time-s.start)/(s.end-s.start),0,1));
    let amount=1;
    for(const b of this.score.breaths)if(time>=b.start&&time<b.end)amount*=b.amount;
    for(const a of this.score.accents){
      if(time>=a.time-a.anticipation&&time<a.time)amount*=1-a.quiet*smooth((time-a.time+a.anticipation)/Math.max(.001,a.anticipation));
      if(time>=a.time-.12&&time<a.time+.22)amount=0;
    }
    return {section:s,density:lerp(...s.density,u)*amount,background:s.background*amount,force:lerp(...s.force,u),scale:lerp(...s.scale,u),amount};
  }

`;
const schedulerSource=await readFile('src/music/RainScheduler.ts','utf8');
const referenceSource=schedulerSource.replace(/  stateAt\(time:number\)\{[\s\S]*?(?=  private position\()/,fullScanStateAt);
assert.notEqual(referenceSource,schedulerSource,'The reference must replace the optimized local window with the original full scan');
const compile=async contents=>{
 const result=await build({stdin:{contents,loader:'ts',resolveDir:process.cwd()+'/src/music'},bundle:true,platform:'node',format:'esm',write:false});
 return (await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).RainScheduler;
};
const [Optimized,FullScan]=await Promise.all([compile(schedulerSource),compile(referenceSource)]);
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
const scores=await Promise.all(manifest.tracks.map(async track=>JSON.parse(await readFile('data/music/'+track.score,'utf8'))));
let gridSamples=0,boundarySamples=0,events=0;
const compare=(optimized,reference,time,label)=>{
 const actual=optimized.stateAt(time),expected=reference.stateAt(time);
 if(actual.section!==expected.section||actual.amount!==expected.amount||actual.density!==expected.density||
    actual.background!==expected.background||actual.force!==expected.force||actual.scale!==expected.scale)
  assert.deepEqual(actual,expected,`${label} at ${time}s`);
};
for(const score of scores){
 const optimized=new Optimized(score),reference=new FullScan(score);
 assert.deepEqual(optimized.events,reference.events,`${score.track_id}: every timestamp, position, force, scale, kind and physical seed is unchanged`);
 events+=optimized.events.length;
 // Every 30Hz and 60Hz sample is an exact subset of this 120Hz grid.
 for(let frame=0;frame<=Math.ceil(score.duration*120);frame++){
  compare(optimized,reference,frame/120,score.track_id+' 30/60/120Hz grid');gridSamples++;
 }
 const boundaries=new Set([0,score.duration,...score.sections.flatMap(section=>[section.start,section.end]),
  ...score.breaths.flatMap(breath=>[breath.start,breath.end]),
  ...score.accents.flatMap(accent=>[accent.time,accent.time-.12,accent.time+.22,accent.time-accent.anticipation])]);
 for(const time of boundaries){
  const epsilon=Number.EPSILON*Math.max(1,Math.abs(time));
  for(const near of [time-epsilon,time,time+epsilon]){
   compare(optimized,reference,near,score.track_id+' exact attack/anticipation/quiet/breath boundary');boundarySamples++;
  }
 }
}
// Exercise long anticipation, duplicate attacks and zero anticipation near
// the limits of the binary window without changing production choreography.
const edgeScore=structuredClone(scores.find(score=>score.track_id==='02-fused-dj-kicks'));
edgeScore.accents=[
 {...edgeScore.accents[0],time:.125,anticipation:0,random_index:900001},
 {...edgeScore.accents[0],time:.125,anticipation:.12,random_index:900002},
 {...edgeScore.accents[0],time:.5,anticipation:.37,random_index:900003},
 {...edgeScore.accents[0],time:3,anticipation:2.875,random_index:900004},
];
const edgeOptimized=new Optimized(edgeScore),edgeReference=new FullScan(edgeScore);
assert.deepEqual(edgeOptimized.events,edgeReference.events,'Variable/zero anticipation and duplicate attack fixtures retain every physical event');
for(const accent of edgeScore.accents)for(const boundary of [accent.time-.12,accent.time+.22,accent.time-accent.anticipation,accent.time]){
 const epsilon=Number.EPSILON*Math.max(1,Math.abs(boundary));
 for(const near of [boundary-epsilon,boundary,boundary+epsilon])compare(edgeOptimized,edgeReference,near,'synthetic boundary');
}
const benchmarkScores=[...new Set([
 scores.toSorted((a,b)=>b.duration-a.duration)[0],
 scores.toSorted((a,b)=>b.accents.length-a.accents.length)[0],
 scores.find(score=>score.track_id==='02-fused-dj-kicks'),
])];
const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)];
const benchmarks=[];
for(const score of benchmarkScores){
 new Optimized(score);new FullScan(score);
 const optimizedTimes=[],fullScanTimes=[];
 for(let repeat=0;repeat<5;repeat++){
  let start=performance.now();new FullScan(score);fullScanTimes.push(performance.now()-start);
  start=performance.now();new Optimized(score);optimizedTimes.push(performance.now()-start);
 }
 const fullScanMs=median(fullScanTimes),optimizedMs=median(optimizedTimes);
 benchmarks.push({track:score.track_id,duration:score.duration,cues:score.accents.length,
  fullScanMedianMs:fullScanMs,optimizedMedianMs:optimizedMs,speedup:fullScanMs/optimizedMs});
}
console.log(JSON.stringify({scores:scores.length,unchangedPhysicalEvents:events,displayCadences:[30,60,120],gridSamples,boundarySamples,
 exactStateAndFullPlans:true,variableAndZeroAnticipation:true,duplicateAttacks:true,benchmarks}));
