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
  // Draw exactly one hairline for each propagating wave cycle.
  // Height + vertical velocity form a local wave phasor. A single phase angle
  // gives one centerline per ripple instead of paired flanks or contour stacks.
  float slope=length(state.ba);
  float velocityPhase=state.g*2.4;
  float waveAmplitude=length(vec2(state.r,velocityPhase));
  float wavePhase=atan(velocityPhase,state.r);

  // Periodic angular distance to phase 0. This selects one line per cycle.
  float phaseDistance=abs(atan(sin(wavePhase),cos(wavePhase)));

  // Screen-space anti-aliased hairline. Width stays essentially constant around
  // the entire ripple and does not depend on local wave amplitude.
  float phaseAA=max(fwidth(wavePhase),0.004);
  float hairlineWidth=phaseAA*(0.38+0.10*clamp(lineWeight,0.5,2.5));
  float hairline=1.0-smoothstep(hairlineWidth,hairlineWidth+phaseAA*0.55,phaseDistance);

  // Binary visibility only: no fading along a ripple.
  float activity=step(0.00016,waveAmplitude+slope*0.20);
  hairline*=activity;

  // The optional comparison toggle keeps a narrow slope line. The preferred
  // default view below is the pure single hairline with no secondary ripple shading.
  float rippleWidth=clamp(lineWeight,0.5,2.5);
  float slopeLevel=0.060/rippleWidth;
  float slopeAA=max(fwidth(slope),0.0015);
  float slopeLine=1.0-smoothstep(slopeAA*0.55,slopeAA*1.25,abs(slope-slopeLevel));
  float contour=waterLikeRipples ? slopeLine : hairline;

  float light=greyAt(coord);
  vec2 d=pixel*1.8;
  float wash=(light*4.0+greyAt(coord+vec2(d.x,0))+greyAt(coord-vec2(d.x,0))+greyAt(coord+vec2(0,d.y))+greyAt(coord-vec2(0,d.y)))/8.0;
  float weight;

  if(!waterLikeRipples){
    // Pure hairline treatment: no slope fill, no optical edge enhancement,
    // no amplitude shading. Only the line itself sits on the paper.
    if(mode==0){
      weight=0.040+contour*0.64;
    } else if(mode==1){
      weight=0.020+contour*0.90;
    } else {
      weight=0.045+contour*0.58;
    }
  } else if(mode==0){
    weight=0.045+0.15*(1.0-wash)+contour*0.28;
  } else if(mode==1){
    weight=0.022+contour*0.42;
  } else {
    weight=0.05+(1.0-wash)*0.16+contour*0.28;
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
