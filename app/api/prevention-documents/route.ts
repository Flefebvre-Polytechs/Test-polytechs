import {randomBytes} from 'node:crypto';
import {bucket,database} from '@/db/raw';
import {checkOrigin,requireRole,securityEvent} from '@/lib/access';
import {planAccess,tokenHash} from '@/lib/prevention-documents';
import {publicOrigin} from '@/lib/security-mail';
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
const noStore={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{
 const gate=await requireRole(req);if(gate.error)return gate.error;const q=new URL(req.url).searchParams,id=q.get('record')||'';
 const plan=await planAccess(gate.user!,id);if(!plan)return fail('Plan non accessible.',404);
 const db=database(),fileId=q.get('file');
 if(fileId){const file=await db.prepare('SELECT * FROM prevention_files WHERE id=? AND record_id=?').bind(fileId,id).first<any>();if(!file)return fail('Fichier introuvable.',404);const blob=await bucket().get('prevention/'+id+'/'+file.id);if(!blob)return fail('Fichier indisponible.',404);return new Response(blob.body,{headers:{'Content-Type':file.mime,'Content-Length':String(file.size),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}
 const files=(await db.prepare('SELECT id,category,name,mime,size,company,status,review_note,reviewed_by,reviewed_at,created_at FROM prevention_files WHERE record_id=? ORDER BY created_at DESC').bind(id).all()).results;
 const invites=(await db.prepare('SELECT id,company,created_at,expires_at,revoked_at FROM prevention_invites WHERE record_id=? ORDER BY created_at DESC').bind(id).all()).results;
 return Response.json({files,invites},{headers:noStore});
}catch(e){console.error(e);return fail('Documents indisponibles.',503)}}
export async function POST(req:Request){try{
 if(!checkOrigin(req))return fail('Origine non autorisée.',403);
 const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
 if(Number(req.headers.get('content-length')||0)>4096)return fail('Requête trop volumineuse.',413);
 const body=await req.json() as Record<string,unknown>;
 const id=typeof body.record==='string'?body.record:'',plan=await planAccess(gate.user!,id,true);
 if(!plan)return fail('Modification non autorisée.',403);
 const db=database(),now=new Date().toISOString();
 if(body.action==='create-link'){
  const company=String(body.company||'').trim();
  if(company.length<2||company.length>150)return fail('Renseignez le nom de l’entreprise.');
  if(plan.status==='Clôturé')return fail('Le plan est clôturé.',409);
  const origin=publicOrigin();
  const secret=randomBytes(32).toString('hex'),inviteId=crypto.randomUUID(),expires=Date.now()+30*86400000;
  await db.batch([
   db.prepare('UPDATE prevention_invites SET revoked_at=? WHERE record_id=? AND company=? AND revoked_at IS NULL').bind(Date.now(),id,company),
   db.prepare('INSERT INTO prevention_invites(id,record_id,company,token_hash,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(inviteId,id,company,tokenHash(secret),gate.user!.id,now,expires)
  ]);
  await securityEvent('prevention_invite_created',gate.user!.id,id);
  return Response.json({url:origin+'/prevention-depot#token='+secret,expiresAt:expires},{headers:noStore});
 }
 if(body.action==='revoke-link'){
  if(typeof body.inviteId!=='string')return fail('Invitation invalide.');
  const result=await db.prepare('UPDATE prevention_invites SET revoked_at=? WHERE id=? AND record_id=? AND revoked_at IS NULL').bind(Date.now(),body.inviteId,id).run();
  if(!result.meta.changes)return fail('Invitation déjà révoquée.',404);
  await securityEvent('prevention_invite_revoked',gate.user!.id,id);return Response.json({ok:true},{headers:noStore});
 }
 if(body.action==='review'){
  if(typeof body.fileId!=='string'||!['Accepté','Refusé'].includes(String(body.status))||typeof body.note!=='string'||body.note.length>1000||body.status==='Refusé'&&!body.note.trim())return fail('Précisez une décision et le motif du refus.');
  const result=await db.prepare("UPDATE prevention_files SET status=?,review_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND record_id=? AND status='À examiner'").bind(body.status,body.note.trim(),gate.user!.displayName,now,body.fileId,id).run();
  if(!result.meta.changes)return fail('Document déjà traité ou introuvable.',409);
  await securityEvent('prevention_file_reviewed',gate.user!.id,id);return Response.json({ok:true},{headers:noStore});
 }
 return fail('Action inconnue.');
}catch(e){console.error(e);return fail('Opération impossible.',503)}}
