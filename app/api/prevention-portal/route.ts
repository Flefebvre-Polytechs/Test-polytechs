import {bucket,database} from '@/db/raw';
import {checkOrigin,throttle,securityEvent} from '@/lib/access';
import {categories,portalInvite} from '@/lib/prevention-documents';
import {documentFileLimit,documentMime} from '@/lib/document-file';
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
const noStore={'Cache-Control':'private, no-store'};
export async function POST(req:Request){try{
 if(!checkOrigin(req))return fail('Origine non autorisée.',403);
 const type=req.headers.get('content-type')||'';
 if(type.includes('application/json')){
  const b=await req.json() as any,invite=await portalInvite(b?.token||'');
  if(!invite)return fail('Lien expiré ou révoqué.',403);
  if(b.action!=='inspect')return fail('Action inconnue.');
  const files=(await database().prepare('SELECT id,category,name,size,status,review_note,created_at FROM prevention_files WHERE invite_id=? ORDER BY created_at DESC').bind(invite.id).all()).results;
  return Response.json({plan:invite.title,company:invite.company,expiresAt:invite.expires_at,files},{headers:noStore});
 }
 if(Number(req.headers.get('content-length')||0)>documentFileLimit+65536)return fail('Limite : 15 Mo par fichier.',413);
 const form=await req.formData(),token=form.get('token'),category=form.get('category'),file=form.get('file');
 if(typeof token!=='string'||typeof category!=='string'||!categories.includes(category as typeof categories[number])||!(file instanceof File)||!file.size||file.size>documentFileLimit||file.name.length>200)return fail('Fichier ou catégorie invalide. 15 Mo maximum.');
 const invite=await portalInvite(token);if(!invite)return fail('Lien expiré ou révoqué.',403);
 if(await throttle('prevention-upload:'+invite.id,35,24*3600000))return fail('Limite d’envois atteinte pour ce lien.',429);
 const bytes=new Uint8Array(await file.arrayBuffer()),mime=documentMime(file.name,bytes);
 if(!mime)return fail('Formats admis : PDF, DOCX, XLSX, JPG et PNG. Les fichiers à macros ou incorporations sont refusés.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const id=crypto.randomUUID(),key='prevention/'+invite.record_id+'/'+id,db=database(),name=file.name.replace(/[\r\n\x00]/g,'');
 await bucket().put(key,bytes);
 try{
  const result=await db.prepare("INSERT INTO prevention_files(id,record_id,invite_id,category,name,mime,size,sha256,company,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM prevention_files WHERE record_id=?)<50 AND EXISTS(SELECT 1 FROM prevention_invites WHERE id=? AND revoked_at IS NULL AND expires_at>?) AND EXISTS(SELECT 1 FROM records WHERE id=? AND kind='Plans de prévention' AND status<>'Clôturé')").bind(id,invite.record_id,invite.id,category,name,mime,file.size,hash,invite.company,new Date().toISOString(),invite.record_id,invite.id,Date.now(),invite.record_id).run();
  if(!result.meta.changes){await bucket().delete(key);return fail('Lien désactivé ou limite de 50 documents atteinte.',409)}
 }catch(e){await bucket().delete(key);throw e}
 await securityEvent('prevention_file_uploaded','',invite.record_id);
 return Response.json({id},{headers:noStore});
}catch(e){console.error(e);return fail('Dépôt impossible.',503)}}
