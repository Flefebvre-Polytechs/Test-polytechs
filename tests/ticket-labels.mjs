import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ticket-labels-')),db=new DatabaseSync(':memory:');
function stmt(sql,values=[]){return {bind(...v){return stmt(sql,v)},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}}}}}
globalThis.labelDb={prepare:stmt};globalThis.labelUser={id:'admin',role:'admin'};globalThis.labelMember=true;
try{
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES('admin'),('editor'),('reader');");db.exec(fs.readFileSync('drizzle/0029_ticket_labels.sql','utf8'));
 fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.labelDb;');
 fs.writeFileSync(path.join(dir,'access.mjs'),`export const checkOrigin=req=>req.headers.get('origin')==='https://labels.test';export const requireRole=async(req,min)=>!globalThis.labelUser?{error:Response.json({}, {status:401})}:min==='editor'&&globalThis.labelUser.role==='reader'?{error:Response.json({}, {status:403})}:{user:globalThis.labelUser};`);
 fs.writeFileSync(path.join(dir,'team-access.mjs'),'export const accessibleTeams=async()=>new Set(globalThis.labelMember?["qsse"]:[]);');
 for(const [name,file] of Object.entries({hub:'lib/hub.ts','ticket-labels':'lib/ticket-labels.ts',route:'app/api/ticket-labels/route.ts'})){let s=fs.readFileSync(file,'utf8');for(const mod of ['hub','ticket-labels','access','team-access'])s=s.replaceAll("'@/lib/"+mod+"'","'./"+mod+".mjs'").replaceAll("'./"+mod+"'","'./"+mod+".mjs'");s=s.replaceAll("'@/db/raw'","'./raw.mjs'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
 const route=await import(path.join(dir,'route.mjs')),lib=await import(path.join(dir,'ticket-labels.mjs')),hub=await import(path.join(dir,'hub.mjs'));
 const get=()=>route.GET(new Request('https://labels.test/api/ticket-labels'));
 const post=(body,origin='https://labels.test')=>route.POST(new Request('https://labels.test/api/ticket-labels',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 let catalog=await (await get()).json();assert.equal(catalog.labels.length,7);assert.equal(catalog.canCreate,true);
 let response=await post({kind:'topic',category:'Environnement',name:'  DÉCHETS  '});assert.equal(response.status,200);assert.equal((await response.json()).label.id,'env-waste');
 response=await post({kind:'location',category:'',name:'Atelier   mélange'});assert.equal(response.status,200);const place=(await response.json()).label;assert.equal(place.name,'Atelier mélange');
 response=await post({kind:'location',category:'',name:'atelier mélange'});assert.equal((await response.json()).label.id,place.id);
 response=await post({kind:'topic',category:'Sécurité',name:'Déchets'});assert.equal(response.status,200);assert.notEqual((await response.json()).label.id,'env-waste');
 for(const body of [{kind:'other',category:'',name:'Test'},{kind:'topic',category:'invalid',name:'Test'},{kind:'location',category:'Environnement',name:'Test'},{kind:'location',category:'',name:'x'},{kind:'location',category:'',name:'x'.repeat(61)}])assert.equal((await post(body)).status,400);
 assert.equal((await post({kind:'location',category:'',name:'Site 3'},'https://other.test')).status,403);
 const ticket={...hub.newTicket(),title:'Fuite',category:'Environnement',topicTags:['env-water','env-spill'],locationTags:[place.id,'place-maris-51']};
 assert.equal(hub.ticketError(ticket),'');assert.equal(await lib.ticketLabelError(ticket),'');
 assert.match(await lib.ticketLabelError({...ticket,category:'Sécurité'}),/thème/);
 assert.match(await lib.ticketLabelError({...ticket,locationTags:['env-water']}),/lieu/);
 assert.match(await lib.ticketLabelError({...ticket,topicTags:['unknown']}),/thème/);
 assert.ok(hub.ticketError({...ticket,topicTags:['env-water','env-water']}));assert.ok(hub.ticketError({...ticket,locationTags:'place-site-1'}));
 const legacy={...hub.newTicket(),title:'Ancien ticket'};delete legacy.topicTags;delete legacy.locationTags;assert.equal(hub.ticketError(legacy),'');assert.equal(await lib.ticketLabelError(legacy),'');
 globalThis.labelUser={id:'reader',role:'reader'};assert.equal((await (await get()).json()).canCreate,false);assert.equal((await post({kind:'location',category:'',name:'Site 3'})).status,403);
 globalThis.labelUser={id:'editor',role:'editor'};globalThis.labelMember=false;assert.equal((await (await get()).json()).canCreate,false);assert.equal((await post({kind:'location',category:'',name:'Site 3'})).status,403);
 globalThis.labelMember=true;assert.equal((await post({kind:'location',category:'',name:'Site 3'})).status,200);
 globalThis.labelUser=null;assert.equal((await get()).status,401);
 console.log('Ticket labels: seeded catalog, creation, deduplication, theme/location validation, legacy compatibility and permissions passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
