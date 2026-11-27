import {spawn} from 'node:child_process';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {appendFile,copyFile,lstat,mkdir,mkdtemp,open,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {backup,DatabaseSync} from 'node:sqlite';
import {pipeline} from 'node:stream/promises';

const databaseName='polytechs.sqlite';
const dataFolders=['objects','private'];
const magic=Buffer.from('POLYTECHS-BACKUP-1\n');
const nonceSize=12,tagSize=16,headerSize=magic.length+nonceSize;

export function backupKey(value){
 const key=Buffer.from(value||'','base64');
 if(key.length!==32||key.toString('base64')!==value)throw Error('Clé de sauvegarde AES-256 manquante ou invalide.');
 return key;
}

export async function fileHash(path){
 const digest=createHash('sha256');
 for await(const chunk of createReadStream(path))digest.update(chunk);
 return digest.digest('hex');
}

export function runBackupCommand(command,args,{input,signal,output='ignore'}={}){
 const child=spawn(command,args,{signal,stdio:[input?'pipe':'ignore',output,'ignore']});
 const done=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',code=>code===0?resolve():reject(Error(command+' a échoué (code '+code+').')));
 });
 if(input){
  child.stdin.on('error',()=>{});
  child.stdin.end(input);
 }
 return {child,done};
}

// Take note of regular files only. Publication uses atomic renames in db/raw.ts.
async function inventory(root){
 const files=[];
 async function visit(relative){
  const items=await readdir(join(root,relative),{withFileTypes:true});
  for(const item of items.sort((a,b)=>a.name.localeCompare(b.name))){
   if(item.name.endsWith('.tmp'))continue;
   const path=relative+'/'+item.name;
   const stat=await lstat(join(root,path),{bigint:true});
   if(stat.isDirectory()){
    await visit(path);
   }else if(stat.isFile()){
    files.push({path,identity:[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(':')});
   }else throw Error('Objet non régulier dans les données.');
  }
 }
 for(const folder of dataFolders){
  const stat=await lstat(join(root,folder)).catch(error=>{
   if(error.code==='ENOENT')return null;
   throw error;
  });
  if(!stat)continue;
  if(!stat.isDirectory())throw Error('Dossier de données invalide.');
  await visit(folder);
 }
 return files;
}

function checkDatabase(path){
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  const rows=db.prepare('PRAGMA integrity_check').all();
  if(rows.length!==1||rows[0].integrity_check!=='ok')throw Error('Le contrôle d’intégrité SQLite a échoué.');
 }finally{db.close()}
}

