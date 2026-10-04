import * as THREE from 'three';
import { fitWaterCamera } from '../src/Viewport.ts';
import { Renderer } from '../src/Renderer.ts';
import { SunDiscPresentation } from '../src/OpticsPresentation.ts';
import { FloorLinePresentation } from '../src/FloorLinePresentation.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { shaderSource } from '../shader-loader.mjs';
const directory=process.argv[2];mkdirSync(directory,{recursive:true});
const engine=new Renderer({} as any,new THREE.Texture(),new THREE.CubeTexture()) as any;
engine.setPoolShape('Box',0,1,0.7,1);
const camera=new THREE.PerspectiveCamera(33,844/640,0.01,100);
fitWaterCamera(camera,844,640);
engine.renderWater({textureA:{texture:new THREE.Texture()}},camera);
function encode(value:any):any{
 if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string')return value;
 if(Array.isArray(value))return value.map(encode);
 if(value?.isVector2||value?.isVector3||value?.isVector4||value?.isMatrix4)return value.toArray();
 return null;
}
function meshData(mesh:any){
 const g=mesh.geometry,m=mesh.material;
 return {position:Array.from(g.attributes.position.array),normal:g.attributes.normal?Array.from(g.attributes.normal.array):null,uv:g.attributes.uv?Array.from(g.attributes.uv.array):null,index:g.index?Array.from(g.index.array):null,vertex:m.vertexShader,fragment:m.fragmentShader,uniforms:Object.fromEntries(Object.entries(m.uniforms).map(([k,v]:[string,any])=>[k,encode(v.value)])),side:m.side};
}
const data:any={camera:{position:camera.position.toArray(),projection:camera.projectionMatrix.toArray(),view:camera.matrixWorldInverse.toArray(),inverseViewProjection:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).invert().toArray()},pool:meshData(engine.getPoolMesh()),above:meshData(engine.getWaterMesh()),below:meshData(engine.getWaterMeshBack()),caustics:meshData(engine.caustics.mesh),quad:meshData(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial()))};
const presentation=new SunDiscPresentation(),floor=new FloorLinePresentation();floor.fit(camera,844);
for(const [key,mesh] of [['above',engine.getWaterMesh()],['below',engine.getWaterMeshBack()]] as const){
  presentation.apply(mesh.material,true);floor.apply(mesh.material,key==='above');
  const shader={fragmentShader:mesh.material.fragmentShader,uniforms:mesh.material.uniforms};
  mesh.material.onBeforeCompile(shader,{} as any);
  data[key+'WithLines']={...meshData(mesh),fragment:shader.fragmentShader};
  floor.apply(mesh.material,false);presentation.apply(mesh.material,false);
}
data.inkFloorLine=floor.line.value.toArray();
data.bitmapDrawing=await shaderSource('src/shaders/BitmapWater.frag');
for(const name of ['WaterRipple.vert','WaterRipple.frag','WaveSimulation.vert','WaveSimulation.frag','WaterNormal.vert','WaterNormal.frag','Drawing.vert','Drawing.frag'])data[name]=await shaderSource('src/shaders/'+name);
writeFileSync(directory+'/fixtures.json',JSON.stringify(data));
console.log(JSON.stringify({waterVertices:data.above.position.length/3,files:'fixtures.json',directory}));
