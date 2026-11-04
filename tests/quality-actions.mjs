import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-quality-')),db=new DatabaseSync(':memory:');
fs.writeFileSync(path.join(dir,'prevention-documents.mjs'),'export const planAccess=async()=>null;');
function statement(sql,args=[]){return {bind(...values){return statement(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.qaDb={prepare:statement,async batch(ss){db.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.qaUser={id:'admin',displayName:'QSSE',role:'admin'};globalThis.qaAllowed=true;
const files=new Map();globalThis.qaBucket={async put(k,v){files.set(k,v)},async delete(k){files.delete(k)},async get(k){return files.has(k)?{body:files.get(k)}:null}};
function compile(name,s){for(const [from,to] of [['./team-access','./teams.mjs'],['./prevention-documents','./prevention-documents.mjs'],['@/lib/notification-access','./notification-access.mjs'],['@/lib/ticket-labels','./ticket-labels.mjs'],['./hub','./hub.mjs'],['@/lib/document-file','./document-file.mjs'],['@/lib/gmao-server','./gmao-server.mjs'],['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/team-access','./teams.mjs'],['@/lib/hub','./hub.mjs'],['@/lib/quality-server','./quality-server.mjs'],['@/lib/quality-private-source','./source.mjs'],['@/lib/quality-actions','./quality-actions.mjs'],['@/lib/ged-server','./ged-server.mjs'],['./quality-private-source','./source.mjs'],['./hub','./hub.mjs']])s=s.replaceAll("'"+from+"'","'"+to+"'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.qaDb;export const bucket=()=>globalThis.qaBucket;');
fs.writeFileSync(path.join(dir,'access.mjs'),`export const checkOrigin=()=>true;export const requireRole=async(req,role)=>role==='editor'&&globalThis.qaUser.role==='reader'?{error:Response.json({error:'reader'},{status:403})}:{user:globalThis.qaUser};`);
fs.writeFileSync(path.join(dir,'teams.mjs'),`export const teamsAllowed=async()=>globalThis.qaAllowed;export const someTeamAllowed=teamsAllowed;export const teamContentVisible=(allowed,ids)=>(!ids.includes('rh')||allowed.has('rh'))&&(!ids.length||ids.some(id=>allowed.has(id)));export const accessibleTeams=async()=>new Set(globalThis.qaAllowed?['qsse']:[]);`);
fs.writeFileSync(path.join(dir,'ged-server.mjs'),`export const gedUsers=async()=>[{id:'admin',qsse:true},{id:'editor',qsse:false}];export const gedDocuments=async()=>new Map();`);
fs.writeFileSync(path.join(dir,'gmao-server.mjs'),'export const gmaoTicketContributor=async()=>false;export const gmaoTicketReader=async()=>false;');
compile('notification-access',fs.readFileSync('lib/notification-access.ts','utf8'));compile('ticket-labels',fs.readFileSync('lib/ticket-labels.ts','utf8'));compile('document-file',fs.readFileSync('lib/document-file.ts','utf8'));compile('hub',fs.readFileSync('lib/hub.ts','utf8'));compile('quality-actions',fs.readFileSync('lib/quality-actions.ts','utf8'));
const lib=await import(path.join(dir,'quality-actions.mjs'));
const base={...lib.blankQualityAction('2026-10-01'),id:'source-1',reference:'AC-1',action:'Vérifier la protection',gravity:4,exposure:4,target:'Humaine'};
fs.writeFileSync(path.join(dir,'source.mjs'),'export const qualitySource='+JSON.stringify({source:'test.xlsx',records:[base],owners:{'M2 - QSSE':'Responsable'},guide:[],trace:[],methods:[],origins:[]})+';');
compile('quality-server',fs.readFileSync('lib/quality-server.ts','utf8'));compile('quality-route',fs.readFileSync('app/api/quality-actions/route.ts','utf8'));compile('hub-route',fs.readFileSync('app/api/hub/route.ts','utf8'));compile('ticket-files',fs.readFileSync('app/api/ticket-files/route.ts','utf8'));
db.exec(fs.readFileSync('drizzle/0015_long_swordsman.sql','utf8').replaceAll('--> statement-breakpoint',''));
db.exec(`CREATE TABLE hub_tickets(id TEXT PRIMARY KEY,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT,author TEXT);CREATE TABLE hub_comments(id TEXT PRIMARY KEY,ticket_id TEXT,body TEXT,author_id TEXT,author TEXT,created_at TEXT);CREATE TABLE hub_files(id TEXT PRIMARY KEY,ticket_id TEXT,name TEXT,mime TEXT,size INTEGER,author TEXT,created_at TEXT);CREATE TABLE hub_notifications(id TEXT,user_id TEXT,title TEXT,href TEXT,seen INTEGER,created_at TEXT);CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT);CREATE TABLE teams(id TEXT PRIMARY KEY);INSERT INTO teams VALUES('qsse');INSERT INTO users VALUES('admin','QSSE');`);
const quality=await import(path.join(dir,'quality-route.mjs')),hub=await import(path.join(dir,'hub-route.mjs')),fileRoute=await import(path.join(dir,'ticket-files.mjs'));
const post=(handler,body)=>handler.POST(new Request('https://example.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
const action=()=>{const row=db.prepare('SELECT data FROM quality_actions WHERE id=?').get('source-1');return row?JSON.parse(row.data):base};
assert.equal(lib.effectiveness({...base,status:'ANNULEE'}),'Annulée');assert.equal(lib.verificationIssues(base).length,4);assert.ok(lib.actionOrder({...base,due:'2020-01-01'},{...base,due:'2030-01-01'},'2026-10-01')<0);assert.equal(lib.priority(4,4),'P1');assert.equal(lib.priority(4,2),'P2');assert.equal(lib.priority(2,2),'P3');assert.equal(lib.priority(1,1),'P4');assert.equal(lib.priority(null,2),'A COTER');assert.equal(lib.proposedDue(base),'2026-10-31');assert.equal(lib.engagement({...base,hours:8,cost:501}),'Action courante');assert.equal(lib.engagement({...base,hours:201,cost:0}),'Investissement CAPEX');
globalThis.qaUser={id:'reader',displayName:'Lecteur',role:'reader'};assert.equal((await post(quality,{operation:'save',id:base.id,revision:0,data:base})).status,403);
globalThis.qaUser={id:'admin',displayName:'QSSE',role:'admin'};globalThis.qaAllowed=false;assert.equal((await post(quality,{operation:'save',id:base.id,revision:0,data:base})).status,403);globalThis.qaAllowed=true;
assert.equal((await post(quality,{operation:'save',id:base.id,revision:0,data:{...base,gravity:6}})).status,400);
assert.equal((await post(quality,{operation:'save',id:base.id,revision:0,data:{...base,due:'2020-01-01'}})).status,400);
assert.equal((await post(quality,{operation:'save',id:base.id,revision:0,data:base})).status,200);assert.equal((await post(quality,{operation:'save',id:base.id,revision:0,data:base})).status,409);
let a=action();assert.equal((await post(quality,{operation:'ticket',id:a.id,revision:a.revision})).status,200);a=action();assert.ok(a.ticketId);assert.equal((await post(quality,{operation:'ticket',id:a.id,revision:a.revision})).status,200);assert.equal(db.prepare('SELECT count(*) n FROM hub_tickets').get().n,1);
assert.equal((await post(quality,{operation:'verify',id:a.id,revision:a.revision,note:'Contrôle'})).status,400);
assert.equal((await post(quality,{operation:'save',id:a.id,revision:a.revision,data:{...a,status:'SOLDEE',criterion:'Zéro exposition',effectiveEvidence:'Mesure réalisée',afterGravity:2,afterExposure:2}})).status,200);a=action();assert.equal(lib.effectiveness(a),'À vérifier');
globalThis.qaUser={id:'editor',displayName:'Pilote',role:'editor'};assert.equal((await post(quality,{operation:'verify',id:a.id,revision:a.revision,note:'Contrôle'})).status,403);
globalThis.qaUser={id:'admin',displayName:'QSSE',role:'admin'};assert.equal((await post(quality,{operation:'verify',id:a.id,revision:a.revision,note:'Protection efficace, mesure vérifiée'})).status,200);a=action();assert.equal(lib.effectiveness(a),'Efficace');
assert.equal((await post(quality,{operation:'save',id:a.id,revision:a.revision,data:{...a,afterGravity:4,afterExposure:4}})).status,200);a=action();assert.equal(lib.effectiveness(a),'À vérifier');assert.equal((await post(quality,{operation:'verify',id:a.id,revision:a.revision,note:'Risque inchangé'})).status,200);a=action();assert.equal(lib.effectiveness(a),'Non efficace');
const follow={...lib.blankQualityAction('2026-10-01'),action:'Revoir la protection',reference:'AC-2'};assert.equal((await post(quality,{operation:'save',id:'',revision:0,parentId:a.id,data:follow})).status,200);assert.equal(db.prepare('SELECT count(*) n FROM quality_actions').get().n,2);
let t=db.prepare('SELECT * FROM hub_tickets WHERE id=?').get(a.ticketId);assert.equal((await post(hub,{action:'archive-ticket',id:t.id,revision:t.revision,archive:true})).status,400);const td={...JSON.parse(t.data),status:'Clôturé',pilot:'admin'};db.prepare('UPDATE hub_tickets SET data=? WHERE id=?').run(JSON.stringify(td),t.id);
assert.equal((await post(hub,{action:'archive-ticket',id:t.id,revision:t.revision-1,archive:true})).status,409);assert.equal((await post(hub,{action:'archive-ticket',id:t.id,revision:t.revision,archive:true})).status,200);t=db.prepare('SELECT * FROM hub_tickets WHERE id=?').get(t.id);assert.ok(JSON.parse(t.data).archivedAt);
assert.equal((await (await hub.GET(new Request('https://example.test/api?scope=tickets'))).json()).rows.length,0);assert.equal((await (await hub.GET(new Request('https://example.test/api?scope=tickets&archive=1'))).json()).rows.length,1);
assert.equal((await post(hub,{action:'comment',ticketId:t.id,body:'Commentaire',recipients:[]})).status,403);assert.equal((await post(hub,{action:'ticket',id:t.id,revision:t.revision,data:td})).status,403);
const form=new FormData();form.set('ticketId',t.id);form.set('file',new File(['%PDF-test'],'test.pdf'));assert.equal((await fileRoute.POST(new Request('https://example.test/api',{method:'POST',body:form}))).status,403);assert.equal(files.size,0);
assert.equal((await post(hub,{action:'archive-ticket',id:t.id,revision:t.revision,archive:false})).status,200);assert.equal((await (await hub.GET(new Request('https://example.test/api?scope=tickets'))).json()).rows.length,1);assert.equal(db.prepare('SELECT count(*) n FROM hub_comments WHERE ticket_id=?').get(t.id).n,2);
// Optional integrity check for the private import; all API tests above use synthetic fixtures.
if(fs.existsSync('private/quality-actions-source.json')){
const src=JSON.parse(fs.readFileSync('private/quality-actions-source.json','utf8'));assert.equal(src.records.length,628);assert.equal(new Set(src.records.map(a=>a.id)).size,628);assert.equal(src.records.filter(a=>lib.priority(a.gravity,a.exposure)==='A COTER').length,443);assert.equal(src.records.filter(a=>a.status==='ANNULEE').length,99);
console.log('Import privé : 628 actions, identifiants et répartitions vérifiés.');
}else console.log('Import privé absent : contrôle du catalogue réservé à son environnement propriétaire.');

// Ticket tags must survive the real ticket save path and reject cross-theme IDs.
db.exec(fs.readFileSync('drizzle/0029_ticket_labels.sql','utf8'));
globalThis.qaUser={id:'admin',displayName:'QSSE',role:'admin'};globalThis.qaAllowed=true;
const {newTicket}=await import(path.join(dir,'hub.mjs'));
const tagged={...newTicket(),title:'Fuite atelier',category:'Environnement',teams:['qsse'],topicTags:['env-water','env-spill'],locationTags:['place-maris-51']};
let labelSave=await post(hub,{action:'ticket',data:tagged});assert.equal(labelSave.status,200);
const taggedId=(await labelSave.json()).id;let stored=JSON.parse(db.prepare('SELECT data FROM hub_tickets WHERE id=?').get(taggedId).data);assert.deepEqual(stored.topicTags,tagged.topicTags);assert.deepEqual(stored.locationTags,tagged.locationTags);
assert.equal((await post(hub,{action:'ticket',id:taggedId,revision:1,data:{...stored,category:'Sécurité'}})).status,400);
assert.equal((await post(hub,{action:'ticket',id:taggedId,revision:1,data:{...stored,topicTags:[],locationTags:[]}})).status,200);
stored=JSON.parse(db.prepare('SELECT data FROM hub_tickets WHERE id=?').get(taggedId).data);assert.deepEqual(stored.topicTags,[]);assert.deepEqual(stored.locationTags,[]);
console.log('Ticket label persistence: save, removal and cross-theme rejection passed through the ticket API.');
console.log('Plan : cotation, moyens, droits, efficacité QSSE, historique et tickets sans doublons vérifiés. Archivage : clôture requise, accès, conservation et restauration vérifiés.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
