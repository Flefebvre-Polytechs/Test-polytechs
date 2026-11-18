import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
export function installVgpSource(dir,env){
 if(!env.POLYTECHS_VGP_SOURCE)return;
 const [hash,parts]=env.POLYTECHS_VGP_SOURCE.split(':');
 const count=Number(parts);
 if(!/^[a-f0-9]{64}$/.test(hash)||!Number.isInteger(count)||count<1||count>64)throw Error('Invalid VGP transfer manifest.');
 const chunks=Array.from({length:count},(_,i)=>env['POLYTECHS_VGP_SOURCE_'+(i+1)]);
 if(chunks.some(chunk=>!chunk||!/^[a-z0-9+/=]+$/i.test(chunk)))throw Error('Incomplete VGP transfer.');
 const bytes=gunzipSync(Buffer.from(chunks.join(''),'base64'),{maxOutputLength:8*1024*1024});
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('VGP transfer checksum mismatch.');
 const {records}=JSON.parse(bytes);
 if(!Array.isArray(records)||!records.length||new Set(records.map(r=>r.id)).size!==records.length)throw Error('Invalid VGP records.');
 const db=new DatabaseSync(join(dir,'polytechs.sqlite'));
 try{
  db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
  const insert=db.prepare('INSERT OR IGNORE INTO vgp_records(id,data,revision,updated_at,updated_by) VALUES(?,?,1,?,?)');
  let added=0;
  for(const record of records){
   if(!/^vgp-source-[a-f0-9]{24}$/.test(record.id)||!['control','observation'].includes(record.kind)||!record.title||!record.raw)throw Error('Invalid VGP source row.');
   added+=Number(insert.run(record.id,JSON.stringify(record),new Date().toISOString(),'Import du classeur VGP').changes);
  }
  db.exec('COMMIT');
  console.log('VGP source installed:',records.length,'source records;',added,'new records.');
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}
 finally{db.close()}
}
