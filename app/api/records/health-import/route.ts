import {createHash} from 'node:crypto';
import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {dateToday,dateValid} from '@/lib/workflows';
import {healthEventKind,healthEventTypes,healthImportLimit,healthImportSheets,healthImportYear,normalizeHealthIdentity,type HealthImportRow} from '@/lib/health-events';

const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const fields=['date','time','person','place','eventType','circumstances','analysis','service','injurySite','injuryNature','daysOff','workActivity'] as const;
function valid(row:HealthImportRow){
 return row&&healthImportSheets.includes(row.sheet)&&Number.isSafeInteger(row.row)&&row.row>=2&&row.row<=100000
  &&fields.every(key=>typeof row[key]==='string'&&row[key].length<=(['analysis','circumstances'].includes(key)?5000:200))
  &&dateValid(row.date)&&row.date.startsWith(healthImportYear+'-')&&row.date<=dateToday()
  &&(!row.time||/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time))
  &&healthEventTypes.includes(row.eventType)&&!!(row.person.trim()&&row.place.trim()&&row.circumstances.trim())
  &&(!row.daysOff||/^\d{1,5}$/.test(row.daysOff));
}

export async function POST(request:Request){
 try{
  if(!checkOrigin(request))return respond({error:'Requête non autorisée.'},403);
  const gate=await requireRole(request,'admin');if(gate.error)return gate.error;
  if(Number(request.headers.get('content-length'))>5*1024*1024)return respond({error:'Lot trop volumineux.'},413);
  const body=await request.json().catch(()=>null) as {mode?:string;rows?:HealthImportRow[]}|null;
  const rows=body?.rows;
  if(!body||!['preview','import'].includes(body.mode||'')||!Array.isArray(rows)||!rows.length||rows.length>healthImportLimit||!rows.every(valid))
   return respond({error:'Le lot contient des événements ou des dates invalides.'},400);
  const db=database();
  const existing=(await db.prepare('SELECT id,details FROM records WHERE kind=?').bind(healthEventKind).all<{id:string;details:string}>()).results
   .map(record=>({...JSON.parse(record.details),id:record.id}));
  const deleted=new Set((await db.prepare("SELECT record_id FROM record_deletions WHERE record_id LIKE 'sse-2026-%'").all<{record_id:string}>()).results.map(row=>row.record_id));
  const same=(a:string,b:string)=>normalizeHealthIdentity(a||'')===normalizeHealthIdentity(b||'');
  const seen=new Set<string>();
  const pending:{id:string;row:HealthImportRow}[]=[];
  const preview=rows.map(row=>{
   const key=[row.date,normalizeHealthIdentity(row.person),row.time||normalizeHealthIdentity(row.place)].join('|');
   const id='sse-2026-'+createHash('sha256').update(key).digest('hex').slice(0,36);
   const match=existing.some(other=>other.id===id||other.date===row.date&&same(other.person,row.person)&&
    (other.time&&row.time?other.time===row.time:same(other.place,row.place)));
   const possible=existing.some(other=>other.date===row.date&&same(other.place,row.place)&&
    normalizeHealthIdentity(other.person||'').length<=4&&(!other.time||!row.time||other.time===row.time));
   const state=seen.has(id)||deleted.has(id)||match?'déjà présent':possible?'à vérifier':'à importer';
   seen.add(id);
   if(state==='à importer')pending.push({id,row});
   return {sheet:row.sheet,line:row.row,date:row.date,type:row.eventType,state};
  });
  if(body.mode==='preview')return respond({preview});
  const now=new Date().toISOString();
  const result=await db.batch(pending.map(({id,row})=>{
   const {sheet,row:sourceRow,...data}=row;
   return db.prepare(`INSERT INTO records (id,title,kind,domain,status,priority,owner,due,description,url,details,created,updated,revision,source_id)
    SELECT ?,?,?,'Sécurité','Signalé','Normale','','','','',?,?,?,1,''
    WHERE NOT EXISTS (SELECT 1 FROM record_deletions WHERE record_id=?)
    ON CONFLICT(id) DO NOTHING`).bind(id,row.eventType,healthEventKind,JSON.stringify({...data,sourceSheet:sheet,sourceRow:String(sourceRow)}),now,now,id);
  }));
  const imported=result.reduce((sum,item)=>sum+Number(item.meta.changes||0),0);
  return respond({imported,skipped:rows.length-imported});
 }catch{return respond({error:'Import impossible. Réessayez après avoir rechargé le registre.'},503);}
}
