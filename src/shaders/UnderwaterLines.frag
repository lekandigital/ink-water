uniform vec3 inkFloorLine;
uniform float referenceLineWeight;
uniform float referenceNeutralCaustic;
uniform bool referenceProjected;
uniform bool referenceLineMaskOnly;

float referenceFloorMark(vec3 point){
  float across=abs(abs(point.z)-inkFloorLine.z);
  float end=max(abs(point.x)-inkFloorLine.x,0.0);
  float distanceToMark=length(vec2(end,across));
  float aa=max(fwidth(distanceToMark),0.000001);
  float width=max(inkFloorLine.y*referenceLineWeight/0.68,aa*referenceLineWeight*0.25);
  return 1.0-smoothstep(width,width+aa,distanceToMark);
}

vec3 getReferenceFloorColor(vec3 point){
  vec3 wallColor=texture2D(tiles,point.xz*0.5+0.5).rgb;
  float scale=0.5/max(length(point),0.0001);
  if(referenceProjected){
    vec3 refractedLight=-refract(-light,vec3(0.0,1.0,0.0),IOR_AIR/IOR_WATER);
    vec2 uv=0.75*(point.xz-point.y*refractedLight.xz/refractedLight.y)*0.5+0.5;
    vec4 focus=texture2D(causticTex,uv);
    // Outside the finite source light mesh, continue neutral illumination.
    // Interior caustics and their shadow channel retain the source values.
    float coverage=1.0-focus.a;
    float intensity=coverage>0.00001?(focus.r/coverage)*(focus.g/coverage):referenceNeutralCaustic;
    scale+=max(0.0,refractedLight.y)*intensity*2.0;
  }
  return wallColor*scale;
}
