import {spawn} from 'node:child_process';
import {join} from 'node:path';

const server=spawn(process.execPath,[
 'node_modules/next/dist/bin/next','start','-H','0.0.0.0','-p',process.env.PORT||'3000',
],{stdio:'inherit'});

let backup,initial,interval,stopping=false;
function startBackup(){
 if(backup||stopping)return;
 backup=spawn('flock',[
  '-n','-F','-E','75',join(process.env.POLYTECHS_DATA_DIR,'.backup.lock'),
  process.execPath,'scripts/render-backup.mjs','scheduled',
 ],{stdio:'inherit'});
 backup.once('error',error=>console.error('[backup] Exécution indisponible',error.code));
 backup.once('close',()=>{backup=undefined});
}

if(process.env.POLYTECHS_BACKUP_ENABLED==='true'){
 initial=setTimeout(startBackup,30_000);
 interval=setInterval(startBackup,30*60_000);
}else{
 console.log('[backup] Copie indépendante en attente de configuration.');
}

function stop(signal){
 stopping=true;
 clearTimeout(initial);
 clearInterval(interval);
 backup?.kill(signal);
 server.kill(signal);
}

for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop(signal));
server.once('error',error=>{
 console.error('Démarrage du service impossible',error.code);
 process.exitCode=1;
 stop('SIGTERM');
});
server.once('exit',code=>{
 const requested=stopping;
 stop('SIGTERM');
 process.exitCode=code??(requested?0:1);
});
