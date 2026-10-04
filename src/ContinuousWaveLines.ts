import * as THREE from 'three';
import { ContinuousWaveModel, MAX_WAVE_IMPULSES } from './ContinuousWaveModel';
import vertexShader from './shaders/ContinuousWave.vert';
import fragmentShader from './shaders/ContinuousWave.frag';

const SEGMENTS = 512;
export class ContinuousWaveLines {
  readonly model = new ContinuousWaveModel();
  readonly scene = new THREE.Scene();
  readonly target = new THREE.WebGLRenderTarget(1,1,{
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter, depthBuffer: false,
  });
  readonly material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: { worldPixel: { value: .002 }, lineWeight: { value: .68 }, pixelRatio: { value: 1 } },
    depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    side: THREE.DoubleSide,
  });
  readonly geometry = new THREE.InstancedBufferGeometry();
  readonly strokes = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WAVE_IMPULSES*9*4),4)
    .setUsage(THREE.DynamicDrawUsage);

  constructor(){
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for(let i=0;i<=SEGMENTS;i++){
      const angle=(i%SEGMENTS)*Math.PI*2/SEGMENTS;
      for(const side of [-1,1]){
        positions.push(Math.cos(angle),Math.sin(angle),0);uv.push(side,0);
      }
      if(i<SEGMENTS){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    this.geometry.setAttribute('waveStroke',this.strokes);
    this.geometry.setIndex(indices);this.geometry.instanceCount=0;
    const mesh=new THREE.Mesh(this.geometry,this.material);
    mesh.frustumCulled=false;this.scene.add(mesh);
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, step: number, lineWeight: number){
    const height=2*camera.position.y*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
    const pixels=renderer.getDrawingBufferSize(new THREE.Vector2());
    this.material.uniforms.worldPixel.value=height/pixels.y;
    this.material.uniforms.lineWeight.value=lineWeight;
    this.material.uniforms.pixelRatio.value=renderer.getPixelRatio();
    const waves=this.model.strokes(step,height*camera.aspect*.5,height*.5);
    waves.forEach((wave,index)=>this.strokes.setXYZW(index,wave.x,wave.z,wave.radius,wave.opacity));
    this.strokes.needsUpdate=true;this.geometry.instanceCount=waves.length;
    renderer.setRenderTarget(this.target);renderer.setClearColor(0,1);renderer.clear();
    renderer.render(this.scene,camera);
  }
}
