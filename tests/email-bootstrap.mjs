import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'polytechs-email-bootstrap-'));
try{
 const env={...process.env,POLYTECHS_DATA_DIR:dir,RENDER_INITIAL_ADMIN_EMAIL:' ADMIN@EXAMPLE.TEST ',RENDER_INITIAL_ADMIN_PASSWORD:'Bootstrap-fixture-2026!'};delete env.RENDER_INITIAL_ADMIN_USERNAME;
 execFileSync(process.execPath,['scripts/render-migrate.mjs'],{env,stdio:'pipe'});
 let db=new DatabaseSync(path.join(dir,'polytechs.sqlite'));const first=db.prepare('SELECT id,email,username,role FROM users').get();assert.equal(first.email,'admin@example.test');assert.match(first.username,/^u\.[a-f0-9]{32}$/);assert.equal(first.role,'admin');
 const excluded=new Set(['render_schema_migrations','sessions','site_identities','login_attempts','security_limits','auth_challenges']);
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name).filter(n=>!excluded.has(n));
 const source={tables:names.map(name=>({name,columns:db.prepare(`PRAGMA table_info("${name}")`).all().map(c=>c.name),rows:db.prepare(`SELECT * FROM "${name}"`).all()}))};
 const filename=path.join(dir,'fixture-export.json');fs.writeFileSync(filename,JSON.stringify(source));db.close();
 assert.throws(()=>execFileSync(process.execPath,['scripts/render-import.mjs',filename],{env:{...env,RENDER_INITIAL_ADMIN_EMAIL:'wrong@example.test'},stdio:'pipe'}));
 execFileSync(process.execPath,['scripts/render-import.mjs',filename],{env,stdio:'pipe'});
 execFileSync(process.execPath,['scripts/render-migrate.mjs'],{env:{...env,RENDER_INITIAL_ADMIN_EMAIL:'another@example.test'},stdio:'pipe'});
 db=new DatabaseSync(path.join(dir,'polytechs.sqlite'));assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,1);assert.equal(db.prepare('SELECT id FROM users').get().id,first.id);db.close();
 console.log('Email bootstrap: first administrator created by email without a username; repeat startup preserves existing accounts and IDs.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
