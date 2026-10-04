import * as THREE from 'three';

// In the drawing modes the pool walls disappear: refracted view rays continue to an
// open floor, which keeps the source tile, light and projected-caustic shading, and
// reflected rays reach the sky instead of the pool rim.
// Two short lines lie on that floor, near the top and bottom where the pool's edge
// was, so ripples visibly bend the view through the water. Original keeps the
// source pool shader verbatim. Rendering only.
const wallHit='    vec2 t = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));\n    color = getWallColor(origin + ray * t.y);';
const rayColor='vec3 getSurfaceRayColor(vec3 origin, vec3 ray, vec3 waterColor) {';
const floorColor=`uniform vec3 inkFloorLine;
// The source floor shading, without walls, plus two short lines (half length x,
// half width y, at z = ±z).
vec3 getInkFloorColor(vec3 point) {
  float scale = 0.5 / length(point);
  vec3 refractedLight = -refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
  // The caustic map covers only the source floor. Beyond it, continue its edge
  // lighting instead of dropping to an unlit band, which drew a rectangle.
  vec2 lit = clamp(point.xz, vec2(-0.99), vec2(0.99));
  vec4 caustic = texture2D(
    causticTex,
    0.75 * (lit - point.y * refractedLight.xz / refractedLight.y) * 0.5 + 0.5
  );
  scale += max(0.0, refractedLight.y) * caustic.r * 2.0 * caustic.g;
  vec2 aa = max(fwidth(point.xz), vec2(1.0e-5));
  float across = 1.0 - smoothstep(inkFloorLine.y - aa.y, inkFloorLine.y + aa.y, abs(abs(point.z) - inkFloorLine.z));
  float along = 1.0 - smoothstep(inkFloorLine.x - aa.x, inkFloorLine.x + aa.x, abs(point.x));
  return texture2D(tiles, point.xz * 0.5 + 0.5).rgb * scale * (1.0 - 0.35 * across * along);
}

`;
const openFloor='    // Open floor: no pool walls in the drawing modes.\n    color = getInkFloorColor(origin + ray * ((-poolHeight - origin.y) / ray.y));';
// Reflections would otherwise show the pool rim near the edges of the view.
const rimHit='    if (hit.y < 2.0 / 12.0) {\n      // Hit pool wall above water line';
const noRim='    if (false) {\n      // No pool rim in the drawing modes: reflections reach the sky';

export function patchFloorLine(source:string){
  for(const target of [wallHit,rayColor,rimHit])if(source.split(target).length!==2)throw new Error('The water shader no longer matches the floor line presentation.');
  return source.replace(rayColor,floorColor+rayColor).replace(wallHit,openFloor).replace(rimHit,noRim);
}

export class FloorLinePresentation{
  readonly line={value:new THREE.Vector3()};
  private enabled=new WeakMap<THREE.ShaderMaterial,boolean>();
  apply(material:THREE.ShaderMaterial,enabled:boolean){
    if(!this.enabled.has(material)){
      material.onBeforeCompile=shader=>{
        if(!this.enabled.get(material))return;
        shader.uniforms.inkFloorLine=this.line;
        shader.fragmentShader=patchFloorLine(shader.fragmentShader);
      };
      material.customProgramCacheKey=()=>this.enabled.get(material)?'ink-floor-line':'source-pool';
    }
    if(this.enabled.get(material)!==enabled){this.enabled.set(material,enabled);material.needsUpdate=true;}
  }
  /**
   * Each line is under 28% of the screen width, faint and about a pixel thick. It sits on the
   * pool's former edge (floor z = ±1) when that is in view, otherwise near the top
   * and bottom of the screen, at any aspect ratio.
   */
  fit(camera:THREE.PerspectiveCamera,width:number){
    const height=camera.position.y,halfHeight=height*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),halfWidth=halfHeight*camera.aspect;
    // Where a view ray through surface offset s meets the floor, 1 below still water.
    const toFloor=(s:number)=>s+Math.tan(Math.asin(Math.sin(Math.atan(s/height))/1.333));
    let screen=.82*halfHeight;
    for(let i=0;i<40&&toFloor(screen)>.98;i++)screen*=.99;
    const floorScale=toFloor(screen)/screen;
    this.line.value.set(.28*halfWidth*floorScale,.3*(2*halfWidth/Math.max(1,width))*floorScale,toFloor(screen));
  }
}
