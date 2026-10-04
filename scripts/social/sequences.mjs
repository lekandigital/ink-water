// Social asset timelines. Times are seconds from the first recorded frame; negative
// times happen during the unrecorded pre-roll. Touch positions are screen
// coordinates from -1 to 1 with y pointing down, the same space as the C, X and /
// gesture paths. Each sequence starts from still water and a fixed random seed,
// so every run renders the same frames.
//
// Every sequence uses Etching with Comic bitmap, the reflected sun left visible and
// Gentle rain on. Rainfall is raised from its minimum (one drop every five seconds)
// to 1.6, a slider step still labelled Light, so the clips always hold some motion.
// Only the paper changes: 'night' (Dark) or 'paper' (Light).

const still=seed=>[{type:'still'},{type:'seed',seed}];
const touch=(x,y)=>({type:'touch',x,y});
const settings=values=>({type:'settings',settings:values});
const gesture=key=>({type:'gesture',key});
const defaults=(tone,extra={})=>settings({tone,bitmapTones:true,rain:true,rainRate:1.6,hideSunDisc:false,...extra});

// 1280×720 CSS pixels at a 1.5 pixel ratio: a 1920×1080 frame with the line
// weight and texture scale of a laptop display.
const hd={width:1280,height:720,scale:1.5,fps:60};

/** Video A: the original simulated pool, then the same water drawn in ink. */
export const launch=tone=>({
  name:'launch-'+tone,...hd,seed:11,preroll:2,duration:12.5,
  setup:[...still(11),defaults(tone,{mode:'original',hideSunDisc:true})],
  events:[
    {at:-0.25,do:touch(-0.22,0.1)},
    {at:0.35,do:touch(0.2,-0.12)},
    {at:0.8,do:settings({mode:'etching'})},
    {at:4,do:touch(0.34,0.24)},
    {at:6,do:gesture('c')},
    {at:8.5,do:gesture('x')},
  ],
});

/** Video B: Etching only, gentle rain and one full-speed touch. */
export const loop=tone=>({
  name:'loop-'+tone,...hd,seed:5,preroll:3,
  // The last `crossfade` seconds blend back into the start, so the clip loops.
  duration:7.75,crossfade:0.75,
  setup:[...still(5),defaults(tone)],
  events:[{at:1.5,do:touch(-0.18,0.08)}],
});

/**
 * The README demo. Touches land near the two lines on the floor, so the ripples
 * visibly bend them. Loops like Video B.
 */
export const demo=tone=>({
  name:'demo-'+tone,...hd,seed:7,preroll:0.6,duration:7.75,crossfade:0.75,
  setup:[...still(7),defaults(tone)],
  events:[
    {at:-0.5,do:touch(-0.3,0.55)},
    {at:0.3,do:touch(0.18,-0.6)},
    {at:1.8,do:touch(-0.1,0.62)},
    {at:3,do:gesture('c')},
    {at:5.4,do:touch(0.3,-0.55)},
    {at:6.2,do:touch(-0.2,0.5)},
  ],
});

/** The Open Graph and GitHub social preview, on Dark paper, just after a C. */
export const social={
  name:'social',width:1280,height:640,scale:2,fps:60,seed:21,preroll:3,duration:1.26,frame:1.25,
  setup:[...still(21),defaults('night')],
  events:[{at:-0.8,do:touch(-0.42,0.25)},{at:-0.3,do:touch(0.3,-0.2)},{at:0.2,do:gesture('c')}],
};
