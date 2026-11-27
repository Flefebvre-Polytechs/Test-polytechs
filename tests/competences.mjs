import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {migrateCompetenceLibrary} from '../scripts/competence-library-migration.mjs';

const dir=await mkdtemp(join(tmpdir(),'polytechs-competences-test-'));
const db=new DatabaseSync(':memory:');

function prepare(sql,values=[]) {
  return {
    sql,values,
    bind(...args){return prepare(sql,args)},
    async first(){return db.prepare(sql).get(...values)??null},
    async all(){return {results:db.prepare(sql).all(...values)}},
    async run(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}}},
  };
}

globalThis.competenceDb={prepare,async batch(statements){
  db.exec('BEGIN IMMEDIATE');
  try {
    const results=statements.map(({sql,values})=>({meta:{changes:Number(db.prepare(sql).run(...values).changes)}}));
    db.exec('COMMIT');
    return results;
  }catch(error){db.exec('ROLLBACK');throw error;}
}};
const manager={id:'manager',displayName:'Responsable Fabrication',role:'editor'};
const admin={id:'admin',displayName:'Administratrice',role:'admin'};
globalThis.competenceUser=manager;

try {
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT NOT NULL);
    INSERT INTO users VALUES ('manager','Responsable Fabrication'),('admin','Administratrice'),
      ('m1','Alex Terrain'),('m2','Camille Atelier'),('rh1','Personne RH');
    CREATE TABLE teams(id TEXT PRIMARY KEY,name TEXT,rank INTEGER);
    INSERT INTO teams VALUES ('production','Fabrication',2),('maintenance','Maintenance',2),('rh','Ressources humaines',2);
    CREATE TABLE team_members(team_id TEXT,user_id TEXT,level TEXT,PRIMARY KEY(team_id,user_id));
    INSERT INTO team_members VALUES ('production','manager','team_admin'),('production','m1','user'),
      ('production','m2','viewer'),('maintenance','m2','user'),('rh','manager','contributor'),('rh','rh1','user');
    CREATE TABLE team_access(team_id TEXT,restricted INTEGER);
    INSERT INTO team_access VALUES ('production',0),('rh',1);`);
  db.exec(await readFile('drizzle/0051_competences.sql','utf8'));
  db.exec(`INSERT INTO competence_skills (id,team_id,name,name_key,family,target,revision) VALUES
    ('legacy-fab','production','Contrôle visuel','controle visuel','Contrôle qualité',2,3),
    ('legacy-maint','maintenance','Controle visuel','controle visuel','CONTROLE QUALITÉ',4,1),
    ('legacy-rh','rh','Contrôle visuel','controle visuel','Accueil',1,1);
    INSERT INTO competence_assessments (team_id,skill_id,person_id,level,revision,assessed_at,assessed_by) VALUES
    ('production','legacy-fab','user:m1','U',3,'2026-11-23T11:10:00.000Z','manager'),
    ('maintenance','legacy-maint','user:m1','',2,'2026-11-24T11:10:00.000Z','admin'),
    ('production','legacy-fab','user:m2','U',1,'2026-11-23T11:10:00.000Z','manager'),
    ('maintenance','legacy-maint','user:m2','L',1,'2026-11-25T11:10:00.000Z','admin');`);
  db.exec(await readFile('drizzle/0052_competence_library.sql','utf8'));
  migrateCompetenceLibrary(db);
  assert.equal(db.prepare('SELECT count(*) AS n FROM competence_assessments').get().n,4);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  await writeFile(join(dir,'raw.mjs'),'export const database=()=>globalThis.competenceDb;');
  await writeFile(join(dir,'access.mjs'),`
    export const checkOrigin=req=>req.headers.get('origin')==='https://matrix.test';
    export const requireRole=async()=>!globalThis.competenceUser?{error:Response.json({}, {status:401})}
      :globalThis.competenceUser.role==='reader'?{error:Response.json({}, {status:403})}:{user:globalThis.competenceUser};
  `);
  for(const [file,output] of [
    ['app/api/competences/route.ts','route'],['lib/team-access.ts','team-access'],
    ['lib/competences.ts','competences'],['lib/hub.ts','hub'],
  ]){
    const source=(await readFile(file,'utf8')).replaceAll(/'@\/(?:lib|db)\/([a-z-]+)'/g,"'./$1.mjs'");
    await writeFile(join(dir,output+'.mjs'),ts.transpileModule(source,{
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
    }).outputText);
  }
  const api=await import(join(dir,'route.mjs'));
  const get=(params={})=>api.GET(new Request('https://matrix.test/api/competences?'+new URLSearchParams(params)));
  const post=(body,origin='https://matrix.test')=>api.POST(new Request('https://matrix.test/api/competences',{
    method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({teamId:'production',...body}),
  }));
  const search=(term,team)=>get({view:'search',q:term,...(team&&{team})});
  const profile=(id,team='production')=>get({view:'person',person:id,team});
  async function successfully(responsePromise) {
    const response=await responsePromise;
    const data=await response.json();
    assert.equal(response.status,200,JSON.stringify(data));
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    return data;
  }

  const matrix=await successfully(get());
  assert.deepEqual(matrix.teams.map(team=>team.id),['production']);
  assert.equal(matrix.teamId,'production');
  assert.deepEqual(matrix.people.map(person=>person.id),['user:m1','user:m2','user:manager']);
  assert.equal(matrix.canEditLibrary,false);
  assert.deepEqual(matrix.library.map(skill=>skill.id).sort(),['legacy-fab','legacy-rh']);
  assert.deepEqual(matrix.skills.map(skill=>[skill.id,skill.target,skill.revision]),[['legacy-fab',2,3]]);
  assert.deepEqual(matrix.assessments.map(({personId,level})=>[personId,level]).sort(),[['user:m1','U'],['user:m2','L']]);
  assert.equal(matrix.assessments.find(a=>a.personId==='user:m2').assessedBy,null);
  assert.equal((await get({team:'rh'})).status,403);
  assert.equal((await search('mélange','rh')).status,403);
  assert.equal((await post({action:'person',name:'Test'},'https://other.test')).status,403);
  const newSkill={action:'library-skill',name:'Réglage du mélangeur',family:'Conduite de ligne',target:2};
  const {id:skillId}=await successfully(post(newSkill));
  assert.equal((await post({...newSkill,name:'REGLAGE du melangeur',family:'Conduite de LIGNE'})).status,409);
  assert.equal((await post({...newSkill,name:'Nouvelle cible',target:0})).status,400);
  assert.equal((await post({...newSkill,id:skillId,revision:1})).status,403);
  const assignment={action:'team-skill',skillId,target:3};
  await successfully(post({...assignment,revision:1}));
  assert.equal((await successfully(get())).skills.find(skill=>skill.id===skillId).target,3);
  assert.equal((await post({...assignment,revision:1})).status,409);
  assert.equal((await post({...assignment,teamId:'maintenance'})).status,403);

  const {id:unassigned}=await successfully(post({...newSkill,name:'Passage de consignes',target:undefined}));
  const unassignedMatrix=await successfully(get());
  assert.equal(unassignedMatrix.library.some(skill=>skill.id===unassigned),true);
  assert.equal(unassignedMatrix.skills.some(skill=>skill.id===unassigned),false);

  const {person}=await successfully(post({action:'person',name:'Noa Mélange'}));
  assert.equal(person.userId,null);
  assert.equal((await post({action:'person',name:'Noa Melange'})).status,409);
  assert.equal((await post({action:'person',name:'Alex Terrain'})).status,409);
  assert.equal((await post({action:'person',teamId:'rh',name:'Équipe extérieure'})).status,403);

  const evaluation={action:'assessment',skillId,personId:'user:m1',level:'L',revision:0};
  const {assessment:first}=await successfully(post(evaluation));
  assert.equal(first.assessedBy,manager.displayName);
  assert.equal((await successfully(search('melangeur'))).relays.length,0);
  assert.equal((await post({...evaluation,personId:'user:rh1'})).status,409);
  assert.equal((await post({...evaluation,skillId:unassigned})).status,409);
  assert.equal((await post({...evaluation,level:'O'})).status,400);
  assert.equal((await post({...evaluation,level:'U'})).status,409);
  await successfully(post({...evaluation,revision:first.revision,level:'U'}));
  await successfully(post({...evaluation,personId:person.id,level:'U'}));
  assert.deepEqual((await successfully(search('MELANGEUR'))).relays.map(relay=>relay.name),['Alex Terrain','Noa Mélange']);
  const exact=await successfully(get({view:'search',skill:skillId,team:'production'}));
  assert.deepEqual(exact.relays.map(relay=>relay.skillId),[skillId,skillId]);
  assert.deepEqual(exact.relays[0].teams,['Fabrication']);
  assert.ok(exact.relays.every(relay=>!('assessedBy' in relay)));
  await successfully(post({action:'person-status',id:person.id,revision:1,active:false}));
  assert.equal((await successfully(search('Conduite'))).relays.length,1);
  assert.equal((await post({...evaluation,personId:person.id,revision:1})).status,409);
  await successfully(post({action:'person-status',id:person.id,revision:2,active:true}));
  assert.equal((await successfully(search('Conduite'))).relays.length,2);
  assert.equal((await profile(person.id,'maintenance')).status,403);
  assert.deepEqual((await successfully(profile('user:rh1'))).skills,[]);
  assert.equal((await post({action:'person-transfer',id:person.id,revision:3,destination:'maintenance'})).status,403);

  await successfully(post({...assignment,revision:2,remove:true}));
  assert.equal((await successfully(profile('user:m1'))).skills.find(skill=>skill.id===skillId).inMatrix,false);
  assert.equal((await successfully(search('mélangeur'))).relays.length,2);
  assert.equal((await post({...evaluation,level:'I',revision:2})).status,409);
  await successfully(post(assignment));
  assert.equal((await successfully(get())).skills.find(skill=>skill.id===skillId).revision,4);
  assert.equal((await successfully(profile('user:m1'))).skills.find(skill=>skill.id===skillId).inMatrix,true);

  globalThis.competenceUser=admin;
  assert.equal((await successfully(get({team:'maintenance'}))).skills.find(skill=>skill.id==='legacy-fab').target,4);
  await successfully(post({...newSkill,name:'Consignes du mélangeur',id:skillId,revision:1}));
  assert.equal((await successfully(get())).library.find(skill=>skill.id===skillId).name,'Consignes du mélangeur');
  await successfully(post({...assignment,teamId:'rh',target:1}));
  await successfully(post({...evaluation,teamId:'rh',personId:'user:rh1',level:'U'}));
  assert.equal((await successfully(search('mélangeur'))).relays.length,3);
  await successfully(post({...evaluation,personId:'user:m2',level:'U'}));
  assert.deepEqual((await successfully(search('mélangeur'))).relays.find(relay=>relay.personId==='user:m2').teams,['Fabrication','Maintenance']);

  globalThis.competenceUser=manager;
  assert.equal((await successfully(search('mélangeur'))).relays.some(relay=>relay.teams.includes('Ressources humaines')),false);
  assert.equal((await post({...evaluation,teamId:'rh',level:'U',revision:2})).status,403);
  await successfully(post({...evaluation,revision:2,level:''}));
  assert.equal((await successfully(profile('user:m1'))).skills.some(skill=>skill.id===skillId),false);
  await successfully(post({...evaluation,revision:3,level:'U'}));

  db.exec(`DELETE FROM team_members WHERE team_id='production' AND user_id='m1';
    INSERT INTO team_members VALUES ('maintenance','m1','user');`);
  assert.equal((await successfully(profile('user:m1'))).skills.length,0);
  assert.equal((await successfully(search('mélangeur'))).relays.some(relay=>relay.personId==='user:m1'),false);
  assert.equal((await post({...evaluation,revision:4,level:'L'})).status,409);

  globalThis.competenceUser=admin;
  const moved=await successfully(profile('user:m1','maintenance'));
  assert.deepEqual(moved.skills.map(skill=>[skill.id,skill.level,skill.inMatrix]).sort(),[['legacy-fab','U',true],[skillId,'U',false]].sort());
  assert.equal((await successfully(search('mélangeur','maintenance'))).relays.some(relay=>relay.personId==='user:m1'),true);
  await successfully(post({...assignment,teamId:'maintenance',target:5}));
  const receive=await successfully(get({team:'maintenance'}));
  assert.equal(receive.skills.find(skill=>skill.id===skillId).target,5);
  assert.equal(receive.assessments.find(item=>item.skillId===skillId&&item.personId==='user:m1').level,'U');
  assert.equal((await post({...evaluation,teamId:'maintenance',level:'I',revision:0})).status,409);
  await successfully(post({...evaluation,teamId:'maintenance',level:'L',revision:4}));
  assert.equal((await successfully(search('mélangeur','maintenance'))).relays.some(relay=>relay.personId==='user:m1'),false);

  const transfer={action:'person-transfer',id:person.id,revision:3,destination:'maintenance'};
  assert.equal((await post({...transfer,revision:2})).status,409);
  await successfully(post(transfer));
  assert.deepEqual((await successfully(profile(person.id))).skills,[]);
  assert.equal((await successfully(profile(person.id,'maintenance'))).skills.find(skill=>skill.id===skillId).level,'U');
  assert.equal((await successfully(search('mélangeur','maintenance'))).relays.some(relay=>relay.personId===person.id),true);
  assert.equal((await post(transfer)).status,409);

  globalThis.competenceUser=manager;

  db.prepare("UPDATE team_members SET level='contributor' WHERE user_id='manager' AND team_id='production'").run();
  assert.equal((await get()).status,403);
  assert.equal((await search('mélangeur')).status,403);
  assert.equal((await post(newSkill)).status,403);
  globalThis.competenceUser={...manager,role:'reader'};
  assert.equal((await get()).status,403);
  globalThis.competenceUser=null;
  assert.equal((await get()).status,401);
  console.log('Compétences: bibliothèque, reprise des évaluations, mobilité, niveaux I/L/U et droits validés.');
} finally {
  db.close();
  await rm(dir,{recursive:true,force:true});
}
