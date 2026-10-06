import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { shaderSource } from './shader-loader.mjs';
export default defineConfig({
  plugins:[{name:'music-data',configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const path=req.url?.split('?')[0];if(!path||!/^\/music\/(?:manifest\.json|scores\/[a-z0-9-]+\.json)$/.test(path))return next();
    try{const content=await readFile('data'+path,'utf8');res.setHeader('Content-Type','application/json');res.end(content);}catch{res.statusCode=404;res.end('Missing score');}
  });}}, { name:'water-shaders', async transform(_,id){ if(/\.(vert|frag|glsl)$/.test(id)) return {code:'export default '+JSON.stringify(await shaderSource(id))+';',map:null}; }}],
  server:{host:'0.0.0.0',port:4173,strictPort:true,allowedHosts:['terminal.local']},
});
