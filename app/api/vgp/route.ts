import {database} from '@/db/raw';
import {checkOrigin} from '@/lib/access';
import {vgpAccess,vgpRecord} from '@/lib/vgp-server';
import {blankVgp,vgpError,vgpResults,vgpEquipmentIdentity,type VgpRecord} from '@/lib/vgp';
import {newTicket,todayParis,validDate} from '@/lib/hub';
const fail=(error:string,status=400)=>Response.json({error},{status});
const ok=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'private, no-store'}});

export async function GET(req:Request){
 try{
  const gate=await vgpAccess(req);if(gate.error)return gate.error;
  const db=database(),id=new URL(req.url).searchParams.get('id');
  if(id){
   const record=await vgpRecord(id);if(!record)return fail('Fiche introuvable.',404);
   const [files,history,passages]=await Promise.all([
    db.prepare('SELECT * FROM vgp_files WHERE record_id=? ORDER BY created_at DESC').bind(id).all(),
    db.prepare('SELECT snapshot,saved_at,saved_by FROM vgp_history WHERE record_id=? ORDER BY saved_at DESC LIMIT 50').bind(id).all(),
    db.prepare('SELECT * FROM vgp_passages WHERE record_id=? ORDER BY performed_date DESC,created_at DESC').bind(id).all(),
   ]);
   return ok({record:{...record,equipment:record.kind==='observation'?vgpEquipmentIdentity(record):undefined},files:files.results,history:history.results,passages:passages.results});
  }
  const rows=(await db.prepare('SELECT id,data,revision FROM vgp_records').all()).results as {id:string;data:string;revision:number}[];
  type FollowUp={id:string;record_id:string;performed_date:string;missing_report:number;missing_result:number};
  const followUps=(await db.prepare(`SELECT p.id,p.record_id,p.performed_date,
   p.report_expected=1 AND NOT EXISTS(SELECT 1 FROM vgp_files f WHERE f.passage_id=p.id) AS missing_report,
   p.result='En attente du rapport' AS missing_result
   FROM vgp_passages p WHERE p.report_expected=1 OR p.result='En attente du rapport'
   ORDER BY p.performed_date ASC`).all()).results as FollowUp[];
  return ok({
   pendingReports:followUps.filter(p=>p.missing_report),
   pendingResults:followUps.filter(p=>!p.missing_report&&p.missing_result),
   records:rows.map(row=>{
    const record=JSON.parse(row.data) as VgpRecord;
    const {raw,...data}=record;
    return {...data,equipment:record.kind==='observation'?vgpEquipmentIdentity(record):undefined,id:row.id,revision:row.revision};
   }),
  });
 }catch(error){console.error(error);return fail('Registre VGP indisponible.',503)}
}
export async function POST(req:Request){
 try{
  if(!checkOrigin(req))return fail('Origine non autorisée.',403);
  const gate=await vgpAccess(req,true);if(gate.error)return gate.error;
  if(Number(req.headers.get('content-length')||0)>200000)return fail('Saisie trop volumineuse.',413);
  const body=await req.json() as {operation?:string;id?:string;revision?:number;data?:Record<string,unknown>};
  const previous=body.id?await vgpRecord(body.id):{...blankVgp(body.data?.kind as VgpRecord['kind']),id:crypto.randomUUID()};
  if(!previous)return fail('Fiche introuvable.',404);
  if(body.revision!==previous.revision)return fail('Cette fiche a changé. Rechargez-la avant de poursuivre.',409);
  const next:VgpRecord={...previous};
  let ticket:null|ReturnType<typeof newTicket>=null;
  let updatedResult:{id:string;result:string}|undefined;
  let passage: {performedDate:string;result:string;reportExpected:boolean;note:string}|undefined;
  if(body.operation==='plan'){
   if(!body.id||previous.kind!=='control')return fail('Sélectionnez un contrôle enregistré.');
   const date=body.data?.plannedDate;
   if(date!==''&&!validDate(date))return fail('Renseignez une date de rendez-vous valide.');
   next.plannedDate=date;
  }else if(body.operation==='passage'){
   if(!body.id||previous.kind!=='control'||!body.data)return fail('Sélectionnez un contrôle enregistré.');
   const {performedDate,result,reportExpected,note,nextDue}=body.data;
   if(!validDate(performedDate)||performedDate>todayParis()||previous.lastDate&&performedDate<=previous.lastDate)
    return fail('La date réelle doit suivre le dernier contrôle et ne peut pas être future.');
   if(typeof result!=='string'||!vgpResults.some(value=>value===result)||typeof reportExpected!=='boolean'||
    result==='En attente du rapport'&&!reportExpected||typeof note!=='string'||note.length>10000)
    return fail('Renseignez le résultat et indiquez si un rapport est attendu.');
   if(typeof nextDue!=='string'||nextDue&&(!validDate(nextDue)||nextDue<=performedDate))
    return fail('La prochaine échéance doit suivre la date réelle du passage.');
   passage={performedDate,result,reportExpected,note};
   next.lastDate=performedDate;next.due=nextDue;next.plannedDate='';
  }else if(body.operation==='passage-result'){
   const id=body.data?.passageId,result=body.data?.result;
   if(typeof id!=='string'||!vgpResults.some(value=>value!=='En attente du rapport'&&value===result))
    return fail('Choisissez un résultat de contrôle.');
   const existing=await database().prepare('SELECT id FROM vgp_passages WHERE id=? AND record_id=?').bind(id,next.id).first();
   if(!existing)return fail('Passage introuvable.',404);
   updatedResult={id,result:result as string};
  }else if(body.operation==='ticket'){
   if(!body.id)return fail('Enregistrez la fiche avant de créer son ticket.');
   if(previous.ticketId)return ok({id:previous.id,ticketId:previous.ticketId});
   next.ticketId='vgp-ticket-'+previous.id;
   const equipment=previous.kind==='observation'?vgpEquipmentIdentity(previous):undefined;
   const vgpLink='/vgp?id='+encodeURIComponent(previous.id);
   const context=[
    equipment?.family&&'Famille : '+equipment.family,
    equipment?.number&&'N° équipement : '+equipment.number,
    equipment?.reference&&'Réf. APAVE : '+equipment.reference,
    previous.location&&'Emplacement : '+previous.location,
    previous.reference&&'Référence source : '+previous.reference,
    previous.lastDate&&'Date du relevé : '+previous.lastDate,
   ].filter(Boolean).join('\n');
   ticket={...newTicket(),title:('VGP · '+previous.title).slice(0,200),category:'Sécurité',teams:['qsse'],
    pilot:previous.pilotId,due:previous.due,
    description:[context,previous.description].filter(Boolean).join('\n\n').slice(0,9700)+'\n\nFiche VGP : '+vgpLink};
  }else if(body.operation==='save'){
   if(!body.data||typeof body.data!=='object')return fail('Saisie invalide.');
   const fields=['controlId','title','domain','location','reference','provider','pilotId','lastDate','due','plannedDate','months','regulatory','status','description','note'] as const;
   for(const field of fields)(next as any)[field]=body.data[field];
   if(next.kind==='observation'&&body.data.equipment!==undefined){
    const identity=body.data.equipment as VgpRecord['equipment'];
    next.equipment=identity&&{family:identity.family,number:identity.number,reference:identity.reference};
   }
   const error=vgpError(next);if(error)return fail(error);
   if(next.controlId){
    const control=await vgpRecord(next.controlId);
    if(next.kind!=='observation'||control?.kind!=='control')return fail('Choisissez une fiche de contrôle existante.');
   }
   if(next.pilotId&&!await database().prepare('SELECT id FROM users WHERE id=?').bind(next.pilotId).first())return fail('Pilote inconnu.');
  }else return fail('Opération inconnue.');
  const db=database(),now=new Date().toISOString(),author=gate.user!.displayName;
  next.revision=previous.revision+1;
  const mutation=previous.revision?
   db.prepare('UPDATE vgp_records SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(JSON.stringify(next),now,author,next.id,previous.revision):
   db.prepare('INSERT OR IGNORE INTO vgp_records(id,data,revision,updated_at,updated_by) VALUES(?,?,1,?,?)').bind(next.id,JSON.stringify(next),now,author);
  const statements=[mutation];
  const passageId=passage?crypto.randomUUID():undefined;
  if(passage)statements.push(db.prepare(`INSERT INTO vgp_passages
   (id,record_id,due,planned_date,performed_date,result,report_expected,note,created_at,created_by)
   SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()=1`).bind(passageId,next.id,previous.due,previous.plannedDate,
   passage.performedDate,passage.result,Number(passage.reportExpected),passage.note,now,author));
  if(updatedResult)statements.push(db.prepare('UPDATE vgp_passages SET result=? WHERE id=? AND changes()=1').bind(updatedResult.result,updatedResult.id));
  if(ticket)statements.push(db.prepare('INSERT INTO hub_tickets(id,data,revision,created_at,updated_at,author) SELECT ?,?,1,?,?,? WHERE changes()=1').bind(next.ticketId,JSON.stringify(ticket),now,now,author));
  statements.push(db.prepare('INSERT INTO vgp_history(id,record_id,snapshot,saved_at,saved_by) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),next.id,JSON.stringify(previous),now,author));
  const result=await db.batch(statements);
  if(!result[0].meta.changes)return fail('Modification simultanée. Rechargez la fiche.',409);
  return ok({id:next.id,revision:next.revision,ticketId:next.ticketId,passageId});
 }catch(error){console.error(error);return fail('Enregistrement impossible. Votre saisie est conservée.',503)}
}
