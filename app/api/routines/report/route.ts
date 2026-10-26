import {database,bucket} from '@/db/raw';
import {auditAccess,auditFail,auditNoStore} from '@/lib/audit-server';
import {buildAuditPdf} from '@/lib/audit-pdf';
import {someTeamAllowed} from '@/lib/team-access';
import type {Ticket} from '@/lib/hub';
export const runtime='nodejs';

export async function GET(req:Request){try{
  const q=new URL(req.url).searchParams,access=await auditAccess(req,q.get('routine')||'',q.get('date')||'');if(access.error)return access.error;
  const {run,routine,user}=access;
  if(q.has('revision')&&q.get('revision')!==String(run!.revision))return auditFail('Le compte rendu a changé. Actualisez avant de télécharger.',409);
  const db=database(),teamRows=(await db.prepare('SELECT id,name FROM teams').all()).results as {id:string;name:string}[],users=(await db.prepare('SELECT id,display_name FROM users').all()).results as {id:string;display_name:string}[];
  const rows=(await db.prepare('SELECT data FROM hub_tickets WHERE json_extract(data,\'$.source.routineId\')=? AND json_extract(data,\'$.source.date\')=? ORDER BY created_at').bind(routine!.id,run!.date).all()).results as {data:string}[];
  const tickets=[];for(const row of rows){const ticket:Ticket=JSON.parse(row.data);if(await someTeamAllowed(user!,ticket.teams))tickets.push({title:ticket.title,status:ticket.status,pilot:users.find(u=>u.id===ticket.pilot)?.display_name||'',due:ticket.due,done:ticket.actions.filter(a=>a.done).length,total:ticket.actions.length})}
  const photos=[];for(const photo of run!.data.photos||[]){const object=await bucket().get('audits/'+run!.id+'/'+photo.id);photos.push({...photo,bytes:object?Buffer.from(await new Response(object.body).arrayBuffer()):null})}
  const bytes=await buildAuditPdf({title:run!.data.routineTitle||routine!.data.title,description:run!.data.routineDescription??routine!.data.description,date:run!.date,teams:routine!.data.teams.map(id=>teamRows.find(t=>t.id===id)?.name||id),author:run!.author,revision:run!.revision,updatedAt:run!.updated_at,run:run!.data,photos,tickets,url:new URL('/routines?routine='+encodeURIComponent(routine!.id)+'&date='+run!.date,process.env.POLYTECHS_PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||req.url).toString()});
  return new Response(new Uint8Array(bytes),{headers:{...auditNoStore,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="audit-${run!.date}-v${run!.revision}.pdf"`,'X-Content-Type-Options':'nosniff'}});
}catch(e){console.error(e);return auditFail('Génération du PDF impossible. Réessayez depuis le compte rendu enregistré.',503)}}
