import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const [filename]=process.argv.slice(2),dir=process.env.POLYTECHS_DATA_DIR;
if(!filename||!dir)throw Error('Usage: POLYTECHS_DATA_DIR=/persistent/path node scripts/render-import.mjs export.json');
const source=JSON.parse(readFileSync(filename,'utf8'));
if(!Array.isArray(source.tables))throw Error('Invalid export');
const db=new DatabaseSync(resolve(dir,'polytechs.sqlite'));
const protectedTables=new Set(['render_schema_migrations','sessions','site_identities','login_attempts','security_limits','auth_challenges']);
const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x=>x.name));
const checkName=name=>typeof name==='string'&&/^[a-z_][a-z0-9_]*$/.test(name)&&tables.has(name)&&!protectedTables.has(name);
if(source.tables.some(x=>!checkName(x.name)||!Array.isArray(x.rows)||!Array.isArray(x.columns)||x.columns.some(c=>typeof c!=='string'||!/^[a-z_][a-z0-9_]*$/.test(c))))throw Error('Invalid table or column name');
// Earlier Site exports predate additive tables introduced by later migrations.
// Only explicitly approved newer tables may be absent from the export, and only
// when they are empty on the destination. We never replace existing data.
// Keep the allowlist explicit: a genuinely missing business table must still
// reject the import instead of silently losing its data.
const budgetTables=['qsse_budget_owner','qsse_budget_data','qsse_budget_history','qsse_budget_import'];
const legacyBudget=budgetTables.every(name=>!source.tables.some(table=>table.name===name));
const newerOptionalTables=[
 'team_invitations','hub_run_history','record_deletions',
 'epi_photos','epi_managers','epi_product_edits',
 'prevention_invites','prevention_files','prevention_urgent_reviews',
 'member_function_roles','notification_receipts','ticket_labels',
 'ticket_import_reversals',
 'hr_people','hr_authorizations','hr_authorization_files','hr_authorization_events',
 'env_consumption_records','env_consumption_history',
 ...(legacyBudget ? budgetTables : [])
];
// Migration 0029 creates seven built-in labels. They are configuration defaults,
// not user edits, and must remain available after importing a pre-label backup.
const defaultLabels=new Map([
 ['env-waste',['topic','Environnement','Déchets','dechets']],
 ['env-water',['topic','Environnement','Eau','eau']],
 ['env-air',['topic','Environnement','Air','air']],
 ['env-spill',['topic','Environnement','Déversement accidentel','deversement accidentel']],
 ['place-site-1',['location','','Site 1','site 1']],
 ['place-site-2',['location','','Site 2','site 2']],
 ['place-maris-51',['location','','MARIS 51','maris 51']]
]);
for(const name of newerOptionalTables){
 if(tables.has(name)&&!source.tables.some(t=>t.name===name)){
  const columns=db.prepare(`PRAGMA table_info("${name}")`).all().map(c=>c.name);
  let rows=[];
  if(db.prepare(`SELECT count(*) n FROM "${name}"`).get().n){
   if(name!=='ticket_labels')throw Error(`Target contains ${name}; import refused`);
   rows=db.prepare('SELECT * FROM "ticket_labels"').all();
   const defaultOnly=rows.length===defaultLabels.size&&rows.every(row=>{
    const expected=defaultLabels.get(row.id);
    return expected&&row.created_by===null&&
      [row.kind,row.category,row.name,row.name_key].every((value,i)=>value===expected[i]);
   });
   if(!defaultOnly)throw Error('Target contains custom ticket labels; import refused');
  }
  source.tables.push({name,columns,rows});
 }
}
if(new Set(source.tables.map(t=>t.name)).size!==source.tables.length)throw Error('Duplicate tables in export');
if(source.tables.length!==tables.size-protectedTables.size)throw Error('Incomplete export: expected all persistent tables');
const business=['hub_tickets','evrp_risks','ged_documents'];
if(business.some(t=>db.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n!==0))throw Error('Target already contains business data; import refused');
const existingUsers=db.prepare('SELECT username,email FROM users').all();
const expectedEmail=process.env.RENDER_INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const expectedUsername=process.env.RENDER_INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
if(existingUsers.length>1||existingUsers.length===1&&!(expectedEmail&&existingUsers[0].email?.trim().toLowerCase()===expectedEmail||expectedUsername&&existingUsers[0].username===expectedUsername))throw Error('Unexpected account on target; import refused');
db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
try{
  for(const {name,columns,rows} of source.tables){
    const schema=new Set(db.prepare(`PRAGMA table_info("${name}")`).all().map(x=>x.name));
    if(columns.some(c=>!schema.has(c)))throw Error(`Schema mismatch: ${name}`);
    db.exec(`DELETE FROM "${name}"`);
    const statement=db.prepare(`INSERT INTO "${name}" (${columns.map(c=>`"${c}"`).join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
    for(const row of rows)statement.run(...columns.map(c=>row[c]??null));
    if(db.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n!==rows.length)throw Error(`Count mismatch: ${name}`);
  }
  if(legacyBudget){
    // Apply the ownership rule from migration 0036 after restoring the users.
    db.exec(`INSERT INTO qsse_budget_owner
      SELECT 1,id FROM users WHERE lower(trim(email))='karine.connan@polytechs.fr'
      AND role IN ('editor','admin') AND
      (SELECT count(*) FROM users WHERE lower(trim(email))='karine.connan@polytechs.fr')=1;
      INSERT INTO member_function_roles
      SELECT user_id,'budget_manager',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM qsse_budget_owner;`);
  }
  const failures=db.prepare('PRAGMA foreign_key_check').all();
  if(failures.length)throw Error(`${failures.length} foreign-key violations`);
  db.exec('COMMIT');
}catch(error){db.exec('ROLLBACK');throw error}
finally{db.exec('PRAGMA foreign_keys=ON');db.close()}
console.log('Imported',source.tables.reduce((n,t)=>n+t.rows.length,0),'persistent rows');
