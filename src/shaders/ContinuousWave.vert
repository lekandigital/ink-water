attribute vec4 waveStroke;
uniform float worldPixel;
varying vec2 waveOffset;
varying float strokeRadius;
varying float strokeOpacity;
void main(){
  // The mesh only bounds a thin annulus. The fragment shader draws an exact
  // circle, including the seam, rather than disconnected polygon segments.
  float padding=worldPixel*4.0+waveStroke.z*0.00008;
  waveOffset=position.xy*max(0.0,waveStroke.z+uv.x*padding);
  strokeRadius=waveStroke.z;
  strokeOpacity=waveStroke.w;
  vec3 world=vec3(waveStroke.x+waveOffset.x,0.0,waveStroke.y+waveOffset.y);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(world,1.0);
}
