import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {backupKey,createSnapshot,fileHash,restoreSnapshot,runBackupCommand} from './backup-snapshot.mjs';

const day=24*60*60*1000;
const controller=new AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
const signal=controller.signal;

function dataDirectory(){
 const path=process.env.POLYTECHS_DATA_DIR;
 if(!path)throw Error('Le chemin des données Polytechs est requis.');
 return resolve(path);
}

function r2Settings(){
 const endpoint=process.env.POLYTECHS_BACKUP_R2_ENDPOINT?.replace(/\/$/,'')||'';
 const bucket=process.env.POLYTECHS_BACKUP_R2_BUCKET||'';
 const access=process.env.POLYTECHS_BACKUP_R2_ACCESS_KEY_ID||'';
 const secret=process.env.POLYTECHS_BACKUP_R2_SECRET_ACCESS_KEY||'';
 if(!/^https:\/\/[a-f0-9]{32}\.eu\.r2\.cloudflarestorage\.com$/.test(endpoint)||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)||
    !/^[a-f0-9]{32}$/i.test(access)||! /^[a-f0-9]{64}$/i.test(secret))
  throw Error('Le stockage R2 de juridiction UE et ses accès doivent être renseignés.');
 return {
  root:endpoint+'/'+bucket,
  // Pass credentials to curl via stdin, never via its process arguments.
  credentials:'user = "'+access+':'+secret+'"\n',
 };
}

const curlFlags=[
 '-q','--config','-','--proto','=https','--tlsv1.2','--fail','--silent',
 '--connect-timeout','20','--max-time','1800','--aws-sigv4','aws:amz:auto:s3',
];

async function transfer(settings,archive,name){
 const url=settings.root+'/polytechs-connect/'+encodeURIComponent(name);
 const hash=await fileHash(archive);
 await runBackupCommand('curl',[
  ...curlFlags,'--retry','2','--header','Content-Type: application/octet-stream',
  '--header','X-Amz-Content-Sha256: '+hash,'--upload-file',archive,url,
 ],{input:settings.credentials,signal}).done;

 const received=createHash('sha256');
 const {child,done}=runBackupCommand('curl',[...curlFlags,url],{input:settings.credentials,signal,output:'pipe'});
 await Promise.all([done,(async()=>{for await(const chunk of child.stdout)received.update(chunk)})()]);
 if(received.digest('hex')!==hash)throw Error('La copie distante ne correspond pas à l’archive envoyée.');
 return hash;
}

async function scheduledBackup(){
 if(process.env.POLYTECHS_BACKUP_ENABLED!=='true')return;
 const source=dataDirectory(),statusPath=join(source,'.backup-status.json');
 const last=await readFile(statusPath,'utf8').then(JSON.parse).catch(error=>{
  if(error.code==='ENOENT'||error instanceof SyntaxError)return null;
  throw error;
 });
 if(last?.verifiedAt&&Date.now()-Date.parse(last.verifiedAt)<day)return;
 const settings=r2Settings(),key=backupKey(process.env.POLYTECHS_BACKUP_KEY);
 const scratch=await mkdtemp(join(tmpdir(),'polytechs-offsite-'));
 try{
  const name='backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.tar.gz.enc';
  const archive=join(scratch,name);
  const info=await createSnapshot(source,archive,key,signal);
  const sha256=await transfer(settings,archive,name);
  const verifiedAt=new Date().toISOString();
  const temporary=statusPath+'.'+randomUUID()+'.tmp';
  try{
   await writeFile(temporary,JSON.stringify({...info,object:'polytechs-connect/'+name,sha256,verifiedAt}),{flag:'wx',mode:0o600});
   await rename(temporary,statusPath);
  }finally{await rm(temporary,{force:true})}
  console.log('[backup] Copie R2 vérifiée',verifiedAt,info.files,'fichiers,',info.bytes,'octets.');
 }finally{await rm(scratch,{recursive:true,force:true})}
}

const [action,archive,destination]=process.argv.slice(2);

try{
 if(action==='scheduled'){
  await scheduledBackup();
 }else if(action==='export'&&archive){
  const result=await createSnapshot(dataDirectory(),resolve(archive),backupKey(process.env.POLYTECHS_BACKUP_KEY),signal);
  console.log('[backup] Archive chiffrée créée',result.capturedAt,result.files,'fichiers.');
 }else if(action==='restore'&&archive&&destination){
  const result=await restoreSnapshot(resolve(archive),resolve(destination),backupKey(process.env.POLYTECHS_BACKUP_KEY),signal);
  console.log('[backup] Restauration vérifiée',result.capturedAt,result.files,'fichiers.');
 }else if(action==='verify'&&archive){
  const scratch=await mkdtemp(join(tmpdir(),'polytechs-verify-'));
  try{
   const result=await restoreSnapshot(resolve(archive),join(scratch,'restored'),backupKey(process.env.POLYTECHS_BACKUP_KEY),signal);
   console.log('[backup] Archive restaurée et contrôlée',result.capturedAt,result.files,'fichiers.');
  }finally{await rm(scratch,{recursive:true,force:true})}
 }else throw Error('Utilisation : render-backup.mjs export ARCHIVE, verify ARCHIVE ou restore ARCHIVE NOUVEAU_DOSSIER.');
}catch(error){
 console.error('[backup] Échec',error.code||((error instanceof SyntaxError)?'format invalide':error.message));
 process.exitCode=1;
}
