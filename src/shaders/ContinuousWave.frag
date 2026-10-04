precision highp float;
uniform float lineWeight;
uniform float pixelRatio;
varying vec2 waveOffset;
varying float strokeRadius;
varying float strokeOpacity;
void main(){
  float distanceFromCurve=length(waveOffset)-strokeRadius;
  float pixelDistance=max(length(vec2(dFdx(distanceFromCurve),dFdy(distanceFromCurve))),1e-8);
  float distanceInPixels=abs(distanceFromCurve)/pixelDistance;
  float width=clamp(lineWeight,0.35,1.25)*pixelRatio;
  float coverage=clamp(min(width*0.5,distanceInPixels+0.5)-max(-width*0.5,distanceInPixels-0.5),0.0,1.0);
  // Opacity is constant around the full wave: fading cannot cut it into islands.
  gl_FragColor=vec4(vec3(coverage*strokeOpacity),1.0);
}
