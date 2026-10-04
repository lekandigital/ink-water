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
varying vec2 coord;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float luminance(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
float greyAt(vec2 uv){ float l=luminance(texture2D(sceneColor,uv).rgb);return l/(1.0+l); }
vec4 bilinearState(vec2 uv){
  const vec2 delta=vec2(1.0/256.0);
  vec2 q=clamp(uv,delta*0.5,1.0-delta*0.5)/delta-0.5,i=floor(q),f=fract(q),a=(i+0.5)*delta;
  return mix(mix(texture2D(water,a),texture2D(water,a+vec2(delta.x,0)),f.x),mix(texture2D(water,a+vec2(0,delta.y)),texture2D(water,a+delta),f.x),f.y);
}
void main(){
  vec4 original=texture2D(sceneColor,coord);
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
  if(mode==3){gl_FragColor=vec4(mix(paper,original.rgb,alpha),1.0);return;}
  vec2 waterUV=p/poolSize*0.5+0.5;
  vec4 state=bilinearState(waterUV);
  // Height contours and slopes come from the same texture used by the original mesh.
  float slope=length(state.ba);
  float activity=smoothstep(0.006,0.055,slope);
  float phase=state.r*380.0;
  float phaseAA=max(fwidth(phase),0.008);
  float distanceToLine=abs(fract(phase+0.5)-0.5);
  float contour=(1.0-smoothstep(phaseAA*lineWeight*0.3,phaseAA*(lineWeight*0.3+0.9),distanceToLine))*activity;
  float slopeInk=smoothstep(0.045,0.34,slope);
  float light=greyAt(coord);
  vec2 d=pixel*1.8;
  float wash=(light*4.0+greyAt(coord+vec2(d.x,0))+greyAt(coord-vec2(d.x,0))+greyAt(coord+vec2(0,d.y))+greyAt(coord-vec2(0,d.y)))/8.0;
  float gradient=length(vec2(greyAt(coord+vec2(pixel.x,0))-greyAt(coord-vec2(pixel.x,0)),greyAt(coord+vec2(0,pixel.y))-greyAt(coord-vec2(0,pixel.y))));
  float weight;
  if(mode==0){
    // Soft graphite wash, translucent slopes, and selective fine ink contours.
    weight=0.045+0.19*(1.0-wash)+0.19*slopeInk+contour*0.51+gradient*1.25;
  } else if(mode==1){
    weight=0.022+contour*0.88+slopeInk*0.18+gradient*1.8;
  } else {
    float diagonal=fract((gl_FragCoord.x+gl_FragCoord.y*0.61)*0.18);
    float hatch=(1.0-smoothstep(0.11,0.32,abs(diagonal-0.5)))*smoothstep(0.02,0.17,slope);
    weight=0.05+(1.0-wash)*0.22+contour*0.34+slopeInk*0.15+hatch*0.2;
  }
  vec3 drawn=mix(paper,ink,clamp(weight,0.0,0.95))+grain;
  color=mix(color,drawn,alpha);
  color=mix(color,ink,outline);
  // A delicate rim follows the actual geometry's alpha, never a replacement outline.
  float coverage=(texture2D(sceneColor,coord+pixel*vec2(1,0)).a+texture2D(sceneColor,coord-pixel*vec2(1,0)).a+texture2D(sceneColor,coord+pixel*vec2(0,1)).a+texture2D(sceneColor,coord-pixel*vec2(0,1)).a)*0.25;
  float rim=sourceGeometry ? abs(alpha-coverage) : 0.0;
  color=mix(color,ink,rim*0.33);
  gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
}
