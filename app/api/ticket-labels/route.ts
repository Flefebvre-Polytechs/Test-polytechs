import {database} from '@/db/raw';
import {requireRole,checkOrigin} from '@/lib/access';
import {hasFunctionRole} from '@/lib/function-roles';
import {gmaoTicketReader} from '@/lib/gmao-server';
import {someTeamAllowed} from '@/lib/team-access';
import {labelInputError,labelKey,type Ticket,type TicketLabel} from '@/lib/hub';

const fail=(error:string,status=400)=>Response.json({error},{status});
const privateHeaders={'Cache-Control':'private, no-store'};

export async function GET(req:Request){
 try{
  const gate=await requireRole(req);
  if(gate.error)return gate.error;
  const canCreate=await hasFunctionRole(gate.user!,'ticket_label_creator');
  const db=database(),ticketId=new URL(req.url).searchParams.get('ticketId');
  let attached:string[]=[];
  if(ticketId&&ticketId.length<=100){
   const row=await db.prepare('SELECT data FROM hub_tickets WHERE id=?').bind(ticketId).first<{data:string}>();
   if(row){
    const ticket=JSON.parse(row.data) as Ticket;
    if(await someTeamAllowed(gate.user!,ticket.teams??[])||await gmaoTicketReader(gate.user!,ticketId)){
     attached=[...(ticket.topicTags??[]),...(ticket.locationTags??[])];
    }
   }
  }
  const {results:labels}=await db.prepare(`SELECT id,kind,category,name,deleted_at AS deletedAt FROM ticket_labels
   WHERE deleted_at IS NULL OR id IN (SELECT value FROM json_each(?))
   ORDER BY kind,category,name`).bind(JSON.stringify(attached)).all<TicketLabel>();
  return Response.json({labels,canCreate},{headers:privateHeaders});
 }catch(e){
  console.error(e);
  return fail('Étiquettes indisponibles.',503);
 }
}

export async function POST(req:Request){
 try{
  if(!checkOrigin(req))return fail('Origine non autorisée.',403);
  const gate=await requireRole(req,'editor');
  if(gate.error)return gate.error;
  if(!await hasFunctionRole(gate.user!,'ticket_label_creator'))return fail('Le rôle Créateur d’étiquettes est nécessaire.',403);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  const error=labelInputError(body?.kind,body?.category,body?.name);
  if(!body||error)return fail(error);
  const kind=String(body.kind),category=String(body.category);
  const name=String(body.name).trim().replace(/\s+/g,' '),key=labelKey(name);
  const db=database();
  // Reuse the original ID so that recreating the label restores its selection on older tickets.
  const saved=await db.prepare(`INSERT INTO ticket_labels(id,kind,category,name,name_key,created_by,created_at)
   VALUES(?,?,?,?,?,?,?) ON CONFLICT(kind,category,name_key) DO UPDATE
   SET name=excluded.name,deleted_at=NULL,deleted_by=NULL WHERE ticket_labels.deleted_at IS NOT NULL`)
   .bind(crypto.randomUUID(),kind,category,name,key,gate.user!.id,new Date().toISOString()).run();
  const label=await db.prepare('SELECT id,kind,category,name FROM ticket_labels WHERE kind=? AND category=? AND name_key=? AND deleted_at IS NULL')
   .bind(kind,category,key).first<TicketLabel>();
  if(!label)return fail('Le catalogue a changé. Actualisez-le avant de réessayer.',409);
  return Response.json({label,created:!!saved.meta.changes},{headers:privateHeaders});
 }catch(e){
  console.error(e);
  return fail('Création de l’étiquette impossible.',503);
 }
}

export async function DELETE(req:Request){
 try{
  if(!checkOrigin(req))return fail('Origine non autorisée.',403);
  const gate=await requireRole(req,'editor');
  if(gate.error)return gate.error;
  if(!await hasFunctionRole(gate.user!,'ticket_label_creator'))return fail('Le rôle Créateur d’étiquettes est nécessaire.',403);
  const body=await req.json().catch(()=>null) as {id?:unknown;confirmation?:unknown}|null;
  if(typeof body?.id!=='string'||!body.id||body.id.length>100)return fail('Étiquette invalide.');
  if(body.confirmation!=='SUPPRIMER')return fail('Saisissez SUPPRIMER pour confirmer.');

  const result=await database().prepare(`UPDATE ticket_labels
   SET deleted_by=CASE WHEN deleted_at IS NULL THEN ? ELSE deleted_by END,deleted_at=COALESCE(deleted_at,?)
   WHERE id=?`).bind(gate.user!.id,new Date().toISOString(),body.id).run();
  if(!result.meta.changes)return fail('Étiquette introuvable.',404);
  return Response.json({id:body.id},{headers:privateHeaders});
 }catch(e){
  console.error(e);
  return fail('Suppression de l’étiquette impossible.',503);
 }
}
