precision highp float;
uniform sampler2D previousWater;
uniform sampler2D currentWater;
uniform float blend;
varying vec2 coord;
void main(){gl_FragColor=mix(texture2D(previousWater,coord),texture2D(currentWater,coord),blend);}
