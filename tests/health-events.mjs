import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const require=createRequire(import.meta.url);
function load(file,imports={}){
 const {outputText}=ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 });
 const exports={};
 new Function('exports','require',outputText)(exports,name=>imports[name]||require(name));
 return exports;
}

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`
 CREATE TABLE records(id TEXT PRIMARY KEY,title TEXT,kind TEXT,domain TEXT,status TEXT,priority TEXT,owner TEXT,due TEXT,description TEXT,url TEXT,details TEXT,created TEXT,updated TEXT,revision INTEGER,source_id TEXT);
 CREATE TABLE record_deletions(record_id TEXT);
 CREATE TABLE record_history(id TEXT PRIMARY KEY,record_id TEXT,revision INTEGER,snapshot TEXT,saved_at TEXT);
 CREATE TABLE hub_tickets(id TEXT PRIMARY KEY,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT,author TEXT);
`);
function prepare(sql){
 const statement=sqlite.prepare(sql);
 const bind=(...params)=>({run:()=>({meta:{changes:statement.run(...params).changes}}),all:()=>({results:statement.all(...params)}),first:()=>statement.get(...params)});
 return {...bind(),bind};
}
const db={prepare,async batch(statements){
 sqlite.exec('BEGIN');
 try{const result=statements.map(statement=>statement.run());sqlite.exec('COMMIT');return result}
 catch(error){sqlite.exec('ROLLBACK');throw error}
}};
let user={role:'admin',id:'admin',displayName:'Administrateur'};
let accessHealth=true,accessTickets=true;
const modules=load('lib/modules.ts');
const events=load('lib/health-events.ts',{'./modules':modules});
const hub=load('lib/hub.ts');
const deps={'@/db/raw':{database:()=>db},'@/lib/health-events':events,'@/lib/hub':hub,
 '@/lib/workflows':{dateToday:()=> '2026-11-17',dateValid:hub.validDate},
 '@/lib/access':{checkOrigin:request=>request.headers.get('origin')==='https://example.test',
  requireRole:async(request,role)=>user.role==='reader'||role==='admin'&&user.role!=='admin'
   ?{error:Response.json({}, {status:403})}:{user}},
 '@/lib/record-access':{recordAccess:async()=>()=>accessHealth},
 '@/lib/team-access':{teamsAllowed:async()=>accessTickets},
};
const importer=load('app/api/records/health-import/route.ts',deps);
const ticketLink=load('app/api/records/health-ticket/route.ts',deps);
const post=(route,body,origin='https://example.test')=>route.POST(new Request('https://example.test',{method:'POST',
 headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}));
const row={sheet:'1ers soins',row:52,date:'2026-03-10',time:'11:15',person:'Personne fictive',place:'Atelier fictif',eventType:'Premier soin',
 circumstances:'Circonstances confidentielles',analysis:'',service:'',injurySite:'',injuryNature:'',daysOff:'0',workActivity:''};
try{
 const preview=await post(importer,{mode:'preview',rows:[row,{...row,row:90}]});
 assert.deepEqual((await preview.json()).preview.map(r=>r.state),['à importer','déjà présent']);
 assert.equal(sqlite.prepare('SELECT count(*) AS count FROM records').get().count,0);
 assert.equal((await post(importer,{mode:'import',rows:[{...row,date:'2025-03-10'}]})).status,400);
 assert.equal((await post(importer,{mode:'import',rows:[row]},'https://other.test')).status,403);
 user={role:'editor',id:'editor',displayName:'Éditeur'};
 assert.equal((await post(importer,{mode:'import',rows:[row]})).status,403);
 user={role:'admin',id:'admin',displayName:'Administrateur'};
 assert.equal((await (await post(importer,{mode:'import',rows:[row]})).json()).imported,1);
 assert.equal((await (await post(importer,{mode:'import',rows:[row]})).json()).imported,0);
 const incident=sqlite.prepare('SELECT * FROM records').get();
 assert.equal(incident.kind,'Accidents du travail');
 assert.equal(JSON.parse(incident.details).eventType,'Premier soin');
 assert.equal(JSON.parse(incident.details).sourceRow,'52');
 const draft={recordId:incident.id,revision:1,mode:'create',title:'Vérifier la protection de la zone'};
 accessHealth=false;
 assert.equal((await post(ticketLink,draft)).status,403);
 accessHealth=true;accessTickets=false;
 assert.equal((await post(ticketLink,draft)).status,403);
 accessTickets=true;
 const created=await post(ticketLink,draft);
 assert.equal(created.status,200);
 const {ticketId,revision}=await created.json();
 assert.equal(revision,2);
 const ticket=JSON.parse(sqlite.prepare('SELECT data FROM hub_tickets WHERE id=?').get(ticketId).data);
 assert.deepEqual(ticket,{...hub.newTicket(),title:draft.title,teams:['qsse']});
 assert.equal(JSON.parse(sqlite.prepare('SELECT details FROM records WHERE id=?').get(incident.id).details).linkedTicketId,ticketId);
 assert.equal((await post(ticketLink,{...draft,revision:2})).status,409);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM hub_tickets').get().count,1);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM record_history').get().count,1);
 assert.equal((await (await post(importer,{mode:'import',rows:[{...row,date:'2026-04-01'}]})).json()).imported,1);
 const second=sqlite.prepare("SELECT id FROM records WHERE json_extract(details,'$.date')='2026-04-01'").get();
 assert.equal((await post(ticketLink,{recordId:second.id,revision:1,mode:'link',ticketId})).status,200);
 assert.equal(JSON.parse(sqlite.prepare('SELECT details FROM records WHERE id=?').get(second.id).details).linkedTicketId,ticketId);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM hub_tickets').get().count,1);
 const thirdDate={...row,date:'2026-05-01'};
 assert.equal((await (await post(importer,{mode:'import',rows:[thirdDate]})).json()).imported,1);
 const third=sqlite.prepare("SELECT id FROM records WHERE json_extract(details,'$.date')='2026-05-01'").get();
 const otherTicket=await (await post(ticketLink,{...draft,recordId:third.id})).json();
 const change={recordId:second.id,revision:2,mode:'replace',ticketId:otherTicket.ticketId};
 accessTickets=false;
 assert.equal((await post(ticketLink,change)).status,403);
 accessTickets=true;
 assert.equal((await post(ticketLink,change)).status,200);
 assert.equal((await post(ticketLink,change)).status,409);
 assert.equal(JSON.parse(sqlite.prepare('SELECT details FROM records WHERE id=?').get(second.id).details).linkedTicketId,otherTicket.ticketId);
 const unlink={recordId:second.id,revision:3,mode:'unlink'};
 accessHealth=false;
 assert.equal((await post(ticketLink,unlink)).status,403);
 accessHealth=true;
 assert.deepEqual(await (await post(ticketLink,unlink)).json(),{ticketId:'',revision:4});
 assert.equal(JSON.parse(sqlite.prepare('SELECT details FROM records WHERE id=?').get(second.id).details).linkedTicketId,undefined);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM hub_tickets').get().count,2);
 console.log('Événements SSE : aperçu, droits, reprise sans doublon, création et rattachement du ticket, données nominatives cantonnées au registre.');
}finally{sqlite.close()}
