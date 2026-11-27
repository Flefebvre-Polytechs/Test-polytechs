import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {access,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {backupKey,createSnapshot,restoreSnapshot} from '../scripts/backup-snapshot.mjs';

const work=await mkdtemp(join(tmpdir(),'polytechs-backup-test-'));
const source=join(work,'data');
const archive=join(work,'nightly.tar.gz.enc');
const destination=join(work,'restored');
const key=backupKey(randomBytes(32).toString('base64'));
const attachment=Buffer.from('Document synthétique réservé au test.\0', 'utf8');
let db;

try{
 await mkdir(join(source,'objects','tickets','example'),{recursive:true});
 await mkdir(join(source,'private'),{recursive:true});
 db=new DatabaseSync(join(source,'polytechs.sqlite'));
 // Keep the live connection and the WAL open throughout the capture.
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
  CREATE TABLE hub_tickets (id TEXT PRIMARY KEY,data TEXT NOT NULL);
  CREATE TABLE sessions (id TEXT PRIMARY KEY);
  CREATE TABLE auth_challenges (id TEXT PRIMARY KEY);
  INSERT INTO hub_tickets VALUES ('example','{"title":"Dossier de test"}');
  INSERT INTO sessions VALUES ('volatile-session');
  INSERT INTO auth_challenges VALUES ('volatile-challenge');`);
 await writeFile(join(source,'objects','tickets','example','file'),attachment);
 await writeFile(join(source,'objects','tickets','example','pending.tmp'),'incomplete');
 await writeFile(join(source,'private','source.json'),'{"source":"test"}');

 const saved=await createSnapshot(source,archive,key);
 assert.equal(saved.files,2);
 assert.ok(saved.bytes>0);
 assert.equal((await readFile(archive)).includes(attachment),false);
 assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,1);

 const restored=await restoreSnapshot(archive,destination,key);
 assert.equal(restored.capturedAt,saved.capturedAt);
 assert.equal(restored.files,2);
 assert.deepEqual(await readFile(join(destination,'objects','tickets','example','file')),attachment);
 await assert.rejects(access(join(destination,'objects','tickets','example','pending.tmp')),{code:'ENOENT'});
 assert.equal(await readFile(join(destination,'private','source.json'),'utf8'),'{"source":"test"}');
 const recovered=new DatabaseSync(join(destination,'polytechs.sqlite'),{readOnly:true});
 try{
  assert.equal(JSON.parse(recovered.prepare('SELECT data FROM hub_tickets WHERE id=?').get('example').data).title,'Dossier de test');
  assert.equal(recovered.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
  assert.equal(recovered.prepare('SELECT count(*) AS n FROM auth_challenges').get().n,0);
 }finally{recovered.close()}

 await assert.rejects(restoreSnapshot(archive,destination,key),{code:'EEXIST'});
 assert.deepEqual(await readFile(join(destination,'objects','tickets','example','file')),attachment);
 const wrongKey=join(work,'wrong-key');
 await assert.rejects(restoreSnapshot(archive,wrongKey,randomBytes(32)));
 await assert.rejects(access(wrongKey),{code:'ENOENT'});

 const corrupted=join(work,'corrupted.tar.gz.enc');
 const bytes=await readFile(archive);
 bytes[Math.floor(bytes.length/2)]^=1;
 await writeFile(corrupted,bytes);
 const invalid=join(work,'invalid');
 await assert.rejects(restoreSnapshot(corrupted,invalid,key));
 await assert.rejects(access(invalid),{code:'ENOENT'});
 console.log('Backup: open WAL database, attachments, private data, authenticated recovery and rejected corruption passed.');
}finally{
 db?.close();
 await rm(work,{recursive:true,force:true});
}
