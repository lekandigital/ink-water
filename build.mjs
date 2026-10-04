import { build } from 'esbuild';
import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { shaderSource } from './shader-loader.mjs';
await mkdir('dist/assets', { recursive: true });
await build({ entryPoints: ['src/main.ts'], bundle: true, minify: true, format: 'esm', target: 'es2022', outfile: 'dist/app.js', plugins:[{name:'water-shaders',setup(b){b.onLoad({filter:/\.(vert|frag|glsl)$/},async args=>({contents:await shaderSource(args.path),loader:'text'}));}}], legalComments: 'linked' });
// Every URL in the page and the textures it loads is relative. To serve the build from a
// subpath, set INK_WATER_BASE (e.g. /ink-water/) and they resolve there even without a trailing slash.
const base=process.env.INK_WATER_BASE;
if(base!==undefined&&!/^\/([\w.-]+\/)*$/.test(base))throw new Error('INK_WATER_BASE must look like /ink-water/');
let html=(await readFile('index.html','utf8')).replace('/src/main.ts','./app.js');
if(base)html=html.replace('<meta charset="utf-8">',`<meta charset="utf-8">\n  <base href="${base}">`);
await writeFile('dist/index.html',html);
for (const name of ['style.css', 'LICENSE']) await copyFile(name, `dist/${name}`);
await cp('public','dist',{recursive:true});
