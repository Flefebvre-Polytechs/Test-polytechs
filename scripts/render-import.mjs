import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const [filename]=process.argv.slice(2),dir=process.env.POLYTECHS_DATA_DIR;
if(!filename||!dir)throw Error('Usage: POLYTECHS_DATA_DIR=/persistent/path node scripts/render-import.mjs export.json');
const source=JSON.parse(readFileSync(filename,'utf8'));
if(!Array.isArray(source.tables))throw Error('Invalid export');
const db=new DatabaseSync(resolve(dir,'polytechs.sqlite'));
const protectedTables=new Set(['render_schema_migrations','sessions','site_identities','login_attempts','security_limits']);
const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x=>x.name));
const checkName=name=>typeof name==='string'&&/^[a-z_][a-z0-9_]*$/.test(name)&&tables.has(name)&&!protectedTables.has(name);
if(source.tables.some(x=>!checkName(x.name)||!Array.isArray(x.rows)||!Array.isArray(x.columns)||x.columns.some(c=>typeof c!=='string'||!/^[a-z_][a-z0-9_]*$/.test(c))))throw Error('Invalid table or column name');
// Older Sites exports predate invitations. An empty additive table can be restored
// safely on a fresh target; pending invitations must never be overwritten.
for(const name of ['team_invitations','hub_run_history']){
 if(tables.has(name)&&!source.tables.some(t=>t.name===name)){
  if(db.prepare(`SELECT count(*) n FROM "${name}"`).get().n)throw Error(`Target contains ${name}; import refused`);
  source.tables.push({name,columns:db.prepare(`PRAGMA table_info("${name}")`).all().map(c=>c.name),rows:[]});
 }
}
if(new Set(source.tables.map(t=>t.name)).size!==source.tables.length)throw Error('Duplicate tables in export');
if(source.tables.length!==tables.size-protectedTables.size)throw Error('Incomplete export: expected all persistent tables');
const business=['hub_tickets','evrp_risks','ged_documents'];
if(business.some(t=>db.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n!==0))throw Error('Target already contains business data; import refused');
const existingUsers=db.prepare('SELECT username FROM users').all();
if(existingUsers.length>1||existingUsers.length===1&&existingUsers[0].username!==process.env.RENDER_INITIAL_ADMIN_USERNAME?.trim().toLowerCase())throw Error('Unexpected account on target; import refused');
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
  const failures=db.prepare('PRAGMA foreign_key_check').all();
  if(failures.length)throw Error(`${failures.length} foreign-key violations`);
  db.exec('COMMIT');
}catch(error){db.exec('ROLLBACK');throw error}
finally{db.exec('PRAGMA foreign_keys=ON');db.close()}
console.log('Imported',source.tables.reduce((n,t)=>n+t.rows.length,0),'persistent rows');
