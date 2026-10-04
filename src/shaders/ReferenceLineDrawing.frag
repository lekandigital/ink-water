precision highp float;
uniform sampler2D marks;
uniform vec3 ink;
varying vec2 coord;
void main(){gl_FragColor=vec4(ink,texture2D(marks,coord).r*0.42);}
