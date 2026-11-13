import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';
import {environmentMetricKeys,validMonth,type EnvironmentEntry} from '@/lib/environment-consumptions';

const noStore={'Cache-Control':'private, no-store'};
const fail=(error:string,status=400)=>Response.json({error},{status,headers:noStore});
const response=(data:unknown)=>Response.json(data,{headers:noStore});
const isId=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
const validSite=(v:unknown)=>v==='site-1'||v==='site-2';
const validNumber=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e9&&Math.abs(v*1e4-Math.round(v*1e4))<1e-6;
const snapshot=(row:{value:number|null;target:number|null;note:string})=>JSON.stringify({value:row.value,target:row.target,note:row.note});

export async function GET(req:Request){
 try{
  const gate=await requireRole(req);if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse']))return fail('Accès au service QSSE nécessaire.',403);
  const params=new URL(req.url).searchParams;
  const db=database();
  if(params.has('history')){
   const id=params.get('history');if(!isId(id))return fail('Enregistrement invalide.');
   const row=await db.prepare('SELECT id FROM env_consumption_records WHERE id=?').bind(id).first();
   if(!row)return fail('Enregistrement introuvable.',404);
   const events=await db.prepare('SELECT previous_snapshot,new_snapshot,actor,created_at FROM env_consumption_history WHERE record_id=? ORDER BY created_at DESC LIMIT 25').bind(id).all();
   return response({events:events.results});
  }
  const start=params.get('start')||'',end=params.get('end')||'';
  if(!validMonth(start)||!validMonth(end)||start>end)return fail('Période invalide.');
  const [startYear,startMonth]=start.split('-').map(Number),[endYear,endMonth]=end.split('-').map(Number);
  if((endYear-startYear)*12+endMonth-startMonth>35)return fail('Sélectionnez 36 mois au maximum.');
  const result=await db.prepare('SELECT id,site,period,metric,value,target,note,revision,updated_at,updated_by FROM env_consumption_records WHERE period>=? AND period<=? ORDER BY period,site,metric').bind(start,end).all();
  return response({entries:result.results,canEdit:await teamsAllowed(gate.user!,['qsse'],true),start,end});
 }catch(e){console.error(e);return fail('Le suivi environnemental est momentanément indisponible.',503)}
}
export async function POST(req:Request){
 try{
  if(!checkOrigin(req))return fail('Origine non autorisée.',403);
  const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse'],true))return fail('Droit de modification QSSE nécessaire.',403);
  const raw=await req.text();if(raw.length>20000)return fail('Données trop volumineuses.');
  let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return fail('Saisie invalide.')}
  if(!body||typeof body!=='object'||Array.isArray(body))return fail('Saisie invalide.');
  if(body.action==='import-production-water'){
   // Import is INSERT-ONLY. A duplicate key aborts the entire transaction,
   // never overwrites a previously audited reading.
   const year=body.year,site=body.site,waterMetric=body.waterMetric==='water_network_m3'?'water_consumed_m3':body.waterMetric,rows=body.rows,source=body.source;
   if(!Number.isSafeInteger(year)||Number(year)<2000||Number(year)>2100||!validSite(site)||!['water_consumed_m3','water_other_m3'].includes(String(waterMetric))||!Array.isArray(rows)||rows.length<1||rows.length>12||typeof source!=='string'||!source.trim()||source.length>160)return fail('Année, site, nature de l’eau, tableau ou source invalide.');
   const months=new Set<number>();
   const clean:Array<{month:number;production:number;water:number}>=[];
   for(const item of rows){
    if(!item||typeof item!=='object'||Array.isArray(item))return fail('Ligne de relevé invalide.');
    const r=item as Record<string,unknown>;
    if(!Number.isSafeInteger(r.month)||Number(r.month)<1||Number(r.month)>12||months.has(Number(r.month))||!validNumber(r.production)||!validNumber(r.water)||r.production===null||r.water===null)return fail('Ligne de relevé incorrecte : doublon, mois ou précision invalide.');
    months.add(Number(r.month));clean.push({month:Number(r.month),production:Number(r.production),water:Number(r.water)});
   }
   const db=database();
   const note='Import groupé · '+source.trim();
   const now=new Date().toISOString(),actor=gate.user!;
   const statements=[];
   let skipped=0;
   for(const row of clean){
    const period=year+'-'+String(row.month).padStart(2,'0');
    for(const [metric,value] of [['production_t',row.production],[waterMetric,row.water]] as [string,number][]){
     const existing=await db.prepare('SELECT id FROM env_consumption_records WHERE site=? AND period=? AND metric=?').bind(site,period,metric).first();
     if(existing){skipped++;continue}
     const recordId=crypto.randomUUID();
     statements.push(
      db.prepare('INSERT INTO env_consumption_records(id,site,period,metric,value,target,note,revision,updated_at,updated_by) VALUES (?,?,?,?,?,NULL,?,1,?,?)').bind(recordId,site,period,metric,value,note,now,actor.displayName),
      db.prepare('INSERT INTO env_consumption_history(id,record_id,previous_snapshot,new_snapshot,actor_id,actor,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),recordId,'{}',snapshot({value,target:null,note}),actor.id,actor.displayName,now)
     );
    }
   }
   if(statements.length)await db.batch(statements);
   return response({ok:true,inserted:statements.length/2,skipped,months:clean.length,source:source.trim()});
  }
  if(body.action!=='save')return fail('Action inconnue.');
  const {site,period,value,target,note,revision}=body;
  const metric=body.metric==='water_network_m3'?'water_consumed_m3':body.metric;
  if(!validSite(site)||typeof metric!=='string'||!environmentMetricKeys.has(metric)||typeof period!=='string'||!validMonth(period))return fail('Site, période ou indicateur invalide.');
  if(!validNumber(value)||!validNumber(target)||typeof note!=='string'||note.length>1000||!Number.isSafeInteger(revision)||Number(revision)<0)return fail('Valeurs, note ou révision invalides. Utilisez au maximum quatre décimales.');
  const db=database(),old=await db.prepare('SELECT id,site,period,metric,value,target,note,revision,updated_at,updated_by FROM env_consumption_records WHERE site=? AND metric=? AND period=?').bind(site,metric,period).first<EnvironmentEntry>();
  if((old?.revision??0)!==revision)return fail('Cet indicateur a déjà été modifié. Actualisez pour conserver les dernières données.',409);
  if(!old&&value===null&&target===null&&!note.trim())return fail('Renseignez une consommation, un objectif ou une note.');
  const now=new Date().toISOString(),actor=gate.user!,newRecord={value:value as number|null,target:target as number|null,note:note.trim()},id=old?.id||crypto.randomUUID();
  // Data and audit event are committed together, even if one fails.
  let changes=0;
  if(old){
   const [result]=await db.batch([
    db.prepare('UPDATE env_consumption_records SET value=?,target=?,note=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(newRecord.value,newRecord.target,newRecord.note,now,actor.displayName,id,revision),
    db.prepare('INSERT INTO env_consumption_history(id,record_id,previous_snapshot,new_snapshot,actor_id,actor,created_at) SELECT ?,id,?,?,?,?,? FROM env_consumption_records WHERE id=? AND revision=? AND updated_at=? AND updated_by=?').bind(crypto.randomUUID(),snapshot(old),snapshot(newRecord),actor.id,actor.displayName,now,id,Number(revision)+1,now,actor.displayName)
   ]);
   changes=result.meta?.changes||0;
  }else{
   const [result]=await db.batch([
    db.prepare('INSERT OR IGNORE INTO env_consumption_records(id,site,period,metric,value,target,note,revision,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,1,?,?)').bind(id,site,period,metric,newRecord.value,newRecord.target,newRecord.note,now,actor.displayName),
    db.prepare('INSERT INTO env_consumption_history(id,record_id,previous_snapshot,new_snapshot,actor_id,actor,created_at) SELECT ?,id,?,?,?,?,? FROM env_consumption_records WHERE id=? AND revision=1').bind(crypto.randomUUID(),'{}',snapshot(newRecord),actor.id,actor.displayName,now,id)
   ]);
   changes=result.meta?.changes||0;
  }
  if(!changes)return fail('La saisie a changé depuis son ouverture. Actualisez avant de réessayer.',409);
  return response({ok:true,id,revision:Number(revision)+1,updatedAt:now});
 }catch(e){console.error(e);return fail('Enregistrement environnemental impossible.',503)}
}
