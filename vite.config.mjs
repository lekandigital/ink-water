import { defineConfig } from 'vite';
import { shaderSource } from './shader-loader.mjs';
export default defineConfig({
  plugins:[{ name:'water-shaders', async transform(_,id){ if(/\.(vert|frag|glsl)$/.test(id)) return {code:'export default '+JSON.stringify(await shaderSource(id))+';',map:null}; }}],
  server:{host:'0.0.0.0',port:4173,strictPort:true,allowedHosts:['terminal.local']},
});
