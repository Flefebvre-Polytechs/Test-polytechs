import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';import {execFileSync} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-invitation-upgrade-'));
let db;
try{
 db=new DatabaseSync(path.join(dir,'polytechs.sqlite'));
 const migrations=fs.readdirSync('drizzle').filter(n=>/^\d{4}_.+\.sql$/.test(n)).sort();
 const previous=migrations.filter(n=>n<'0020_');for(const name of previous)db.exec(fs.readFileSync('drizzle/'+name,'utf8'));
 db.prepare('INSERT INTO users(id,username,display_name,role,password_hash,must_change_password,created_at) VALUES(?,?,?,?,?,0,?)').run('existing','bootstrap','Existing administrator','admin','unchanged-test-hash','2026');
 db.exec("CREATE TABLE render_schema_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)");
 for(const name of previous)db.prepare('INSERT INTO render_schema_migrations VALUES(?,?)').run(name,'2026');
 const protectedTables=new Set(['render_schema_migrations','sessions','site_identities','login_attempts','security_limits']);
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name).filter(n=>!protectedTables.has(n));
 const tables=names.map(name=>({name,columns:db.prepare('PRAGMA table_info("'+name+'")').all().map(c=>c.name),rows:db.prepare('SELECT * FROM "'+name+'"').all()}));
 const snapshot=path.join(dir,'old-export.json');fs.writeFileSync(snapshot,JSON.stringify({tables}),{mode:0o600});
 const before=db.prepare('SELECT id,username,role,password_hash FROM users').all();db.close();db=null;
 const env={...process.env,POLYTECHS_DATA_DIR:dir,RENDER_INITIAL_ADMIN_USERNAME:'bootstrap'};
 execFileSync(process.execPath,['scripts/render-migrate.mjs'],{env,stdio:'pipe'});
 execFileSync(process.execPath,['scripts/render-migrate.mjs'],{env,stdio:'pipe'});
 db=new DatabaseSync(path.join(dir,'polytechs.sqlite'));
 assert.deepEqual(db.prepare('SELECT id,username,role,password_hash FROM users').all(),before);
 assert.equal(db.prepare('SELECT email FROM users').get().email,null);
 assert.equal(db.prepare("SELECT count(*) n FROM render_schema_migrations WHERE name='0020_team_invitations.sql'").get().n,1);db.close();db=null;
 execFileSync(process.execPath,['scripts/render-import.mjs',snapshot],{env,stdio:'pipe'});
 db=new DatabaseSync(path.join(dir,'polytechs.sqlite'));assert.deepEqual(db.prepare('SELECT id,username,role,password_hash FROM users').all(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM team_invitations').get().n,0);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 db.exec('DROP TABLE team_invitations; DROP INDEX users_email_unique; ALTER TABLE users DROP COLUMN email;');
 assert.deepEqual(db.prepare('SELECT id,username,role,password_hash FROM users').all(),before);
 console.log('Invitation migration: existing accounts/roles/passwords retained, idempotent startup, pre-invitation backup restore, FK integrity and reversible schema passed.');
}finally{db?.close();fs.rmSync(dir,{recursive:true,force:true})}
