import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
process.on('uncaughtException',error=>{console.error(error.name+': '+error.message+'\n'+error.stack.split('\n').filter(line=>!line.includes('data:text')).slice(1,5).join('\n'));process.exitCode=1;});
const manifest=JSON.parse(await readFile('data/music/manifest.json','utf8'));
const {window,document}=parseHTML(await readFile('index.html','utf8'));
Object.defineProperty(document.getElementById('music-track'),'value',{value:'',writable:true});
Object.defineProperty(document,'baseURI',{value:'https://ink-water.test/'});
const queue=manifest.order.map(id=>manifest.tracks.find(t=>t.id===id).source.video_id);
let gesture=false,unlocked=false,handle=0,latest={};const timers=new Map(),ports=[];
window.matchMedia=query=>({matches:query==='(pointer: coarse)'});
Object.assign(window,{setTimeout:(fn,delay)=>{timers.set(++handle,{fn,delay});return handle;},clearTimeout:id=>timers.delete(id),setInterval:()=>++handle,clearInterval:()=>{}});
Object.assign(globalThis,{window,document,location:{origin:'https://ink-water.test'},fetch:async url=>({ok:true,json:async()=>{
 const path=new URL(url).pathname.replace('/music/','');return path==='manifest.json'?structuredClone(manifest):JSON.parse(await readFile('data/music/'+path,'utf8'));
}})});
class Port{
 constructor(element,options){this.options=options;this.index=0;this.state=5;this.time=0;this.playlist=[];this.playCalls=0;this.frame=document.createElement('iframe');element.replaceWith(this.frame);ports.push(this);}
 ready(){this.options.events.onReady();}
 cuePlaylist(){this.playlist=[...queue];}
 playVideo(){this.playCalls++;if(!gesture&&!unlocked){this.options.events.onAutoplayBlocked();return;}unlocked=true;this.state=1;this.options.events.onStateChange();}
 playVideoAt(index){this.requested=index;}pauseVideo(){this.state=2;this.options.events.onStateChange();}stopVideo(){this.state=0;}seekTo(time){this.time=time;}
 getPlaylist(){return [...this.playlist];}getPlaylistIndex(){return this.index;}getVideoUrl(){return 'https://www.youtube.com/watch?v='+this.playlist[this.index];}
 getCurrentTime(){return this.time;}getDuration(){return manifest.tracks.find(t=>t.source.video_id===this.playlist[this.index])?.duration||300;}getPlaybackRate(){return 1;}getPlayerState(){return this.state;}
 setLoop(){}setShuffle(){}getIframe(){return this.frame;}destroy(){this.frame.remove();}
}
window.YT={Player:Port};
const {outputFiles}=await build({stdin:{contents:"export {PlaylistMusic} from './src/music/PlaylistMusic';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {PlaylistMusic}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const music=new PlaylistMusic({publish:state=>latest={...latest,...state}}),flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
assert.equal(document.getElementById('music-open').disabled,true,'Play cannot consume the initiating tap before its player is ready');
await flush();assert.equal(ports.length,1,'Prepare one native player before the first tap');const port=ports[0];port.ready();await flush();
assert.equal(port.playCalls,0,'Preparing the playlist never autoplays audio');assert.equal(document.getElementById('music-open').disabled,false);
assert.match(port.frame.getAttribute('allow'),/autoplay/,'The native iframe receives autoplay permission');
gesture=true;document.getElementById('music-open').click();gesture=false;
assert.equal(port.state,1,'The first enabled tap must start playback inside its gesture');assert.equal(port.playCalls,1);await flush();
assert.equal(music.backgroundRainAllowed,false,'Actual YouTube playback owns its authored rain');
port.state=3;music.player.poll();assert.equal(music.backgroundRainAllowed,true,'Buffering cannot freeze the ambient water');port.playVideo();await flush();
assert.equal(document.getElementById('youtube-frame').hidden,false,'A playing mobile iframe stays visible');
assert.equal(document.getElementById('youtube-slot').hidden,false);
document.getElementById('music-expand').click();document.getElementById('music-expand').click();assert.equal(document.getElementById('youtube-frame').hidden,false,'Minimizing details does not hide mobile playback');
await music.next();assert.equal(port.requested,1);port.index=1;port.time=0;port.state=5;music.player.poll();await flush();assert.equal(port.state,1,'A cued next item must resume the existing play intent');
// Native playlist advancement can arrive without an intermediate app Next.
port.index=2;port.time=0;port.state=5;music.player.poll();await flush();assert.equal(port.state,1,'A native queue change also resumes a cued item');
music.pause();const calls=port.playCalls;await music.next();port.index=3;port.state=5;music.player.poll();await flush();assert.equal(port.playCalls,calls,'Changing a paused playlist cannot resume audio');
port.options.events.onAutoplayBlocked();assert.equal(document.getElementById('youtube-frame').hidden,false);assert.equal(document.getElementById('music-details').hidden,false,'A browser block reveals usable native controls');
music.close();assert.equal(document.getElementById('youtube-frame').hidden,true);assert.equal(timers.size,0,'Closing playback clears pending timers');
console.log(JSON.stringify({preparedWithoutAutoplay:true,firstTapUsesGesture:true,oneNativePlayer:true,mobilePlayerVisible:true,cuedNextResumes:true,nativeAdvanceResumes:true,pausedNextRemainsPaused:true,blockedNativeControlsAccessible:true,closedTimersCleared:true}));
