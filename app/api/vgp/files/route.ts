import {bucket,database} from '@/db/raw';
import {checkOrigin} from '@/lib/access';
import {vgpAccess,vgpRecord} from '@/lib/vgp-server';
const fail=(error:string,status=400)=>Response.json({error},{status});
const maxSize=15*1024*1024;
export async function GET(req:Request){
 try{
  const gate=await vgpAccess(req);if(gate.error)return gate.error;
  const id=new URL(req.url).searchParams.get('id')||'';
  const file=await database().prepare('SELECT * FROM vgp_files WHERE id=?').bind(id).first<{id:string;record_id:string;name:string;size:number}>();
  if(!file)return fail('Rapport introuvable.',404);
  const object=await bucket().get('vgp/'+file.record_id+'/'+file.id);if(!object)return fail('Fichier indisponible.',404);
  return new Response(object.body,{headers:{'Content-Type':'application/pdf','Content-Length':String(file.size),
   'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(file.name),
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(error){console.error(error);return fail('Consultation indisponible.',503)}
}
export async function POST(req:Request){
 try{
  if(!checkOrigin(req))return fail('Origine non autorisée.',403);
  const gate=await vgpAccess(req,true);if(gate.error)return gate.error;
  if(Number(req.headers.get('content-length')||0)>maxSize+65536)return fail('PDF limité à 15 Mo.',413);
  const form=await req.formData(),id=form.get('recordId'),file=form.get('file');
  if(typeof id!=='string'||!await vgpRecord(id))return fail('Enregistrez la fiche avant le dépôt.');
  if(!(file instanceof File)||!file.size||file.size>maxSize||file.name.length>200||!/\.pdf$/i.test(file.name))return fail('Choisissez un PDF de 15 Mo maximum.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return fail('Le contenu du fichier doit être un PDF.');
  const fileId=crypto.randomUUID(),key='vgp/'+id+'/'+fileId;
  await bucket().put(key,bytes);
  try{
   const result=await database().prepare('INSERT INTO vgp_files(id,record_id,name,size,author,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM vgp_files WHERE record_id=?)<50')
    .bind(fileId,id,file.name.replace(/[\r\n\x00]/g,''),file.size,gate.user!.displayName,new Date().toISOString(),id).run();
   if(!result.meta.changes){await bucket().delete(key);return fail('Cette fiche contient déjà 50 documents.')}
  }catch(error){await bucket().delete(key);throw error}
  return Response.json({id:fileId});
 }catch(error){console.error(error);return fail('Dépôt impossible. Vérifiez la liste avant de réessayer.',503)}
}
