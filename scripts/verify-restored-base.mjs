import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=JSON.parse(await readFile('scripts/0124-base.json','utf8'));
for(const [path,sha] of Object.entries(base.files)){
 const contents=await readFile(path),actual=createHash('sha1').update(Buffer.from('blob '+contents.length+'\0')).update(contents).digest('hex');
 assert.equal(actual,sha,'Restored source must remain byte-identical: '+path);
}
console.log(JSON.stringify({actualBase:base.commit,unchangedSourceFiles:Object.keys(base.files).length,solverGeometryOpticsAndDrawingPreserved:true}));
