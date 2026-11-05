import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-transactions-'));
const sqlite=new DatabaseSync(':memory:');
let beforeBatch;
function statement(sql,values=[]){return {bind(...args){return statement(sql,args)},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}}}}
globalThis.auditDatabase={prepare:statement,async batch(statements){beforeBatch?.();beforeBatch=undefined;sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
function compile(name,source){fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(source.replaceAll("'./function-roles'","'./function-roles.mjs'").replaceAll("'./function-role-labels'","'./function-role-labels.mjs'").replaceAll("'@/lib/team-access'","'./teams.mjs'").replaceAll("'./epi-access'","'./epi-access.mjs'").replaceAll("'./team-access'","'./teams.mjs'").replaceAll("'./prevention-rules'","'./prevention-rules.mjs'").replaceAll("'./workflows'","'./workflows.mjs'").replaceAll("'@/db/raw'","'./raw.mjs'"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
  fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.auditDatabase;export const bucket=()=>{throw Error("Unexpected storage access")};');
  fs.writeFileSync(path.join(dir,'access.mjs'),'export const checkOrigin=()=>true;export const requireRole=async()=>({user:{id:"tester",displayName:"QSSE",role:"admin"}});');
  fs.writeFileSync(path.join(dir,'teams.mjs'),'export const teamsAllowed=async()=>true;export const teamContentVisible=(allowed,ids)=>(!ids.includes("rh")||allowed.has("rh"))&&(!ids.length||ids.some(id=>allowed.has(id)));export const accessibleTeams=async()=>new Set(["qsse"]);');
  compile('record-access',fs.readFileSync('lib/record-access.ts','utf8').replaceAll("'@/db/raw'","'./raw.mjs'").replaceAll("'./team-access'","'./teams.mjs'"));
  fs.writeFileSync(path.join(dir,'source.mjs'),'export const evrpSource=null;');
  for(const name of ['function-role-labels','function-roles','epi-access','prevention-rules','modules','workflows','evrp','navigation','prevention-control'])compile(name,fs.readFileSync('lib/'+name+'.ts','utf8').replaceAll("'./modules'","'./modules.mjs'"));
  for(const name of ['records','evrp']){let source=fs.readFileSync('app/api/'+name+'/route.ts','utf8');for(const [from,to] of [['@/lib/prevention-control','./prevention-control.mjs'],['@/lib/record-access','./record-access.mjs'],['@/lib/team-access','./teams.mjs'],['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/workflows','./workflows.mjs'],['@/lib/evrp','./evrp.mjs'],['@/lib/evrp-private-source','./source.mjs']])source=source.replaceAll("'"+from+"'","'"+to+"'");compile(name+'-route',source)}
  sqlite.exec(`CREATE TABLE records(id TEXT PRIMARY KEY,title TEXT,kind TEXT,domain TEXT,status TEXT,priority TEXT,owner TEXT,due TEXT,description TEXT,url TEXT,details TEXT,created TEXT,updated TEXT,revision INTEGER,source_id TEXT);
CREATE TABLE record_history(id TEXT,record_id TEXT,revision INTEGER,snapshot TEXT,saved_at TEXT);
CREATE TABLE epi_products(code TEXT PRIMARY KEY,quantity INTEGER,revision INTEGER,catalog_status TEXT,updated_at TEXT,unit_cost_cents INTEGER);
CREATE TABLE epi_movements(id TEXT,code TEXT,kind TEXT,delta INTEGER,quantity INTEGER,recipient TEXT,note TEXT,author TEXT,created_at TEXT,unit_cost_cents INTEGER);
CREATE TABLE evrp_units(code TEXT PRIMARY KEY);
CREATE TABLE evrp_risks(id TEXT PRIMARY KEY,unit_code TEXT,data TEXT,original TEXT,status TEXT,revision INTEGER,updated_at TEXT,updated_by TEXT);
CREATE TABLE evrp_risk_history(id TEXT,risk_id TEXT,revision INTEGER,snapshot TEXT,saved_at TEXT,saved_by TEXT);
CREATE TABLE evrp_actions(id TEXT PRIMARY KEY,unit_code TEXT,risk_id TEXT,data TEXT,revision INTEGER,updated_at TEXT,updated_by TEXT);
CREATE TABLE evrp_action_history(id TEXT,action_id TEXT,revision INTEGER,snapshot TEXT,saved_at TEXT,saved_by TEXT);
INSERT INTO evrp_units VALUES('UT1');INSERT INTO epi_products(code,quantity,revision,catalog_status,updated_at) VALUES('EPI1',3,1,'Actif','');`);
  const records=await import(pathToFileURL(path.join(dir,'records-route.mjs'))),evrp=await import(pathToFileURL(path.join(dir,'evrp-route.mjs'))),{blank}=await import(pathToFileURL(path.join(dir,'workflows.mjs'))),{serviceHref}=await import(pathToFileURL(path.join(dir,'navigation.mjs')));
  const post=(handler,body)=>handler.POST(new Request('https://example.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const base={...blank,title:'Vérifier une protection',details:{measure:'Contrôler'}};
  const created=await post(records,base);assert.equal(created.status,200);const {id}=await created.json();
  beforeBatch=()=>sqlite.prepare('UPDATE records SET revision=2 WHERE id=?').run(id);
  assert.equal((await post(records,{...base,id,revision:1,title:'Modification concurrente'})).status,409);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM record_history').get().n,0,'Un conflit QSE ne doit pas créer un historique');
  assert.equal((await post(records,{...base,id,revision:2,title:'Modification valide'})).status,200);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM record_history').get().n,1);
  for(const kind of ['risk','action']){
    const data=kind==='risk'?{unitCode:'UT1',factor:'Chute',risk:'Blessure',f:null,g:null,im:null,detection:null}:{unitCode:'UT1',description:'Poser une protection',status:'À définir'};
    const created=await post(evrp,{action:kind,data});assert.equal(created.status,200);const {id}=await created.json();const table=kind==='risk'?'evrp_risks':'evrp_actions',history=kind==='risk'?'evrp_risk_history':'evrp_action_history';
    beforeBatch=()=>sqlite.prepare('UPDATE '+table+' SET revision=2 WHERE id=?').run(id);
    assert.equal((await post(evrp,{action:kind,id,revision:1,data})).status,409);
    assert.equal(sqlite.prepare('SELECT count(*) n FROM '+history).get().n,0,'Un conflit EVRP ne doit pas créer un historique');
    assert.equal((await post(evrp,{action:kind,id,revision:2,data})).status,200);
    assert.equal(sqlite.prepare('SELECT count(*) n FROM '+history).get().n,1);
  }
  sqlite.exec("CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT);INSERT INTO users VALUES('pilot-a','Alex Martin'),('pilot-b','Alex Martin');");
  const assigned=await post(records,{...base,owner:'Texte erroné',details:{...base.details,ownerId:'pilot-b'}});assert.equal(assigned.status,200);const assignedId=(await assigned.json()).id;
  const saved=sqlite.prepare('SELECT owner,details FROM records WHERE id=?').get(assignedId);assert.equal(saved.owner,'Alex Martin');assert.equal(JSON.parse(saved.details).ownerId,'pilot-b');
  assert.equal((await post(records,{...base,details:{...base.details,ownerId:'unknown'}})).status,400);
  const namedAction={unitCode:'UT1',description:'Contrôle nominatif',status:'À définir',ownerId:'pilot-b',owner:'Texte erroné'};
  const assignment=await post(evrp,{action:'action',data:namedAction});assert.equal(assignment.status,200);const assignmentId=(await assignment.json()).id;
  const namedSaved=JSON.parse(sqlite.prepare('SELECT data FROM evrp_actions WHERE id=?').get(assignmentId).data);assert.equal(namedSaved.ownerId,'pilot-b');assert.equal(namedSaved.owner,'Alex Martin');
  assert.equal((await post(evrp,{action:'action',data:{...namedAction,ownerId:'unknown'}})).status,400);
  assert.equal((await post(evrp,{action:'action',id:assignmentId,revision:1,data:{...namedAction,ownerId:'',owner:'Service QSSE'}})).status,200);
  assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM evrp_actions WHERE id=?').get(assignmentId).data).ownerId,'');
  console.log('Affectations QSE/EVRP : identifiant persistant, homonymes, libellé canonique, compte inconnu et retrait du rattachement vérifiés.');
  const engaged={unitCode:'UT1',description:'Contrôler la protection',status:'En cours'};
  assert.equal((await post(evrp,{action:'action',data:engaged})).status,400,'Une action engagée exige un pilote et une échéance');
  assert.equal((await post(evrp,{action:'action',data:{...engaged,owner:'QSSE',due:'2026-01-01',start:'2026-02-01'}})).status,400,'Le début doit précéder l’échéance');
  assert.equal((await post(evrp,{action:'action',data:{...engaged,owner:'QSSE',due:'2026-12-01'}})).status,200);
  const dotation={...blank,kind:'EPI',title:'Lunettes',domain:'Sécurité',status:'En service',owner:'QSSE',details:{equipment:'Lunettes',reference:'EPI1',quantity:'2',assignee:'Atelier',date:'2026-01-01'}};
  const issued=await post(records,dotation);assert.equal(issued.status,200);const issuedId=(await issued.json()).id;
  assert.equal(sqlite.prepare('SELECT quantity FROM epi_products').get().quantity,1);
  assert.equal((await post(records,{...dotation,id:issuedId,revision:1})).status,200);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM epi_movements').get().n,1,'Une modification ne doit pas débiter à nouveau');
  assert.equal((await post(records,dotation)).status,409,'Une remise supérieure au solde doit être refusée');
  assert.equal(serviceHref('/tickets?new=1','qsse'),'/tickets?new=1&team=qsse');
  assert.equal(serviceHref('/routines?team=qsse&date=2026-01-01','production'),'/routines?team=production&date=2026-01-01');
  assert.equal(serviceHref('/tickets?team=qsse&id=123',''),'/tickets?id=123');
  console.log('Conflits QSE/EVRP, remise EPI unique, solde insuffisant et liens de service vérifiés.');
}finally{sqlite.close();delete globalThis.auditDatabase;fs.rmSync(dir,{recursive:true,force:true})}
