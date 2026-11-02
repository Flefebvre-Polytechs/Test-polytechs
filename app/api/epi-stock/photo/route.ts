import sharp from 'sharp';
import {bucket,database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';

export const runtime='nodejs';
const limit=4*1024*1024;
const validCode=(code:string)=>/^[A-Za-z0-9*_-]{4,80}$/.test(code);
const fail=(message:string,status=400)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
type Photo={object_key:string;updated_at:string};

export async function GET(req:Request){try{
  const gate=await requireRole(req);if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse']))return fail('Accès QSSE nécessaire.',403);
  const code=new URL(req.url).searchParams.get('code')||'';if(!validCode(code))return fail('Référence invalide.');
  const photo=await database().prepare('SELECT object_key,updated_at FROM epi_photos WHERE code=?').bind(code).first<Photo>();
  if(!photo)return fail('Photo introuvable.',404);
  const blob=await bucket().get(photo.object_key);if(!blob)return fail('Photo indisponible.',404);
  return new Response(blob.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){console.error(e);return fail('Chargement de la photo impossible.',503)}}

export async function POST(req:Request){try{
  if(!checkOrigin(req))return fail('Requête non autorisée.',403);
  const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse'],true))return fail('Droit de modification QSSE nécessaire.',403);
  const reader=req.body?.getReader();if(!reader)return fail('Choisissez une photo.');
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>limit+65536){await reader.cancel();return fail('Limite : 4 Mo par photo.',413)}chunks.push(part.value)}
  const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
  const code=String(form.get('code')||''),file=form.get('file');
  if(!validCode(code)||!(file instanceof File)||!file.size||file.size>limit)return fail('Référence ou photo invalide.');
  const db=database();const product=await db.prepare('SELECT code FROM epi_products WHERE code=?').bind(code).first();if(!product)return fail('Référence inconnue.',404);
  let bytes:Buffer;
  try{const source=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:20_000_000,animated:false}),metadata=await source.metadata();if(!['jpeg','png','webp'].includes(metadata.format||''))return fail('Choisissez une image JPG, PNG ou WebP.');bytes=await source.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer()}catch{return fail('Image illisible ou trop grande.');}
  const key='epi/'+code+'/'+crypto.randomUUID()+'.jpg',old=await db.prepare('SELECT object_key,updated_at FROM epi_photos WHERE code=?').bind(code).first<Photo>();
  await bucket().put(key,bytes);
  try{await db.prepare('INSERT INTO epi_photos (code,object_key,author,updated_at) VALUES (?,?,?,?) ON CONFLICT(code) DO UPDATE SET object_key=excluded.object_key,author=excluded.author,updated_at=excluded.updated_at').bind(code,key,gate.user!.displayName,new Date().toISOString()).run()}catch(e){await bucket().delete(key);throw e}
  if(old)await bucket().delete(old.object_key).catch(e=>console.error('EPI old photo cleanup:',e));
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}catch(e){console.error(e);return fail('Ajout de la photo impossible.',503)}}

export async function DELETE(req:Request){try{
  if(!checkOrigin(req))return fail('Requête non autorisée.',403);
  const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse'],true))return fail('Droit de modification QSSE nécessaire.',403);
  const code=String((await req.json() as {code?:string}).code||'');if(!validCode(code))return fail('Référence invalide.');
  const db=database(),photo=await db.prepare('SELECT object_key,updated_at FROM epi_photos WHERE code=?').bind(code).first<Photo>();
  if(!photo)return fail('Photo introuvable.',404);
  await db.prepare('DELETE FROM epi_photos WHERE code=?').bind(code).run();
  await bucket().delete(photo.object_key).catch(e=>console.error('EPI photo cleanup:',e));
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}catch(e){console.error(e);return fail('Retrait de la photo impossible.',503)}}
