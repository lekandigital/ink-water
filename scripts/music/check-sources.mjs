import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/music/MusicScore.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {validateManifest}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
try{validateManifest(manifest,true);
 const unverified=manifest.tracks.filter(t=>t.source.validation_status!=='verified');
 if(unverified.length)throw new Error('Recordings still need version verification: '+unverified.map(t=>t.title).join(', '));
 console.log('All 32 playback identities and recording versions are verified.');
}catch(error){console.error('Music production readiness: '+error.message);process.exitCode=1;}
