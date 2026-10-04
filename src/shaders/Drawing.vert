precision highp float;
in vec3 position;
in vec2 uv;
out vec2 coord;
void main(){ coord=uv; gl_Position=vec4(position.xy,0.0,1.0); }
