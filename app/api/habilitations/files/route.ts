import {database,bucket} from '@/db/raw';
import {checkOrigin,requireRole,securityEvent} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';
import {documentFileLimit,documentMime} from '@/lib/document-file';
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
const validId=(v:unknown)=>typeof v==='string'&&/^[a-f\d-]{36}$/i.test(v);
const fileKey=(authId:string,id:string)=>'rh/habilitations/'+authId+'/'+id;
type Stored={id:string;authorization_id:string;name:string;mime:string;size:number};
async function permission(req:Request,write=false){
 if(write&&!checkOrigin(req))return {error:fail('Origine non autorisée.',403)};
 const g=await requireRole(req,write?'editor':'reader');if(g.error)return {error:g.error};
 if(!await teamsAllowed(g.user!,['rh'],write))return {error:fail('Accès RH nécessaire.',403)};
 return {user:g.user!};
}
export async function GET(req:Request){
 try{
  const g=await permission(req);if(g.error)return g.error;
  const id=new URL(req.url).searchParams.get('id');
  if(!validId(id))return fail('Document invalide.');
  const meta=await database().prepare('SELECT id,authorization_id,name,mime,size FROM hr_authorization_files WHERE id=?').bind(id).first<Stored>();
  if(!meta)return fail('Document introuvable.',404);
  const file=await bucket().get(fileKey(meta.authorization_id,meta.id));
  if(!file)return fail('Document indisponible.',404);
  const inline=new URL(req.url).searchParams.get('preview')==='1'&&['application/pdf','image/png','image/jpeg'].includes(meta.mime);
  return new Response(file.body,{headers:{'Content-Type':meta.mime,'Content-Length':String(meta.size),'Content-Disposition':(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(meta.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}});
 }catch(e){console.error(e);return fail('Document indisponible.',503)}
}
export async function POST(req:Request){
 try{
  const g=await permission(req,true);if(g.error)return g.error;
  const db=database();
  if(req.headers.get('content-type')?.includes('application/json')){
   const b=await req.json() as Record<string,unknown>;
   if(b.action!=='remove'||!validId(b.id)||b.confirmation!=='SUPPRIMER')return fail('Saisissez SUPPRIMER pour retirer ce justificatif.');
   const row=await db.prepare('SELECT id,authorization_id FROM hr_authorization_files WHERE id=?').bind(b.id).first<Stored>();
   if(!row)return fail('Justificatif introuvable.',404);
   await db.prepare('DELETE FROM hr_authorization_files WHERE id=?').bind(row.id).run();
   try{await bucket().delete(fileKey(row.authorization_id,row.id))}catch(e){console.error('Nettoyage pièce RH',e)}
   await securityEvent('hr_file_removed',g.user!.id,row.id);
   return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(Number(req.headers.get('content-length')||0)>documentFileLimit+65536)return fail('Fichier trop volumineux : 15 Mo maximum.',413);
  const form=await req.formData(),authorizationId=form.get('authorizationId'),file=form.get('file');
  if(!validId(authorizationId)||!(file instanceof File)||!file.size||file.size>documentFileLimit||file.name.length>200)return fail('Justificatif invalide : 15 Mo maximum.');
  if(!await db.prepare('SELECT id FROM hr_authorizations WHERE id=?').bind(authorizationId).first())return fail('Habilitation introuvable.',404);
  const bytes=new Uint8Array(await file.arrayBuffer()),mime=documentMime(file.name,bytes);
  if(!mime||!['application/pdf','image/jpeg','image/png'].includes(mime))return fail('PDF, JPEG et PNG uniquement.');
  const id=crypto.randomUUID(),now=new Date().toISOString(),name=file.name.replace(/[\r\n\x00]/g,'');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  await bucket().put(fileKey(String(authorizationId),id),bytes,{httpMetadata:{contentType:mime}});
  try{await db.prepare('INSERT INTO hr_authorization_files (id,authorization_id,name,mime,size,sha256,author,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,authorizationId,name,mime,file.size,hash,g.user!.displayName,now).run()}
  catch(e){await bucket().delete(fileKey(String(authorizationId),id));throw e}
  await securityEvent('hr_file_uploaded',g.user!.id,id);
  return Response.json({ok:true,id},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error(e);return fail('Enregistrement du justificatif impossible.',503)}
}
