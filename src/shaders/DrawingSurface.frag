// A small presentation-only filter. It never writes to either water simulation buffer.
precision highp float;
uniform sampler2D water;
uniform vec2 axis;
varying vec2 coord;
void main(){
  vec2 h=vec2(0.0);float total=0.0;
  for(int i=-6;i<=6;i++){
    float weight=exp(-float(i*i)/9.68);
    h+=texture2D(water,coord+axis*float(i)).rg*weight;total+=weight;
  }
  gl_FragColor=vec4(h/total,0.0,1.0);
}
