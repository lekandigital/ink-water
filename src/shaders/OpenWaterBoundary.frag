// Open-edge treatment applied after the unchanged source wave update.
precision highp float;
uniform sampler2D currentWater;
uniform sampler2D previousWater;
uniform vec2 delta;
varying vec2 coord;
void main(){
  vec4 info=texture2D(currentWater,coord);
  vec2 edge=min(coord,1.0-coord)/delta;
  float cells=min(edge.x,edge.y);
  float oldHeight=texture2D(previousWater,coord).r;
  // First-order outgoing radiation at the outermost cells, with a broad
  // smooth sponge before them. A third target prevents texture feedback.
  const float outgoing=(0.70710678-1.0)/(0.70710678+1.0);
  float edgeHeight=0.0,count=0.0;
  if(edge.x<1.0){
    vec2 inward=vec2(coord.x<0.5?delta.x:-delta.x,0.0);
    edgeHeight+=texture2D(previousWater,coord+inward).r
      +outgoing*(texture2D(currentWater,coord+inward).r-oldHeight);count+=1.0;
  }
  if(edge.y<1.0){
    vec2 inward=vec2(0.0,coord.y<0.5?delta.y:-delta.y);
    edgeHeight+=texture2D(previousWater,coord+inward).r
      +outgoing*(texture2D(currentWater,coord+inward).r-oldHeight);count+=1.0;
  }
  if(count>0.0){info.r=edgeHeight/count;info.g=info.r-oldHeight;}
  float sponge=clamp((40.0-cells)/40.0,0.0,1.0);
  if(sponge>0.0){
    info.g*=exp(-0.28*sponge*sponge*sponge*sponge);
    info.r=oldHeight+info.g;
  }
  gl_FragColor=info;
}
