import {bucket,database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {requireEpiRole} from '@/lib/epi-session';
import {epiCanRead,epiCanManage} from '@/lib/epi-access';
import {documentMime} from '@/lib/document-file';
export const runtime='nodejs';
const limit=10*1024*1024;
const validCode=(code:string)=>/^[A-Za-z0-9*_-]{4,80}$/.test(code);
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
type Sheet={object_key:string;name:string;size:number;version:string;author:string;updated_at:string};
const sheet=(code:string)=>database().prepare("SELECT s.* FROM epi_technical_sheets s JOIN epi_products p ON p.code=s.code WHERE s.code=? AND p.catalog_status<>'Supprimé'").bind(code).first<Sheet>();
export async function GET(req:Request){try{
 const gate=await requireEpiRole(req);if(gate.error)return gate.error;
 if(!await epiCanRead(gate.user!))return fail('Accès EPI non autorisé.',403);
 const params=new URL(req.url).searchParams,code=params.get('code')||'';if(!validCode(code))return fail('Référence invalide.');
 const row=await sheet(code);
 if(params.get('meta')==='1')return Response.json({sheet:row?{name:row.name,size:row.size,version:row.version,author:row.author,updatedAt:row.updated_at}:null},{headers:{'Cache-Control':'private, no-store'}});
 if(!row)return fail('Fiche technique introuvable.',404);
 const blob=await bucket().get(row.object_key);if(!blob)return fail('Fichier indisponible.',404);
 return new Response(blob.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`${params.get('download')==='1'?'attachment':'inline'}; filename="fiche-technique.pdf"; filename*=UTF-8''${encodeURIComponent(row.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){console.error(e);return fail('Consultation de la fiche technique impossible.',503)}}
export async function POST(req:Request){try{
 if(!checkOrigin(req))return fail('Requête non autorisée.',403);
 const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
 if(!await epiCanManage(gate.user!))return fail('Rôle gestionnaire EPI nécessaire.',403);
 const reader=req.body?.getReader();if(!reader)return fail('Choisissez un PDF.');
 const chunks:Uint8Array[]=[];let total=0;
 while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>limit+65536){await reader.cancel();return fail('Limite de 10 Mo par PDF.',413)}chunks.push(part.value)}
 const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
 const code=String(form.get('code')||''),expected=String(form.get('version')||''),file=form.get('file');
 if(!validCode(code)||!(file instanceof File)||!file.size||file.size>limit)return fail('Référence ou fichier invalide.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(documentMime(file.name,bytes)!=='application/pdf'||!new TextDecoder().decode(bytes.slice(-2048)).includes('%%EOF'))return fail('Choisissez un fichier PDF valide.');
 const db=database(),product=await db.prepare("SELECT code FROM epi_products WHERE code=? AND catalog_status<>'Supprimé'").bind(code).first();if(!product)return fail('EPI introuvable.',404);
 const old=await sheet(code);if((old?.version||'')!==expected)return fail('La fiche technique a changé. Rechargez avant de recommencer.',409);
 const version=crypto.randomUUID(),key='epi-documents/'+code+'/'+version+'.pdf',name=file.name.replace(/[\u0000-\u001f\u007f/\\]/g,'_').slice(-180),now=new Date().toISOString();
 await bucket().put(key,bytes);
 let changed=false;
 try{const result=old?await db.prepare("UPDATE epi_technical_sheets SET object_key=?,name=?,size=?,version=?,author=?,updated_at=? WHERE code=? AND version=? AND EXISTS(SELECT 1 FROM epi_products WHERE code=? AND catalog_status<>'Supprimé')").bind(key,name,file.size,version,gate.user!.displayName,now,code,expected,code).run():await db.prepare("INSERT OR IGNORE INTO epi_technical_sheets(code,object_key,name,size,version,author,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM epi_products WHERE code=? AND catalog_status<>'Supprimé')").bind(code,key,name,file.size,version,gate.user!.displayName,now,code).run();changed=!!result.meta.changes}catch(e){await bucket().delete(key);throw e}
 if(!changed){await bucket().delete(key);return fail('La fiche technique a changé. Rechargez avant de recommencer.',409)}
 if(old)await bucket().delete(old.object_key).catch(e=>console.error('EPI PDF cleanup',e));
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}catch(e){console.error(e);return fail('Dépôt de la fiche technique impossible.',503)}}
export async function DELETE(req:Request){try{
 if(!checkOrigin(req))return fail('Requête non autorisée.',403);
 const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
 if(!await epiCanManage(gate.user!))return fail('Rôle gestionnaire EPI nécessaire.',403);
 const body=await req.json() as {code?:string;version?:string};const code=String(body.code||'');if(!validCode(code))return fail('Référence invalide.');
 const old=await sheet(code);if(!old)return fail('Fiche technique introuvable.',404);if(old.version!==body.version)return fail('La fiche technique a changé. Rechargez avant de recommencer.',409);
 const result=await database().prepare('DELETE FROM epi_technical_sheets WHERE code=? AND version=?').bind(code,String(body.version||'')).run();
 if(!result.meta.changes)return fail('La fiche technique a changé. Rechargez avant de recommencer.',409);
 await bucket().delete(old.object_key).catch(e=>console.error('EPI PDF cleanup',e));return Response.json({ok:true});
}catch(e){console.error(e);return fail('Suppression de la fiche technique impossible.',503)}}
