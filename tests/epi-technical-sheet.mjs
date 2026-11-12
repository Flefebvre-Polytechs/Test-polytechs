import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'epi-pdf-')),db=new DatabaseSync(':memory:'),objects=new Map();
let allowed=true,origin=true,fullSession=true,readSession=true;
function stmt(sql,args=[]){return {bind(...v){return stmt(sql,v)},async first(){return db.prepare(sql).get(...args)||null},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.epiPdfDb={prepare:stmt};globalThis.epiPdfBucket={async put(k,v){objects.set(k,v)},async get(k){return objects.has(k)?{body:objects.get(k)}:null},async delete(k){objects.delete(k)}};
globalThis.epiPdfGate=async()=>fullSession?{user:{displayName:'Gestionnaire'}}:{error:Response.json({}, {status:401})};globalThis.epiPdfReadGate=async()=>readSession?{user:{displayName:'Lecteur'}}:{error:Response.json({}, {status:401})};globalThis.epiPdfAllowed=()=>allowed;globalThis.epiPdfOrigin=()=>origin;
try{
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE epi_products(code TEXT PRIMARY KEY,catalog_status TEXT);INSERT INTO epi_products VALUES(\'EPI_01\',\'Actif\'),(\'EPI_02\',\'Supprimé\');');db.exec(fs.readFileSync('drizzle/0042_epi_technical_sheets.sql','utf8'));
 fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.epiPdfDb;export const bucket=()=>globalThis.epiPdfBucket;');
 fs.writeFileSync(path.join(dir,'access.mjs'),'export const requireRole=(...a)=>globalThis.epiPdfGate(...a);export const checkOrigin=()=>globalThis.epiPdfOrigin();');
 fs.writeFileSync(path.join(dir,'session.mjs'),'export const requireEpiRole=(...a)=>globalThis.epiPdfReadGate(...a);');
 fs.writeFileSync(path.join(dir,'epi-access.mjs'),'export const epiCanRead=async()=>globalThis.epiPdfAllowed();export const epiCanManage=epiCanRead;');
 function compile(file,out){let s=fs.readFileSync(file,'utf8');for(const [a,b] of [['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/epi-session','./session.mjs'],['@/lib/epi-access','./epi-access.mjs'],['@/lib/document-file','./document-file.mjs']])s=s.replaceAll(a,b);fs.writeFileSync(path.join(dir,out),ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
 compile('lib/document-file.ts','document-file.mjs');compile('app/api/epi-stock/technical-sheet/route.ts','route.mjs');const api=await import(path.join(dir,'route.mjs'));
 const url='https://example.test/api/epi-stock/technical-sheet';const pdf='%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF';
 const get=(suffix='&meta=1')=>api.GET(new Request(url+'?code=EPI_01'+suffix));
 async function upload(version='',code='EPI_01',bytes=pdf,name='fiche.pdf'){const f=new FormData();f.set('code',code);f.set('version',version);f.set('file',new File([bytes],name,{type:'application/pdf'}));const body=new Request(url,{method:'POST',body:f});return api.POST(new Request(url,{method:'POST',headers:body.headers,body:await body.arrayBuffer()}))}
 const del=version=>api.DELETE(new Request(url,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'EPI_01',version})}));
 assert.equal((await (await get()).json()).sheet,null);assert.equal((await upload()).status,200);assert.equal(objects.size,1);
 const first=(await (await get()).json()).sheet;assert.equal(first.name,'fiche.pdf');assert.ok(!('object_key' in first));
 assert.equal(await (await get('')).text(),pdf);assert.match((await get('&download=1')).headers.get('content-disposition'),/^attachment/);
 assert.equal((await upload()).status,409);assert.equal((await del('wrong')).status,409);assert.equal(objects.size,1);
 assert.equal((await upload(first.version,'EPI_01','not pdf')).status,400);assert.equal((await upload(first.version,'EPI_01',pdf,'file.html')).status,400);assert.equal((await upload('','EPI_02')).status,404);
 assert.equal((await upload(first.version,'EPI_01',pdf,'new.pdf')).status,200);const second=(await (await get()).json()).sheet;assert.notEqual(first.version,second.version);assert.equal(objects.size,1);assert.equal((await del(first.version)).status,409);
 fullSession=false;assert.equal((await get('')).status,200,'QR session may consult PDF');assert.equal((await upload(second.version)).status,401,'QR-only session cannot upload');fullSession=true;
 allowed=false;assert.equal((await get()).status,403);assert.equal((await upload(second.version)).status,403);assert.equal((await del(second.version)).status,403);allowed=true;
 origin=false;assert.equal((await upload(second.version)).status,403);assert.equal((await del(second.version)).status,403);origin=true;
 const tooBig=new Uint8Array(10*1024*1024+70000);assert.equal((await upload(second.version,'EPI_01',tooBig)).status,413);
 readSession=false;assert.equal((await get()).status,401);readSession=true;
 assert.equal((await del(second.version)).status,200);assert.equal(objects.size,0);assert.equal((await get('')).status,404);
 console.log('EPI PDF: upload, replacement, stale-version rejection, format/size, permissions, QR read-only access, download and deletion passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});for(const k of ['epiPdfDb','epiPdfBucket','epiPdfGate','epiPdfReadGate','epiPdfAllowed','epiPdfOrigin'])delete globalThis[k]}
