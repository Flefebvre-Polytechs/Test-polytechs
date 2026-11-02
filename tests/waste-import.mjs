import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-waste-import-'));
const dataDir=path.join(root,'data'),privateDir=path.join(dataDir,'private');fs.mkdirSync(privateDir,{recursive:true});
const oldDir=process.env.POLYTECHS_DATA_DIR;process.env.POLYTECHS_DATA_DIR=dataDir;
const row=n=>({id:`excel-dechets-${n}`,revision:0,sourceRow:n,date:'2026-11-01',dateSource:'2026-11-01',status:'Enlevé',type:'Carton',family:'Cartons',code:'200101',danger:'Non',quantity:2,estimate:null,unit:'t',excluded:false,client:false,collector:'Collecteur',destination:'Site',treatment:'Le recyclage matière',bsd:'',owner:'',notes:'',documentUrl:'',issues:[],raw:{A:'2026-11-01',AD:'Carton'}});
const source=(records,sha)=>({source:'test.xlsx',sha256:sha.repeat(64),records,headers:['Date'],adrReference:[],treatments:[]});
const previous=source([row(6)],'a'),incoming=source([{...row(6),quantity:3},row(7)],'b');
fs.writeFileSync(path.join(privateDir,'waste-source.json'),JSON.stringify(previous));
fs.writeFileSync(path.join(root,'source.mjs'),`import {readFileSync} from 'node:fs';import {join} from 'node:path';export const loadWasteSource=()=>JSON.parse(readFileSync(join(process.env.POLYTECHS_DATA_DIR,'private','waste-source.json'),'utf8'));`);
fs.writeFileSync(path.join(root,'raw.mjs'),`export const database=()=>({prepare:()=>({first:async()=>({n:4})})});`);
fs.writeFileSync(path.join(root,'access.mjs'),`export const checkOrigin=req=>req.headers.get('origin')==='https://example.test';export const requireRole=async()=>globalThis.wasteImporterAdmin?{user:{id:'admin'}}:{error:Response.json({error:'Non autorisé'},{status:403})};export const securityEvent=async()=>{};`);
let route=fs.readFileSync('app/api/dechets/import/route.ts','utf8');for(const [from,to] of [['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/waste-private-source','./source.mjs']])route=route.replaceAll("'"+from+"'","'"+to+"'");
fs.writeFileSync(path.join(root,'route.mjs'),ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
try{
 const api=await import(path.join(root,'route.mjs'));
 const post=(body,origin='https://example.test')=>api.POST(new Request('https://example.test/api/dechets/import',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));
 globalThis.wasteImporterAdmin=false;assert.equal((await post({source:incoming})).status,403);
 globalThis.wasteImporterAdmin=true;assert.equal((await post({source:incoming},'https://evil.test')).status,403);
 const preview=await (await post({source:incoming})).json();assert.deepEqual([preview.previous,preview.total,preview.added,preview.changed,preview.protectedCorrections],[1,2,1,1,4]);
 if(fs.existsSync('private/waste-source.json')){const actual=JSON.parse(fs.readFileSync('private/waste-source.json','utf8'));const check=await post({source:actual});assert.equal(check.status,200,'The complete private workbook passes server validation');assert.equal((await check.json()).total,actual.records.length)}
 assert.equal((await post({source:source([row(7)],'c')})).status,409,'No existing source row may silently disappear');
 assert.equal((await post({source:{...incoming,records:[row(6),row(6)]}})).status,400,'Duplicate source identifiers refused');
 assert.equal((await post({source:incoming,apply:true,expectedSha:'stale'})).status,409);
 assert.equal(JSON.parse(fs.readFileSync(path.join(privateDir,'waste-source.json'))).sha256,previous.sha256,'Preview and rejected imports never mutate source');
 const result=await (await post({source:incoming,apply:true,expectedSha:preview.currentSha})).json();assert.equal(result.imported,true);
 assert.equal(JSON.parse(fs.readFileSync(path.join(privateDir,'waste-source.json'))).records.length,2);
 assert.equal(fs.readdirSync(privateDir).filter(x=>x.startsWith('waste-source.backup-')).length,1,'Previous source backed up');
 const repeat=await (await post({source:incoming,apply:true,expectedSha:incoming.sha256})).json();assert.equal(repeat.imported,true);assert.equal(fs.readdirSync(privateDir).filter(x=>x.startsWith('waste-source.backup-')).length,1,'Reimporting the same workbook does not create an extra backup');
 console.log('Waste import: admin/CSRF gates, preview, duplicates/removal rejection, concurrency, atomic replacement and previous source backup passed.');
}finally{if(oldDir===undefined)delete process.env.POLYTECHS_DATA_DIR;else process.env.POLYTECHS_DATA_DIR=oldDir;delete globalThis.wasteImporterAdmin;fs.rmSync(root,{recursive:true,force:true})}
