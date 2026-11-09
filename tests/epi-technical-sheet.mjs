import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-epi-sheet-'));
const db=new DatabaseSync(':memory:'),objects=new Map();
function statement(sql,args=[]){return {bind(...values){return statement(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.epiSheetDb={prepare:statement};
globalThis.epiSheetBucket={async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(key){objects.delete(key)}};
globalThis.epiSheetUser={role:'editor',displayName:'Gestionnaire EPI'};
globalThis.epiSheetAllowed=true;
function compile(name,source){
 for(const [from,to] of [['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/team-access','./teams.mjs'],['@/lib/document-file','./document-file.mjs']])source=source.replaceAll("'"+from+"'","'"+to+"'");
 fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
try{
 db.exec("PRAGMA foreign_keys=ON; CREATE TABLE epi_products (code TEXT PRIMARY KEY); INSERT INTO epi_products VALUES ('EPI-001'),('EPI-002');");
 db.exec(fs.readFileSync('drizzle/0020_epi_technical_sheets.sql','utf8'));
 fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.epiSheetDb;export const bucket=()=>globalThis.epiSheetBucket;');
 fs.writeFileSync(path.join(dir,'access.mjs'),"export const checkOrigin=req=>req.headers.get('origin')===new URL(req.url).origin;export const requireRole=async(req,role='reader')=>!globalThis.epiSheetUser?{error:Response.json({}, {status:401})}:role==='editor'&&globalThis.epiSheetUser.role==='reader'?{error:Response.json({}, {status:403})}:{user:globalThis.epiSheetUser};");
 fs.writeFileSync(path.join(dir,'teams.mjs'),'export const teamsAllowed=async()=>globalThis.epiSheetAllowed;');
 compile('document-file',fs.readFileSync('lib/document-file.ts','utf8'));
 compile('route',fs.readFileSync('app/api/epi-technical-sheet/route.ts','utf8'));
 const api=await import(path.join(dir,'route.mjs'));
 const url='https://example.test/api/epi-technical-sheet';
 const read=(code='EPI-001',preview=false)=>api.GET(new Request(url+'?code='+code+(preview?'&preview=1':'')));
 const post=async(file,previousId='',code='EPI-001',origin=url)=>{
   const f=new FormData();f.set('code',code);f.set('previousId',previousId);f.set('file',file);
   return api.POST(new Request(url,{method:'POST',headers:{origin:new URL(origin).origin},body:f}));
 };
 const remove=(code,id)=>api.POST(new Request(url,{method:'POST',headers:{origin:new URL(url).origin,'content-type':'application/json'},body:JSON.stringify({action:'remove',code,id})}));
 const pdf=()=>new File(['%PDF-1.7\nPolytechs EPI'],'fiche-technique.pdf',{type:'application/pdf'});
 globalThis.epiSheetUser=null;assert.equal((await read()).status,401);
 globalThis.epiSheetUser={role:'reader',displayName:'Lecteur'};
 assert.equal((await post(pdf())).status,403,'Lecteurs cannot upload');
 globalThis.epiSheetUser={role:'editor',displayName:'Gestionnaire EPI'};
 globalThis.epiSheetAllowed=false;assert.equal((await read()).status,403);assert.equal((await post(pdf())).status,403);
 globalThis.epiSheetAllowed=true;
 assert.equal((await api.POST(new Request(url,{method:'POST',headers:{origin:'https://evil.test'},body:new FormData()}))).status,403);
 assert.equal((await post(new File(['not a pdf'],'fake.pdf',{type:'application/pdf'}))).status,400);
 assert.equal((await post(pdf(),'','MISSING')).status,404);
 assert.equal((await post(pdf())).status,200);
 let row=db.prepare("SELECT * FROM epi_technical_sheets WHERE code='EPI-001'").get();
 assert.equal(objects.size,1);assert.equal(row.author,'Gestionnaire EPI');
 assert.equal((await read('EPI-002')).status,404);
 const preview=await read('EPI-001',true);
 assert.equal(preview.status,200);assert.match(preview.headers.get('content-disposition'),/^inline/);
 assert.equal(preview.headers.get('cache-control'),'private, no-store');
 assert.equal(preview.headers.get('x-content-type-options'),'nosniff');
 assert.match(await preview.text(),/Polytechs EPI/);
 assert.equal((await post(pdf())).status,409,'Stale additions cannot overwrite the current sheet');
 assert.equal((await post(pdf(),row.id)).status,200,'Authorised replacement works');
 assert.equal(objects.size,1,'Replacement cleans up the previous R2 object');
 const updated=db.prepare("SELECT * FROM epi_technical_sheets WHERE code='EPI-001'").get();
 assert.notEqual(updated.id,row.id);assert.equal((await remove('EPI-001',row.id)).status,409);
 assert.equal((await remove('EPI-001',updated.id)).status,200);
 assert.equal(objects.size,0);assert.equal((await read()).status,404);
 assert.equal(db.prepare('SELECT count(*) AS n FROM epi_products').get().n,2,'Original EPI catalog untouched');
 assert.equal((await post(pdf(),'','EPI-002')).status,200,'Each EPI reference supports its own sheet');
 assert.equal((await post(new File(['%PDF-1.7'],'oversize.pdf'),'', 'EPI-001','https://example.test')).status,200);
 console.log('EPI technical sheets: migration, QSSE permissions, validated upload, private preview, replacement, optimistic conflict, deletion and independent references passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});delete globalThis.epiSheetDb;delete globalThis.epiSheetBucket;delete globalThis.epiSheetUser;delete globalThis.epiSheetAllowed}
