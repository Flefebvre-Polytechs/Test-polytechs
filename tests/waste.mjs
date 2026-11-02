import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-waste-'));
const sqlite=new DatabaseSync(':memory:');
function statement(sql,values=[]){return {bind(...args){return statement(sql,args)},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}}}}
globalThis.wasteTestDb={prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
globalThis.wasteTestRole='admin';globalThis.wasteTeamAllowed=true;
function compile(name,source){fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
compile('waste',fs.readFileSync('lib/waste.ts','utf8'));
const {blankWaste,wasteMetrics,wasteIssues,tonnes,validateWaste}=await import(pathToFileURL(path.join(dir,'waste.mjs')));
const mass={...blankWaste(),id:'excel-dechets-6',type:'Carton',family:'Cartons',date:'2026-01-10',quantity:2,unit:'t',status:'Enlevé',danger:'Non',collector:'Collecteur',destination:'Destination',treatment:'Le recyclage matière',sourceRow:6,raw:{AJ:'2'}};
const kg={...mass,id:'kg',quantity:500,unit:'kg',treatment:'Autre'};
const pieces={...mass,id:'palettes',family:'Palettes',quantity:204,unit:'unité'};
const planned={...mass,id:'prévu',status:'Prévu',quantity:100};
const uncertain={...mass,id:'unité',quantity:3445,unit:'à vérifier'};
const badDate={...mass,id:'date',date:'2026-02-31',quantity:10};
const unknown={...mass,id:'inconnue',quantity:null,estimate:5};
const all=[mass,kg,pieces,planned,uncertain,badDate,unknown];
assert.equal(wasteMetrics(all).total,2.5);assert.equal(wasteMetrics(all).materialRate,80);assert.equal(wasteMetrics(all).pallets,204);assert.equal(wasteMetrics(all).weighed,2);
assert.equal(tonnes({...mass,quantity:0}),0);assert.equal(tonnes(badDate),null);assert.equal(tonnes(planned),null);assert.equal(tonnes(unknown),null);
assert.ok(wasteIssues({...mass,code:'161001*',danger:'Non'}).some(x=>x.includes('étoilé')));assert.ok(validateWaste({...mass,quantity:-1}).length);assert.ok(validateWaste({...mass,documentUrl:'javascript:alert(1)'}).length);
assert.ok(wasteIssues({...mass,estimate:-18}).some(x=>x.includes('négative')),'A negative historical estimate remains visible for correction');
fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.wasteTestDb;');
fs.writeFileSync(path.join(dir,'access.mjs'),"export const checkOrigin=req=>req.headers.get('origin')===new URL(req.url).origin;export const requireRole=async(req,role='reader')=>globalThis.wasteTestRole===null?{error:Response.json({}, {status:401})}:role==='editor'&&globalThis.wasteTestRole==='reader'?{error:Response.json({}, {status:403})}:{user:{displayName:'Test',role:globalThis.wasteTestRole}};");
fs.writeFileSync(path.join(dir,'teams.mjs'),'export const teamsAllowed=async()=>globalThis.wasteTeamAllowed;');
fs.writeFileSync(path.join(dir,'source.mjs'),'export const loadWasteSource=()=>('+JSON.stringify({source:'test.xlsx',records:[mass],headers:['Date'],adrReference:[]})+');');
let source=fs.readFileSync('app/api/dechets/route.ts','utf8');for(const [from,to] of [['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/team-access','./teams.mjs'],['@/lib/waste-private-source','./source.mjs'],['@/lib/waste','./waste.mjs']])source=source.replaceAll("'"+from+"'","'"+to+"'");compile('route',source);
sqlite.exec(`CREATE TABLE records(id TEXT PRIMARY KEY,title TEXT,kind TEXT,status TEXT,details TEXT,description TEXT,owner TEXT,url TEXT);`);
sqlite.exec(fs.readFileSync('drizzle/0013_tricky_lady_vermin.sql','utf8').replaceAll('--> statement-breakpoint',''));
const api=await import(pathToFileURL(path.join(dir,'route.mjs')));const request=(body,origin='https://example.test')=>new Request('https://example.test/api/dechets',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
assert.equal((await api.POST(request(mass,'https://elsewhere.test'))).status,403);
globalThis.wasteTestRole='reader';assert.equal((await api.POST(request(mass))).status,403);globalThis.wasteTestRole='admin';
globalThis.wasteTeamAllowed=false;assert.equal((await api.GET(new Request('https://example.test/api/dechets'))).status,403);globalThis.wasteTeamAllowed=true;
assert.equal((await api.POST(request({...mass,quantity:3}))).status,200);
assert.equal((await api.POST(request({...mass,quantity:99}))).status,409);
let data=await (await api.GET(new Request('https://example.test/api/dechets'))).json();assert.equal(data.records.length,1);assert.equal(data.records[0].quantity,3);assert.equal(data.records[0].raw,undefined);
data=await (await api.GET(new Request('https://example.test/api/dechets?id=excel-dechets-6'))).json();assert.equal(data.record.raw.AJ,'2');assert.equal(data.history.length,1);assert.equal(JSON.parse(data.history[0].snapshot).quantity,2);
assert.equal((await api.POST(request({...data.record,quantity:4}))).status,200);
assert.equal((await api.POST(request({...data.record,quantity:44}))).status,409);
const created=await api.POST(request({...blankWaste(),type:'Nouveau déchet'}));assert.equal(created.status,200);
const sourcePath='private/waste-source.json';if(fs.existsSync(sourcePath)){const original=JSON.parse(fs.readFileSync(sourcePath,'utf8'));assert.ok(original.records.length>=1733);assert.equal(new Set(original.records.map(r=>r.id)).size,original.records.length);assert.equal(original.records.find(r=>r.sourceRow===66).unit,'à vérifier');assert.equal(original.records.find(r=>r.sourceRow===6).quantity,204);assert.equal(original.records.find(r=>r.sourceRow===6).unit,'unité');assert.ok(original.records.every(r=>r.raw.AD));}
console.log('Déchets : unités, dates, estimations, confidentialité, droits, historique et modifications concurrentes vérifiés.');
}finally{sqlite.close();fs.rmSync(dir,{recursive:true,force:true})}
