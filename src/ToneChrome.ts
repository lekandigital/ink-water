import {tones,type Tone} from './DrawingPalette';

// Browser chrome follows the added palettes. Preserve the exact existing
// favicon and theme-color when returning to Light, Silver or Dark.
const originals=new WeakMap<Document,{icon:string;color:string}>();
const hex=(value:number)=>'#'+value.toString(16).padStart(6,'0');
export function syncToneChrome(tone:Tone,doc:Document=document){
  const icon=doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const theme=doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if(!icon||!theme)return;
  let original=originals.get(doc);
  if(!original){original={icon:icon.getAttribute('href')??'',color:theme.content};originals.set(doc,original);}
  let href=original.icon,color=original.color;
  if(tone==='green-light'||tone==='green-dark'){
    const paper=hex(tones[tone].paper),ink=hex(tones[tone].ink);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="${paper}"/><g fill="none" stroke="${ink}"><ellipse cx="20" cy="20" rx="15" ry="11"/><ellipse cx="20" cy="20" rx="10" ry="7"/><ellipse cx="20" cy="20" rx="5" ry="3"/></g></svg>`;
    href='data:image/svg+xml,'+encodeURIComponent(svg);color=paper;
  }
  if(icon.getAttribute('href')!==href)icon.setAttribute('href',href);
  if(theme.content!==color)theme.content=color;
}
