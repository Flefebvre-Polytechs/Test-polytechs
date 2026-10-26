// Run after `POLYTECHS_DATA_DIR=/tmp/build-only pnpm exec next build --webpack`.
// Creates a disposable database and uses real HTTP against the compiled server.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const dir=mkdtempSync(join(tmpdir(),'polytechs-built-audit-')),origin='http://127.0.0.1:'+port,password=randomBytes(24).toString('base64url');
const env={...process.env,POLYTECHS_DATA_DIR:dir,POLYTECHS_PUBLIC_ORIGIN:origin,RENDER_INITIAL_ADMIN_USERNAME:'audit-test',RENDER_INITIAL_ADMIN_PASSWORD:password};let server;
try{
  execFileSync(process.execPath,['scripts/render-migrate.mjs'],{env,stdio:'pipe'});
  const db=new DatabaseSync(join(dir,'polytechs.sqlite'));db.exec('UPDATE users SET must_change_password=0');db.close();
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env,stdio:['ignore','pipe','pipe']});
  let logs='';server.stdout.on('data',c=>logs+=c);server.stderr.on('data',c=>logs+=c);
  let ready=false;for(let i=0;i<50;i++){try{if((await fetch(origin+'/api/auth')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
  if(!ready)throw Error('Server failed to start: '+logs);
  let cookie='';
  const post=async(path,data)=>{const r=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',origin,cookie},body:JSON.stringify(data)}),out=await r.json();if(!r.ok)throw Error(JSON.stringify({path,status:r.status,error:out.error,logs}));if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return out};
  await post('/api/auth',{action:'login',username:'audit-test',password});
  const routine=await post('/api/hub',{action:'routine',data:{title:'Audit HTTP de test',description:'Test du serveur compilé',teams:['qsse'],pilot:'',start:'2026-10-26',time:'10:00',repeat:'none',interval:1,end:'',active:true,questions:[{id:'q1',label:'Contrôle réel du PDF',section:'Sécurité'}]}});
  await post('/api/hub',{action:'run',routineId:routine.id,date:'2026-10-26',revision:0,data:{answers:[{id:'q1',label:'',result:'Conforme',comment:'Test de génération depuis Next.js compilé.'}],notes:'',completed:true}});
  const response=await fetch(origin+'/api/routines/report?routine='+routine.id+'&date=2026-10-26',{headers:{cookie}}),bytes=Buffer.from(await response.arrayBuffer());
  if(response.status!==200||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Compiled PDF failure: '+response.status+' '+bytes.toString().slice(0,300)+' '+logs);
  const anon=await fetch(origin+'/api/routines/report?routine='+routine.id+'&date=2026-10-26');if(anon.status!==401)throw Error('Anonymous PDF access must be denied');
  console.log('Production HTTP test passed: login, routine creation, audit save, real PDF download ('+bytes.length+' bytes), anonymous refusal.');
}finally{
  if(server&&server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await stopped}
  rmSync(dir,{recursive:true,force:true});
}
