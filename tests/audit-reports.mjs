import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(process.cwd(),'.audit-test-')),db=new DatabaseSync(':memory:'),objects=new Map();
function stmt(sql,args=[]){return {bind(...values){return stmt(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.auditDb={prepare:stmt,async batch(statements){db.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.auditBucket={async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(key){objects.delete(key)}};
globalThis.auditUser={id:'editor',role:'editor',displayName:'Auditeur de test'};globalThis.auditOrigin=true;
function compile(name,file){let source=fs.readFileSync(file,'utf8');for(const [a,b] of [['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/hub','./hub.mjs'],['@/lib/team-access','./teams.mjs'],['@/lib/gmao-server','./gmao.mjs'],['@/lib/audit-server','./audit-server.mjs'],['@/lib/audit-pdf','./audit-pdf.mjs']])source=source.replaceAll("'"+a+"'","'"+b+"'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
 fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.auditDb;export const bucket=()=>globalThis.auditBucket;');
 fs.writeFileSync(path.join(dir,'access.mjs'),`export const checkOrigin=()=>globalThis.auditOrigin;export const requireRole=async(req,role)=>!globalThis.auditUser?{error:Response.json({error:'Connexion nécessaire'},{status:401})}:role==='editor'&&globalThis.auditUser.role==='reader'?{error:Response.json({error:'Lecture seule'},{status:403})}:{user:globalThis.auditUser};`);
 fs.writeFileSync(path.join(dir,'gmao.mjs'),'export const gmaoTicketContributor=async()=>false;export const gmaoTicketReader=async()=>false;');
 for(const [name,file] of [['hub','lib/hub.ts'],['teams','lib/team-access.ts'],['audit-server','lib/audit-server.ts'],['audit-pdf','lib/audit-pdf.ts'],['hub-route','app/api/hub/route.ts'],['photos','app/api/routine-files/route.ts'],['report','app/api/routines/report/route.ts']])compile(name,file);
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT);CREATE TABLE teams(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE team_access(team_id TEXT,restricted INTEGER);CREATE TABLE team_members(team_id TEXT,user_id TEXT,level TEXT);CREATE TABLE hub_routines(id TEXT PRIMARY KEY,data TEXT,revision INTEGER,updated_at TEXT);CREATE TABLE hub_runs(id TEXT PRIMARY KEY,routine_id TEXT REFERENCES hub_routines(id),date TEXT,data TEXT,revision INTEGER,author TEXT,updated_at TEXT);CREATE TABLE hub_tickets(id TEXT PRIMARY KEY,data TEXT,created_at TEXT);INSERT INTO users VALUES('editor','Auditeur de test');INSERT INTO teams VALUES('qsse','QSSE'),('rh','RH');INSERT INTO team_access VALUES('qsse',1),('rh',1);INSERT INTO team_members VALUES('qsse','editor','user');`);
 db.exec(fs.readFileSync('drizzle/0021_audit_reports.sql','utf8'));
 const hub=await import(path.join(dir,'hub-route.mjs')),photos=await import(path.join(dir,'photos.mjs')),report=await import(path.join(dir,'report.mjs')),lib=await import(path.join(dir,'hub.mjs'));
 assert.equal(lib.auditScore([{result:'Non applicable'}]).percent,null);assert.equal(lib.auditScore([{result:'À faire'}]).percent,null);assert.equal(lib.auditScore([{result:'Conforme'},{result:'Non conforme'},{result:'Non applicable'},{result:'À faire'}]).percent,50);
 assert.equal(lib.routineError({questions:[{section:'x'.repeat(151)}]}).length>0,true);
 const routine={title:'Audit terrain – sécurité & environnement',description:'Vérifier les équipements et les pratiques du secteur.',teams:['qsse'],pilot:'editor',start:'2026-10-26',time:'09:00',repeat:'none',interval:1,end:'',active:true,questions:[{id:'q1',label:'Le sol est-il propre et dégagé ?',section:'MR 1 · Ordre et propreté'},{id:'q2',label:'Les protections sont-elles en place ?',section:'MR 2 · Machines'},{id:'q3',label:'Le stockage est-il adapté ?',section:'MR 1 · Ordre et propreté'}]};
 db.prepare('INSERT INTO hub_routines VALUES(?,?,1,?)').run('audit',JSON.stringify(routine),'2026-10-26');
 const request=(body)=>new Request('https://example.test/api/hub',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const base={answers:routine.questions.map(q=>({...q,result:'À faire',comment:''})),notes:'',completed:false,location:'Atelier de test',auditee:'Équipe de test',photos:[{id:'forged'}],startedAt:'1900-01-01'};
 const save=async(data,revision)=>hub.POST(request({action:'run',routineId:'audit',date:routine.start,data,revision}));
 let response=await save(base,0);assert.equal(response.status,200);let saved=await response.json();assert.notEqual(saved.data.startedAt,base.startedAt);assert.deepEqual(saved.data.photos,[]);assert.equal(saved.data.startedBy,'Auditeur de test');
 const startedAt=saved.data.startedAt;
 assert.equal((await save({...base,completed:true},1)).status,400);
 saved.data.answers=saved.data.answers.map((a,i)=>({...a,result:i===0?'Non conforme':i===1?'Conforme':'Non applicable',comment:i===0?'Fuite à traiter. Observation accentuée : électricité, prévention.':''}));
 response=await save(saved.data,1);assert.equal(response.status,200);saved=await response.json();assert.equal(saved.data.answers[0].author,'Auditeur de test');assert.equal(saved.data.startedAt,startedAt);assert.equal(saved.data.routineTitle,routine.title);
 const image=await sharp({create:{width:900,height:600,channels:3,background:'#005faa'}}).jpeg().toBuffer();
 const upload=async(revision,bytes=image,questionId='q1')=>{const form=new FormData();form.set('revision',String(revision));form.set('questionId',questionId);form.set('caption','Constat terrain · photo de test');form.set('file',new Blob([bytes],{type:'image/jpeg'}),'test.jpg');return photos.POST(new Request('https://example.test/api/routine-files?routine=audit&date=2026-10-26',{method:'POST',body:form}))};
 assert.equal((await upload(1)).status,409);assert.equal((await upload(2,new Uint8Array([1,2,3]))).status,400);assert.equal((await upload(2,image,'unknown')).status,400);
 response=await upload(2);assert.equal(response.status,200,await response.clone().text());saved=await response.json();assert.equal(saved.revision,3);assert.equal(saved.data.photos.length,1);const photo=saved.data.photos[0];
 const photoRequest=()=>new Request('https://example.test/api/routine-files?routine=audit&date=2026-10-26&id='+photo.id);
 assert.equal((await photos.GET(photoRequest())).status,200);
 // Canonical server metadata and photos survive ordinary writes, and the PDF reads only saved data.
 response=await save({...saved.data,completed:true,photos:[],completedBy:'Spoofed',routineTitle:'Spoofed'},3);assert.equal(response.status,200);saved=await response.json();assert.equal(saved.data.photos.length,1);assert.equal(saved.data.completedBy,'Auditeur de test');assert.equal(saved.data.routineTitle,routine.title);assert.ok(saved.data.completedAt);
 assert.equal((await upload(4)).status,409);
 db.prepare('INSERT INTO hub_tickets VALUES(?,?,?)').run('visible',JSON.stringify({title:'Action corrective de test',status:'En cours',teams:['qsse'],source:{routineId:'audit',date:routine.start},pilot:'editor',due:'2026-11-15',actions:[{done:false}]}),'2026');
 db.prepare('INSERT INTO hub_tickets VALUES(?,?,?)').run('secret',JSON.stringify({title:'SECRET RH',status:'Ouvert',teams:['qsse','rh'],source:{routineId:'audit',date:routine.start},pilot:'',due:'',actions:[]}),'2026');
 const reportRequest=(extra='')=>new Request('https://example.test/api/routines/report?routine=audit&date=2026-10-26'+extra);
 assert.equal((await report.GET(reportRequest('&revision=1'))).status,409);
 response=await report.GET(reportRequest('&revision=4'));assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.match(response.headers.get('Cache-Control'),/no-store/);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');fs.mkdirSync('tmp/audit-reports',{recursive:true});const filename=path.resolve('tmp/audit-reports/compte-rendu-qa.pdf');fs.writeFileSync(filename,bytes);
 const text=execFileSync('pdftotext',['-layout',filename,'-'],{encoding:'utf8'});for(const label of ['50 %','Atelier de test','Action corrective de test','Non conforme','Non applicable','Constat terrain','Révision 4','Auditeur de test'])assert.ok(text.includes(label),'Missing PDF text: '+label);assert.ok(!text.includes('SECRET RH'));
 globalThis.auditUser={id:'editor',role:'reader',displayName:'Lecteur'};assert.equal((await report.GET(reportRequest())).status,200);assert.equal((await upload(4)).status,403);
 db.prepare("DELETE FROM team_members WHERE user_id='editor'").run();assert.equal((await report.GET(reportRequest())).status,403);assert.equal((await photos.GET(photoRequest())).status,403);
 globalThis.auditUser=null;assert.equal((await report.GET(reportRequest())).status,401);
 globalThis.auditUser={id:'admin',role:'admin',displayName:'Admin'};globalThis.auditOrigin=false;assert.equal((await upload(4)).status,403);globalThis.auditOrigin=true;
 response=await save({...saved.data,completed:false},4);assert.equal(response.status,200);saved=await response.json();assert.equal(saved.data.completedAt,'');
 const remove=new Request('https://example.test/api/routine-files?routine=audit&date=2026-10-26',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:photo.id,revision:5})});assert.equal((await photos.DELETE(remove)).status,200);assert.equal((await photos.GET(photoRequest())).status,404);assert.equal(objects.size,1,'Keep the earlier version’s photograph');
 const history=JSON.parse(db.prepare('SELECT snapshot FROM hub_run_history WHERE run_id=? AND revision=5').get('audit:2026-10-26').snapshot);assert.equal(history.photos[0].id,photo.id);
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 // Legacy reports keep their original content and do not fabricate a start time.
 db.prepare('INSERT INTO hub_runs VALUES(?,?,?,?,1,?,?)').run('audit:2026-10-25','audit','2026-10-25',JSON.stringify({...base,startedAt:undefined,photos:[],completed:true}),'Ancien auditeur','2026-10-25');
 const legacy=await report.GET(new Request('https://example.test/api/routines/report?routine=audit&date=2026-10-25'));assert.equal(legacy.status,200);
 // Long Unicode observations, all-N/A scoring and missing-photo fallback paginate safely.
 const {buildAuditPdf}=await import(path.join(dir,'audit-pdf.mjs'));
 const long=await buildAuditPdf({title:'Audit de contrôle – électricité',description:'',date:routine.start,teams:['QSSE'],author:'Test',revision:1,updatedAt:startedAt,url:'https://example.test/routines',run:{answers:Array.from({length:22},(_,i)=>({id:String(i),label:'Point '+i+' · '+('Très longue désignation '.repeat(6)),section:'Prévention',result:'Non applicable',comment:'Prévention électricité & amélioration. '.repeat(35)})),notes:'Synthèse finale.',completed:true},photos:[{...photo,questionId:'',bytes:null}],tickets:[]});fs.writeFileSync(path.resolve('tmp/audit-reports/pagination-qa.pdf'),long);assert.ok(execFileSync('pdftotext',[path.resolve('tmp/audit-reports/pagination-qa.pdf'),'-'],{encoding:'utf8'}).includes('Synthèse finale.'));
 console.log('Audit reports: real SQLite permissions, RH isolation, immediate revocation, server timestamps, N/A scoring, saved-only PDF, photos, concurrent revisions, history, legacy data and long pagination passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});delete globalThis.auditDb;delete globalThis.auditBucket;delete globalThis.auditUser;delete globalThis.auditOrigin}
