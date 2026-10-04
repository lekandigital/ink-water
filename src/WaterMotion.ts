export const motionDefaults={waveSpeed:1,rippleScale:.85,rainForce:.0018,touchForce:.008};
export const motionRanges={waveSpeed:{min:.15,max:1},rippleScale:{min:.4,max:1},rainForce:{min:.0002,max:.0045},touchForce:{min:.001,max:.012}};
export function validateMotion(input:Record<string,unknown>){
  for(const [key,{min,max}] of Object.entries(motionRanges)){
    const value=input[key];
    if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max))throw new Error(key+' is outside its range.');
  }
}
export function rainImpulse(force:number,scale:number,random=Math.random){return {radius:(.016+random()*.012)*scale,strength:-force*(.8+random()*.4)};}
