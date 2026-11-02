import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-waste-table-'));
try{
 fs.writeFileSync(path.join(dir,'waste-table.mjs'),ts.transpileModule(fs.readFileSync('lib/waste-table.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 const {wasteColumn,wasteTableColumns,wasteTableValue}=await import(pathToFileURL(path.join(dir,'waste-table.mjs')));
 assert.deepEqual([wasteColumn(0),wasteColumn(25),wasteColumn(26),wasteColumn(61)],['A','Z','AA','BJ']);
 assert.deepEqual(wasteTableColumns(['Date','',"N° BSD"]).map(x=>x.label),['Date','Colonne B','N° BSD']);
 const raw={A:'Date source',AC:'BSD initial',AD:'Carton',AR:'Collecteur\nAdresse',BH:'Note source'};
 const record={sourceRow:6,revision:0,date:'2026-01-02',type:'Carton',bsd:'BSD récent',collector:'Collecteur',quantity:2,estimate:null,danger:'Non',client:false,excluded:false,code:'200101',treatment:'Recyclage',destination:'Site'};
 assert.equal(wasteTableValue(record,raw,'AR'),'Collecteur\nAdresse');assert.equal(wasteTableValue(record,raw,'BH'),'Note source');
 assert.equal(wasteTableValue({...record,revision:1},raw,'AC'),'BSD récent');assert.equal(wasteTableValue({...record,revision:1},raw,'BH'),'Note source');
 assert.equal(wasteTableValue({...record,sourceRow:0},raw,'AJ'),'2');
 console.log('Registre complet : 62 colonnes, source et corrections vérifiées.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
