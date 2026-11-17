import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {recordAccess} from '@/lib/record-access';
import {teamsAllowed} from '@/lib/team-access';
import {newTicket,type Ticket} from '@/lib/hub';
import {healthEventKind} from '@/lib/health-events';

const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const idValid=(v:unknown):v is string=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);

export async function POST(request:Request){
 try{
  if(!checkOrigin(request))return respond({error:'Requête non autorisée.'},403);
  const gate=await requireRole(request,'editor');if(gate.error)return gate.error;
  const body=await request.json().catch(()=>null) as {recordId?:unknown;revision?:number;mode?:string;title?:unknown;ticketId?:unknown}|null;
  if(!body||!idValid(body.recordId)||!Number.isSafeInteger(body.revision)||!['create','link','replace','unlink'].includes(body.mode||''))
   return respond({error:'Demande de rattachement invalide.'},400);
  const db=database();
  const record=await db.prepare('SELECT * FROM records WHERE id=? AND kind=?').bind(body.recordId,healthEventKind).first<{id:string;kind:string;details:string;revision:number}>();
  const writable=await recordAccess(gate.user!,[],true);
  if(!record||!writable(record))return respond({error:'Fiche non accessible.'},403);
  if(record.revision!==body.revision)return respond({error:'La fiche a changé. Fermez-la puis rouvrez-la.'},409);
  const details=JSON.parse(record.details);
  if(['create','link'].includes(body.mode||'')&&details.linkedTicketId&&await db.prepare('SELECT 1 FROM hub_tickets WHERE id=?').bind(details.linkedTicketId).first())
   return respond({error:'Un ticket est déjà rattaché à cet événement.'},409);
  if(['replace','unlink'].includes(body.mode||'')&&!details.linkedTicketId)
   return respond({error:'Aucun ticket n’est rattaché à cet événement.'},409);
  const now=new Date().toISOString();
  let ticketId='';
  let ticket:Ticket|undefined;
  if(body.mode==='create'){
   if(typeof body.title!=='string'||!body.title.trim()||body.title.length>200)
    return respond({error:'Renseignez un intitulé de ticket valide.'},400);
   if(!await teamsAllowed(gate.user!,['qsse'],true))
    return respond({error:'Droit de création de ticket QSSE nécessaire.'},403);
   ticketId=crypto.randomUUID();
   ticket={...newTicket(),title:body.title.trim(),teams:['qsse']};
  }else if(body.mode!=='unlink'){
   if(!idValid(body.ticketId))return respond({error:'Renseignez un lien ou un identifiant de ticket valide.'},400);
   ticketId=body.ticketId;
   if(ticketId===details.linkedTicketId)return respond({error:'Ce ticket est déjà rattaché.'},409);
   const existing=await db.prepare('SELECT data FROM hub_tickets WHERE id=?').bind(ticketId).first<{data:string}>();
   if(!existing||!await teamsAllowed(gate.user!,JSON.parse(existing.data).teams,true))
    return respond({error:'Ticket introuvable ou droit de modification insuffisant.'},403);
  }
  // Write the record revision and ticket together. Conditional inserts prevent duplicates on retry.
  const nextDetails={...details};
  if(ticketId)nextDetails.linkedTicketId=ticketId;
  else delete nextDetails.linkedTicketId;
  const update=db.prepare(`UPDATE records SET details=?,revision=revision+1,updated=? WHERE id=? AND revision=?
   AND (?=1 OR EXISTS (SELECT 1 FROM hub_tickets WHERE id=?))`)
   .bind(JSON.stringify(nextDetails),now,record.id,record.revision,ticket||!ticketId?1:0,ticketId);
  const snapshot=db.prepare('INSERT INTO record_history (id,record_id,revision,snapshot,saved_at) SELECT ?,?,?,?,? WHERE changes()=1')
   .bind(crypto.randomUUID(),record.id,record.revision,JSON.stringify(record),now);
  const statements=[update,snapshot];
  if(ticket)statements.push(db.prepare(`INSERT INTO hub_tickets (id,data,revision,created_at,updated_at,author)
   SELECT ?,?,1,?,?,? WHERE changes()=1`).bind(ticketId,JSON.stringify(ticket),now,now,gate.user!.displayName));
  const result=await db.batch(statements);
  if(!result[0].meta.changes)return respond({error:'Le rattachement a changé. Rechargez la fiche.'},409);
  return respond({ticketId,revision:record.revision+1});
 }catch{return respond({error:'Rattachement impossible. Réessayez après avoir rechargé la fiche.'},503);}
}
