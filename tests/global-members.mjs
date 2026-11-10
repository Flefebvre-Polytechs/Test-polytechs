import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-global-members-')),db=new DatabaseSync(':memory:');
function statement(sql,args=[]){return {bind(...v){return statement(sql,v)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.membersDb={prepare:statement,async batch(ss){db.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of ss)out.push(await s.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
function compile(name,file){let s=fs.readFileSync(file,'utf8');for(const [a,b] of [['@/lib/function-roles','./function-roles.mjs'],['./function-roles','./function-roles.mjs'],['./function-role-labels','./function-role-labels.mjs'],['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/security-mail','./security-mail.mjs'],['@/lib/team-access','./team-access.mjs'],['./auth-config','./config.mjs']])s=s.replaceAll("'"+a+"'","'"+b+"'");fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
try{
 fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),'dir');fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.membersDb;');fs.writeFileSync(path.join(dir,'config.mjs'),'export const trustSiteIdentity=()=>false;');
 for(const f of fs.readdirSync('drizzle').filter(f=>/^\d{4}_.+\.sql$/.test(f)).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 for(const [name,file] of [['function-role-labels','lib/function-role-labels.ts'],['function-roles','lib/function-roles.ts'],['access','lib/access.ts'],['security-mail','lib/security-mail.ts'],['team-access','lib/team-access.ts'],['users','app/api/users/route.ts'],['teams','app/api/team-access/route.ts']])compile(name,file);
 const access=await import(path.join(dir,'access.mjs')),users=await import(path.join(dir,'users.mjs')),teams=await import(path.join(dir,'teams.mjs'));const cookies={};
 for(const [id,role] of [['admin','admin'],['other-admin','admin'],['lead','editor'],['reader','reader']]){db.prepare('INSERT INTO users(id,username,display_name,role,password_hash,must_change_password,created_at,email) VALUES(?,?,?,?,?,0,?,?)').run(id,id,id,role,'fixture-session-only','2026-11-02',id+'@example.test');cookies[id]=(await access.issueSession(id,true)).split(';')[0]}
 db.prepare('INSERT INTO teams(id,name,rank) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run('rh','Ressources humaines',2);db.prepare('INSERT INTO teams(id,name,rank) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run('production','Production',2);db.prepare('INSERT INTO team_members(team_id,user_id,level) VALUES(?,?,?)').run('production','lead','team_admin');
 const req=(cookie,origin='https://example.test')=>new Request('https://example.test/api/users',{headers:{cookie:cookie||'',origin}});
 const post=(body,who='admin',api=users,origin='https://example.test')=>api.POST(new Request('https://example.test/api/users',{method:'POST',headers:{origin,'Content-Type':'application/json',cookie:cookies[who]||''},body:JSON.stringify(body)}));
 assert.equal((await users.GET(req())).status,401);for(const id of ['lead','reader']){assert.equal((await users.GET(req(cookies[id]))).status,403);assert.equal((await post({action:'name',id:'reader',displayName:'Changed',expectedName:'reader'},id)).status,403);assert.equal((await post({action:'revoke-sessions',id:'admin'},id)).status,403)}
 db.prepare('INSERT INTO user_profiles(user_id,photo_key,photo_mime,photo_updated_at) VALUES(?,?,?,?)').run('lead','profiles/lead/photo','image/jpeg','2026-11-02T11:00:00.000Z');
 const listing=await (await users.GET(req(cookies.admin))).json();assert.equal(listing.users.length,4);assert.ok(listing.users.every(u=>u.email&&!('password_hash' in u)&&!('photo_key' in u)));
 assert.equal(listing.users.find(u=>u.id==='lead').photo_updated_at,'2026-11-02T11:00:00.000Z');assert.equal(listing.users.find(u=>u.id==='reader').photo_updated_at,null,'No image request is necessary for a member without a photo');
 const allTeams=await (await teams.GET(req(cookies.admin))).json();assert.ok(allTeams.teams.length>=2);assert.ok(allTeams.users.some(u=>u.id==='reader'),'Global management includes people with no team');assert.equal(allTeams.users.find(u=>u.id==='lead').photo_updated_at,'2026-11-02T11:00:00.000Z');assert.equal(allTeams.users.find(u=>u.id==='reader').photo_updated_at,null);
 const budgetGrant={action:'function-role',functionRole:'budget_manager',enabled:true,expected:false};
 for(const id of ['lead','other-admin'])assert.equal((await post({...budgetGrant,id})).status,200);
 assert.equal((await post({...budgetGrant,id:'reader'})).status,400);
 assert.equal((await post({...budgetGrant,id:'lead',enabled:false,expected:true})).status,200);
 const cseGrant={action:'function-role',id:'reader',functionRole:'cse_representative',enabled:true,expected:false};
 assert.equal((await post(cseGrant,'lead')).status,403);
 assert.equal((await post(cseGrant)).status,200,'An elected CSE member may keep their global reader role');
 assert.ok(JSON.parse((await (await users.GET(req(cookies.admin))).json()).users.find(u=>u.id==='reader').function_roles).includes('cse_representative'));
 assert.equal((await post({...cseGrant,enabled:false,expected:true})).status,200,'CSE mandate can be revoked independently');
 const functionGrant={action:'function-role',id:'lead',functionRole:'pdp_manager',enabled:true,expected:false};
 assert.equal((await post(functionGrant,'lead')).status,403,'A team administrator cannot assign global functional roles');
 assert.equal((await post({...functionGrant,id:'reader'})).status,400,'Reader cannot receive an active functional role');
 assert.equal((await post({...functionGrant,functionRole:'__proto__'})).status,400);
 assert.equal((await post(functionGrant)).status,200);
 let functionalListing=await (await users.GET(req(cookies.admin))).json();assert.ok(JSON.parse(functionalListing.users.find(u=>u.id==='lead').function_roles).includes('pdp_manager'));
 assert.equal((await post(functionGrant)).status,409,'Stale grant rejected');
 assert.equal((await post({...functionGrant,enabled:false,expected:true})).status,200);
 assert.equal((await post({...functionGrant,functionRole:'hsee_approver',id:'other-admin'})).status,200,'Global admins also need an explicit HSEE assignment');
 const created=await (await post({action:'create',displayName:'Nouvelle personne',email:'nouvelle@example.test',password:'AnInitialPasswordWithEnoughLength',role:'reader'})).json();assert.ok(created.id,'Create returns the stable account ID so the UI can open service assignment');assert.equal(db.prepare('SELECT email FROM users WHERE id=?').get(created.id).email,'nouvelle@example.test');assert.equal((await post({action:'member',teamId:'rh',userId:created.id,level:'viewer',expectedLevel:'none'},'admin',teams)).status,200,'A newly created person can be assigned without a second search');
 assert.equal((await post({action:'name',id:'reader',displayName:'Lecteur Polytechs',expectedName:'reader'},'admin',users,'https://evil.test')).status,403);
 assert.equal((await post({action:'name',id:'reader',displayName:'Lecteur Polytechs',expectedName:'stale'})).status,409);assert.equal((await post({action:'name',id:'reader',displayName:'Lecteur Polytechs',expectedName:'reader'})).status,200);
 assert.equal((await post({action:'role',id:'admin',role:'reader',expectedRole:'admin'})).status,400);
 assert.equal((await post({action:'role',id:'reader',role:'editor',expectedRole:'admin'})).status,409);
 assert.equal((await post({action:'role',id:'reader',role:'editor',expectedRole:'reader'})).status,200);assert.equal(await access.currentUser(req(cookies.reader)),null,'Global role change revokes target sessions');assert.equal(db.prepare("SELECT role FROM users WHERE id='lead'").get().role,'editor');
 assert.equal((await post({action:'member',teamId:'rh',userId:'reader',level:'user',expectedLevel:'none'},'admin',teams)).status,200);assert.equal(db.prepare("SELECT level FROM team_members WHERE user_id='reader' AND team_id='rh'").get().level,'user');assert.equal((await post({action:'member',teamId:'rh',userId:'reader',level:'viewer',expectedLevel:'none'},'admin',teams)).status,409);
 assert.equal((await post({action:'member',teamId:'rh',userId:'reader',level:'none',expectedLevel:'user'},'admin',teams)).status,200);assert.equal((await post({action:'restrict',teamId:'rh',restricted:false},'admin',teams)).status,403);
 assert.equal((await post({action:'revoke-sessions',id:'lead'})).status,200);assert.equal(await access.currentUser(req(cookies.lead)),null);assert.ok(await access.currentUser(req(cookies.admin)));
 assert.equal((await post({action:'revoke-sessions',id:'does-not-exist'})).status,404);
 assert.equal((await post({action:'role',id:'other-admin',role:'reader',expectedRole:'admin'})).status,200);assert.equal(db.prepare("SELECT count(*) n FROM users WHERE role='admin'").get().n,1);assert.equal(db.prepare("SELECT count(*) n FROM member_function_roles WHERE user_id='other-admin'").get().n,0,'Downgrading to reader revokes functional roles');assert.equal((await post({action:'role',id:'admin',role:'reader'},'other-admin')).status,401);
 assert.equal(db.prepare("SELECT count(*) n FROM security_events WHERE action='user_name_changed'").get().n,1);assert.equal(db.prepare("SELECT count(*) n FROM security_events WHERE action='user_sessions_revoked'").get().n,1);
 console.log('Global members: all-account inventory, unassigned users, global-admin-only API, team-admin refusal, CSRF, concurrent names and roles, self/last-admin protection, session revocation, multi-service assignments, stale permissions, RH confidentiality and audit events passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});delete globalThis.membersDb;}
