import {database} from '@/db/raw';
import {checkOrigin} from '@/lib/access';
import {vgpAccess,vgpRecord} from '@/lib/vgp-server';
import {blankVgp,vgpError,type VgpRecord} from '@/lib/vgp';
import {newTicket} from '@/lib/hub';
const fail=(error:string,status=400)=>Response.json({error},{status});
const ok=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'private, no-store'}});

export async function GET(req:Request){
 try{
  const gate=await vgpAccess(req);if(gate.error)return gate.error;
  const db=database(),id=new URL(req.url).searchParams.get('id');
  if(id){
   const record=await vgpRecord(id);if(!record)return fail('Fiche introuvable.',404);
   const [files,history]=await Promise.all([
    db.prepare('SELECT * FROM vgp_files WHERE record_id=? ORDER BY created_at DESC').bind(id).all(),
    db.prepare('SELECT snapshot,saved_at,saved_by FROM vgp_history WHERE record_id=? ORDER BY saved_at DESC LIMIT 50').bind(id).all(),
   ]);
   return ok({record,files:files.results,history:history.results});
  }
  const rows=(await db.prepare('SELECT id,data,revision FROM vgp_records').all()).results as {id:string;data:string;revision:number}[];
  return ok({records:rows.map(row=>{const {raw,...data}=JSON.parse(row.data);return {...data,id:row.id,revision:row.revision}})});
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
  if(body.operation==='ticket'){
   if(!body.id)return fail('Enregistrez la fiche avant de créer son ticket.');
   if(previous.ticketId)return ok({id:previous.id,ticketId:previous.ticketId});
   next.ticketId='vgp-ticket-'+previous.id;
   ticket={...newTicket(),title:('VGP · '+previous.title).slice(0,200),category:'Sécurité',teams:['qsse'],
    pilot:previous.pilotId,due:previous.due,
    description:[previous.description,previous.location,previous.reference,'Suivi VGP /vgp?id='+encodeURIComponent(previous.id)].filter(Boolean).join('\n')};
  }else if(body.operation==='save'){
   if(!body.data||typeof body.data!=='object')return fail('Saisie invalide.');
   const fields=['controlId','title','domain','location','reference','provider','pilotId','lastDate','due','plannedDate','months','regulatory','status','description','note'] as const;
   for(const field of fields)(next as any)[field]=body.data[field];
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
  if(ticket)statements.push(db.prepare('INSERT INTO hub_tickets(id,data,revision,created_at,updated_at,author) SELECT ?,?,1,?,?,? WHERE changes()=1').bind(next.ticketId,JSON.stringify(ticket),now,now,author));
  statements.push(db.prepare('INSERT INTO vgp_history(id,record_id,snapshot,saved_at,saved_by) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),next.id,JSON.stringify(previous),now,author));
  const result=await db.batch(statements);
  if(!result[0].meta.changes)return fail('Modification simultanée. Rechargez la fiche.',409);
  return ok({id:next.id,revision:next.revision,ticketId:next.ticketId});
 }catch(error){console.error(error);return fail('Enregistrement impossible. Votre saisie est conservée.',503)}
}
