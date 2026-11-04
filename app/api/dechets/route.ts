import {database} from '@/db/raw';
import {requireRole,checkOrigin} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';
import {loadWasteSource} from '@/lib/waste-private-source';
import {blankWaste,wasteIssues,validateWaste,type WasteRecord} from '@/lib/waste';
import {applyWasteCell,wasteManagedColumns,wasteTableValue,wasteTableColumns} from '@/lib/waste-table';
async function allRecords(wasteSource:ReturnType<typeof loadWasteSource>){const db=database(),records=new Map<string,WasteRecord>((wasteSource?.records||[]).map(r=>[r.id,{...r,issues:wasteIssues(r)}]));
const [legacy,overrides]=await Promise.all([db.prepare("SELECT * FROM records WHERE kind='Gestion des déchets'").all(),db.prepare('SELECT * FROM waste_records').all()]);
for(const x of legacy.results as any[]){const d=JSON.parse(x.details||'{}'),q=d.quantity===''||d.quantity===undefined?null:Number(d.quantity);const r:WasteRecord={...blankWaste(),id:'legacy-'+x.id,date:d.date||'',dateSource:d.date||'',type:x.title,family:'Autres',code:d.code||'',quantity:Number.isFinite(q)?q:null,unit:'kg',danger:['Oui','Non'].includes(d.dangerous)?d.dangerous:'À vérifier',status:x.status==='Prévu'?'Prévu':'Enlevé',collector:d.collector||'',destination:d.destination||'',treatment:d.treatment||'',bsd:d.bsd||'',notes:x.description||'',owner:x.owner||'',documentUrl:x.url||'',raw:{'Ancienne fiche':x.id,'Statut antérieur':x.status}};records.set(r.id,{...r,issues:wasteIssues(r)})}
for(const x of overrides.results as any[]){const stored=JSON.parse(x.data),original=records.get(x.id);const r={...stored,id:x.id,revision:x.revision,updatedAt:x.updated_at,updatedBy:x.updated_by,raw:original?.raw,sourceRow:original?.sourceRow||0,dateSource:original?.dateSource||''};records.set(x.id,{...r,issues:wasteIssues(r)})}return records}
const noStore={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{const gate=await requireRole(req);if(gate.error)return gate.error;if(!await teamsAllowed(gate.user!,['qsse']))return Response.json({error:'Accès QSSE nécessaire.'},{status:403});const wasteSource=loadWasteSource(),p=new URL(req.url).searchParams,id=p.get('id');
if(p.get('reference'))return Response.json({reference:wasteSource?.adrReference||[]},{headers:noStore});
const records=await allRecords(wasteSource);if(id){const record=records.get(id);if(!record)return Response.json({error:'Enlèvement introuvable.'},{status:404});const history=(await database().prepare('SELECT snapshot,saved_at,saved_by FROM waste_history WHERE record_id=? ORDER BY saved_at DESC LIMIT 30').bind(id).all()).results;return Response.json({record,history,headers:wasteSource?.headers||[]},{headers:noStore})}
const rawIds=p.get('rawIds');if(rawIds!==null){const ids=rawIds==='all'?[...records.keys()]:rawIds.split(',');if((ids.length>100&&rawIds!=='all')||ids.some(x=>x.length>100))return Response.json({error:'Sélection trop importante.'},{status:400,headers:noStore});return Response.json({headers:wasteSource?.headers||[],rows:ids.flatMap(x=>{const r=records.get(x);return r?[{id:x,raw:r.raw||{}}]:[]})},{headers:noStore})}
return Response.json({records:[...records.values()].map(({raw,...r})=>r),source:wasteSource?{name:wasteSource.source,count:wasteSource.records.length}:null,canEdit:gate.user!.role!=='reader'&&await teamsAllowed(gate.user!,['qsse'],true)},{headers:noStore})
}catch(e){console.error(e);return Response.json({error:'Le registre est indisponible. Réessayez.'},{status:503})}}
export async function POST(req:Request){try{if(!checkOrigin(req))return Response.json({error:'Requête non autorisée.'},{status:403});const gate=await requireRole(req,'editor');if(gate.error)return gate.error;if(!await teamsAllowed(gate.user!,['qsse'],true))return Response.json({error:'Droit de modification QSSE nécessaire.'},{status:403});const b=await req.json() as WasteRecord;if(!b||typeof b!=='object'||Array.isArray(b))return Response.json({error:'Fiche invalide.'},{status:400});
for(const k of ['id','date','type','family','code','status','unit','danger','collector','destination','treatment','bsd','owner','notes','documentUrl'] as const)if(typeof b[k]!=='string'||b[k].length>(k==='notes'?5000:500))return Response.json({error:'Champ invalide : '+k},{status:400});if(typeof b.excluded!=='boolean'||typeof b.client!=='boolean'||!Number.isInteger(b.revision)||b.revision<0)return Response.json({error:'Fiche invalide.'},{status:400});const errors=validateWaste(b);if(errors.length)return Response.json({error:errors.join('\n')},{status:400});
const records=await allRecords(loadWasteSource()),previous=b.id?records.get(b.id):null;if(b.id&&!previous)return Response.json({error:'Enlèvement introuvable.'},{status:404});if(previous&&previous.revision!==b.revision)return Response.json({error:'La fiche a changé. Copiez votre saisie puis rouvrez la dernière version.'},{status:409});
const id=previous?.id||crypto.randomUUID(),now=new Date().toISOString(),r:WasteRecord={...blankWaste(),...Object.fromEntries(['date','type','family','code','status','unit','danger','collector','destination','treatment','bsd','owner','notes','documentUrl','quantity','estimate','excluded','client'].map(k=>[k,(b as any)[k]])),id,revision:b.revision+1};r.type=r.type.trim();r.cellOverrides={...previous?.cellOverrides};if(previous)for(const [column,field] of Object.entries(wasteManagedColumns)){if(b[field as keyof WasteRecord]!==previous[field as keyof WasteRecord])delete r.cellOverrides[column]}r.issues=wasteIssues(r);const db=database();let mutation;
if(previous&&previous.revision>0)mutation=db.prepare('UPDATE waste_records SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(JSON.stringify(r),now,gate.user!.displayName,id,b.revision);
else mutation=db.prepare('INSERT OR IGNORE INTO waste_records (id,data,revision,updated_at,updated_by) VALUES (?,?,?,?,?)').bind(id,JSON.stringify(r),1,now,gate.user!.displayName);
const statements=[mutation];if(previous)statements.push(db.prepare('INSERT INTO waste_history (id,record_id,snapshot,saved_at,saved_by) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),id,JSON.stringify({...previous,raw:undefined}),now,gate.user!.displayName));const result=await db.batch(statements);if(!result[0].meta.changes)return Response.json({error:'Une autre personne a modifié cette fiche. Copiez votre saisie puis rechargez-la.'},{status:409});return Response.json({id});
}catch(e){console.error(e);return Response.json({error:'Enregistrement impossible. Votre saisie est conservée.'},{status:503})}}

export async function PATCH(req:Request){
 try{
  if(!checkOrigin(req))return Response.json({error:'Requête non autorisée.'},{status:403,headers:noStore});
  const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse'],true))return Response.json({error:'Droit de modification QSSE nécessaire.'},{status:403,headers:noStore});
  const body=await req.json() as {id?:unknown;revision?:unknown;column?:unknown;value?:unknown};
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.id!=='string'||body.id.length>100||!Number.isInteger(body.revision)||typeof body.column!=='string'||typeof body.value!=='string'||body.value.length>5000)return Response.json({error:'Cellule invalide.'},{status:400,headers:noStore});
  const source=loadWasteSource(),columns=wasteTableColumns(source?.headers||[]);
  if(!columns.some(x=>x.key===body.column))return Response.json({error:'Colonne inconnue.'},{status:400,headers:noStore});
  const records=await allRecords(source),previous=records.get(body.id);
  if(!previous)return Response.json({error:'Enlèvement introuvable.'},{status:404,headers:noStore});
  if(previous.revision!==body.revision)return Response.json({error:'La fiche a changé. Rechargez-la avant de modifier cette cellule.'},{status:409,headers:noStore});
  if(wasteTableValue(previous,previous.raw||{},body.column)===body.value)return Response.json({id:body.id,revision:previous.revision},{headers:noStore});
  let next:WasteRecord;
  try{next=applyWasteCell(previous,body.column,body.value)}catch(e){return Response.json({error:(e as Error).message},{status:400,headers:noStore})}
  const managed=Object.hasOwn(wasteManagedColumns,body.column);
  if(managed&&['AC','AD','AE','AQ','AX'].includes(body.column)&&body.value.length>500)return Response.json({error:'Ce champ est limité à 500 caractères.'},{status:400,headers:noStore});
  if(next.collector.length>500)return Response.json({error:'Le nom du collecteur est limité à 500 caractères.'},{status:400,headers:noStore});
  const oldErrors=validateWaste(previous),errors=validateWaste(next).filter(error=>!oldErrors.includes(error));
  if(errors.length)return Response.json({error:errors.join('\n')},{status:400,headers:noStore});
  next={...next,revision:previous.revision+1,issues:wasteIssues(next),raw:undefined};
  const now=new Date().toISOString(),db=database();
  const mutation=previous.revision>0
   ?db.prepare('UPDATE waste_records SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(JSON.stringify(next),now,gate.user!.displayName,previous.id,previous.revision)
   :db.prepare('INSERT OR IGNORE INTO waste_records (id,data,revision,updated_at,updated_by) VALUES (?,?,?,?,?)').bind(previous.id,JSON.stringify(next),1,now,gate.user!.displayName);
  const history=db.prepare('INSERT INTO waste_history (id,record_id,snapshot,saved_at,saved_by) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),previous.id,JSON.stringify({...previous,raw:undefined}),now,gate.user!.displayName);
  const result=await db.batch([mutation,history]);
  if(!result[0].meta.changes)return Response.json({error:'Une autre personne a modifié cette fiche. Rechargez-la avant de réessayer.'},{status:409,headers:noStore});
  return Response.json({id:previous.id,revision:next.revision},{headers:noStore});
 }catch(e){console.error(e);return Response.json({error:'Modification impossible. Votre saisie est conservée.'},{status:503,headers:noStore})}
}
