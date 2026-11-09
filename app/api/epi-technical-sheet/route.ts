import {database,bucket} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';
import {documentFileLimit,documentMime} from '@/lib/document-file';

const fail=(error:string,status=400)=>Response.json({error},{status});
const validCode=(code:string)=>/^[A-Za-z0-9*_-]{4,80}$/.test(code);
type Sheet={id:string;name:string;mime:string;size:number;author:string;created_at:string};
const key=(code:string,id:string)=>'epi/technical-sheets/'+code+'/'+id;

export async function GET(req:Request){
 try{
  const gate=await requireRole(req);if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse']))return fail('Accès QSSE nécessaire.',403);
  const q=new URL(req.url).searchParams,code=q.get('code')||'';
  if(!validCode(code))return fail('Référence invalide.');
  const sheet=await database().prepare('SELECT * FROM epi_technical_sheets WHERE code=?').bind(code).first<Sheet>();
  if(!sheet)return fail('Aucune fiche technique associée.',404);
  const file=await bucket().get(key(code,sheet.id));
  if(!file)return fail('Fiche technique indisponible.',404);
  const inline=q.get('preview')==='1'&&['application/pdf','image/jpeg','image/png'].includes(sheet.mime);
  return new Response(file.body,{headers:{
   'Content-Type':sheet.mime,'Content-Length':String(sheet.size),
   'Content-Disposition':(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(sheet.name),
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
   'Content-Security-Policy':"default-src 'none'; sandbox"
  }});
 }catch(e){console.error(e);return fail('Consultation de la fiche indisponible.',503)}
}

export async function POST(req:Request){
 try{
  if(!checkOrigin(req))return fail('Origine non autorisée.',403);
  const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse'],true))return fail('Modification QSSE non autorisée.',403);
  const db=database();
  if(req.headers.get('content-type')?.includes('application/json')){
   const body=await req.json() as Record<string,unknown>;
   const code=typeof body.code==='string'?body.code:'',id=typeof body.id==='string'?body.id:'';
   if(body.action!=='remove'||!validCode(code)||!/^[a-f0-9-]{36}$/i.test(id))return fail('Demande invalide.');
   const result=await db.prepare('DELETE FROM epi_technical_sheets WHERE code=? AND id=?').bind(code,id).run();
   if(!result.meta.changes)return fail('Fiche déjà modifiée. Rechargez.',409);
   try{await bucket().delete(key(code,id))}catch(e){console.error('Nettoyage fiche technique EPI',e)}
   return Response.json({removed:true});
  }
  if(Number(req.headers.get('content-length')||0)>documentFileLimit+65536)return fail('Limite : 15 Mo par fichier.',413);
  const form=await req.formData(),code=form.get('code'),previousId=form.get('previousId'),file=form.get('file');
  if(typeof code!=='string'||!validCode(code)||typeof previousId!=='string'||previousId.length>36
   ||!(file instanceof File)||!file.size||file.size>documentFileLimit||file.name.length>200)return fail('Référence ou fichier invalide (15 Mo maximum).');
  if(!await db.prepare('SELECT code FROM epi_products WHERE code=?').bind(code).first())return fail('Référence EPI inconnue.',404);
  const current=await db.prepare('SELECT id FROM epi_technical_sheets WHERE code=?').bind(code).first<{id:string}>();
  if((current?.id||'')!==previousId)return fail('La fiche technique a changé. Rechargez avant de réessayer.',409);
  const bytes=new Uint8Array(await file.arrayBuffer()),mime=documentMime(file.name,bytes);
  if(!mime)return fail('Formats acceptés : PDF, DOCX sans macros, JPG et PNG. Le fichier doit correspondre à son extension.');
  if(!['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'].includes(mime))return fail('Format de fiche technique non autorisé.');
  const id=crypto.randomUUID(),name=file.name.replace(/[\r\n\x00]/g,''),now=new Date().toISOString();
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  await bucket().put(key(code,id),bytes,{httpMetadata:{contentType:mime}});
  try{
   const result=await db.prepare(`INSERT INTO epi_technical_sheets (code,id,name,mime,size,sha256,author,created_at)
    SELECT ?,?,?,?,?,?,?,? WHERE COALESCE((SELECT id FROM epi_technical_sheets WHERE code=?),'')=?
    ON CONFLICT(code) DO UPDATE SET id=excluded.id,name=excluded.name,mime=excluded.mime,size=excluded.size,
    sha256=excluded.sha256,author=excluded.author,created_at=excluded.created_at
    WHERE epi_technical_sheets.id=?`)
    .bind(code,id,name,mime,file.size,sha256,gate.user!.displayName,now,code,previousId,previousId).run();
   if(!result.meta.changes){await bucket().delete(key(code,id));return fail('La fiche a changé entre-temps. Rechargez.',409)}
  }catch(e){await bucket().delete(key(code,id));throw e}
  if(current?.id){try{await bucket().delete(key(code,current.id))}catch(e){console.error('Nettoyage ancienne fiche EPI',e)}}
  return Response.json({ok:true,id});
 }catch(e){console.error(e);return fail('Enregistrement de la fiche technique impossible.',503)}
}
