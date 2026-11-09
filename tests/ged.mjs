import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-ged-')),sqlite=new DatabaseSync(':memory:');
function statement(sql,values=[]){return {bind(...args){return statement(sql,args)},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sql.startsWith('SELECT team_id,level FROM team_members')&&!globalThis.gedTestAllowed?[]:sqlite.prepare(sql).all(...values)}},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}}}}
globalThis.gedTestDb={prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const objects=new Map();globalThis.gedTestBucket={async put(key,data){objects.set(key,data)},async get(key){const body=objects.get(key);return body?{body}:null},async delete(key){objects.delete(key)}};
globalThis.gedTestUser={id:'author',displayName:'Auteur',role:'editor'};globalThis.gedTestAllowed=true;
function compile(name,source){for(const [from,to] of [['@/lib/ged-access','./ged-access.mjs'],['./team-access','./teams.mjs'],['@/lib/hub','./hub.mjs'],['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/team-access','./teams.mjs'],['@/lib/ged-private-source','./source.mjs'],['@/lib/ged-server','./ged-server.mjs'],['@/lib/ged','./ged.mjs'],['@/lib/document-file','./document-file.mjs'],['./ged-private-source','./source.mjs'],['./ged','./ged.mjs']])source=source.replaceAll("'"+from+"'","'"+to+"'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
compile('hub',fs.readFileSync('lib/hub.ts','utf8'));compile('ged',fs.readFileSync('lib/ged.ts','utf8'));compile('document-file',fs.readFileSync('lib/document-file.ts','utf8'));
const {blankDocument,draftFrom,draftErrors}=await import(path.join(dir,'ged.mjs'));
const sourceDocument={...blankDocument(),id:'source-1',ref:'MO1-1500',index:'a',title:'Document du catalogue',catalogStatus:'Actif',sourceRow:12,sourceSheet:'LDA',raw:{D:'MO1-1500',F:'Document du catalogue'}};
fs.writeFileSync(path.join(dir,'source.mjs'),'export const gedSource='+JSON.stringify({source:'test.xlsx',records:[sourceDocument],history:[],headers:{}})+';');
fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.gedTestDb;export const bucket=()=>globalThis.gedTestBucket;');
fs.writeFileSync(path.join(dir,'access.mjs'),"export const checkOrigin=req=>req.headers.get('origin')===new URL(req.url).origin;export const requireRole=async(req,role='reader')=>role==='editor'&&globalThis.gedTestUser.role==='reader'?{error:Response.json({}, {status:403})}:{user:globalThis.gedTestUser};");
fs.writeFileSync(path.join(dir,'teams.mjs'),"export const teamsAllowed=async(user,ids)=>globalThis.gedTestAllowed&&!ids.includes('production');export const someTeamAllowed=async()=>globalThis.gedTestAllowed;export const teamContentVisible=(allowed,ids)=>(!ids.includes('rh')||allowed.has('rh'))&&(!ids.length||ids.some(id=>allowed.has(id)));export const accessibleTeams=async()=>new Set(globalThis.gedTestAllowed?['qsse']:[]);");
compile('ged-access',fs.readFileSync('lib/ged-access.ts','utf8'));compile('ged-server',fs.readFileSync('lib/ged-server.ts','utf8'));compile('route',fs.readFileSync('app/api/ged/route.ts','utf8'));compile('files',fs.readFileSync('app/api/ged-files/route.ts','utf8'));
sqlite.exec(`CREATE TABLE teams(id TEXT PRIMARY KEY,name TEXT,rank INTEGER);INSERT INTO teams VALUES('qsse','QSSE',1),('production','Production',2),('rh','RH',2),('custom','Service spécifique',3);CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT,display_name TEXT,role TEXT);CREATE TABLE team_members(user_id TEXT,team_id TEXT,level TEXT);CREATE TABLE records(id TEXT,title TEXT,kind TEXT,details TEXT,description TEXT,url TEXT,status TEXT);CREATE TABLE hub_notifications(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,href TEXT,seen INTEGER,created_at TEXT);INSERT INTO users VALUES('author','author','Auteur','editor'),('reviewer','reviewer','Relecteur QSSE','editor'),('manager','manager','N+1','editor'),('admin','flavien','Administrateur','admin'),('reader','reader','Lecteur','reader');`);
sqlite.exec(fs.readFileSync('drizzle/0014_easy_sue_storm.sql','utf8').replaceAll('--> statement-breakpoint',''));sqlite.exec("INSERT INTO team_members VALUES('author','qsse','contributor'),('reviewer','qsse','contributor'),('reader','qsse','viewer');");
sqlite.exec("CREATE TABLE member_function_roles(user_id TEXT,role TEXT,PRIMARY KEY(user_id,role));INSERT INTO member_function_roles VALUES('reviewer','ged_reviewer')");
const api=await import(path.join(dir,'route.mjs')),files=await import(path.join(dir,'files.mjs'));
function actor(id,role='editor'){globalThis.gedTestUser={id,displayName:id,role}}
const post=body=>api.POST(new Request('https://example.test/api/ged',{method:'POST',headers:{origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify(body)}));
const get=id=>api.GET(new Request('https://example.test/api/ged'+(id?'?id='+id:'')));
const version=id=>{const r=sqlite.prepare('SELECT * FROM ged_versions WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
actor('admin','admin');assert.equal((await post({action:'profile',userId:'author',managerId:'manager',qsse:false})).status,200);assert.equal((await post({action:'profile',userId:'reviewer',managerId:'manager',qsse:true})).status,200);assert.equal((await post({action:'profile',userId:'manager',managerId:'author',qsse:false})).status,400);
sqlite.exec("DELETE FROM team_members WHERE user_id='reviewer'");
const metaUsers=(await (await getMeta()).json()).users;
function getMeta(){return api.GET(new Request('https://example.test/api/ged?scope=meta'))}
assert.deepEqual(metaUsers.filter(u=>u.gedReviewer).map(u=>u.id),['reviewer']);
actor('reader','reader');assert.equal((await post({action:'create-version',documentId:''})).status,403);
actor('author');const data={...draftFrom(sourceDocument,'author'),reviewerId:'reviewer',approverId:'manager',changeReason:'Intégration du document original'};
globalThis.gedTestAllowed=false;assert.equal((await post({action:'create-version',documentId:'source-1',data})).status,403);globalThis.gedTestAllowed=true;
const created=await post({action:'create-version',documentId:'source-1',data});assert.equal(created.status,200);const {versionId}=await created.json();let v=version(versionId);assert.equal((await post({action:'create-version',documentId:'source-1',data})).status,409);
assert.equal((await post({action:'save-draft',versionId,revision:v.revision,data:{...data,process:'R4'}})).status,403,'Cannot move a draft into an unauthorized service');assert.equal(version(versionId).revision,v.revision);
assert.equal((await post({action:'submit',versionId,revision:v.revision})).status,400); // no document attached
const upload=async(id,revision,name='test.pdf',bytes='%PDF-1.7\nTest')=>{const f=new FormData();f.set('versionId',id);f.set('revision',String(revision));f.set('file',new File([bytes],name,{type:'application/pdf'}));return files.POST(new Request('https://example.test/api/ged-files',{method:'POST',headers:{origin:'https://example.test'},body:f}))};
assert.equal((await upload(versionId,v.revision,'fake.pdf','not a pdf')).status,400);const uploaded=await upload(versionId,v.revision);assert.equal(uploaded.status,200);const fileId=(await uploaded.json()).id;assert.equal(objects.size,1);assert.equal((await post({action:'submit',versionId,revision:v.revision})).status,409);v=version(versionId);
assert.equal((await post({action:'submit',versionId,revision:v.revision})).status,200);v=version(versionId);assert.equal(v.status,'Relecture QSSE');assert.equal((await upload(versionId,v.revision)).status,403);assert.equal((await post({action:'save-draft',versionId,revision:v.revision,data})).status,403);
actor('reader','reader');assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id='+fileId))).status,403);const publicDetail=await (await get('source-1')).json();assert.equal(publicDetail.versions.length,0);assert.equal(publicDetail.files.length,0);
actor('manager');assert.equal((await post({action:'approve',versionId,revision:v.revision})).status,403);actor('reviewer');
sqlite.exec("DELETE FROM member_function_roles WHERE user_id='reviewer'");
for(const action of ['review','reject'])assert.equal((await post({action,versionId,revision:v.revision,confirmation:true,note:'Correction'})).status,403);
actor('author');
assert.equal((await post({action:'recall',versionId,revision:v.revision})).status,200);v=version(versionId);
assert.equal((await post({action:'submit',versionId,revision:v.revision})).status,400);
sqlite.exec("INSERT INTO member_function_roles VALUES('reviewer','ged_reviewer')");
assert.equal((await post({action:'submit',versionId,revision:v.revision})).status,200);v=version(versionId);
actor('reviewer');
assert.equal((await post({action:'reject',versionId,revision:v.revision,note:''})).status,403);assert.equal((await post({action:'reject',versionId,revision:v.revision,note:'Préciser la consigne'})).status,200);v=version(versionId);assert.equal(v.status,'À corriger');
actor('author');assert.equal((await post({action:'save-draft',versionId,revision:v.revision,data:{...data,changeReason:'Consigne précisée'}})).status,200);v=version(versionId);assert.equal((await post({action:'submit',versionId,revision:v.revision})).status,200);v=version(versionId);
actor('reviewer');assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id='+fileId))).status,200);assert.equal((await post({action:'review',versionId,revision:v.revision})).status,400,'Review must require confirmation');assert.equal((await post({action:'review',versionId,revision:v.revision,confirmation:true})).status,200);assert.equal((await post({action:'review',versionId,revision:v.revision})).status,409);v=version(versionId);assert.equal(v.reviewed_by,'reviewer');assert.equal((await post({action:'approve',versionId,revision:v.revision})).status,403);
actor('manager');assert.equal((await post({action:'approve',versionId,revision:v.revision})).status,400,'Approval must require confirmation');assert.equal((await post({action:'approve',versionId,revision:v.revision,confirmation:true})).status,200);v=version(versionId);assert.equal(v.status,'Approuvé');assert.equal(v.approved_by,'manager');assert.equal(sqlite.prepare('SELECT published_version_id FROM ged_documents WHERE id=?').get('source-1').published_version_id,versionId);
const reviewProof=JSON.parse(sqlite.prepare("SELECT snapshot FROM ged_events WHERE version_id=? AND action='Relecture QSSE validée'").get(versionId).snapshot).evidence;
const approvalProof=JSON.parse(sqlite.prepare("SELECT snapshot FROM ged_events WHERE version_id=? AND action='Approbation N+1'").get(versionId).snapshot).evidence;
assert.equal(reviewProof.signerId,'reviewer');assert.equal(approvalProof.signerId,'manager');
assert.equal(reviewProof.confirmation,true);assert.equal(approvalProof.confirmation,true);
assert.equal(reviewProof.sha256,approvalProof.sha256,'Exact same document files must be reviewed and approved');
assert.match(approvalProof.sha256,/^[a-f0-9]{64}$/);assert.equal(approvalProof.files.length,1);
assert.equal(approvalProof.files[0].id,fileId);assert.match(approvalProof.files[0].sha256,/^[a-f0-9]{64}$/);
assert.equal((await upload(versionId,v.revision)).status,403,'Published version files cannot be modified');
assert.equal((await files.POST(new Request('https://example.test/api/ged-files',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({action:'remove',versionId,fileId,revision:v.revision,confirmation:'SUPPRIMER'})}))).status,403,'Published version files cannot be removed');
actor('reader','reader');assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id='+fileId))).status,200);globalThis.gedTestAllowed=false;assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id='+fileId))).status,403);globalThis.gedTestAllowed=true;
actor('author');assert.equal((await post({action:'save-draft',versionId,revision:v.revision,data})).status,403);const second=await post({action:'create-version',documentId:'source-1',data:{...data,index:'b',changeReason:'Amélioration'}});assert.equal(second.status,200);const secondId=(await second.json()).versionId;assert.equal(sqlite.prepare('SELECT published_version_id FROM ged_documents WHERE id=?').get('source-1').published_version_id,versionId);assert.equal((await upload(secondId,1)).status,200);let secondV=version(secondId);assert.equal((await post({action:'save-draft',versionId:secondId,revision:secondV.revision,data:{...data,index:'a'}})).status,200);secondV=version(secondId);assert.equal((await post({action:'submit',versionId:secondId,revision:secondV.revision})).status,400);assert.equal((await post({action:'abandon',versionId:secondId,revision:secondV.revision})).status,200);assert.equal(objects.size,2);
const users=[{id:'author',role:'editor',managerId:'manager',gedReviewer:false},{id:'manager',role:'editor',managerId:'',gedReviewer:true}];assert.ok(draftErrors({...data,reviewerId:'author'},users,true).length);assert.ok(sqlite.prepare("SELECT count(*) n FROM ged_events WHERE action='Approbation N+1'").get().n===1);assert.ok(sqlite.prepare('SELECT count(*) n FROM hub_notifications').get().n>=4);
// Service spaces and the QSSE overview use real explicit memberships, independent of open services.
sqlite.exec("INSERT INTO users VALUES('prod-user','prod-user','Production user','editor'),('custom-user','custom-user','Custom service','editor');INSERT INTO team_members VALUES('prod-user','production','contributor'),('custom-user','custom','contributor');");
function seedDocument(id,team,process){const document={...blankDocument(),id,serviceId:team,process,ref:id,title:'Document '+team,catalogStatus:'Actif',publishedVersionId:id+'-v'};const draft={...draftFrom(document,'author'),serviceId:team};sqlite.prepare('INSERT INTO ged_documents VALUES(?,?,1,?)').run(id,JSON.stringify(document),id+'-v');sqlite.prepare("INSERT INTO ged_versions(id,document_id,data,status,created_at,updated_at) VALUES(?,?,?,'Approuvé',?,?)").run(id+'-v',id,JSON.stringify(draft),'2026-11-01','2026-11-01');sqlite.prepare('INSERT INTO ged_files VALUES(?,?,?,?,?,?,?,?)').run(id+'-file',id+'-v',id+'.pdf','application/pdf',9,'sha','Auteur','2026-11-01');objects.set('ged/'+id+'-v/'+id+'-file','%PDF-1.7');return document}
const productionDoc=seedDocument('prod-doc','production','R4'),rhDoc=seedDocument('rh-doc','rh','S3'),customDoc=seedDocument('custom-doc','custom','');
const list=async(query)=>api.GET(new Request('https://example.test/api/ged?'+query));
actor('prod-user');let meta=await (await list('scope=meta')).json();assert.equal(meta.canGlobal,false);assert.deepEqual(meta.services.map(t=>t.id),['production']);
let serviceList=await list('scope=service&team=production');assert.equal(serviceList.status,200);assert.deepEqual((await serviceList.json()).documents.map(d=>d.id),['prod-doc']);
assert.equal((await list('scope=global')).status,403);assert.equal((await list('scope=service&team=qsse')).status,403);assert.equal((await get('source-1')).status,403);assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id=rh-doc-file'))).status,403);
sqlite.exec("INSERT INTO team_members VALUES('reviewer','qsse','contributor')");actor('reviewer');meta=await (await list('scope=meta')).json();assert.equal(meta.canGlobal,true);assert.equal(meta.defaultService,'qsse');
let overview=await (await list('scope=global')).json();assert.ok(overview.documents.some(d=>d.id==='prod-doc'));assert.ok(overview.documents.some(d=>d.id==='custom-doc'));assert.ok(!overview.documents.some(d=>d.id==='rh-doc'),'Global QSSE overview respects the RH boundary');
const own=await (await list('scope=service&team=qsse')).json();assert.ok(own.documents.some(d=>d.id==='source-1'));assert.ok(!own.documents.some(d=>d.id==='prod-doc'));
assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id=prod-doc-file'))).status,200,'QSSE can download approved documents across services');
assert.equal((await get('rh-doc')).status,403);assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id=rh-doc-file'))).status,403);
assert.equal((await post({action:'document-metadata',documentId:'prod-doc',revision:1,nextReview:'2027-01-01',catalogStatus:'Actif',note:'Global view is read-only'})).status,403);
assert.equal((await post({action:'create-version',documentId:'prod-doc',data:{...draftFrom(productionDoc,'reviewer'),changeReason:'Denied'}})).status,403);
// A GED reviewer flag alone does not grant a QSSE service-wide overview.
actor('manager');sqlite.prepare('INSERT INTO ged_profiles(user_id,manager_id,qsse) VALUES(?,NULL,1)').run('manager');assert.equal((await list('scope=global')).status,403);
actor('custom-user');assert.equal((await list('scope=service&team=custom')).status,200);
const customDraft={...draftFrom(customDoc,'custom-user'),ref:'CUSTOM-NEW',title:'New service document',changeReason:'Creation'};
const customCreated=await post({action:'create-version',documentId:'',data:customDraft});assert.equal(customCreated.status,200);const customCreation=await customCreated.json(),customNewId=customCreation.id,customNewVersionId=customCreation.versionId;assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM ged_documents WHERE id=?').get(customNewId).data).serviceId,'custom','New services have their own document ownership');
assert.equal((await post({action:'create-version',documentId:'',data:{...customDraft,ref:'DENIED-MOVE',serviceId:'production'}})).status,403);
// Both deletion operations must require the precise uppercase phrase on the server.
const removeAttachment=(body)=>files.POST(new Request('https://example.test/api/ged-files',{method:'POST',headers:{origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify(body)}));
const addedFile=await upload(customNewVersionId,1,'temporary.pdf');assert.equal(addedFile.status,200);const tempId=(await addedFile.json()).id;
const fileRevision=version(customNewVersionId).revision;
const removePayload={action:'remove',versionId:customNewVersionId,fileId:tempId,revision:fileRevision,confirmation:'SUPPRIMER'};
for(const confirmation of ['','supprimer',' Supprimer','SUPPRIMER ','SUPPRIMER\\n'])assert.equal((await removeAttachment({...removePayload,confirmation})).status,400);
assert.ok(sqlite.prepare('SELECT id FROM ged_files WHERE id=?').get(tempId),'Incorrect confirmation must not delete anything');
assert.equal((await removeAttachment(removePayload)).status,200);
assert.equal(sqlite.prepare('SELECT id FROM ged_files WHERE id=?').get(tempId),undefined);
assert.equal(objects.has('ged/'+customNewVersionId+'/'+tempId),false);
actor('reader','reader');assert.equal((await post({action:'delete-document',documentId:'source-1',revision:2,confirmation:'SUPPRIMER'})).status,403);
actor('author');assert.equal((await post({action:'delete-document',documentId:'source-1',revision:2,confirmation:'SUPPRIMER'})).status,403);
actor('admin','admin');assert.ok((await (await list('scope=global')).json()).documents.some(d=>d.id==='rh-doc'));
const currentRevision=sqlite.prepare('SELECT revision FROM ged_documents WHERE id=?').get('source-1').revision;
const deletion={action:'delete-document',documentId:'source-1',revision:currentRevision,confirmation:'SUPPRIMER'};
for(const confirmation of ['','supprimer','SUPPRIMER ',' SUPPRIMER'])assert.equal((await post({...deletion,confirmation})).status,400);
assert.equal((await post({...deletion,revision:currentRevision-1})).status,409,'Stale revision must not delete');
assert.equal((await get('source-1')).status,200);
assert.equal((await post(deletion)).status,200);
assert.equal((await get('source-1')).status,404,'Deleted catalog document is no longer visible');
assert.equal((await files.GET(new Request('https://example.test/api/ged-files?id='+fileId))).status,404,'Old attachment URLs must stop working');
assert.equal((await post(deletion)).status,404,'Duplicate deletion is rejected');
assert.equal((await (await list('scope=global')).json()).documents.some(d=>d.id==='source-1'),false);
assert.ok(sqlite.prepare('SELECT id FROM ged_versions WHERE id=?').get(versionId),'Approval versions retained');
assert.ok(sqlite.prepare("SELECT id FROM ged_events WHERE document_id='source-1' AND action='Suppression de la GED'").get(),'Deletion has an audit event');
assert.ok(JSON.parse(sqlite.prepare('SELECT data FROM ged_documents WHERE id=?').get('source-1').data).deletedAt,'Tombstone retained');
assert.equal(objects.has('ged/'+versionId+'/'+fileId),true,'Approved file storage preserved for traceability');
console.log('GED safe deletion: admin-only document withdrawal, exact SUPPRIMER confirmation, revision conflict, audit retention, hidden GED/SMI source, attachment access blocked and draft file removal passed.');

console.log('GED service ownership, explicit membership, global QSSE consultation, RH document/file confidentiality, custom services and denied cross-service writes passed.');
if(fs.existsSync('private/ged-source.json')){const src=JSON.parse(fs.readFileSync('private/ged-source.json','utf8'));assert.equal(src.records.length,1319);assert.equal(src.records.filter(d=>d.sourceSheet==='LDA').length,795);assert.equal(src.records.filter(d=>d.sourceArchive).length,524);assert.equal(new Set(src.records.map(d=>d.id)).size,1319);assert.ok(src.records.some(d=>d.sourceArchive&&d.issues.some(i=>i.includes('marqué actif'))));}
console.log('GED : catalogue, droits, N+1, relecture QSSE, retours pour correction, fichiers figés, versions applicables et conflits vérifiés.');
}finally{sqlite.close();fs.rmSync(dir,{recursive:true,force:true})}
