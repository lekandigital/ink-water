import * as THREE from 'three';
import referenceFloor from './shaders/UnderwaterLines.frag';

// In the drawing modes the pool walls disappear: refracted view rays continue to an
// open floor, which keeps the source tile, light and projected-caustic shading, and
// reflected rays reach the sky instead of the pool rim.
// Two short lines lie on that floor, near the top and bottom where the pool's edge
// was, so ripples visibly bend the view through the water. Original keeps the
// source pool shader verbatim. Rendering only.
const wallHit='    vec2 t = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));\n    color = getWallColor(origin + ray * t.y);';
const rayColor='vec3 getSurfaceRayColor(vec3 origin, vec3 ray, vec3 waterColor) {';
const openFloor='    // Open floor: no pool walls in the drawing modes.\n    color = getReferenceFloorColor(origin + ray * ((-poolHeight - origin.y) / ray.y));';
// Reflections would otherwise show the pool rim near the edges of the view.
const rimHit='    if (hit.y < 2.0 / 12.0) {\n      // Hit pool wall above water line';
const noRim='    if (false) {\n      // No pool rim in the drawing modes: reflections reach the sky';

const refractedRay='vec3 refractedRay = refract(incomingRay, normal, IOR_AIR / IOR_WATER);';
const lineMask=`${refractedRay}
  if(referenceLineMaskOnly){
    float mark=referenceFloorMark(vPosition+refractedRay*((-poolHeight-vPosition.y)/refractedRay.y));
    gl_FragColor=vec4(mark,0.0,0.0,1.0);return;
  }`;

export function patchFloorLine(source:string){
  for(const target of [wallHit,rayColor,rimHit,refractedRay])if(source.split(target).length!==2)throw new Error('The water shader no longer matches the floor line presentation.');
  return source.replace(rayColor,referenceFloor+'\n'+rayColor).replace(wallHit,openFloor).replace(rimHit,noRim).replace(refractedRay,lineMask);
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

