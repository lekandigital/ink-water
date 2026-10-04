uniform sampler2D touchWater;
uniform sampler2D rainWater;
uniform bool joinStrokes;
varying vec2 coord;

void main(){
  vec4 touch=texture2D(touchWater,coord);
  vec4 rain=texture2D(rainWater,coord);
  // The source heightfield solver is linear in height and velocity (R/G).
  // Normals are recomputed from the sum, never added together.
  gl_FragColor=joinStrokes?max(touch,rain):vec4(touch.rg+rain.rg,0.0,0.0);
}
