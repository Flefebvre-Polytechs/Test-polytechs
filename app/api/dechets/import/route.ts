import {mkdir,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {database} from '@/db/raw';
import {checkOrigin,requireRole,securityEvent} from '@/lib/access';
import {loadWasteSource,type WasteSource} from '@/lib/waste-private-source';

const noStore={'Cache-Control':'private, no-store'};
const fail=(error:string,status=400)=>Response.json({error},{status,headers:noStore});
const limit=8_000_000;
let importing=false;

async function boundedBody(req:Request){
 const reader=req.body?.getReader();if(!reader)throw Error('Fichier absent.');
 let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Fichier trop volumineux (8 Mo maximum).')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;
}
function validSource(source:unknown):source is WasteSource{
 if(!source||typeof source!=='object'||Array.isArray(source))return false;
 const s=source as Partial<WasteSource>;
 if(typeof s.source!=='string'||s.source.length>180||!/^[a-f0-9]{64}$/i.test(s.sha256||'')||!Array.isArray(s.records)||s.records.length<1||s.records.length>50_000)return false;
 if(!Array.isArray(s.headers)||s.headers.length>100||!s.headers.every(x=>typeof x==='string'&&x.length<500))return false;
 if(!Array.isArray(s.treatments)||s.treatments.length>100||!s.treatments.every(x=>typeof x==='string'&&x.length<500))return false;
 if(!Array.isArray(s.adrReference)||s.adrReference.length>1000||!s.adrReference.every(x=>Number.isInteger(x?.row)&&x.row>0&&x.raw&&typeof x.raw==='object'&&!Array.isArray(x.raw)))return false;
 const ids=new Set<string>();
 for(const r of s.records){
  if(!r||!Number.isInteger(r.sourceRow)||r.sourceRow<6||r.id!==`excel-dechets-${r.sourceRow}`||ids.has(r.id)||r.revision!==0) return false;
  ids.add(r.id);
  if(!['Prévu','Enlevé'].includes(r.status)||!['Oui','Non','À vérifier'].includes(r.danger)||!['t','kg','unité','à vérifier'].includes(r.unit))return false;
  for(const k of ['date','dateSource','type','family','code','collector','destination','treatment','bsd','owner','notes','documentUrl'] as const)if(typeof r[k]!=='string'||r[k].length>5000)return false;
  // A negative historical estimate is kept as source evidence and flagged for review.
  if(!r.type||typeof r.excluded!=='boolean'||typeof r.client!=='boolean'||(r.quantity!==null&&(!Number.isFinite(r.quantity)||r.quantity<0))||(r.estimate!==null&&(!Number.isFinite(r.estimate)||Math.abs(r.estimate)>1_000_000)))return false;
  if(!Array.isArray(r.issues)||!r.issues.every(x=>typeof x==='string'&&x.length<500)||!r.raw||typeof r.raw!=='object'||Array.isArray(r.raw)||Object.keys(r.raw).length>100||!Object.values(r.raw).every(x=>typeof x==='string'&&x.length<5000))return false;
 }
 return true;
}
const comparable=(r:WasteSource['records'][number])=>JSON.stringify({...r,raw:undefined,issues:undefined});
export async function POST(req:Request){
 if(!checkOrigin(req))return fail('Requête non autorisée.',403);
 const gate=await requireRole(req,'admin');if(gate.error)return gate.error;
 if(Number(req.headers.get('content-length')||0)>limit)return fail('Fichier trop volumineux (8 Mo maximum).',413);
 let body:{source?:unknown;apply?:unknown;expectedSha?:unknown};
 try{body=await boundedBody(req) as typeof body}catch{return fail('Fichier JSON illisible ou trop volumineux.');}
 if(!body||typeof body!=='object'||Array.isArray(body)||!validSource(body.source))return fail('Source invalide : vérifiez le fichier préparé depuis le classeur.');
 const incoming=body.source,current=loadWasteSource(),existing=new Map(current?.records.map(r=>[r.id,r])||[]),next=new Set(incoming.records.map(r=>r.id));
 const removed=[...existing.keys()].filter(id=>!next.has(id));
 if(removed.length)return fail(`${removed.length} lignes de la source actuelle seraient supprimées. Import refusé.`,409);
 const added=incoming.records.filter(r=>!existing.has(r.id)).length;
 const changed=incoming.records.filter(r=>existing.has(r.id)&&comparable(r)!==comparable(existing.get(r.id)!)).length;
 const summary={previous:existing.size,total:incoming.records.length,added,changed,unchanged:incoming.records.length-added-changed,protectedCorrections:(await database().prepare('SELECT count(*) AS n FROM waste_records').first<{n:number}>())?.n||0,currentSha:current?.sha256||''};
 if(body.apply!==true)return Response.json(summary,{headers:noStore});
 if(typeof body.expectedSha!=='string'||body.expectedSha!==summary.currentSha)return fail('La source a changé depuis l’aperçu. Recommencez la vérification.',409);
 if(current?.sha256===incoming.sha256&&(added||changed))return fail('Empreinte identique pour un contenu différent. Import refusé.',409);
 if(current?.sha256===incoming.sha256)return Response.json({...summary,imported:true},{headers:noStore});
 if(!process.env.POLYTECHS_DATA_DIR)return fail('Disque persistant non configuré.',503);
 if(importing)return fail('Un import est déjà en cours.',409);
 importing=true;
 const dir=join(process.env.POLYTECHS_DATA_DIR,'private'),target=join(dir,'waste-source.json'),temp=target+'.'+crypto.randomUUID()+'.tmp';
 try{
  await mkdir(dir,{recursive:true});
  // Keep the previous full source separately. SQLite corrections remain untouched.
  if(current)await writeFile(join(dir,'waste-source.backup-'+Date.now()+'-'+crypto.randomUUID()+'.json'),JSON.stringify(current),{flag:'wx',mode:0o600});
  await writeFile(temp,JSON.stringify(incoming),{flag:'wx',mode:0o600});
  await rename(temp,target);
  try{await securityEvent('waste_source_imported',gate.user!.id,JSON.stringify({sha256:incoming.sha256,total:summary.total,added,changed}))}catch(e){console.error('Waste source imported; security event failed',e)}
  return Response.json({...summary,imported:true},{headers:noStore});
 }catch(e){console.error('Waste source import failed',e);return fail('Import impossible. La source précédente est conservée.',503)}
 finally{await rm(temp,{force:true}).catch(()=>{});importing=false}
}
