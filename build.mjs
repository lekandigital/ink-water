import { build } from 'esbuild';
import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { shaderSource } from './shader-loader.mjs';
await mkdir('dist/assets', { recursive: true });
await build({ entryPoints: ['src/main.ts'], bundle: true, minify: true, format: 'esm', target: 'es2022', outfile: 'dist/app.js', plugins:[{name:'water-shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}], legalComments: 'linked' });
await writeFile('dist/index.html',(await readFile('index.html','utf8')).replace('/src/main.ts','./app.js'));
for (const name of ['style.css', 'LICENSE']) await copyFile(name, `dist/${name}`);
await cp('public','dist',{recursive:true});
