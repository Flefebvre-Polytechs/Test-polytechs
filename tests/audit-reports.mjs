import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(process.cwd(),'.audit-test-')),db=new DatabaseSync(':memory:'),objects=new Map();
fs.writeFileSync(path.join(dir,'prevention-documents.mjs'),'export const planAccess=async()=>null;');
function stmt(sql,args=[]){return {bind(...values){return stmt(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.auditDb={prepare:stmt,async batch(statements){db.exec('BEGIN IMMEDIATE');try{const out=statements.map(statement=>statement.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.auditBucket={async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(key){objects.delete(key)}};
globalThis.auditUser={id:'editor',role:'editor',displayName:'Auditeur de test'};globalThis.auditOrigin=true;
function compile(name,file){let source=fs.readFileSync(file,'utf8');for(const [a,b] of [['./team-access','./teams.mjs'],['./prevention-documents','./prevention-documents.mjs'],['@/lib/notification-access','./notification-access.mjs'],['@/lib/ticket-labels','./ticket-labels.mjs'],['./hub','./hub.mjs'],['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/hub','./hub.mjs'],['@/lib/team-access','./teams.mjs'],['@/lib/gmao-server','./gmao.mjs'],['@/lib/audit-server','./audit-server.mjs'],['@/lib/audit-pdf','./audit-pdf.mjs']])source=source.replaceAll("'"+a+"'","'"+b+"'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
 fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.auditDb;export const bucket=()=>globalThis.auditBucket;');
 fs.writeFileSync(path.join(dir,'access.mjs'),`export const checkOrigin=()=>globalThis.auditOrigin;export const notificationSessionKey=async()=>globalThis.auditSession;export const requireRole=async(req,role)=>!globalThis.auditUser?{error:Response.json({error:'Connexion nécessaire'},{status:401})}:role==='editor'&&globalThis.auditUser.role==='reader'?{error:Response.json({error:'Lecture seule'},{status:403})}:{user:globalThis.auditUser};`);
 fs.writeFileSync(path.join(dir,'gmao.mjs'),'export const gmaoTicketContributor=async()=>false;export const gmaoTicketReader=async()=>false;');
 for(const [name,file] of [['notification-access','lib/notification-access.ts'],['ticket-labels','lib/ticket-labels.ts'],['hub','lib/hub.ts'],['teams','lib/team-access.ts'],['audit-server','lib/audit-server.ts'],['audit-pdf','lib/audit-pdf.ts'],['hub-route','app/api/hub/route.ts'],['notification-route','app/api/notifications/route.ts'],['photos','app/api/routine-files/route.ts'],['report','app/api/routines/report/route.ts']])compile(name,file);
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT,role TEXT NOT NULL DEFAULT 'editor');CREATE TABLE teams(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE team_access(team_id TEXT,restricted INTEGER);CREATE TABLE team_members(team_id TEXT,user_id TEXT,level TEXT);CREATE TABLE hub_routines(id TEXT PRIMARY KEY,data TEXT,revision INTEGER,updated_at TEXT);CREATE TABLE hub_runs(id TEXT PRIMARY KEY,routine_id TEXT REFERENCES hub_routines(id),date TEXT,data TEXT,revision INTEGER,author TEXT,updated_at TEXT);CREATE TABLE hub_tickets(id TEXT PRIMARY KEY,data TEXT,created_at TEXT);INSERT INTO users(id,display_name) VALUES('editor','Auditeur de test');INSERT INTO teams VALUES('qsse','QSSE'),('rh','RH');INSERT INTO team_access VALUES('qsse',1),('rh',1);INSERT INTO team_members VALUES('qsse','editor','user');`);
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

 // Builder-defined information fields and required evidence are enforced by the real routes.
 const typedRoutine={...routine,title:'Audit mixte de test',questions:[{id:'control',label:'Contrôle avec preuve',type:'conformity',required:true,evidence:'both'},{id:'text',label:'Référence observée',type:'text',required:true},{id:'number',label:'Mesure relevée',type:'number',required:true},{id:'date',label:'Date de contrôle',type:'date',required:true},{id:'optional',label:'Point facultatif',type:'conformity',required:false}]};
 db.prepare('INSERT INTO hub_routines VALUES(?,?,1,?)').run('typed',JSON.stringify(typedRoutine),'2026-10-26');
 const typedSave=async(data,revision)=>hub.POST(request({action:'run',routineId:'typed',date:routine.start,data,revision}));
 const typedBase={answers:typedRoutine.questions.map(q=>({...q,result:q.id==='control'?'Non conforme':q.type==='conformity'?'À faire':'Information',value:q.id==='text'?'Lot TEST-026':q.id==='number'?'0':q.id==='date'?'2026-10-27':'',comment:q.id==='control'?'Écart observé':''})),notes:'Audit mixte',completed:true};
 assert.equal((await typedSave(typedBase,0)).status,400,'Photographic evidence must be required by server');
 assert.equal((await typedSave({...typedBase,completed:false,answers:typedBase.answers.map(a=>a.id==='number'?{...a,value:'Infinity'}:a)},0)).status,400);
 assert.equal((await typedSave({...typedBase,completed:false,answers:typedBase.answers.map(a=>a.id==='date'?{...a,value:'2026-02-30'}:a)},0)).status,400);
 response=await typedSave({...typedBase,completed:false},0);assert.equal(response.status,200);let typedSaved=await response.json();
 const proofForm=new FormData();proofForm.set('revision','1');proofForm.set('questionId','control');proofForm.set('caption','Preuve du contrôle');proofForm.set('file',new Blob([image],{type:'image/jpeg'}),'proof.jpg');
 response=await photos.POST(new Request('https://example.test/api/routine-files?routine=typed&date=2026-10-26',{method:'POST',body:proofForm}));assert.equal(response.status,200);typedSaved=await response.json();
 response=await typedSave({...typedSaved.data,completed:true,answers:typedSaved.data.answers.map(a=>a.id==='number'?{...a,type:'conformity',result:'Conforme'}:a)},2);assert.equal(response.status,200);typedSaved=await response.json();assert.equal(typedSaved.data.answers.find(a=>a.id==='number').type,'number','Ignore forged answer type');assert.equal(typedSaved.data.answers.find(a=>a.id==='number').result,'Information');assert.equal(lib.auditScore(typedSaved.data.answers).percent,0);assert.equal(lib.auditScore(typedSaved.data.answers).requiredPending,0);
 response=await report.GET(new Request('https://example.test/api/routines/report?routine=typed&date=2026-10-26'));assert.equal(response.status,200);const typedFile=path.resolve('tmp/audit-reports/typed-qa.pdf');fs.writeFileSync(typedFile,Buffer.from(await response.arrayBuffer()));const typedText=execFileSync('pdftotext',['-layout',typedFile,'-'],{encoding:'utf8'});assert.ok(typedText.includes('Lot TEST-026'));assert.ok(typedText.includes('2026-10-27'));assert.ok(typedText.includes('Audit terminé'));
 const listed=await (await hub.GET(new Request('https://example.test/api/hub?scope=routines&from=2026-10-01&to=2026-10-31'))).json();assert.equal(listed.routines.find(r=>r.id==='typed').has_runs,1,'The builder must know a grid is frozen');
 globalThis.auditUser={id:'editor',role:'editor',displayName:'Auditeur de test'};
 db.exec("INSERT INTO team_members VALUES('qsse','editor','user')");
 const auditToday=lib.todayParis();
 db.prepare('INSERT INTO hub_routines VALUES(?,?,1,?)').run('catalogue',JSON.stringify({...routine,mode:'catalog',start:auditToday}),auditToday);
 const session=(params)=>hub.POST(request({action:'audit-session',routineId:'catalogue',...params}));
 assert.deepEqual(lib.scheduledAuditDates({...routine,mode:'catalog'},routine.start,routine.start),[]);
 assert.equal((await session({intent:'schedule',date:auditToday,time:'10:00'})).status,403,'A contributor who can fill audits cannot schedule them');
 const quick=await session({intent:'now'});
 assert.equal(quick.status,200);
 const {id:quickId,date:quickDate}=await quick.json();
 const quickRow=JSON.parse(db.prepare('SELECT data FROM hub_routines WHERE id=?').get(quickId).data);
 assert.deepEqual(lib.scheduledAuditDates(quickRow,quickDate,quickDate),[],'A field audit never creates a calendar event');
 assert.equal((await hub.POST(request({action:'run',routineId:quickId,date:quickDate,revision:0,data:{
  answers:routine.questions.map(q=>({id:q.id,result:'Conforme',comment:''})),notes:'',completed:true,
 }}))).status,200);
 assert.equal((await hub.POST(request({action:'run',routineId:'catalogue',date:quickDate,revision:0,data:{}}))).status,400);
 db.exec("UPDATE team_members SET level='contributor' WHERE team_id='qsse' AND user_id='editor'");
 assert.equal((await session({intent:'schedule',date:'2020-01-01',time:'09:00'})).status,400);
 const scheduled=await session({intent:'schedule',date:auditToday,time:'10:00'});
 assert.equal(scheduled.status,200);
 const {id:scheduledId}=await scheduled.json();
 const scheduledRow=JSON.parse(db.prepare('SELECT data FROM hub_routines WHERE id=?').get(scheduledId).data);
 assert.deepEqual(lib.scheduledAuditDates(scheduledRow,auditToday,auditToday),[auditToday]);
 assert.notEqual(scheduledId,quickId);
 assert.equal(JSON.parse(db.prepare("SELECT data FROM hub_routines WHERE id='catalogue'").get().data).mode,'catalog');
 const deleteAudit=(id,revision,confirmation='SUPPRIMER')=>hub.POST(request({action:'delete-audit',id,revision,confirmation}));
 assert.equal((await deleteAudit(quickId,1)).status,403);
 db.exec("UPDATE team_members SET level='team_admin' WHERE team_id='qsse' AND user_id='editor'");
 assert.equal((await deleteAudit(quickId,1,'Supprimer')).status,400);
 assert.equal((await deleteAudit(quickId,2)).status,409);
 assert.equal((await deleteAudit(quickId,1)).status,200);
 assert.equal((await deleteAudit(quickId,1)).status,409);
 const archived=JSON.parse(db.prepare('SELECT data FROM hub_routines WHERE id=?').get(quickId).data);
 assert.equal(archived.active,false);
 assert.equal(archived.archivedBy,'editor');
 assert.ok(archived.archivedAt);
 assert.equal((await hub.POST(request({action:'run',routineId:quickId,date:quickDate,revision:1,data:{}}))).status,400);
 const runRequest=new Request('https://example.test/api/hub?scope=run&id='+quickId+'&date='+quickDate);
 assert.equal((await (await hub.GET(runRequest)).json()).run.data.completed,true);
 const archiveRequest=new Request('https://example.test/api/hub?scope=audit-history&id='+quickId);
 assert.deepEqual((await (await hub.GET(archiveRequest)).json()).reports,[{date:quickDate,completed:1}]);
 assert.equal((await report.GET(new Request('https://example.test/api/routines/report?routine='+quickId+'&date='+quickDate))).status,200);
 assert.equal((await deleteAudit(scheduledId,1)).status,200);
 const archivedSchedule=JSON.parse(db.prepare('SELECT data FROM hub_routines WHERE id=?').get(scheduledId).data);
 assert.deepEqual(lib.scheduledAuditDates(archivedSchedule,auditToday,auditToday),[]);
 db.exec("DELETE FROM team_members WHERE user_id='editor'");
 assert.equal((await hub.GET(archiveRequest)).status,403);
 db.exec("ALTER TABLE hub_tickets ADD COLUMN revision INTEGER; ALTER TABLE hub_tickets ADD COLUMN updated_at TEXT; ALTER TABLE hub_tickets ADD COLUMN author TEXT; INSERT INTO team_members VALUES('qsse','editor','contributor')");
 const scheduledSave=await hub.POST(request({action:'run',routineId:scheduledId,date:auditToday,revision:0,data:{
  answers:routine.questions.map(q=>({id:q.id,result:q.id==='q1'?'Non conforme':'Conforme',comment:'Constat'})),notes:'',completed:false,
 }}));
 // The already archived session cannot be changed or given a ticket.
 assert.equal(scheduledSave.status,400);
 const ticketSession=await (await session({intent:'now'})).json();
 const auditTicket=(patch={})=>hub.POST(request({
  action:'audit-ticket',routineId:ticketSession.id,date:auditToday,questionId:'q1',runRevision:1,
  title:'Écart précis',category:'Environnement',description:'Constat',due:'',...patch,
 }));
 assert.equal((await auditTicket()).status,409,'Save the audit first');
 const saveTicketAudit=await hub.POST(request({action:'run',routineId:ticketSession.id,date:auditToday,revision:0,data:{
  answers:routine.questions.map(q=>({id:q.id,result:q.id==='q1'?'Non conforme':'Conforme',comment:'Constat'})),notes:'',completed:false,
 }}));
 assert.equal(saveTicketAudit.status,200);
 assert.equal((await auditTicket({questionId:'q2'})).status,400);
 db.exec("UPDATE team_members SET level='user' WHERE user_id='editor'");
 assert.equal((await auditTicket()).status,403);
 db.exec("UPDATE team_members SET level='contributor' WHERE user_id='editor'");
 db.exec("CREATE TABLE hub_notifications(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,href TEXT,seen INTEGER,created_at TEXT); CREATE TABLE ticket_labels(id TEXT,kind TEXT,category TEXT,name TEXT); INSERT INTO ticket_labels VALUES('dechets','topic','Environnement','Déchets')");
 const ticketData={...lib.newTicket(),title:'Écart précis',description:'Constat',category:'Environnement',teams:['qsse'],
  pilot:'editor',status:'En cours',due:auditToday,topicTags:['dechets'],analysis:{method:'5p',values:{},paths:[
   {id:'tri',name:'Consigne de tri',values:{p1:'Bac non identifié',cause:'Absence de standard de marquage'}},
   {id:'appro',name:'Approvisionnement',values:{p1:'Étiquettes manquantes',p2:'Pas de stock dédié',cause:'Aucun seuil de réapprovisionnement'}},
  ]},
  actions:[{id:'action-test',title:'Corriger l’écart',pilot:'editor',done:false,due:auditToday}]};
 assert.equal((await auditTicket({data:{...ticketData,teams:['rh']}})).status,403);
 assert.equal((await auditTicket({data:{...ticketData,topicTags:['inconnue']}})).status,400);
 assert.equal((await auditTicket({data:{...ticketData,pilot:'inconnu'}})).status,400);
 assert.equal((await auditTicket({data:{...ticketData,analysis:{method:'5p',values:{d1:'Mauvais champ'}}}})).status,400);
 const paths=ticketData.analysis.paths;
 for(const analysis of [
  {...ticketData.analysis,paths:[paths[0],paths[0]]},
  {...ticketData.analysis,paths:[{...paths[0],values:{p1:'x'.repeat(3001)}}]},
  {...ticketData.analysis,paths:[]},
  {...ticketData.analysis,paths:Array.from({length:11},(_,i)=>({...paths[0],id:String(i)}))},
  {...ticketData.analysis,values:{p1:'Ancienne réponse'}},
  {method:'8d',values:{},paths},
 ])assert.equal((await auditTicket({data:{...ticketData,analysis}})).status,400);

 const causes=[
  {id:'bac',parentId:null,answer:'Bac non identifié'},
  {id:'standard',parentId:'bac',answer:'Absence de standard',actionId:'action-test'},
  {id:'appro',parentId:'bac',answer:'Étiquettes indisponibles'},
  {id:'stock',parentId:'appro',answer:'Pas de stock dédié',conclusion:'Aucun seuil de réapprovisionnement'},
 ];
 const treeAnalysis={method:'5p',values:{},causes};
 const treeTicket={...ticketData,analysis:treeAnalysis};
 const overDepth=Array.from({length:6},(_,i)=>({id:String(i),parentId:i?String(i-1):null,answer:'Cause'}));
 for(const invalidCauses of [
  [causes[1]],
  [causes[0],causes[0]],
  [{...causes[0],parentId:causes[1].id},{...causes[1],parentId:causes[0].id}],
  [causes[0],{...causes[1],actionId:'action-autre-ticket'}],
  overDepth,
 ])assert.equal((await auditTicket({data:{...ticketData,analysis:{...treeAnalysis,causes:invalidCauses}}})).status,400);
 const tickets=await Promise.all([auditTicket({data:treeTicket}),auditTicket({data:treeTicket})]);
 assert.deepEqual(tickets.map(result=>result.status),[200,200]);
 const linked=await Promise.all(tickets.map(result=>result.json()));
 assert.equal(linked[0].id,linked[1].id);
 assert.equal(linked.filter(ticket=>ticket.created).length,1);
 const storedTicket=JSON.parse(db.prepare('SELECT data FROM hub_tickets WHERE id=?').get(linked[0].id).data);
 assert.deepEqual(storedTicket.actions,ticketData.actions);
 assert.equal(storedTicket.pilot,'editor');
 assert.deepEqual(storedTicket.topicTags,['dechets']);
 assert.equal(storedTicket.status,'En cours');
 assert.deepEqual(storedTicket.analysis,treeAnalysis);
 const auditNotices=db.prepare('SELECT user_id,title,href FROM hub_notifications').all();
 assert.deepEqual(auditNotices.map(notice=>({...notice})),[{
  user_id:'editor',title:'Action attribuée · Corriger l’écart',href:'/tickets?id='+linked[0].id+'&action=action-test',
 }]);
 const ticketAuditUrl='https://example.test/api/hub?scope=run&id='+ticketSession.id+'&date='+auditToday;
 const reopened=await (await hub.GET(new Request(ticketAuditUrl))).json();
 assert.equal(reopened.run.data.completed,false);
 assert.equal(reopened.tickets[0].questionId,'q1');
 assert.equal(reopened.tickets[0].id,linked[0].id);
 const regularData={...lib.newTicket(),title:'Ticket avec analyse',teams:['qsse'],analysis:{method:'8d',values:{d1:'Équipe QSSE',d2:'Constat'}}};
 const regularResponse=await hub.POST(request({action:'ticket',data:regularData}));
 assert.equal(regularResponse.status,200);
 const regularId=(await regularResponse.json()).id;
 assert.deepEqual(JSON.parse(db.prepare('SELECT data FROM hub_tickets WHERE id=?').get(regularId).data).analysis,regularData.analysis);
 assert.equal((await hub.POST(request({action:'ticket',id:regularId,revision:1,data:{...regularData,analysis:undefined}}))).status,200);
 assert.equal(JSON.parse(db.prepare('SELECT data FROM hub_tickets WHERE id=?').get(regularId).data).analysis,undefined);
 const legacyAnalysis={method:'5p',values:{p1:'Cause existante',p2:'Pourquoi existant',cause:'Cause racine et preuve historiques'}};
 assert.equal((await hub.POST(request({action:'ticket',id:regularId,revision:2,data:{...regularData,analysis:legacyAnalysis}}))).status,200);
 db.exec('CREATE TABLE hub_comments(id TEXT,ticket_id TEXT,created_at TEXT); CREATE TABLE hub_files(id TEXT,ticket_id TEXT,created_at TEXT)');
 const loadAnalysis=async()=>{
  const response=await hub.GET(new Request('https://example.test/api/hub?scope=ticket&id='+regularId));
  assert.equal(response.status,200);
  return (await response.json()).ticket.data.analysis;
 };
 const initialPaths=lib.ticketFiveWhyPaths(await loadAnalysis());
 assert.deepEqual(initialPaths,[{id:'initial',name:'',values:legacyAnalysis.values}]);
 const branched={method:'5p',values:{},paths:[...initialPaths,paths[1]]};
 assert.equal((await hub.POST(request({action:'ticket',id:regularId,revision:3,data:{...regularData,analysis:branched}}))).status,200);
 assert.deepEqual(await loadAnalysis(),branched);
 const remaining={...branched,paths:[paths[1]]};
 assert.equal((await hub.POST(request({action:'ticket',id:regularId,revision:4,data:{...regularData,analysis:remaining}}))).status,200);
 assert.deepEqual(await loadAnalysis(),remaining);
 assert.deepEqual(lib.ticketFiveWhyCauses(legacyAnalysis),[
  {id:'legacy-1-1',parentId:null,answer:'Cause existante'},
  {id:'legacy-1-2',parentId:'legacy-1-1',answer:'Pourquoi existant',conclusion:'Cause racine et preuve historiques'},
 ]);
 assert.deepEqual(lib.ticketFiveWhyCauses(branched),[
  ...lib.ticketFiveWhyCauses(legacyAnalysis),
  {id:'legacy-2-1',parentId:null,answer:'Étiquettes manquantes',label:'Approvisionnement'},
  {id:'legacy-2-2',parentId:'legacy-2-1',answer:'Pas de stock dédié',conclusion:'Aucun seuil de réapprovisionnement'},
 ]);
 assert.equal((await hub.POST(request({action:'ticket',id:regularId,revision:5,data:{...regularData,analysis:treeAnalysis}}))).status,400);
 assert.equal((await hub.POST(request({action:'ticket',id:regularId,revision:5,data:{
  ...regularData,analysis:treeAnalysis,actions:ticketData.actions,
 }}))).status,200);
 assert.deepEqual(await loadAnalysis(),treeAnalysis);

 const saveCauseAnalysis=(revision,analysis)=>hub.POST(request({
  action:'ticket',id:regularId,revision,data:{...regularData,analysis},
 }));
 const newCauseAnalysis={method:'arbre-causes',values:{}};
 assert.equal((await saveCauseAnalysis(6,newCauseAnalysis)).status,200);
 assert.deepEqual(await loadAnalysis(),newCauseAnalysis);
 const fact=(id,text,kind='variation')=>({id,text,kind});
 const connection=(antecedentId,effectId,uncertain=false)=>({antecedentId,effectId,uncertain});
 const causeTree={
  outcome:'Bac de réception renversé',
  facts:[
   fact('glisse','La roue a glissé'),fact('appui','Le frein était desserré'),
   fact('eau','Une flaque était présente'),fact('zone','La zone est exposée à la pluie','permanent'),
  ],
  links:[
   connection('glisse',lib.causeTreeOutcomeId),connection('appui',lib.causeTreeOutcomeId),
   connection('eau','glisse'),connection('eau','appui',true),connection('zone','eau'),
  ],
 };
 for(const badTree of [
  {...causeTree,facts:[...causeTree.facts,fact('isolé','Fait sans lien')]},
  {...causeTree,facts:[...causeTree.facts,causeTree.facts[0]]},
  {...causeTree,facts:[...causeTree.facts,fact(lib.causeTreeOutcomeId,'Fait final en double')]},
  {...causeTree,facts:[{...causeTree.facts[0],text:'   '},...causeTree.facts.slice(1)]},
  {...causeTree,links:[...causeTree.links,connection('inconnu','eau')]},
  {...causeTree,links:[...causeTree.links,connection('glisse','zone')]},
  {...causeTree,links:[...causeTree.links,causeTree.links[0]]},
 ])assert.equal((await saveCauseAnalysis(7,{...newCauseAnalysis,causeTree:badTree})).status,400);
 assert.equal((await saveCauseAnalysis(7,{method:'5p',values:{},causeTree})).status,400);
 assert.equal((await saveCauseAnalysis(7,{...newCauseAnalysis,causeTree})).status,200);
 assert.deepEqual(await loadAnalysis(),{...newCauseAnalysis,causeTree});

 db.exec(`
  INSERT INTO users VALUES ('second-pilot','Deuxième pilote','editor'),('outside','Autre service','editor');
  INSERT INTO team_members VALUES ('qsse','second-pilot','contributor');
  CREATE TABLE notification_receipts(notification_id TEXT PRIMARY KEY,user_id TEXT,acknowledged_at TEXT,deferred_session TEXT,deferred_at TEXT);
 `);
 const notifications=await import(path.join(dir,'notification-route.mjs'));
 const namedAction={id:'action-a',title:'Ajuster le réglage',pilot:'editor',done:false,due:auditToday};
 const secondAction={...namedAction,id:'action-b',title:'Vérifier le résultat',pilot:'second-pilot'};
 const draft={...regularData,actions:[namedAction,secondAction,{...namedAction,id:'action-c',pilot:''}]};
 const inaccessible=await hub.POST(request({action:'ticket',data:{...draft,actions:[{...namedAction,pilot:'outside'}]}}));
 assert.equal(inaccessible.status,400);
 assert.match((await inaccessible.json()).error,/Autre service n’a pas accès au ticket/);
 const created=await hub.POST(request({action:'ticket',data:draft}));
 assert.equal(created.status,200);
 const {id:assignedTicket,actionNotifications}=await created.json();
 assert.equal(actionNotifications,2);
 const getNotices=()=>db.prepare('SELECT id,user_id,title,href FROM hub_notifications WHERE href LIKE ? ORDER BY rowid')
  .all('/tickets?id='+assignedTicket+'&action=%');
 assert.deepEqual(getNotices().map(notice=>[notice.user_id,new URLSearchParams(notice.href.split('?')[1]).get('action')]),
  [['editor','action-a'],['second-pilot','action-b']]);
 const saveDraft=(revision,data)=>hub.POST(request({action:'ticket',id:assignedTicket,revision,data}));
 const renamed={...draft,description:'Description mise à jour'};
 assert.equal((await saveDraft(1,renamed)).status,200);
 assert.equal(getNotices().length,2,'An unrelated edit does not send another assignment notice');

 const author=globalThis.auditUser;
 globalThis.auditUser={id:'second-pilot',role:'editor',displayName:'Deuxième pilote'};
 globalThis.auditSession='session-a';
 const pending=async()=>((await (await notifications.GET(new Request('https://example.test/api/notifications'))).json()).notifications);
 const decide=(id,action)=>notifications.POST(new Request('https://example.test/api/notifications',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action}),
 }));
 const [notice]=await pending();
 assert.equal(notice.title,'Action attribuée · Vérifier le résultat');
 assert.ok(notice.href.endsWith('&action=action-b'));
 assert.match(notice.context,/Échéance/);
 assert.equal((await decide(notice.id,'later')).status,200);
 assert.equal((await pending()).length,0);
 globalThis.auditSession='session-b';
 assert.deepEqual((await pending()).map(item=>item.id),[notice.id]);

 globalThis.auditUser=author;
 const reassigned={...renamed,actions:renamed.actions.map(action=>action.id==='action-b'?{...action,pilot:'editor'}:action)};
 const concurrent=await Promise.all([saveDraft(2,reassigned),saveDraft(2,reassigned)]);
 assert.deepEqual(concurrent.map(response=>response.status).sort(),[200,409]);
 assert.equal(getNotices().length,3,'Only the committed revision notifies the new pilot');
 globalThis.auditUser={id:'second-pilot',role:'editor',displayName:'Deuxième pilote'};
 assert.equal((await pending()).length,0,'A former pilot no longer sees the assignment');
 globalThis.auditUser=author;
 assert.equal((await saveDraft(3,renamed)).status,200);
 globalThis.auditUser={id:'second-pilot',role:'editor',displayName:'Deuxième pilote'};
 const renewed=await pending();
 assert.equal(renewed.length,1,'Only the latest assignment for this action is shown');
 assert.notEqual(renewed[0].id,notice.id);
 assert.equal((await decide(renewed[0].id,'acknowledge')).status,200);
 globalThis.auditSession='session-c';
 assert.equal((await pending()).length,0,'Acknowledging the latest assignment does not bring an older one back');
 globalThis.auditUser=author;
 delete globalThis.auditSession;

 console.log('Audit reports and action notifications passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});delete globalThis.auditDb;delete globalThis.auditBucket;delete globalThis.auditUser;delete globalThis.auditOrigin}
