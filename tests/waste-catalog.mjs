import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-waste-catalog-'));
try{
 for(const name of ['waste','waste-catalog']){
  let source=fs.readFileSync(`lib/${name}.ts`,'utf8').replaceAll("'./waste'","'./waste.mjs'");
  fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 }
 const {blankWaste}=await import(pathToFileURL(path.join(dir,'waste.mjs')));
 const {wasteCatalog,newWasteFromCatalog,collectorCatalog,applyCollector}=await import(pathToFileURL(path.join(dir,'waste-catalog.mjs')));
 const old={...blankWaste(),id:'excel-dechets-6',type:'Carton',code:'20 01 01',date:'2025-01-01',collector:'Ancien',quantity:5};
 const recent={...old,id:'excel-dechets-7',type:' carton ',date:'2026-01-01',collector:'Nouveau',destination:'Centre',quantity:8,bsd:'BSD-123',notes:'Note confidentielle',sourceRow:7,raw:{A:'Source'},treatment:'Le recyclage matière'};
 const other={...recent,id:'excel-dechets-8',code:'15 01 01',collector:'Autre'};
 const catalog=wasteCatalog([old,recent,other]);assert.equal(catalog.length,2);
 const item=catalog.find(x=>x.record.code==='20 01 01');assert.equal(item.count,2);assert.equal(item.record.collector,'Nouveau');
 const draft={...blankWaste(),date:'2026-11-02',quantity:2,bsd:'BSD-NOUVEAU',notes:'Saisie en cours'};
 const next=newWasteFromCatalog(item,draft);
 assert.equal(next.collector,'Nouveau');assert.equal(next.treatment,'Le recyclage matière');assert.equal(next.date,draft.date);assert.equal(next.quantity,2);assert.equal(next.bsd,'BSD-NOUVEAU');assert.equal(next.notes,'Saisie en cours');assert.equal(next.id,'');assert.equal(next.sourceRow,0);assert.equal(next.raw,undefined);
 const collectors=collectorCatalog([old,recent,{...recent,id:'9',collector:' nouveau ',date:'2025-06-01'},other]);
 assert.equal(collectors.find(x=>x.key==='nouveau').count,2);
 const withCollector=applyCollector(collectors.find(x=>x.key==='nouveau'),{...next,destination:'Ancienne destination'});
 assert.equal(withCollector.collector,'Nouveau');assert.equal(withCollector.destination,'Centre');assert.equal(withCollector.type,next.type);assert.equal(withCollector.quantity,2);assert.equal(withCollector.bsd,'BSD-NOUVEAU');
 console.log('Catalogue déchets : dédoublonnage, dernière filière et champs propres au nouvel enlèvement vérifiés.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