async function stageData(source,stage,signal){
 const db=new DatabaseSync(join(source,databaseName),{readOnly:true});
 try{
  db.exec('PRAGMA busy_timeout=5000');
  const version=db.prepare('PRAGMA data_version');
  const before=version.get().data_version;
  const files=await inventory(source);
  await backup(db,join(stage,databaseName));
  for(const folder of dataFolders)await mkdir(join(stage,folder),{mode:0o700});
  for(const file of files){
   signal?.throwIfAborted();
   const destination=join(stage,file.path);
   await mkdir(dirname(destination),{recursive:true,mode:0o700});
   await copyFile(join(source,file.path),destination);
  }
  if(JSON.stringify(await inventory(source))!==JSON.stringify(files)||version.get().data_version!==before)
   throw Error('Des données ont changé pendant la copie. La sauvegarde sera retentée.');
 }finally{db.close()}

 // Expired or revoked web sessions must not be reinstated by a recovery.
 const snapshot=new DatabaseSync(join(stage,databaseName));
 try{
  snapshot.exec('PRAGMA journal_mode=DELETE; BEGIN IMMEDIATE');
  for(const table of ['sessions','auth_challenges']){
   if(snapshot.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
    snapshot.exec('DELETE FROM '+table);
  }
  snapshot.exec('COMMIT');
 }finally{snapshot.close()}

 checkDatabase(join(stage,databaseName));
 const files=[];
 for(const path of [databaseName,...(await inventory(stage)).map(file=>file.path)]){
  const file=join(stage,path);
  files.push({path,size:(await lstat(file)).size,sha256:await fileHash(file)});
 }
 return {version:1,capturedAt:new Date().toISOString(),files};
}

async function encryptFile(source,destination,key,signal){
 const nonce=randomBytes(nonceSize);
 const header=Buffer.concat([magic,nonce]);
 const cipher=createCipheriv('aes-256-gcm',key,nonce);
 cipher.setAAD(header);
 await writeFile(destination,header,{flag:'wx',mode:0o600});
 try{
  await pipeline(createReadStream(source),cipher,createWriteStream(destination,{flags:'a'}),{signal});
  await appendFile(destination,cipher.getAuthTag());
 }catch(error){
  await rm(destination,{force:true});
  throw error;
 }
}

async function decryptFile(source,destination,key,signal){
 const handle=await open(source,'r');
 let header,tag,size;
 try{
  ({size}=await handle.stat());
  if(size<=headerSize+tagSize)throw Error('Archive de sauvegarde incomplète.');
  header=Buffer.alloc(headerSize);
  tag=Buffer.alloc(tagSize);
  await handle.read(header,0,headerSize,0);
  await handle.read(tag,0,tagSize,size-tagSize);
  if(!header.subarray(0,magic.length).equals(magic))throw Error('Format de sauvegarde inconnu.');
 }finally {await handle.close()}
 const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(magic.length));
 decipher.setAAD(header);
 decipher.setAuthTag(tag);
 await pipeline(
  createReadStream(source,{start:headerSize,end:size-tagSize-1}),
  decipher,
  createWriteStream(destination,{flags:'wx',mode:0o600}),
  {signal},
 );
}

export async function createSnapshot(source,archive,key,signal){
 const scratch=await mkdtemp(join(tmpdir(),'polytechs-capture-'));
 try{
  const stage=join(scratch,'data');
  await mkdir(stage,{mode:0o700});
  const manifest=await stageData(source,stage,signal);
  await writeFile(join(stage,'manifest.json'),JSON.stringify(manifest),{mode:0o600});
  const compressed=join(scratch,'payload.tar.gz');
  await runBackupCommand('tar',['-czf',compressed,'-C',stage,databaseName,...dataFolders,'manifest.json'],{signal}).done;
  await encryptFile(compressed,archive,key,signal);
  return {capturedAt:manifest.capturedAt,files:manifest.files.length-1,bytes:(await lstat(archive)).size};
 }finally{await rm(scratch,{recursive:true,force:true})}
}

// Always authenticate the entire archive before unpacking it into a new directory.
export async function restoreSnapshot(archive,destination,key,signal){
 const scratch=await mkdtemp(join(tmpdir(),'polytechs-restore-'));
 try{
  const compressed=join(scratch,'payload.tar.gz');
  await decryptFile(archive,compressed,key,signal);
  await mkdir(destination,{mode:0o700});
  try{
   await runBackupCommand('tar',['-xzf',compressed,'--no-same-owner','--no-same-permissions','-C',destination],{signal}).done;
   const manifest=JSON.parse(await readFile(join(destination,'manifest.json'),'utf8'));
   const files=[databaseName,...(await inventory(destination)).map(file=>file.path)].sort();
   if(manifest.version!==1||!Array.isArray(manifest.files)||
      JSON.stringify(manifest.files.map(file=>file.path).sort())!==JSON.stringify(files))
    throw Error('Le contenu restauré ne correspond pas au manifeste.');
   for(const file of manifest.files){
    signal?.throwIfAborted();
    const path=join(destination,file.path);
    if((await lstat(path)).size!==file.size||await fileHash(path)!==file.sha256)
     throw Error('Une empreinte de fichier restauré est invalide.');
   }
   checkDatabase(join(destination,databaseName));
   return {capturedAt:manifest.capturedAt,files:files.length-1};
  }catch(error){
   await rm(destination,{recursive:true,force:true});
   throw error;
  }
 }finally{await rm(scratch,{recursive:true,force:true})}
}
