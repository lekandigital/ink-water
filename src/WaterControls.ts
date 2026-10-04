import {experimentSwitches,experimentRanges,controlId,validateExperimentSettings} from './AppearanceExperiments';
import {motionDefaults,motionRanges,validateMotion} from './WaterMotion';
import {gestureKeys,type GestureKey} from './GesturePatterns';
import {startupSettings,type WaterSettings} from './StartupSettings';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const labels={'ink-wash':'Ink wash',etching:'Etching',graphite:'Graphite',original:'Original'};
export const switchKeys=['hairlineRipples','caustics','rain',...experimentSwitches] as const;
export const ranges={lineWeight:{min:.35,max:1.25},rainRate:{min:.2,max:8},dropSize:{min:.012,max:.065},...experimentRanges,...motionRanges};
type Hooks={change:()=>void;clear:()=>void;gesture:(key:GestureKey)=>void};

// A single state owner, bound before graphics initialization. Native input events
// commit state once; GPU work runs later, outside the checkbox's click transaction.
export class WaterControls{
  readonly state:WaterSettings=startupSettings();
  hooks:Hooks={change:()=>{},clear:()=>{},gesture:()=>{}};
  private savedCaustics:boolean|undefined;
  private diagnostics:Record<string,unknown>={ready:false,renderRevision:0};
  constructor(){
    for(const key of switchKeys){
      const input=$<HTMLInputElement>(controlId(key));
      input.addEventListener('input',()=>this.change({[key]:input.checked}));
    }
    for(const key of Object.keys(ranges)){
      const input=$<HTMLInputElement>(controlId(key));
      input.addEventListener('input',()=>this.change({[key]:Number(input.value)}));
    }
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.addEventListener('click',()=>this.change({mode:b.dataset.mode})));
    document.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(b=>b.addEventListener('click',()=>this.change({tone:b.dataset.tone})));
    document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(b=>b.addEventListener('click',()=>this.change({bitmapPattern:Number(b.dataset.pattern)})));
    document.querySelectorAll<HTMLButtonElement>('[data-gesture]').forEach(b=>b.addEventListener('click',()=>this.hooks.gesture(b.dataset.gesture as GestureKey)));
    $('reset-defaults').addEventListener('click',()=>this.reset());
    $('clear').addEventListener('click',()=>this.hooks.clear());
    $('pause').addEventListener('click',()=>this.change({paused:!this.state.paused}));
    $('toggle-controls').addEventListener('click',()=>this.toggleVisibility());
    window.addEventListener('keydown',e=>{
      if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
      if((e.target as Element)?.closest?.('textarea,select,[contenteditable="true"],input:not([type="range"]):not([type="checkbox"]):not([type="button"])'))return;
      const key=e.key.toLowerCase();
      if(e.code==='Space'||key===' '){e.preventDefault();this.change({paused:!this.state.paused});}
      else if(key==='h'){e.preventDefault();this.toggleVisibility();}
      else if(gestureKeys.includes(key as GestureKey)){e.preventDefault();this.hooks.gesture(key as GestureKey);}
    });
    this.sync();
  }
  change(input:Record<string,unknown>){
    // Validate the entire update before touching any state.
    for(const key of Object.keys(input))if(!Object.hasOwn(this.state,key))throw new Error('Unknown setting: '+key);
    for(const key of [...switchKeys,'paused','sourceGeometry'])if(input[key]!==undefined&&typeof input[key]!=='boolean')throw new Error(key+' must be boolean.');
    if(input.mode!==undefined&&!Object.hasOwn(labels,String(input.mode)))throw new Error('Unknown drawing mode.');
    if(input.tone!==undefined&&!['paper','silver','night'].includes(String(input.tone)))throw new Error('Unknown paper tone.');
    validateExperimentSettings(input);validateMotion(input);
    for(const [key,{min,max}] of Object.entries(ranges))if(input[key]!==undefined){
      const value=input[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(key+' is outside its range.');
    }
    const updates=Object.fromEntries(Object.entries(input).filter(([,v])=>v!==undefined));
    if(updates.causticRipples===true&&!this.state.causticRipples){
      this.savedCaustics=this.state.caustics;updates.caustics=false;
    }else if(updates.causticRipples===false&&this.state.causticRipples){
      if(updates.caustics===undefined)updates.caustics=this.savedCaustics??false;
      this.savedCaustics=undefined;
    }
    if(updates.caustics===true){updates.causticRipples=false;this.savedCaustics=undefined;}
    Object.assign(this.state,updates);
    this.sync();this.hooks.change();
  }
  reset(){Object.assign(this.state,startupSettings());this.savedCaustics=undefined;this.sync();this.hooks.change();}
  toggleVisibility(){
    const hidden=document.body.classList.toggle('controls-hidden');
    $('toggle-controls').setAttribute('aria-expanded',String(!hidden));
    $('toggle-controls').textContent=hidden?'Show controls':'Hide controls';this.publish();
  }
  publish(diagnostics:Record<string,unknown>={}){
    Object.assign(this.diagnostics,diagnostics);
    $('water-state').textContent=JSON.stringify({...this.state,...this.diagnostics,controlsHidden:document.body.classList.contains('controls-hidden')});
  }
  sync(){
    document.body.dataset.tone=this.state.tone;
    for(const key of switchKeys){
      const input=$<HTMLInputElement>(controlId(key));
      // Do not write checked back into an input already displaying its new value.
      if(input.checked!==this.state[key])input.checked=this.state[key];
    }
    for(const key of Object.keys(ranges) as (keyof typeof ranges)[]){
      const input=$<HTMLInputElement>(controlId(key)),value=this.state[key];
      if(Number(input.value)!==value)input.value=String(value);
      let text:string;
      if(key==='lineWeight')text=value<1?'Fine':value<1.7?'Medium':'Bold';
      else if(key==='rainRate')text=!this.state.rain?'Off':value<2?'Light':value<5?'Steady':'Heavy';
      else if(key==='dropSize')text=value<.029?'Small':value<.05?'Medium':'Large';
      else if(key==='waterBitmapLevels')text=Math.round(value)+' shades';
      else if(['bitmapScale','revealWidth','waterBitmapScale','dreamSoftness'].includes(key))text=value.toFixed(key==='bitmapScale'?1:0)+' px';
      else if(key.startsWith('light'))text=Math.round(value)+'°';
      else text=Math.round(value*(key==='rainForce'?100/motionDefaults.rainForce:key==='touchForce'?100/motionDefaults.touchForce:100))+'%';
      $(key==='lineWeight'?'weight-value':key==='rainRate'?'rain-value':key==='dropSize'?'size-value':controlId(key)+'-value').textContent=text;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===this.state.mode)));
    document.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tone===this.state.tone)));
    document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pattern)===this.state.bitmapPattern)));
    $('style-caption').textContent=labels[this.state.mode];
    $('pause').setAttribute('aria-pressed',String(this.state.paused));
    $('pause-label').textContent=this.state.paused?'Resume':'Pause';
    $('pause').querySelector('.pause-symbol')!.textContent=this.state.paused?'▷':'Ⅱ';
    $('ripple-note').textContent=this.state.causticRipples?'Refracted light shapes drawn as ink. Projected lighting is off.':this.state.hairlineRipples?'Concentric waves expand and fade. No wall echoes.':'Artistic height contours over open water.';
    $('caustic-note').textContent=this.state.alignedCaustics&&this.state.mode!=='original'?'Surface glow follows the ripple positions. An artistic alignment experiment.':'Projected light falls below the water. Its highlights can sit apart from the ripple crests.';
    this.publish();
  }
}
