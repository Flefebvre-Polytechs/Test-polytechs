import {database} from '@/db/raw';
import {requireRole,checkOrigin} from '@/lib/access';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
type TicketRow={id:string;data:string;revision:number;created_at:string;updated_at:string;author:string;linked:number};
async function imported(){return (await database().prepare("SELECT t.*, EXISTS(SELECT 1 FROM hub_comments c WHERE c.ticket_id=t.id) OR EXISTS(SELECT 1 FROM hub_files f WHERE f.ticket_id=t.id) AS linked FROM hub_tickets t WHERE json_type(t.data,'$.qualityImport')='object'").all()).results as TicketRow[]}
export async function GET(req:Request){try{const gate=await requireRole(req,'admin');if(gate.error)return gate.error;const batches=new Map<string,{sha:string;source:string;count:number;changed:number}>();for(const row of await imported()){const metadata=JSON.parse(row.data).qualityImport;if(!/^[a-f0-9]{64}$/.test(metadata.sha))continue;const batch=batches.get(metadata.sha)||{sha:metadata.sha,source:String(metadata.source),count:0,changed:0};batch.count++;if(row.revision!==1||row.linked)batch.changed++;batches.set(batch.sha,batch)}const reversals=(await database().prepare('SELECT id,source,ticket_count,removed_at,restored_at FROM ticket_import_reversals ORDER BY removed_at DESC LIMIT 30').all()).results;return reply({batches:[...batches.values()],reversals})}catch{return reply({error:'Annulations indisponibles.'},503)}}
export async function POST(req:Request){try{
 if(!checkOrigin(req))return reply({error:'Origine non autorisée.'},403);const gate=await requireRole(req,'admin');if(gate.error)return gate.error;
 const body=await req.json() as {action?:string;sha?:string;count?:number;id?:string};if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Requête invalide.'},400);const db=database();const now=new Date().toISOString();
 if(body.action==='remove'){
  if(!/^[a-f0-9]{64}$/.test(body.sha||'')||!Number.isInteger(body.count)||!body.count||body.count<1||body.count>1000)return reply({error:'Import invalide.'},400);
  const rows=(await imported()).filter(r=>JSON.parse(r.data).qualityImport.sha===body.sha);
  if(rows.length!==body.count)return reply({error:'Le nombre de tickets a changé. Actualisez les imports.'},409);
  if(rows.some(r=>r.revision!==1||r.linked))return reply({error:'Certains tickets ont été modifiés ou ont reçu des commentaires ou fichiers. Annulation automatique refusée pour préserver ces ajouts.'},409);
  const snapshot=JSON.stringify(rows.map(({linked,...row})=>row)),id=crypto.randomUUID(),source=String(JSON.parse(rows[0].data).qualityImport.source);
  // Guard the exact snapshot inside the same transaction as backup and removal.
  const backup=db.prepare(`INSERT INTO ticket_import_reversals(id,batch_sha,source,snapshot,ticket_count,removed_at,removed_by)
   SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM hub_tickets WHERE json_extract(data,'$.qualityImport.sha')=?)=?
   AND NOT EXISTS(SELECT 1 FROM json_each(?) s LEFT JOIN hub_tickets t ON t.id=json_extract(s.value,'$.id')
    WHERE t.id IS NULL OR t.revision<>1 OR t.data<>json_extract(s.value,'$.data') OR t.updated_at<>json_extract(s.value,'$.updated_at')
    OR EXISTS(SELECT 1 FROM hub_comments c WHERE c.ticket_id=t.id) OR EXISTS(SELECT 1 FROM hub_files f WHERE f.ticket_id=t.id))`).bind(id,body.sha,source,snapshot,rows.length,now,gate.user!.displayName,body.sha,rows.length,snapshot);
  const remove=db.prepare("DELETE FROM hub_tickets WHERE id IN (SELECT json_extract(s.value,'$.id') FROM ticket_import_reversals r,json_each(r.snapshot) s WHERE r.id=?)").bind(id);
  const result=await db.batch([backup,remove]);if(!result[0].meta.changes)return reply({error:'Modification simultanée détectée. Aucun ticket supprimé.'},409);
  return reply({removed:Number(result[1].meta.changes),reversalId:id,restorable:true});
 }
 if(body.action==='restore'){
  if(typeof body.id!=='string'||body.id.length>100)return reply({error:'Annulation invalide.'},400);
  const row=await db.prepare('SELECT id,restored_at FROM ticket_import_reversals WHERE id=?').bind(body.id).first<{id:string;restored_at:string|null}>();if(!row)return reply({error:'Sauvegarde introuvable.'},404);if(row.restored_at)return reply({restored:0,alreadyRestored:true});
  const restore=db.prepare(`INSERT INTO hub_tickets(id,data,revision,created_at,updated_at,author)
   SELECT json_extract(s.value,'$.id'),json_extract(s.value,'$.data'),json_extract(s.value,'$.revision'),json_extract(s.value,'$.created_at'),json_extract(s.value,'$.updated_at'),json_extract(s.value,'$.author')
   FROM ticket_import_reversals r,json_each(r.snapshot) s WHERE r.id=? AND r.restored_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM json_each(r.snapshot) j JOIN hub_tickets t ON t.id=json_extract(j.value,'$.id'))`).bind(body.id);
  const mark=db.prepare('UPDATE ticket_import_reversals SET restored_at=? WHERE id=? AND restored_at IS NULL AND changes()=ticket_count').bind(now,body.id);
  const result=await db.batch([restore,mark]);if(!result[0].meta.changes)return reply({error:'Des identifiants existent déjà. Aucun ticket écrasé.'},409);return reply({restored:Number(result[0].meta.changes)});
 }
 return reply({error:'Action inconnue.'},400);
}catch(e){console.error('Ticket import undo failed',e);return reply({error:'Annulation impossible. La transaction a été annulée.'},503)}}
