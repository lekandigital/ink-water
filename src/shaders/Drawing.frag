// A presentation pass only: upstream simulation and scene geometry are unchanged.
precision highp float;
uniform sampler2D sceneColor;
uniform sampler2D water;
uniform vec2 pixel;
uniform vec2 poolSize;
uniform mat4 inverseViewProjection;
uniform vec3 eye;
uniform vec3 paper;
uniform vec3 ink;
uniform float lineWeight;
uniform int mode;
uniform bool sourceGeometry;
uniform bool waterLikeRipples;
in vec2 coord;
out vec4 fragColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float luminance(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
float greyAt(vec2 uv){ float l=luminance(texture(sceneColor,uv).rgb);return l/(1.0+l); }
vec4 bilinearState(vec2 uv){
  const vec2 delta=vec2(1.0/256.0);
  vec2 q=clamp(uv,delta*0.5,1.0-delta*0.5)/delta-0.5,i=floor(q),f=fract(q),a=(i+0.5)*delta;
  return mix(mix(texture(water,a),texture(water,a+vec2(delta.x,0)),f.x),mix(texture(water,a+vec2(0,delta.y)),texture(water,a+delta),f.x),f.y);
}
void main(){
  vec4 original=texture(sceneColor,coord);
  float alpha=original.a;
  float grain=(hash(floor(gl_FragCoord.xy))-0.5)*0.004;
  vec3 color=paper+grain;
  vec4 world=inverseViewProjection*vec4(coord*2.0-1.0,0.0,1.0);
  vec3 ray=normalize(world.xyz/world.w-eye);
  vec2 p=(eye+ray*(-eye.y/ray.y)).xz;
  float outline=0.0;
  if(!sourceGeometry){
    vec2 q=p/vec2(0.96,0.77);
    float a=atan(q.y,q.x);
    float r=0.87+0.06*cos(3.0*a+0.5)+0.032*sin(5.0*a-0.7)+0.018*cos(7.0*a);
    float sd=(length(q)-r)*0.77,aa=max(fwidth(sd),0.0009);
    alpha*=1.0-smoothstep(-aa,aa,sd);
    outline=(1.0-smoothstep(aa*0.5,aa*1.5,abs(sd)))*0.4;
  }
  if(mode==3){fragColor=vec4(mix(paper,original.rgb,alpha),1.0);return;}
  vec2 waterUV=p/poolSize*0.5+0.5;
  vec4 state=bilinearState(waterUV);
  // Height contours and slopes come from the same texture used by the original mesh.
  float slope=length(state.ba);
  // Use the simulation's height + vertical velocity as a local wave phasor.
  // Unlike repeated iso-height contours, phase follows a propagating wavefront
  // without turning amplitude variations into extra contour loops/"bubbles".
  float velocityPhase=state.g*2.4;
  float waveAmplitude=length(vec2(state.r,velocityPhase));
  float wavePhase=atan(velocityPhase,state.r);
  float phaseSignal=sin(wavePhase);
  float phaseAA=max(fwidth(phaseSignal),0.010);
  float thinWidth=phaseAA*(0.34*lineWeight+0.28);
  float phaseContour=1.0-smoothstep(thinWidth,thinWidth+phaseAA*0.72,abs(phaseSignal));

  // Keep line strength uniform around a ripple. The wave-presence test is
  // intentionally binary: segments are either fully present or absent, never
  // faded according to local amplitude. Anti-aliasing still happens only
  // across the line's thickness via phaseContour above.
  float wavePresence=waveAmplitude+slope*0.35;
  float activity=step(0.00018,wavePresence);
  float legacyContour=phaseContour*activity;

  // Optional comparison mode: a narrow slope contour, not a filled slope band.
  // A radial wave crosses this level on each flank, giving a fine paired line.
  float rippleWidth=clamp(lineWeight,0.5,2.5);
  float slopeLevel=0.060/rippleWidth;
  float slopeAA=max(fwidth(slope),0.0015);
  float pairedRipple=1.0-smoothstep(slopeAA*0.65,slopeAA*1.75,abs(slope-slopeLevel));
  float contour=waterLikeRipples ? pairedRipple : legacyContour;
  float slopeInk=smoothstep(0.045,0.34,slope);
  float light=greyAt(coord);
  vec2 d=pixel*1.8;
  float wash=(light*4.0+greyAt(coord+vec2(d.x,0))+greyAt(coord-vec2(d.x,0))+greyAt(coord+vec2(0,d.y))+greyAt(coord-vec2(0,d.y)))/8.0;
  float gradient=length(vec2(greyAt(coord+vec2(pixel.x,0))-greyAt(coord-vec2(pixel.x,0)),greyAt(coord+vec2(0,pixel.y))-greyAt(coord-vec2(0,pixel.y))));
  float weight;
  if(mode==0){
    // Soft graphite wash, translucent slopes, and selective fine ink contours.
    weight=0.045+0.19*(1.0-wash)+(waterLikeRipples?0.0:0.19)*slopeInk+contour*(waterLikeRipples?0.26:0.51)+gradient*1.25;
  } else if(mode==1){
    weight=0.022+contour*(waterLikeRipples?0.38:0.88)+slopeInk*(waterLikeRipples?0.0:0.18)+gradient*1.8;
  } else {
    float diagonal=fract((gl_FragCoord.x+gl_FragCoord.y*0.61)*0.18);
    float hatch=(1.0-smoothstep(0.11,0.32,abs(diagonal-0.5)))*smoothstep(0.02,0.17,slope);
    weight=0.05+(1.0-wash)*0.22+contour*(waterLikeRipples?0.24:0.34)+slopeInk*(waterLikeRipples?0.0:0.15)+hatch*0.2;
  }
  vec3 drawn=mix(paper,ink,clamp(weight,0.0,0.95))+grain;
  color=mix(color,drawn,alpha);
  color=mix(color,ink,outline);
  // A delicate rim follows the actual geometry's alpha, never a replacement outline.
  float coverage=(texture(sceneColor,coord+pixel*vec2(1,0)).a+texture(sceneColor,coord-pixel*vec2(1,0)).a+texture(sceneColor,coord+pixel*vec2(0,1)).a+texture(sceneColor,coord-pixel*vec2(0,1)).a)*0.25;
  float rim=sourceGeometry ? abs(alpha-coverage) : 0.0;
  color=mix(color,ink,rim*0.33);
  fragColor=vec4(clamp(color,0.0,1.0),1.0);
}
