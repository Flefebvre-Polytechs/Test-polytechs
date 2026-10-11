import {mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync,randomBytes,randomUUID} from 'node:crypto';

const dir=process.env.POLYTECHS_DATA_DIR;
if(!dir)throw Error('POLYTECHS_DATA_DIR must point to a persistent disk.');
await mkdir(dir,{recursive:true});
const db=new DatabaseSync(resolve(dir,'polytechs.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS render_schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
for(const name of (await readdir('drizzle')).filter(x=>/^\d{4}_.+\.sql$/.test(x)).sort()){
  if(db.prepare('SELECT 1 FROM render_schema_migrations WHERE name=?').get(name))continue;
  const sql=await readFile(join('drizzle',name),'utf8');
  db.exec('BEGIN IMMEDIATE');
  try{db.exec(sql);db.prepare('INSERT INTO render_schema_migrations VALUES (?,?)').run(name,new Date().toISOString());db.exec('COMMIT')}
  catch(error){db.exec('ROLLBACK');throw Error(`Migration ${name} failed`,{cause:error})}
  console.log('Applied',name);
}
const count=db.prepare('SELECT count(*) AS n FROM users').get().n;
if(count===0){
  const username=process.env.RENDER_INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
  const password=process.env.RENDER_INITIAL_ADMIN_PASSWORD;
  if(!username||!password||!/^[a-z0-9._-]{3,40}$/.test(username)||password.length<16)throw Error('First start requires RENDER_INITIAL_ADMIN_USERNAME and a password of at least 16 characters.');
  const salt=randomBytes(16),hash=pbkdf2Sync(password,salt,600000,32,'sha256');
  db.prepare('INSERT INTO users(id,username,display_name,role,password_hash,must_change_password,created_at) VALUES (?,?,?,?,?,1,?)').run(randomUUID(),username,username,'admin',`pbkdf2:600000:${salt.toString('hex')}:${hash.toString('hex')}`,new Date().toISOString());
  console.log('Initial administrator created; change the password on first login.');
}
db.close();
