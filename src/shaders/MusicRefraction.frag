precision highp float;
uniform sampler2D water;
uniform mat4 inverseViewProjection;
uniform mat4 viewProjection;
uniform vec3 eye;
uniform vec4 screenRect;
uniform vec2 screenSize;
varying vec2 coord;

vec3 projected(vec3 point){
  vec4 clip=viewProjection*vec4(point,1.0);
  return clip.xyz/clip.w;
}
vec3 floorHit(vec3 point,vec3 ray){
  return point+ray*((-0.7-point.y)/min(ray.y,-0.001));
}
void main(){
  vec2 screen=screenRect.xy+coord*screenRect.zw;
  vec4 near=inverseViewProjection*vec4(screen*2.0-1.0,-1.0,1.0);
  vec4 far=inverseViewProjection*vec4(screen*2.0-1.0,1.0,1.0);
  vec3 origin=near.xyz/near.w,ray=normalize(far.xyz/far.w-origin);
  vec3 point=origin+ray*(-origin.y/ray.y);
  if(max(abs(point.x),abs(point.z))>1.0){gl_FragColor=vec4(0.5,0.5,0.0,1.0);return;}
  vec2 uv=point.xz*0.5+0.5;
  vec4 info=texture2D(water,uv);
  // Use the same normal reconstruction and parallax refinement as WaterAbove.
  for(int i=0;i<5;i++){uv=clamp(uv+info.ba*0.005,0.0,1.0);info=texture2D(water,uv);}
  vec2 slope=clamp(info.ba,vec2(-0.999),vec2(0.999));
  vec3 normal=normalize(vec3(slope.x,sqrt(max(0.001,1.0-min(dot(slope,slope),0.999))),slope.y));
  vec3 surface=vec3(point.x,info.r,point.z);
  vec3 bent=floorHit(surface,refract(normalize(surface-eye),normal,1.0/1.333));
  vec3 still=floorHit(point,refract(normalize(point-eye),vec3(0.0,1.0,0.0),1.0/1.333));
  vec2 pixels=(projected(bent).xy-projected(still).xy)*screenSize*0.5;
  // DOM y runs down. Bound displacement to 12 CSS pixels to keep controls legible.
  pixels.y=-pixels.y;
  gl_FragColor=vec4(0.5+clamp(pixels,vec2(-12.0),vec2(12.0))/24.0,0.0,1.0);
}
