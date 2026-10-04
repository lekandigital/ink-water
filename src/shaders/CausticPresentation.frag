precision highp float;
uniform sampler2D causticMap;
uniform float strength;
varying vec2 coord;
void main(){
  vec4 light=texture2D(causticMap,coord);
  light.r*=strength;
  gl_FragColor=light;
}
