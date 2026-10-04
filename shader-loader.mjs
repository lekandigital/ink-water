import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
export async function shaderSource(file, ancestors=[]) {
  if(ancestors.includes(file)) throw new Error('Cyclic shader include: '+file);
  const text=await readFile(file,'utf8');
  const matches=[...text.matchAll(/#include\s+"([^"]+)"/g)];
  let out=text;
  for(const match of matches) out=out.replace(match[0],await shaderSource(resolve(dirname(file),match[1]),[...ancestors,file]));
  return out;
}
