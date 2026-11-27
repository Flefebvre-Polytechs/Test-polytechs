import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const dir=await mkdtemp(join(tmpdir(),'polytechs-competences-test-'));
const db=new DatabaseSync(':memory:');

function prepare(sql,values=[]) {
  return {
    bind(...args){return prepare(sql,args)},
    async first(){return db.prepare(sql).get(...values)??null},
    async all(){return {results:db.prepare(sql).all(...values)}},
    async run(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}}},
  };
}

globalThis.competenceDb={prepare};
const manager={id:'manager',displayName:'Responsable Fabrication',role:'editor'};
const admin={id:'admin',displayName:'Administratrice',role:'admin'};
globalThis.competenceUser=manager;

try {
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT NOT NULL);
    INSERT INTO users VALUES ('manager','Responsable Fabrication'),('admin','Administratrice'),
      ('m1','Alex Terrain'),('m2','Camille Atelier'),('rh1','Personne RH');
    CREATE TABLE teams(id TEXT PRIMARY KEY,name TEXT,rank INTEGER);
    INSERT INTO teams VALUES ('production','Fabrication',2),('rh','Ressources humaines',2);
    CREATE TABLE team_members(team_id TEXT,user_id TEXT,level TEXT,PRIMARY KEY(team_id,user_id));
    INSERT INTO team_members VALUES ('production','manager','team_admin'),('production','m1','user'),
      ('production','m2','viewer'),('rh','manager','contributor'),('rh','rh1','user');
    CREATE TABLE team_access(team_id TEXT,restricted INTEGER);
    INSERT INTO team_access VALUES ('production',0),('rh',1);`);
  db.exec(await readFile('drizzle/0051_competences.sql','utf8'));
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
  assert.equal((await get({team:'rh'})).status,403);
  assert.equal((await search('mélange','rh')).status,403);
  assert.equal((await post({action:'person',name:'Test'},'https://other.test')).status,403);
  const newSkill={action:'skill',name:'Réglage du mélangeur',family:'Conduite de ligne',target:2};
  const {skill}=await successfully(post(newSkill));
  assert.equal(skill.revision,1);
  assert.equal((await post({...newSkill,name:'REGLAGE du melangeur'})).status,409);
  assert.equal((await post({...newSkill,name:'Nouvelle cible',target:0})).status,400);
  const edited=await successfully(post({...newSkill,id:skill.id,revision:skill.revision,target:3}));
  assert.equal(edited.skill.target,3);
  assert.equal((await post({...newSkill,id:skill.id,revision:skill.revision})).status,409);

  const {person}=await successfully(post({action:'person',name:'Noa Mélange'}));
  assert.equal(person.userId,null);
  assert.equal((await post({action:'person',name:'Noa Melange'})).status,409);
  assert.equal((await post({action:'person',name:'Alex Terrain'})).status,409);
  assert.equal((await post({action:'person',teamId:'rh',name:'Équipe extérieure'})).status,403);

  const evaluation={action:'assessment',skillId:skill.id,personId:'user:m1',level:'L',revision:0};
  const {assessment:first}=await successfully(post(evaluation));
  assert.equal(first.assessedBy,manager.displayName);
  assert.equal((await successfully(search('melangeur'))).relays.length,0);
  assert.equal((await post({...evaluation,personId:'user:rh1'})).status,409);
  assert.equal((await post({...evaluation,level:'O'})).status,400);
  assert.equal((await post({...evaluation,level:'U'})).status,409);
  await successfully(post({...evaluation,revision:first.revision,level:'U'}));
  await successfully(post({...evaluation,personId:person.id,level:'U'}));
  assert.deepEqual((await successfully(search('MELANGEUR'))).relays.map(relay=>relay.name),['Alex Terrain','Noa Mélange']);
  const exact=await successfully(get({view:'search',skill:skill.id,team:'production'}));
  assert.deepEqual(exact.relays.map(relay=>relay.skillId),[skill.id,skill.id]);
  assert.ok(exact.relays.every(relay=>!('assessedBy' in relay)));
  await successfully(post({action:'person-status',id:person.id,revision:1,active:false}));
  assert.equal((await successfully(search('Conduite'))).relays.length,1);
  assert.equal((await post({...evaluation,personId:person.id,revision:1})).status,409);
  await successfully(post({action:'person-status',id:person.id,revision:2,active:true}));
  assert.equal((await successfully(search('Conduite'))).relays.length,2);

  globalThis.competenceUser=admin;
  const {skill:rhSkill}=await successfully(post({...newSkill,teamId:'rh'}));
  await successfully(post({...evaluation,teamId:'rh',skillId:rhSkill.id,personId:'user:rh1',level:'U'}));
  assert.equal((await successfully(search('mélangeur'))).relays.length,3);

  globalThis.competenceUser=manager;
  assert.equal((await successfully(search('mélangeur'))).relays.some(relay=>relay.teamId==='rh'),false);
  assert.equal((await post({...evaluation,skillId:rhSkill.id,level:'U',revision:2})).status,409);
  await successfully(post({...evaluation,revision:2,level:''}));
  assert.deepEqual((await successfully(search('mélangeur'))).relays.map(relay=>relay.personId),[person.id]);

  db.prepare("UPDATE team_members SET level='contributor' WHERE user_id='manager' AND team_id='production'").run();
  assert.equal((await get()).status,403);
  assert.equal((await search('mélangeur')).status,403);
  assert.equal((await post(newSkill)).status,403);
  globalThis.competenceUser={...manager,role:'reader'};
  assert.equal((await get()).status,403);
  globalThis.competenceUser=null;
  assert.equal((await get()).status,401);
  console.log('Compétences: équipe, niveaux I/L/U, effectif, recherche de relais et isolation RH validés.');
} finally {
  db.close();
  await rm(dir,{recursive:true,force:true});
}
