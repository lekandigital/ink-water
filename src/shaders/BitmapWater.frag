// Independent bitmap layers over the existing water drawing and its caustics.
precision highp float;
uniform sampler2D baseColor;
uniform sampler2D litScene;
uniform sampler2D flatScene;
uniform sampler2D water;
uniform vec2 pixel;
uniform float pixelRatio;
uniform vec2 poolSize;
uniform mat4 inverseViewProjection;
uniform vec3 eye;
uniform vec3 paper;
uniform vec3 ink;
uniform bool causticRipples;
uniform bool bitmapTones;
uniform bool causticReveal;
uniform bool driftingGrain;
uniform bool softDiffusion;
uniform bool dreamy;
uniform bool subtle;
uniform float waterBitmapScale;
uniform float waterBitmapLevels;
uniform float waterBitmapContrast;
uniform float causticInk;
uniform float dreamSoftness;
varying vec2 coord;
float bitmapLuma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
float bitmapHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float opticalGrey(vec3 c){float l=bitmapLuma(c);return l/(1.0+l);}
float focusAt(vec2 uv){return opticalGrey(texture2D(litScene,uv).rgb)-opticalGrey(texture2D(flatScene,uv).rgb);}
float bitmapOrder(vec2 index){vec2 q=mod(index,2.0);return 2.0*q.x+3.0*q.y-4.0*q.x*q.y;}
float dotPrint(vec2 position){
  vec2 cell=position/max(1.0,waterBitmapScale);
  float distance=length(fract(cell)-.5);
  float aa=max(fwidth(distance)*.55,.01);
  return 1.0-smoothstep(.29-aa,.29+aa,distance);
}
vec4 bitmapState(vec2 uv){
  const vec2 delta=vec2(1.0/256.0);
  vec2 q=clamp(uv,delta*.5,1.0-delta*.5)/delta-.5,i=floor(q),f=fract(q),a=(i+.5)*delta;
  return mix(mix(texture2D(water,a),texture2D(water,a+vec2(delta.x,0)),f.x),mix(texture2D(water,a+vec2(0,delta.y)),texture2D(water,a+delta),f.x),f.y);
}
void main(){
  vec3 color=texture2D(baseColor,coord).rgb;
  float focus=0.0,edge=0.0;
  if(causticRipples||causticReveal){
    focus=focusAt(coord);
    vec2 d=pixel*max(1.0,pixelRatio);
    edge=length(vec2(focusAt(coord+vec2(d.x,0))-focusAt(coord-vec2(d.x,0)),focusAt(coord+vec2(0,d.y))-focusAt(coord-vec2(0,d.y))));
  }
  if(causticRipples){
    // The same refracted light shapes become ink. Lighting itself is switched off.
    float weight=.018+clamp((edge*3.8+abs(focus)*.055)*causticInk,0.0,.88);
    color=mix(paper,ink,weight);
  }
  if(softDiffusion||dreamy){
    vec2 d=pixel*pixelRatio*dreamSoftness*(dreamy?1.25:1.0);
    vec3 mist=texture2D(baseColor,coord).rgb*4.0;
    mist+=texture2D(baseColor,coord+vec2(d.x,0)).rgb+texture2D(baseColor,coord-vec2(d.x,0)).rgb;
    mist+=texture2D(baseColor,coord+vec2(0,d.y)).rgb+texture2D(baseColor,coord-vec2(0,d.y)).rgb;
    mist+=texture2D(baseColor,coord+d).rgb+texture2D(baseColor,coord-d).rgb;
    mist+=texture2D(baseColor,coord+vec2(d.x,-d.y)).rgb+texture2D(baseColor,coord+vec2(-d.x,d.y)).rgb;
    if(!causticRipples)color=mix(color,mist/12.0,softDiffusion?(dreamy?.57:.42):.28);
    else{
      float halo=abs(focusAt(coord+d))+abs(focusAt(coord-d));
      color=mix(color,ink,clamp(halo*causticInk*.08,0.0,.12));
    }
  }
  vec2 position=gl_FragCoord.xy/max(1.0,pixelRatio);
  if(driftingGrain){
    vec4 world=inverseViewProjection*vec4(coord*2.0-1.0,0.0,1.0);
    vec3 ray=normalize(world.xyz/world.w-eye);
    vec2 p=(eye+ray*(-eye.y/ray.y)).xz;
    vec4 state=bitmapState(p/poolSize*.5+.5);
    vec2 warped=position+vec2(state.b,-state.a)*48.0;
    float marks=dotPrint(warped),flecks=bitmapHash(floor(warped/max(1.0,waterBitmapScale)));
    color=mix(color,ink,(marks*.027+step(.78,flecks)*.012)*waterBitmapContrast);
  }
  if(causticReveal){
    float reveal=clamp(edge*7.0+abs(focus)*.5,0.0,1.0);
    color=mix(color,ink,dotPrint(position)*(.009+reveal*.6)*waterBitmapContrast);
  }
  if(bitmapTones){
    float delta=bitmapLuma(ink)-bitmapLuma(paper);
    float weight=clamp((bitmapLuma(color)-bitmapLuma(paper))/delta,0.0,1.0);
    vec2 index=mod(floor(position/max(1.0,waterBitmapScale)),4.0);
    float threshold=(4.0*bitmapOrder(index)+bitmapOrder(floor(index*.5))+.5)/16.0;
    float levels=max(2.0,floor(waterBitmapLevels)),value=weight*(levels-1.0);
    float printed=(floor(value)+step(threshold,fract(value)))/(levels-1.0);
    color=mix(color,mix(paper,ink,printed),waterBitmapContrast);
  }
  if(subtle)color=mix(paper,color,.64);
  gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
}
