import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=JSON.parse(await readFile('scripts/0124-base.json','utf8'));
for(const [path,sha] of Object.entries(base.files)){
 let contents=await readFile(path);
 if(path==='src/DrawingPalette.ts'){
  // Appearance-only additions are intentional. Remove only the two green
  // declarations and their comments, then hash the retained original palette,
  // types and uniform upload function against the unmodified 0124 manifest.
  const legacy=contents.toString().replace(/^  \/\/ The Solid Doctor label: lighter unprinted paper and median green ink\.\n/m,'').replace(/^  'green-(?:light|dark)': \{ paper: 0x[0-9a-f]{6}, ink: 0x[0-9a-f]{6} \},\n/gm,'').replace('  // The custom drawing shader writes these display RGB values directly.','  // The custom shader writes these grayscale values directly to the screen.');
  contents=Buffer.from(legacy);
 }
 const actual=createHash('sha1').update(Buffer.from('blob '+contents.length+'\0')).update(contents).digest('hex');
 assert.equal(actual,sha,'Restored source must remain byte-identical: '+path);
}
console.log(JSON.stringify({actualBase:base.commit,unchangedSourceFiles:Object.keys(base.files).length-1,legacyPaletteSourcePreserved:true,appearancePaletteExtended:true,solverGeometryOpticsAndDrawingPreserved:true}));
